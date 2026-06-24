# Feature-critique pipeline

A standing system that critiques fundscore-web pages, turns the critiques into reviewable feature
proposals, and — once you approve them — specs and implements them. It spans two repos:
**fundscore-web** (this repo: UI + serving table) and **fund_score** (the data backend).

Run the pipeline from a Claude Code session rooted in **this repo** (fundscore-web): the custom
agents and slash-commands resolve from `.claude/` here, and the implementers need this repo as the
working dir. The data-quality / backend agents reach into fund_score by absolute path.

## The flow

```
Phase 1  CRITIQUE & PROPOSE  (automated)
  capture page  →  5 critics  →  product-strategist  →  proposals/pending/*.md
                                                          │
Phase 2  HUMAN GATE  (you)  ◄─────────────────────────────┘
  /review-proposals  →  approved/  or  rejected/
                          │
Phase 3  SPEC & IMPLEMENT  (automated)
  spec-writer  →  specs/queue/*.md  →  /implement-next routes by track:
        track: frontend → feature-implementer  → build+lint → branch → done/
        track: backend  → implement-backend-spec workflow (reviewed assembly line) → done/
```

## Commands (run in order)

| Command | What it does |
|---|---|
| `/critique-funds [TICKER ...]` | Capture the fund pages + run the critic panel → writes `proposals/pending/`. Defaults to the tickers in `config/page-types.json`. |
| `/review-proposals` | Walk through pending proposals; keep → `approved/`, reject → `rejected/`. (Or just move files yourself.) |
| `/spec-approved` | Turn approved proposals into specs in `specs/queue/` (classified frontend / backend / full-stack). |
| `/implement-next` | Implement the next ready spec, routing by track. `/loop /implement-next` drains the queue. |

## Agents (`.claude/agents/`)

**Critics** (Phase 1) — each returns structured findings + feature ideas:
- `marketing-critic` — does the page deliver the fee-vs-passive promise, differentiated, retail-first?
- `design-critic` — visual craft, hierarchy, mobile, a11y (reads desktop + mobile screenshots).
- `engineering-critic` — source review: correctness, tier-gating integrity, perf, states.
- `data-quality-critic` — diffs every displayed number across the provenance chain (page → Postgres
  → staging parquet → gold panels in fund_score) + external web sanity checks.
- `narrative-critic` — "what did I actually learn, is it true, what's missing?" — the feature-idea engine.

**Pipeline:**
- `product-strategist` — synthesizes critiques → a small deduped set of proposals; writes the inbox.
- `spec-writer` — approved proposal → implementation spec(s), classified by track.
- `feature-implementer` — implements a **frontend** spec; gates on `npm run build` + `lint`; commits on a branch.

**Backend data track** (for `track: backend` specs, in fund_score):
- `backend-implementer` — implements one segment of a data spec (sample → full → serving → commit).
- `data-reviewer` — adversarially verifies the output **after every intermediate step** (atomic spot
  checks vs raw source, aggregate sanity, statistical coherence, no synthetic data). Any blocking
  issue = FAIL = the assembly line stops.
- `data-scientist` — emits self-contained **HTML plot reports** to `fund_score/reports/feature_pipeline/`
  for human review: pre-build EDA (feasibility) and post-build output verification.

The backend workflow `implement-backend-spec.js` runs these as a reviewed assembly line:
`EDA plots → implement-sample → review ✋ → full build → review ✋ + output plots → serving rebuild →
review ✋ (served == gold) → /check-data → commit`. It is **fully autonomous but halts on any FAIL**.

## Directory layout

```
config/page-types.json     page-type → route, critics, default tickers, source files, ground-truth paths
captures/<slug>/           per-page capture bundle (gitignored): screenshot[-mobile].png, text.txt,
                           served_facts.json, sources.json, meta.json
proposals/{pending,approved,rejected}/   narrative feature proposals (the review inbox)
specs/{queue,done}/        implementation specs (the build queue)
```

## Extending to other page types

Add an entry to `config/page-types.json` `page_types` (route template, which critics apply, default
targets, source files, ground-truth paths). v0 ships `fund_profile` only. Everything else (capture,
workflow, commands) is page-type-generic and reads the config.

## Maintainer notes

- **Capture needs the dev server + local Postgres up.** `npm run dev` (:3000); the page reads the
  `fund_profile_facts` table.
- **Workflow `args` arrive as a JSON string**, not a parsed object — every workflow script does
  `const A = typeof args === 'string' ? JSON.parse(args) : (args || {})`. Keep that when editing.
- **Personas are read from the `.md` files by absolute path** at runtime (not bound to a custom
  `agentType`), so the workflows are portable and the `.md` files are the single source of truth —
  edit one file, both the workflow and interactive `/agents` use pick it up.
- **Data integrity is sacred.** The backend track never synthesizes/imputes data; missing reads as
  missing; every intermediate output is reviewed before it propagates.
