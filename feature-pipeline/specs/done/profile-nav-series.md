---
id: profile-nav-series
title: Serve monthly growth-of-$1000 series (fund vs passive blend, matched windows) + after-fee period table
status: done
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-01
scope: global
model: opus
---

## Goal
Serve the Historical Performance section of the profile redesign: a monthly growth-of-$1000 series
for the fund AND its passive alternative on a **matched window**, a per-period (1Y/3Y/5Y/SI)
fund-vs-passive **after-fee** annualized-return table, and a beta-adjusted variant. This is
**serving integration, not new computation** — the NAV series already exist in gold:
- `data/gold/fund_daily_adj_close.parquet` (~118M rows, daily adjusted fund NAV)
- `data/gold/passive_alt_daily_nav.parquet` (~71M rows; `ticker, date, fund_nav, benchmark_nav` —
  the L2-blend passive NAV is already reconstructed as a column)

Today the web receives only five scalar period returns (`performance.return_periods`) with no
passive pairing (deliberately suppressed — the served passive figures were on a different window).
This spec fixes that at the source by pairing both legs on the same grid.

## Context
- The four-section story's Performance section ships fund-only returns because pairing was
  dishonest on mismatched windows (see commit 252546e rationale). The redesign's growth chart and
  after-fee table need a properly matched pair.
- A real FCNTX vs IWF monthly growth series already exists as design mock data
  (`fundscore-web/feature-pipeline/captures/fund_profile__FCNTX/_mock_data_v4.json → growth_10k`,
  216 monthly points from Tiingo adjusted closes) — proof of feasibility, now productionize it.
- `value_score.parquet` already carries per-fund `beta` and `passive_alt_label` (v0.3) for the
  beta-adjusted variant and the display label.

## Computation
For each series_id with a passive blend (join key exists in `passive_alt_daily_nav.parquet`):
1. Month-end downsample both `fund_nav` and `benchmark_nav`; restrict to the **common window**
   (first month where BOTH legs exist → last common month). Both legs normalized to 1000 at the
   common start month. Adjusted NAV is after-fee by construction (fees accrue inside NAV).
2. Beta-adjusted passive leg: growth of `1000 × Π(1 + β·r_passive_m)` with the single full-history
   `β` from `value_score.parquet` (no new regression; if the fund has no value_score row, omit the
   beta-adjusted leg — do not default β to 1).
3. Period table for 1Y/3Y/5Y/SI (SI = common window start): annualized fund return, annualized
   passive return, `diff_bps`, `beta_adj_diff_bps` — all computed from the SAME monthly grid.
   Suppress any period longer than the common window (no partial-window extrapolation).

## Output
- `data/gold/profile_nav_series.parquet`: `series_id, month_end, fund_growth, passive_growth,
  beta_adj_passive_growth (nullable), method_version` (+ a small per-series summary table or
  embedded period rows — implementer's choice, but the period table must be derived from this same
  panel, not recomputed elsewhere).
- Serving: new `nav_series` JSONB section in `src/fundscore/serving/fact_assembler.py`:
  `{passive_label, series_start, as_of, points: [{t, fund, passive, beta_adj_passive?}],
  period_table: [{period, fund_ann_pct, passive_ann_pct, diff_bps, beta_adj_diff_bps}],
  method_version}`. ~200–450 monthly points × 3 floats ≈ 10–25 KB — acceptable inside the hot row.
- Drizzle: add `navSeries` JSONB column in `fundscore-web/src/lib/db/schema/serving.ts`; gates
  entry `nav_series` (proposed: fund-only chart public; vs-passive table + beta-adjusted paid, one
  free proof point like "3Y: −40 bps/yr vs IWF after fees" via `PREVIEW_PROJECTORS`).

## Data-integrity guardrails
- **Matched windows are the point.** Both legs share one grid, one start, one normalization. Never
  pair a fund return with a passive return from a different window (root cause of the old
  suppression).
- No synthetic backfill: months missing in either leg truncate the common window; funds with no
  passive blend serve `nav_series: null` (honest absence), not a market-index substitute.
- Coverage is a headline metric: report the fraction of the real EQ serving universe (5,799 series
  in `serving_facts_staging.parquet` — the spec's earlier ~8,656 figure was stale) with a non-null
  `nav_series`, split honest-missing (no passive blend / too-short history) vs recoverable-missing,
  BEFORE the full build (pre-build EDA on a sample). REALIZED (2026-07-04): gold panel serves 9,044
  series (of the with-blend, ≥13mo population); served EQ coverage 3,189/5,799 = 55.0% overall
  (78.0% of active funds; passive 1.3%, null by design). A codex [P2] flagged 123 funds nulled by
  the keep-last-run trim. Root-caused (not a trim bug): 122/123 are LIVE funds whose paired
  fund+passive series ends stale because of an UPSTREAM data gap — the NAV feed cuts off a cohort at
  ~2025-04-30 and the passive blend has 1–2mo micro-gaps before the end (evidence: LSLTX paired
  2002-12..2025-01, gap, 2025-04 stub). A keep-longest-run recovery was tried (`233e370`) and
  REVERTED — codex correctly showed it serves charts ending 1–5yr ago for funds that look current.
  These 123 serve `nav_series:null` for v1 (honest); the real recovery is upstream, filed as two
  `(data)` backlog items (NAV-feed 2025-04-30 cutoff + passive-blend micro-gaps). v1 backend =
  `90c9f11` (codex CODEX_GATE pass).

## EDA questions
1. **Is `benchmark_nav` derived from ETF adjusted closes (i.e., already net of the ETF's expense
   ratio)?** Confirm by tracing `passive_match` build code + one numeric spot check (IWF leg vs
   raw IWF adjusted-close compounding). Determines whether "after fees" is exact on the passive leg.
2. Distribution of common-window lengths (how many funds get 10y+ vs <3y of paired history).
3. Frequency decision: monthly is the default; confirm payload sizes at p99 history length.

## Acceptance criteria (relational)
- For 5 active spot-check funds that have a passive blend (e.g. FCNTX, DODGX, FBGRX): endpoint
  growth values recompute from the raw daily NAV parquets within rounding tolerance; both legs share
  an identical month grid; the series' SI `diff_bps` sign is consistent with the fund's `value_bps`
  sign where confidence is high.
- Plain passive vehicles (e.g. VOO, FXAIX) have no cheaper passive alternative, so they serve
  `nav_series: null` (RATIFIED 2026-07-04 — honest absence per the no-substitute guardrail, not a
  degenerate fund-vs-itself line). The index-tracking-within-replication-error check therefore uses
  an index-tracking fund that DOES carry a passive blend (e.g. DFUSX, an S&P 500 tracker,
  replica_r2 ≈ 0.996) — fund vs passive lines track within known replication error, a large
  divergence fails the build.
- Served `nav_series` == gold panel rows (spot-check 5 funds); `/check-data` passes on
  `profile_nav_series.parquet` (entity = series_id, date = month_end).
- Coverage number reported in the validation report with the honest/recoverable split.

## Out of scope
- The React chart (frontend spec; preview route ships against a fixture of this exact shape).
- Rolling excess-return charts, drawdown charts (later iterations).

## Risks
- Passive-leg fee treatment (EDA #1) — if `benchmark_nav` turns out gross-of-fee anywhere, fix at
  the source, don't adjust in serving.
- Payload bloat for very long histories — cap chart payload to monthly (never daily) and confirm
  p99 size.
