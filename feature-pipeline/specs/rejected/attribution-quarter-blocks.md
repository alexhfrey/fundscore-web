---
id: attribution-quarter-blocks
title: V2: materialize quarterly Brinson member blocks for custom-window attribution drill-downs
status: queued
track: backend
repo: fund_score
depends_on: attribution-factor-path-serving, profile-v2-production-cutover
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-01
scope: global
model: opus
---

## Owner summary
Lets customers zoom the performance-attribution story into custom date windows ("what drove returns in 2023?") instead of one fixed multi-year window. A V2 enhancement — the per-quarter building blocks are already served; this adds the interactive composition.

## Goal
V2 enhancement for the Attribution Explorer: serve the **member drill-down layer** as per-quarter
Brinson-Fachler member contributions (stock / sector / theme), so a paid user can compose custom
quarter-aligned windows by summation and drill from a category into the members behind it.

This is **not required for the first production cutover of the current fund page design**. V1 can
ship with:
- the top waterfall / factor-path story served by `attribution-factor-path-serving`;
- the existing fixed-window `return_attribution` rows (`1Y` / `3Y` / `5Y`) as the related Brinson
  member lens;
- custom range controls disabled or removed until this V2 grid exists.

Today only fixed `1Y` / `3Y` / `5Y` trailing aggregates are served (`return_attribution` JSONB). The
quarterly sub-period effects are computed internally by `src/fundscore/product/return_attribution.py`
(v0.2) and then discarded when summing. This V2 spec materializes that quarter grid instead of
discarding it.

## V2 framing decision (2026-07-04)

The current `/preview/funds/[ticker]` Attribution Explorer intentionally pins the window and labels
custom sub-windows as unavailable. The production v2 page should not block on this member-block grid
unless the launch scope explicitly includes arbitrary attribution windows.

Launch sequencing:
1. **V1 production cutover:** ship the fund page dynamically with the existing fixed Brinson windows
   and the factor-path/top-split layer. No custom Brinson member windows.
2. **V2 Attribution Explorer:** add this spec's quarter blocks, turn on custom quarter-window member
   drill-downs, and replace the fixed `1Y` / `3Y` / `5Y` Brinson selector where appropriate.

Non-goals for V1:
- no fake sub-window recomputation from fixed-window aggregates;
- no client-side interpolation between `1Y` / `3Y` / `5Y`;
- no claim that Brinson members decompose the factor-path idiosyncratic row.

## Context
- `data/gold/return_attribution.parquet` is ~7.08M rows (~817/fund) of fixed-window aggregates.
- The engine already sums quarterly sub-period Brinson-Fachler effects arithmetically with a
  ±200 bps reconciliation gate — so quarter blocks summed over a standard window are
  **method-identical** to shipped rows (this is the acceptance criterion).
- Design decision (owner-approved plan, 2026-07-01): custom windows use **arithmetic summation of
  pre-computed quarter blocks, NOT Carino/GRAP linking** in v1. GRAP coefficients are
  window-dependent (blocks couldn't be pre-linked once), and a GRAP custom 3Y would disagree with
  the served arithmetic 3Y. The UI instead shows the composed total NEXT TO the true compounded NAV
  active return with an explicit "unexplained (compounding, intra-quarter trading, fees)" residual —
  the codebase's existing honest-residual pattern (`reconciliation_gap_bps`).
- **Owner decision (2026-07-01, after codex adversarial review of the design mock): the Brinson
  member layer and the factor-path "stock selection" figure are TWO LABELED LENSES, deliberately.**
  The factor-path idio (e.g. FCNTX −298 bps/yr) has no member decomposition in v1, and the Brinson
  stock tables (different method + window) must be framed as "how individual names did vs the
  baseline — its own method and window", never as a decomposition of the idio row. Do NOT add
  reconciliation logic between the two bases; do NOT present Brinson members as summing to the
  factor-path parent. (Per-stock idio attribution was considered and explicitly deferred.)

## Computation
For each (series_id, quarter, dimension ∈ {stock, sector, theme}):
- Emit per-member rows: `quarter_end, dimension, member_id, member_label, contribution_bps,
  fund_weight_avg, passive_weight_avg`.
- Cap at top-K (~10) members per (quarter, dimension) by |contribution| **plus an "other" residual
  bucket row** so per-quarter additivity is exact despite the cap.
- Carry the existing Gate-A coverage suppressions unchanged (`return_attribution_suppressions.parquet`
  logic applies to blocks identically — a suppressed fund/dimension serves no blocks, honestly).
- Also emit per-quarter `fund_ret_bps` / `passive_ret_bps` totals (for the residual line; shared
  contract with `attribution-factor-path-serving`).

## Output
- `data/gold/return_attribution_blocks.parquet` (~8.6K funds × ~20 quarters × 3 dims × ≤11 rows).
- Serving: **new serving table `fund_attribution_blocks`** (one row per series_id, JSONB payload),
  loaded via the same TRUNCATE/COPY pattern in `src/fundscore/serving/load.py` — deliberately NOT a
  new column on `fund_profile_facts`, to keep the hot row lean; the profile RSC fetches it only when
  rendering the Attribution section. New Drizzle table in `fundscore-web/src/lib/db/schema/serving.ts`.
- Gate: paid (mirrors the existing `active_return_attribution` paid sub-gate); free preview stays
  the existing `DetractorPreview` projector.

## Data-integrity guardrails
- Quarter blocks come from the SAME engine and inputs as the shipped aggregates — no parallel
  implementation that can drift.
- The "other" bucket is a computed residual, never an estimate; per-quarter member rows + other ==
  the quarter's dimension total exactly.
- Holdings-era honesty: blocks exist only where N-PORT holdings exist (2019-09 frontier; FCNTX grid
  is 2020-12-31 → 2025-09-30, 20 quarters). No pre-frontier blocks, ever.

## EDA questions
1. K sensitivity: at K=10, what fraction of |contribution| mass lands in "other" (p50/p95 across
   funds)? Pick the smallest K where "other" is typically small.
2. Payload size per fund at chosen K (target: tens of KB, not MB).

## Acceptance criteria (relational)
- For 5 spot-check funds (incl. FCNTX and one suppressed fund): summing a fund's quarter blocks over
  the trailing-3Y quarter set reproduces the shipped 3Y `return_attribution` member rows
  (same engine ⇒ equality within rounding, not tolerance-waved).
- Per-quarter additivity: Σ(member + other) == dimension total for every (fund, quarter, dimension).
- Suppressed funds serve no blocks; served payload == gold panel (spot-check).
- `/check-data` passes on the blocks panel (entity = series_id, date = quarter_end).

## Out of scope
- The factor/beta/macro top-split layer (separate spec `attribution-factor-path-serving`).
- GRAP/Carino linking (possible v2 server-side normalization; per-quarter returns kept so no
  re-ingest would be needed).
- The V1 production profile cutover. That cutover can keep fixed Brinson windows and leave custom
  member-window controls disabled/absent.
- The Explorer UI implementation (frontend; composes windows client-side over the served grid).

## Risks
- Serving size — bounded by top-K + "other" and the separate table.
- Member-label churn across quarters (tickers/themes renamed) — use stable `member_id`s from the
  existing attribution dimension tables; labels join at serve time.
