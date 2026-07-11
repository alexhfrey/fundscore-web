---
id: fee-peer-band-backend
title: Serve the fee-over-passive percentile vs funds sharing the same passive alternative (blend-weighted)
status: done
track: backend
repo: fund_score
lane: reviewed
depends_on: positioning-context-percentiles
source_proposal: feature-pipeline/prds/fee-fairness-peer-band.md
created: 2026-07-10
scope: global
model: opus
---

# Fee-over-passive peer percentile — backend

PRD: `feature-pipeline/prds/fee-fairness-peer-band.md` — **owner resolved all 5 questions
2026-07-10; the OWNER DECISIONS block there is the contract.** Red-team findings (2026-07-10)
are folded into the constraints below.

## Goal

Serve, for each scored fund, the percentile of its canonical `active_fee_over_passive_bps`
within the cohort of scored funds sharing its passive alternative — e.g. "FCNTX's 62 bps over
passive is higher than 71% of the 158 funds benchmarked to IWF." Payload names the cohort and n;
never a percentile against an unnamed population.

## Binding constraints (from the PRD + red-team; do not relitigate)

- **As-of row selection (the #1 red-team blocker):** `fee_efficiency_score.parquet` is a dense
  (series_id, eval_date) grid; a naive `.last()` per series NULLs `active_fee_over_passive_bps`
  for 99.5% of series. Convention: **latest eval_date row where `active_fee_over_passive_bps`
  is non-null**, mirroring `fact_assembler`'s `fair_fee` handling.
- **Cross-panel join:** collapse the fee panel to one row/series via the rule above, THEN join
  `value_score.parquet` on `series_id` alone for cohort labels (no eval_date alignment exists).
  Measured coverage: 2,607/2,622 fee-eligible series (99.4%) carry a cohort label.
- **Shared utility (owner Q5):** the cohort construction + percentile convention comes from the
  shared utility shipped by `positioning-context-percentiles` — same strictly-below convention,
  same cohort-naming payload shape, same N_MIN constant. Do NOT implement a second percentile
  engine (`value_offering.cluster_percentile` is a dead Hazen-formula precedent — do not revive).
- **Blend-weighted cohort (owner Q1):** single-ETF baseline → cohort = scored funds sharing that
  passive alternative. Blend baseline → percentile = Σ w_i × percentile_within(cohort of
  constituent ETF i), weights = blend weights. EDA pins: constituent-cohort membership
  (a fund shares constituent i when its selected blend includes i), N_MIN per constituent
  cohort, renormalize weights over qualifying constituents when some are below N_MIN, and
  honest null when none qualify. The payload's cohort object must expose the blend basis
  (constituents + weights + per-constituent n) so the UI copy can be honest about it.
- **Figure (owner Q2):** canonical `active_fee_over_passive_bps` only. Never net ER.
- **Gate (owner Q3):** FREE. Verify `applyGates` neither leaks nor over-strips.

## Output

- `data/gold/fee_peer_percentile.parquet` — one row per scored series:
  `series_id, fee_over_passive_bps, fee_percentile, cohort {kind, label, n | blend basis},
  as_of, method_version`.
- Serving: extend the `fees` JSONB section in `fact_assembler.py` (a `peer_percentile` object);
  no new Drizzle column (the fees section is already served + free).

## Data-integrity guardrails

- Percentiles only within scored funds (`value_bps IS NOT NULL` universe); never pool across
  coverage states; cohorts below N_MIN (after blend renormalization) serve null — honest absence.
- The served figure must equal the canonical fee figure the page already shows (same as-of, same
  panel) — the percentile NEVER introduces a second fee number.
- `/check-data` on the new parquet (entity = series_id, date = as_of); coverage headline
  reported (% of scored funds with a served percentile, honest-missing split).

## Acceptance (relational)

- 5 spot-check funds: served percentile recomputes exactly from a direct DuckDB query over the
  source panels using the documented convention; at least one blend-baseline fund verified by
  hand-computing the weighted average.
- Every served row names cohort (or blend basis) + n; no cohort below N_MIN.
- FCNTX serves a percentile against the IWF cohort consistent with the ad-hoc 2026-07-01 numbers
  (~158-fund cohort) or the deviation is explained by universe re-scoping (5,656 post-dedup).
- Data-reviewer PASS; `/check-data` clean; codex gate pass.

## Out of scope

Frontend rendering (separate lean spec `fee-peer-band-web`); changes to the canonical fee
figures; percentiles on other metrics.
