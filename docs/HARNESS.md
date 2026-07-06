# The FundScore AI Harness

This document explains what the harness is, why each part of it exists, and how the
pieces fit together. It's meant to be read start to finish — the mechanics near the end
only make sense once the reasoning earlier has landed.

## What we're actually building, and why it's hard

FundScore answers one question for a retail investor: *for the fees you pay this fund, what
are you actually getting versus its best passive alternative?* To answer that honestly we
take messy raw material — SEC filings, holdings disclosures, pricing feeds — and turn it
into confident, plain-language claims that a non-expert will act on with real money.

That framing creates two pressures that shape everything about the harness.

The first is that **wrong data is worse than no data**. If we can't compute a fund's fee gap,
we can say so. But if we show a number that's subtly wrong — a gross expense ratio labeled as
net, a holdings weight measured against the wrong baseline, a "closest passive match" that's
actually an inverse ETF — we've broken the one promise the product makes. And the failure is
quiet: the number looks plausible, it renders fine, nobody notices until trust is already
spent. Large language models make this worse, because their instinct is to be helpful and fill
gaps — to impute a missing value, to reconcile a surprising number into something reasonable.
That instinct is exactly the wrong one for this product.

The second is **surface area versus attention**. This is a full data product built largely by
one person with AI assistance: SEC ingestion, feature engineering, model development,
productionization, pipelines, serving, and the web UI on top. No single conversation — no
single context window — can hold that whole system. If the AI has to re-derive how the pipeline
works every session, or if reviewing one feature drags the entire codebase into the chat, the
work grinds to a halt.

Almost every design choice in the harness is an answer to one of those two pressures: *don't
let the AI ship wrong data*, and *don't let the work exceed the attention available to it*. The
rest of this document is those answers, in order.

## The two repositories, and the direction data flows

The work lives in two repos because it's really two different disciplines. **fund_score**
(`~/Projects/fund_score`) is the Python/Polars/DuckDB backend — it ingests filings and builds
the data. **fundscore-web** (`~/Projects/fundscore-web`) is the Next.js product — it serves the
data and renders the pages. (There's a third, smaller repo we'll get to.)

Data moves in one direction, and holding that picture in your head explains most of the gates
later. Raw filings land in a parquet lakehouse (`bronze` → `silver` → `gold` → `product`),
where each layer is more refined than the last. The finished `gold`/`product` panels are
assembled into serving tables and loaded into Postgres, which the web app reads to render a
fund's page. So a single number on a page has a **provenance chain**: rendered value ← Postgres
row ← staging parquet ← gold panel ← raw filing. When something looks wrong, you walk that chain
backwards to the source — and most of the review machinery exists to check that each hop is
faithful.

## First principle: the AI is not trusted on data, so verification is a separate adversarial step

The single most important idea in the harness is that **generating data and trusting data are
different actions, done by different agents, and the second is adversarial.** An agent that
builds a feature is motivated to finish; it is the wrong entity to certify its own output. So
every backend data step is followed by a `data-reviewer` — an agent whose entire job is to
assume the output is wrong until the evidence says otherwise.

