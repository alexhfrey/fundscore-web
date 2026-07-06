---
id: positioning-context-percentiles
title: Serve beta + tracking-error percentiles vs funds sharing the same passive alternative
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-01
scope: global
model: opus
---

## Goal
Give the Current Positioning section its comparative context: the fund's beta and tracking error
each with a percentile among **funds sharing the same passive alternative** — e.g. "FCNTX's beta of
0.90 is lower than 98% of the 158 funds benchmarked to IWF; its 4.8% tracking error is mid-pack
(67th percentile)." A raw beta means little to a retail reader; the percentile is what makes it
legible. Cheapest spec in the redesign set — a groupby over one existing panel.

## Context
- All inputs already exist in `data/gold/value_score.parquet` (v0.3): `beta`, `te_current`,
  `passive_alt_label`, `peer_group`, `coverage_state`.
- Verified ad hoc (2026-07-01, mock-data prep): IWF cohort = 158 scored funds; FCNTX beta 0.904 →
  ~2nd percentile (cohort median 1.01); te_current 4.81% → ~67th percentile (cohort median 4.03%).
  These numbers are already shipped as labeled-real design-mock data
  (`_mock_data_v5.json → positioning_context`).

## Computation
Over scored funds (`value_bps IS NOT NULL`) in `value_score.parquet`:
- Primary cohort: same `passive_alt_label`. Fallback: same `peer_group` when the primary cohort has
  fewer than N_MIN (~20) members. The served payload NAMES which cohort was used and its size —
  never a percentile against an unnamed population.
- Percentile = strictly-below fraction × 100 (document the convention; ties handled consistently).
- Emit per series: `beta`, `beta_percentile`, `te_bps`, `te_percentile`, `cohort {kind:
  'same_passive_alt'|'peer_group', label, n_funds}`, `as_of`, `method_version`.

## Output
- `data/gold/positioning_context.parquet` (one row per scored series_id).
- Serving: new `positioning_context` JSONB section in `fact_assembler.py`; `positioningContext`
  JSONB column in `fundscore-web/src/lib/db/schema/serving.ts`. Proposed gate: free (context is a
  trust feature; the TE-by-bet detail in the separate te-decomposition spec is the paid layer).

## Data-integrity guardrails
- Percentiles only for scored funds within their own cohort — never mix coverage states or pool
  across baselines to inflate n.
- Cohorts below N_MIN even after fallback serve `null` (honest absence) rather than a percentile
  over a handful of funds.
- beta and te_current are consumed as-is from value_score (same as-of, same method) — no
  recomputation, no mixing with `fund_metadata.beta_3y` (different basis).

## EDA questions
1. Cohort-size distribution across `passive_alt_label` values: what fraction of scored funds land
   in cohorts ≥ N_MIN? What does the peer_group fallback recover?
2. Sensitivity of N_MIN (10 vs 20 vs 30) on coverage; pick and document.

## Acceptance criteria (relational)
- For 5 spot-check funds, served percentiles recompute exactly from a direct DuckDB query over
  `value_score.parquet` using the documented convention.
- Every served percentile row carries cohort kind + n; no row has n < N_MIN.
- Coverage (fraction of scored funds with a served context) reported in the validation report.
- `/check-data` passes (entity = series_id, date = as_of).

## Out of scope
- Percentiles for unscored funds; percentile time series; percentile on other metrics (fee
  percentile already exists in fee fairness).

## Risks
- Small-cohort noise (guarded by N_MIN + naming the n).
- Percentile convention ambiguity — fixed by documenting strictly-below and testing it in the
  acceptance query.
