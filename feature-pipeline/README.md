# Feature-improvement pipeline (fundscore-web)

A multi-agent assembly line that turns "look at the website" → reviewed feature ideas → specs →
shipped code, with **human gates** and **data-integrity guardrails** at every step. Built across this
repo's `.claude/` (agents, workflows, commands), `feature-pipeline/` (artifacts), and
`scripts/critique/` (tooling). The data-quality / backend agents reach into the `fund_score` repo
(`/Users/alexfrey/Projects/fund_score`) by absolute path for ground truth.

## Run it from a fundscore-web session

Open Claude Code rooted in **this repo** — custom agents and slash-commands resolve from `.claude/`
here, and the implementers need it as cwd for `npm`. Have the **dev server** (`npm run dev`, :3000) and
**local Postgres** up — pages and captures read `fund_profile_facts`.

## The flow — 3 phases + a human gate

```
/critique-funds     4 critics + product-strategist   → proposals/pending/      (Phase 1, automated;
                    canonicality precheck first — never review pages whose headline numbers are stale)
   ▼ you: /review-proposals          → approved/                               (the human gate)
/spec-approved      spec-writer                       → specs/queue/  (track-tagged, just-in-time:
                    soft cap ~3 unstarted specs — queued specs decay as code moves)
   ▼ you: /review-specs   (decision-altitude dashboard; revise loop auto-fixes the rest)
/implement-next     routes by lane:                                            (Phase 3)
        lean     → main session direct edit → targeted verify → codex gate
        standard → feature-implementer → npm build+lint → codex gate → branch
        reviewed → implement-backend-spec assembly line
                   (EDA → implement → data-reviewer ✋ each step → final data gate
                    [served==gold + /check-data, one combined pass] → codex-gated commit;
                    halts on FAIL, fails closed — no codex pass + SHA, no done)
```

## Commands (`.claude/commands/`)

| Command | Phase | What it does |
|---|---|---|
| `/critique-funds [tickers]` | 1 | Capture the pages + run the critic panel → writes `proposals/pending/`. |
| `/review-proposals` | gate | Triage pending proposals: keep → `approved/`, reject → `rejected/`. |
| `/spec-approved` | 2 | Turn approved proposals into specs in `specs/queue/`, classified by track and lane. |
| `/review-specs` | 2 | Decision-altitude review dashboard: auto-fix mechanical+engineering, surface only product decisions. |
| `/implement-next` | 3 | Implement the next ready spec, routing by `lane: lean|standard|reviewed`. `/loop /implement-next` drains the queue. |
| `/review-prompts` | meta | Audit the machinery itself (agent/workflow/command prompts) at decision altitude. |

## Implementation lanes

Specs may carry `lane: lean`, `lane: standard`, or `lane: reviewed` in frontmatter.

- **Lean** — tiny, localized non-data work with a concrete acceptance check. The main session implements
  directly, runs targeted verification, and uses a risk-sized codex gate. It must not touch `fund_score`
  feature data, serving-fact semantics, financial calculations, schema/data migrations, or cross-repo
  contracts.
- **Standard** — normal frontend/product specs over existing served data/contracts. One implementer agent,
  build/lint/tests, and a high-reasoning codex sign-off before done.
- **Reviewed** — backend data, serving semantics, financial calculations, migrations, cross-repo/full-stack
  contracts, or ambiguous product/data-truth work. This keeps the full assembly line and `/check-data` gates.

If `lane` is absent, `/implement-next` infers conservatively: frontend specs default to `standard`; backend,
full-stack, `fund_score`, data/serving, financial, schema, and cross-repo specs default to `reviewed`.

## Agents (`.claude/agents/`)

- **Critics** (Phase 1, return structured findings + feature ideas): `design-critic` ·
  `engineering-critic` · `data-quality-critic` (cross-repo provenance audit) · `narrative-critic`
  (retail lens + the promise/differentiation mandate — absorbed the former marketing-critic).
- **Pipeline**: `product-strategist` (critiques → deduped proposals; on ≤2-page runs the per-page
  Role-A pass is skipped and Role B merges raw critiques directly) · `spec-writer` (frontend / backend /
  full-stack, grounded in real code; flags redesign collisions) · `feature-implementer` (frontend; gates
  on build+lint, commits on a branch).
- **Backend reviewed track**: `backend-implementer` (data work in fund_score, segmented) · `data-reviewer`
  (adversarial gate after every step) · `data-scientist` (EDA + self-contained HTML plot reports).
- **Reviewer** (decision altitude): `artifact-reviewer` — one persona for both specs and machinery
  (merged the former spec-reviewer + prompt-reviewer).

## Workflows (`.claude/workflows/`)

- `critique-and-propose.js` — fan out critics per page → PM synthesis → dedup → write proposals.
- `spec-out-approved.js` — approved proposals → specs.
- `revise-specs.js` — revise flagged specs + re-review.
- `review-artifacts.js` — **decision altitude**: review specs or prompts, auto-resolve mechanical +
  engineering issues, surface only product **decisions** (+ a plain-English brief and the artifact inline).