Concretely, that reviewer doesn't glance at the result and nod. It pulls individual records and
compares them to the raw filing by hand. It treats a surprising value as a *defect to be
explained*, not a curiosity — because a convenient reconciliation ("oh, that's probably fine
because…") is exactly how a real bug survives review. It checks that comparisons are
commensurable: both sides of a "vs" measured against the same baseline, as-of date, and units,
because a perfectly-computed number against the wrong benchmark is a false signal that traces
cleanly to its source. And it leads with **coverage**, not precision — what fraction of the
target universe actually got a value, and of the part that didn't, how much is honestly missing
(no source data) versus recoverably missing (the data is there and our code failed to extract
it). High precision on a thin slice is not success; silent under-extraction is a defect on par
with fabrication.

This is why the harness is so insistent about *never* fabricating, imputing, or default-filling
data. A missing value must read as missing and be fixed at its source. That rule isn't
fussiness — it's the direct consequence of "wrong data is worse than no data."

Two more layers reinforce the same principle. First, **`/check-data`** is a repeatable protocol
that runs aggregate diagnostics and atomic spot checks over a feature and writes a report; in
fund_score, `make check` runs all the registered checks at once and fails loudly. Second, and
independently, a **cross-vendor codex gate**: before any change is committed, an *OpenAI* model
reviews the diff. The point of using a different vendor's model is that it fails differently
than a Claude agent does — an independent adversary catches what a same-family reviewer's blind
spots would miss. Its findings are graded, and anything it marks as a must-fix blocks the commit
until resolved.

Because that gate re-runs on every fix-and-recheck round, it runs at *medium* reasoning during
iteration to stay cheap, and then finishes with a single *high*-reasoning pass — deep,
thorough — that is the one that actually gates the commit. You pay for expensive reasoning
exactly once, at the moment it matters, and you can force it from the start (`--high`) for a
change you already know is subtle.

Finally, some gates are made mechanical rather than left to discipline, because a rule that
depends on remembering to follow it will eventually be skipped under pressure. In fund_score a
git hook physically blocks a commit that touches data-producing code unless a fresh check report
exists, and another re-injects the data-integrity rules into the session after the context gets
compacted — the exact moment prose reminders tend to get dropped.

## First principle: context is scarce, so heavy work is pushed out of the main window

The operator's conversation with the AI is the scarce resource. If exploring a subsystem or
reviewing a feature pulls thousands of lines into that conversation, there's no room left to
think. So the harness pushes heavy work *out* of the main window in two forms.

**Subagents** handle anything where you want a conclusion but not the raw material — search a
subsystem, verify a claim, read across many files. The subagent burns its own context on the
mess and hands back a short answer. The main conversation stays clean.

**Workflows** are the heavier tool, and they're worth understanding properly because they're the
backbone of the pipeline. A workflow is a small JavaScript program that orchestrates many
subagents — fanning them out, piping one stage into the next, collecting structured results. The
crucial property is *where the work lives*: the orchestration plan and all the intermediate
results sit in the script's variables, running in the background, and only the final answer comes
back to you. A five-agent critique of a fund page, or a full backend build with a reviewer
checkpoint after every step, executes without ever cluttering your session. Because the plan is
code rather than a chat transcript, a run is also repeatable and resumable — you can re-launch it
and the steps that already succeeded return instantly while only the changed ones re-run.

The rule of thumb: reach for a subagent when you want one conclusion, and a workflow when you
want a *structured, multi-stage process* run to completion — especially one with fan-out or with
gates between stages.

## First principle: match the model to the job, and never review with a weaker one

Not every step needs the frontier model, and using it everywhere is just waste. The harness tiers
the models by where judgment actually cascades. The heaviest model (the session default, Fable)
runs the highest-stakes work: the main planning conversation and — critically — the adversarial
data reviewers. Implementation and idea-generation run on Opus, a notch down, because a mistake
there gets caught by the gates downstream. Bounded, one-shot craft review — is this page's layout
clean, is this spec internally consistent — runs on Sonnet.

The one rule that must never bend is **reviewer ≥ implementer**. A weak checker of strong work is
worse than no checker, because it manufactures false confidence: it waves through work it wasn't
capable of scrutinizing, and now you *believe* it was checked. So the gate agents are never tiered
below the work they judge. (This is also the subtlety in the backend workflow's model settings: it
holds cleanly when you drive the workflow from a Fable session, and inverts if you launch it from a
weaker one — a known tradeoff noted in project memory.)

## First principle: the repo teaches the agent, so no one re-derives the system

A solo operator can't afford to re-explain the codebase every session, so the repos are written to
orient an agent quickly, and to reveal detail progressively rather than all at once. Each repo has
a short standing brief — `CLAUDE.md` in the web repo, `AGENTS.md` in fund_score — that a fresh
session reads first: the mission, the non-negotiable data rules, and where to look next. From
there, fund_score's `docs/agent_context_map.md` routes you to the right code and docs for a given
task, and before touching a subsystem you read its **context card** in `docs/context/` — a
~30-line note capturing what that subsystem does, how to change it, what breaks it, and what
depends on it (the tribal knowledge that isn't obvious from the code). Persistent memory carries
the hard-won lessons across sessions so the same mistake isn't rediscovered twice. The theme is
progressive disclosure: load the smallest context that lets you act, and pull more only when the
task demands it.

## Why there's a third repo: one source of truth for shared machinery

Both repos need the same data-integrity agents and the same fix loops. If those lived as copies in
each repo, they'd drift, and drift in a safety mechanism is how you end up with two subtly
different definitions of "reviewed." So the shared machinery lives once, in a small third repo —
**fundscore-harness** — packaged as a Claude Code *plugin* that both repos install. The data
reviewer, the data scientist, the backend implementer, the `fix-bug`/`fix-data` loops, and the
codex gate script all live there and only there. Edit them in that repo, and both projects pick up
the change.

Because plugin components are namespaced, they're invoked as `fundscore-data:...` — the fix loops
are `/fundscore-data:fix-bug` and `/fundscore-data:fix-data`, the agents are
`fundscore-data:data-reviewer` and so on. Not everything is shared: the pre-commit data hooks are
specific to fund_score's paths, the web-page critique workflows are specific to the product repo,
and the `/check-data` protocol is general enough to live at the user level across all projects.
Only what genuinely must stay identical between the two repos went into the plugin.

## How the work actually flows

With those principles in place, the day-to-day pipeline is easy to follow, because it's just those
ideas arranged into a line. Everything that needs doing lands in one backlog
(`feature-pipeline/backlog.md`). Running `/triage` takes the top item and routes it by type. A
bug or a data defect goes straight into a lean fix loop — `/fundscore-data:fix-bug` or
`/fundscore-data:fix-data` — which reproduces or root-causes the problem, fixes it *at the
source*, and won't call itself done until the reviewer and the codex gate both sign off and the
change is committed.

A larger idea takes the longer road, and this is where the product gets its new features. You
start from the product itself: `/critique-funds` captures real fund pages and runs a panel of
critics over them — a skeptical retail investor, a designer, an engineer, a data-quality auditor —
each looking for what's missing, wrong, or unconvincing. Their findings are synthesized into a
small set of **proposals**. You approve or reject those (`/review-proposals`); approved ones become
implementation-ready **specs** (`/spec-approved`), which get reviewed for soundness
(`/review-specs`) and then implemented (`/implement-next`). A frontend spec goes to a frontend
implementer; a backend spec goes through the reviewed assembly line — build a sample, check it,
build it fully, check it, wire it into serving, check it, run the data gate, and only then commit.
The through-line from "something feels off on this page" to "a verified feature ships" is a single
managed path, gated at every step.

## Setting a workflow going

You never run a workflow by hand — you name an *intent*, and the harness assembles the agents
behind it. In practice that means typing the slash command that wraps the workflow, or just asking
in plain language ("run the critique workflow on AAPL and MSFT"). The command's job is to work out
the arguments the workflow needs — which repos, which spec, which tickers — and then launch it.

Five workflows carry the pipeline, and each has a natural front door:

- **Critique a set of fund pages into proposals** — `critique-and-propose`, via `/critique-funds`.
- **Build a backend spec through the reviewed assembly line** — `implement-backend-spec`, via
  `/implement-next` on a backend spec.
- **Review queued specs (or the harness's own prompt files)** — `review-artifacts`, via
  `/review-specs` and `/review-prompts`.
- **Revise the specs a review flagged, then re-check them** — `revise-specs`, inside `/review-specs`.
- **Turn approved proposals into queued specs** — `spec-out-approved`, via `/spec-approved`.

While one runs, `/workflows` shows a live tree of its phases and agents; the run is detached, so you
get a notification when it finishes rather than waiting on it. If a run is interrupted or you edit
the workflow, you can relaunch it and the steps that already completed return from cache while only
the new work executes.

## Where to look

- **fundscore-web** — start at `CLAUDE.md`; this document is the fuller companion to it.
- **fund_score** — start at `AGENTS.md`, then `docs/agent_context_map.md`; read a subsystem's
  `docs/context/` card before you change it.
- **fundscore-harness** — its `README.md` explains the plugin and how to update it.

If you remember nothing else: *the AI is not trusted on data, so verification is a separate
adversarial step; and context is scarce, so heavy work runs out of sight in subagents and
workflows.* Everything else is those two ideas, worked out in detail.
