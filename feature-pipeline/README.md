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
/critique-funds     5 critics + product-strategist   → proposals/pending/      (Phase 1, automated)
   ▼ you: /review-proposals          → approved/                               (the human gate)
/spec-approved      spec-writer                       → specs/queue/  (track-tagged)
   ▼ you: /review-specs   (decision-altitude dashboard; revise loop auto-fixes the rest)
/implement-next     routes by track:                                           (Phase 3)
        frontend → feature-implementer → npm build+lint → branch
        backend  → implement-backend-spec assembly line
                   (EDA → implement → data-reviewer ✋ each step → /check-data → commit; halts on FAIL)
```

## Commands (`.claude/commands/`)

| Command | Phase | What it does |
|---|---|---|
| `/critique-funds [tickers]` | 1 | Capture the pages + run the critic panel → writes `proposals/pending/`. |
| `/review-proposals` | gate | Triage pending proposals: keep → `approved/`, reject → `rejected/`. |
| `/spec-approved` | 2 | Turn approved proposals into specs in `specs/queue/`, classified by track. |
| `/review-specs` | 2 | Decision-altitude review dashboard: auto-fix mechanical+engineering, surface only product decisions. |
| `/implement-next` | 3 | Implement the next ready spec, routing frontend vs backend. `/loop /implement-next` drains the queue. |
| `/review-prompts` | meta | Audit the machinery itself (agent/workflow/command prompts) at decision altitude. |

## Agents (`.claude/agents/`)

- **Critics** (Phase 1, return structured findings + feature ideas): `marketing-critic` · `design-critic`
  · `engineering-critic` · `data-quality-critic` (cross-repo provenance audit) · `narrative-critic`.
- **Pipeline**: `product-strategist` (critiques → deduped proposals) · `spec-writer` (frontend / backend /
  full-stack, grounded in real code) · `feature-implementer` (frontend; gates on build+lint, commits on a branch).
- **Backend reviewed track**: `backend-implementer` (data work in fund_score, segmented) · `data-reviewer`
  (adversarial gate after every step) · `data-scientist` (EDA + self-contained HTML plot reports).
- **Reviewers** (decision altitude): `spec-reviewer` · `prompt-reviewer`.

## Workflows (`.claude/workflows/`)

- `critique-and-propose.js` — fan out critics per page → PM synthesis → dedup → write proposals.
- `spec-out-approved.js` — approved proposals → specs.
- `revise-specs.js` — revise flagged specs + re-review.
- `review-artifacts.js` — **decision altitude**: review specs or prompts, auto-resolve mechanical +
  engineering issues, surface only product **decisions** (+ a plain-English brief and the artifact inline).
- `implement-backend-spec.js` — the **reviewed assembly line** for backend data specs; halts on any FAIL.

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
```

## How reviews work — "decision altitude"

Reviewers sort every finding into **mechanical** (auto-fixed), **engineering** (the loop auto-resolves),
or **decision** (the only thing surfaced to you — a product/framing/scope/data-truth call, in plain
language with a recommendation). You review a brief + your decisions + the artifact inline, rendered to a
browser dashboard — **not** a finding dump. Reports are always **opened in the browser + served at a
localhost URL**, never handed over as a bare file path.

## Data-integrity guardrails

- **No synthetic data, ever.** Missing reads as missing; the verification gate (sample → atomic +
  aggregate checks) runs before any scale build; `/check-data` after rebuilds.
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

## Extending to new page types

Add an entry to `config/page-types.json` `page_types` (route template, which critics apply, default
targets, source files, ground-truth paths). The capture, workflows, and commands are page-type-generic.