- `implement-backend-spec.js` — the **reviewed assembly line** for backend data specs; halts on any
  FAIL and **fails closed**: the codex gate is enforced inside its finalize stage (no clean pass +
  commit SHA → the run returns `stopped`, never `done`; a killed finalize also returns `stopped`).

## Tooling (`scripts/critique/`)

- `capture.mjs` — Playwright: a page → desktop + mobile screenshots, visible text, source list, served facts.
- `render-review.mjs` — review result → decision-brief HTML dashboard.
- `render-md.mjs` — any markdown (specs, design docs) → self-contained HTML.

## Directory layout (`feature-pipeline/`)

```
config/page-types.json     page-type → route, critics, default targets, source files, ground-truth paths
captures/<slug>/           per-page capture bundle (gitignored)
proposals/{pending,approved,rejected}/   the review inbox
specs/{queue,done}/        the build queue
reviews/                   review/decision HTML reports (gitignored)
backlog.md                 the operational intake list (## Done keeps only the 3 newest entries)
backlog-archive.md         full changelog of shipped Done entries (newest first)
```

## How reviews work — "decision altitude"

Reviewers sort every finding into **mechanical** (auto-fixed), **engineering** (the loop auto-resolves),
or **decision** (the only thing surfaced to you — a product/framing/scope/data-truth call, in plain
language with a recommendation). You review a brief + your decisions + the artifact inline, rendered to a
browser dashboard — **not** a finding dump. Reports are always **opened in the browser + served at a
localhost URL**, never handed over as a bare file path.

**Canonicality precedes review.** Before any multi-round adversarial review of a page, mock, or
dossier, verify its headline numbers against the canonical gold sources (`config/page-types.json`
`ground_truth`) — a review loop that certifies internally-consistent-but-wrong data is pure waste
(one mock loop burned ~450K tokens across two rounds validating a fee that was ~2× off).

## Queue discipline — spec just-in-time

Speccing is cheap; **spec inventory is not**. A queued spec decays as the code moves under it, and a
deep queue invites building against components another queued item is about to replace (two
fully-worked specs — one already implemented — were orphaned by the v2 redesign; a 2026-07-03 audit
found 1 of 17 queued specs implemented). Soft rules, enforced as nudges (never hard gates):
- `/spec-approved` defers proposals past ~3 unstarted specs in `queue/` (approved proposals keep —
  they don't decay the way grounded specs do).
- `/spec-story` reports queue depth when it specs past the cap.
- `spec-writer` flags redesign collisions (`at_risk: superseded-by <slug>` frontmatter).
- Don't spec against a component an in-flight redesign is replacing; sequence behind it instead.

## Data-integrity guardrails

- **No synthetic data, ever.** Missing reads as missing; the verification gate (sample → atomic +
  aggregate checks) runs before any scale build; `/check-data` after rebuilds.
- **Lean is forbidden for data truth.** Any change that can alter or misstate a fund fact, generated feature,
  source provenance, or served financial calculation uses the reviewed lane, regardless of how small the code
  diff looks.
- **Commensurability + fault-first + "things that look off"** — baked into `data-reviewer`,
  `data-quality-critic`, and the global `/check-data` skill: any two compared quantities must share
  baseline / as-of / window / population / units; treat contradictions and surprises as defects to
  root-cause, not puzzles to reconcile. ("Traces to source" is necessary, not sufficient.)
- The **reviewed backend assembly line halts on any data-reviewer FAIL**.
- **Verify "done" independently** — the assembly line can over-report a passing status; trust the data,
  not the headline.

## Conventions & gotchas (for maintainers)

- **Personas are read from the `.md` files by absolute path** at runtime (not bound to a custom
  `agentType`) — so workflows are portable and the `.md` is the single source of truth.
- **Workflow `args` arrive as a JSON string** — every script does
  `const A = typeof args === 'string' ? JSON.parse(args) : (args || {})`.
- **Frontend** work happens in fundscore-web; **backend data** work in fund_score (the assembly line,
  autonomous with hard gates). Custom `agentType` only resolves in its own repo's session — that's why
  the workflows read personas by path instead.
- **Hybrid autonomy** — auto-apply obvious/mechanical fixes; flag nuanced/judgment calls.
- **Worktrees + branches** — a PreToolUse branch-guard hook (harness plugin `branch-guard.sh`,
  registered in both repos) blocks `git commit` on master/main: one worktree + one feature branch
  per committing session (`new-worktree.sh <slug>` sets one up, symlinking gitignored shared state).
  Git isolates code only — the fund_score lakehouse stays one shared store; reviewed data builds
  stay serialized in the canonical checkout. `SKIP_BRANCH_GUARD=1` overrides deliberately.

## Extending to new page types

Add an entry to `config/page-types.json` `page_types` (route template, which critics apply, default
targets, source files, ground-truth paths). The capture, workflows, and commands are page-type-generic.
