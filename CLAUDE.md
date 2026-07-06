# FundScore Web — project guide

## What this is
FundScore.ai — a retail-investor web app answering one question per fund:
**"What are you actually getting for your fees vs. the fund's best passive alternative?"**
Evidence only — filed/observed data; never forecasts, never fabricated values.

Stack: Next.js 16 / React 19 RSC, Drizzle + Postgres (Supabase), Tailwind v4, recharts.

## Two-repo system
- **This repo** — UI + serving layer. Data layer: `src/lib/data/index.ts` (async, Promises).
  Schema: `src/lib/db/schema/` (barrel export). DB singleton: `src/lib/db/index.ts`.
- **fund_score** (`/Users/alexfrey/Projects/fund_score`) — Python/uv/Polars/DuckDB backend.
  Parquet lakehouse `data/{bronze,silver,gold,product}`. Orient there via `CLAUDE.md` →
  `docs/agent_context_map.md` → `docs/status/pipeline_status.md`.
- Data flows: gold/product panels → staging parquet → Postgres serving tables (TRUNCATE+COPY
  in one transaction). Never load serving from a branch missing another feature's emitters.

## Data integrity (non-negotiable)
- Never synthesize, impute, or default-fill data. Missing data surfaces as missing; fix at source.
- Coverage is a first-class, up-front metric: report populated %, split honest-missing vs
  recoverable-missing (spot-checked on the raw source). A large recoverable miss is a DEFECT.
- Every backend data step gets an adversarial `data-reviewer` checkpoint (atomic spot checks
  vs raw source, aggregate sanity, commensurability, label/basis provenance).
- After rebuilding any feature: run the `/check-data` protocol; FAIL blocks, WARNs go to the owner.

## Harness entry points (the feature pipeline)
Work state lives under `feature-pipeline/`:
`backlog.md` → `proposals/{pending,approved,rejected}/` → `specs/{queue,done}/` → shipped.

| Command | Use |
|---|---|
| `/triage` | Drain backlog: route items to fix-bug / fix-data / spec-story |
| `/fundscore-data:fix-bug`, `/fundscore-data:fix-data` | Lean single-issue loops (root cause, gates, codex review, commit) — from the shared plugin |
| `/critique-funds` | Capture pages, run the 5-critic panel → proposals |
| `/review-proposals` | Human triage of pending proposals |
| `/spec-approved` → `/review-specs` → `/implement-next` | Proposal → spec → implementation |

Agents: `.claude/agents/` (11 web-side personas) + the **fundscore-data plugin**
(`~/Projects/fundscore-harness`, single source of truth) providing `fundscore-data:data-reviewer`,
`:data-scientist`, `:backend-implementer` to both repos — edit those there, never re-create copies here.
Workflows: `.claude/workflows/` (5 orchestrations). Cross-vendor gate: codex-review.sh (P0/P1 block;
lives in the plugin at `plugins/fundscore-data/scripts/`, legacy copy in `.claude/scripts/`).
Codex-native skill mirror: `.agents/skills/fundscore-implement-spec/`.
Config: `feature-pipeline/config/page-types.json` (fund_score repo path, page types, targets).

## Model tiering policy
Rule: **reviewer ≥ implementer** — never verify data work with a cheaper model than produced it.
- **Inherit session model (Fable)**: main session, `data-reviewer`, `data-quality-critic` —
  adversarial verification is the last line of defense; do not tier it down.
- **Opus**: implementers (`backend-implementer`, `feature-implementer`), `spec-writer`,
  `narrative-critic`, `product-strategist`, `data-scientist`.
- **Sonnet**: bounded craft critics (`design`, `marketing`, `engineering`), `page-designer`,
  `spec-reviewer`, `prompt-reviewer`, artifact revise loops.
Pins live in agent frontmatter (`model:`) and workflow `agent()` opts. Specs may override the
implementer via `model:`/`effort:` frontmatter; gates always stay on the session model.

## Commands
- `npm run db:push` / `db:seed` / `db:studio` — schema push / synthetic seed / Drizzle Studio.
- Local dev needs Docker: `npx supabase start` (Postgres on 54322); `DATABASE_URL` in `.env.local`.
- Build gate before done: `npm run build && npm run lint`.
