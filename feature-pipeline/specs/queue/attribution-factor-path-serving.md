---
id: attribution-factor-path-serving
title: Serve the per-quarter factor path (betas × forward factor returns, market-beta effect, idio) for the beta/sector/macro/selection split
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-01
scope: global
model: fable
---

## Goal
Serve the **top-split layer** of the Attribution Explorer: for any quarter-aligned window, decompose
active return into **beta effect / sector bets / macro bets / stock selection** (fee shown as its own
known line), with a per-category "steady tilt vs tilt variation" split. The building blocks are
per-quarter `(β_kt, f_kt)` pairs; the engine exists (`src/fundscore/product/
exposure_path_attribution.py`, `exposure_path_v0.1`) and its quarterly β path is already in gold
(`data/gold/holdings_exposure_path.parquet`, per-quarter factor betas; FCNTX: 20 quarters ×
6 factors). What's missing for window composition is the **per-quarter forward factor returns,
per-quarter market beta + its effect, per-quarter idio residual, and per-quarter fund/passive
returns** — today only full-path aggregates ship (`factor_attribution.parquet`: bias/timing/idio
totals).

## Context
- `holdings_exposure_path.parquet` columns today: `series_id, fund_ticker, quarter_end, factor_id,
  factor_type (sector|theme|macro), cluster_id, beta, n_obs, weight_coverage, holdings_window,
  method_version`. The FF6 **market beta is not in the path** — it must be added for the "beta
  effect" line.
- `factor_attribution.parquet` (~271K rows) has the full-path `bias_bps / timing_bps /
  total_contribution_bps` per factor — the acceptance reference.
- Owner-approved math (plan, 2026-07-01): windows compose by **arithmetic summation** of quarter
  blocks (see `attribution-quarter-blocks` for the linking rationale). The timing/composition split
  reuses the module's own `bias_timing()` formula restricted to the window:
  `bias_k = mean_{t∈W}(β_kt) × Σ_{t∈W} f_kt`, `timing_k = total_k − bias_k`.
- **Copy charter (binding, from the module's own docstring):** the split renders as **"steady tilt"
  vs "tilt variation"**, never "timing skill" — three prior timing-skill probes failed. No timing
  split at the Brinson member layer (per-member weight paths aren't robust); the factor layer
  answers the question at category level.

## OWNER DECISION (2026-07-01) — migrate to the standardized risk model. THIS SUPERSEDES parts of the
## Context above.
The legacy `exposure_path_v0.1` runs on a PRE-standardization per-fund kept-factor selection
(`risk_decomp_v0.1` F-gate + cluster-dedup + cap; FCNTX = 6 of 9 candidates), while the served
Positioning betas use the APPROVED standardized model contract (2026-06-20:
`data/gold/risk_model/model.parquet` — `canonical_v1` FF6 control basis, `mkt_1f`, `l2_1f`;
67-target catalog `target_v0.1`). The profile page therefore speaks two factor dialects — the owner
saw bets in Positioning (Hyperscalers, Dividend Aristocrats, Mega Banks) that attribution never
explains (verified: `theme::hyperscalers` clusters under `tc::mag_7`, `theme::ai_infrastructure`
under `tc::semiconductors_broad`). **Decision: do NOT perpetuate the legacy selection. This spec
rebuilds the quarterly factor path on the standardized model contract**, so the factor set the
attribution explains IS the factor set Positioning displays:
- Controls per the approved contract (`canonical_v1` basis; `l2_1f` where the named-baseline frame
  applies — match whatever basis the served `riskAttribution.factor_betas` headline uses).
- Robustness policy re-expressed on the standardized catalog: one representative per cluster
  (`cluster_id` taxonomy), confidence flags per factor — documented, deterministic, same policy the
  TE-decomposition spec uses, so Positioning / TE table / attribution share ONE bet universe.
- Serve the candidate→representative mapping (`theme::hyperscalers → attributed within theme::mag_7`)
  so the UI can bridge every displayed bet to its attribution row.
- **Acceptance change**: the original "reproduce `factor_attribution.parquet` exactly" criterion is
  replaced by (a) internal consistency on the NEW basis (blocks sum to the new full-path aggregates
  exactly; per-quarter identity holds), and (b) a documented old-vs-new comparison for 5 spot-check
  funds (incl. FCNTX) explaining every material story change — the legacy panel is a diff reference,
  not the target.

## Computation
Extend the exposure-path build to emit, per (series_id, quarter):
1. Per kept factor: `beta` (existing), `fwd_factor_ret_bps` = the factor's return over the quarter
   the beta is applied to (same factor return series `bias_timing()` already consumes —
   `data/gold/risk_model/target_return_series.parquet`), `contribution_bps = β_kt × f_kt`.
2. Market line: per-quarter FF6 market beta `beta_mkt_t` (add to PATH_COLS) and
   `beta_effect_bps = (β_mkt,t − 1) × benchmark quarter return`.
3. `idio_bps_t` = realized frozen-portfolio active return − Σ factor contributions − beta effect
   (per quarter, the same residual definition the aggregate build uses).
4. `fund_ret_bps_t` / `passive_ret_bps_t` (for the reconciliation line; shared contract with
   `attribution-quarter-blocks`).

## Output
- `data/gold/factor_attribution_blocks.parquet` (per series × quarter × factor + per-quarter scalars).
- Serving: into the SAME `fund_attribution_blocks` serving table introduced by
  `attribution-quarter-blocks` (one JSONB payload per series carries both layers; whichever spec
  lands first creates the table). Gate: paid, same as the member layer.

## Data-integrity guardrails
- Factor returns and betas must be the exact series/rows `exposure_path_attribution.py` already
  uses — no re-derived returns that can drift from the shipped aggregates.
- Sum test is exact, not approximate: blocks summed over the full path MUST reproduce
  `factor_attribution.parquet` per-factor `bias_bps/timing_bps/total_contribution_bps` (same
  formula, same inputs).
- The idio residual is a computed remainder — never smoothed, floored, or redistributed.
- Every payload carries `holdings_window` + factor eval provenance so the UI can stamp the era.

## EDA questions
1. Is the benchmark quarter return for the beta-effect line the L2-blend return or the market
   factor return in the existing engine? Use whichever the aggregate build uses; document it.
2. Cross-check one fund by hand (FCNTX): the six factor contributions summed over the 20-quarter
   path vs the shipped realised-path numbers (Comm Services +472, Technology −355, Mag 7 +171,
   Semis +87, Credit HY +80, EV/Battery −64, idio −298 — the served riskAttribution values).

## Acceptance criteria (relational)
- Full-path sums of served blocks == `factor_attribution.parquet` per-factor bias/timing/total for
  5 spot-check funds (equality within rounding).
- Windowed `bias_k` recomputed from served `(β_kt, f_kt)` over the FULL window equals the shipped
  full-path bias per factor (formula identity check).
- Per-quarter identity holds: beta effect + Σ factor contributions + idio == frozen-portfolio
  active return per quarter (the engine's own reconciliation).
- Served payload == gold panel (spot-check 5 funds); `/check-data` passes (entity = series_id,
  date = quarter_end).

## Out of scope
- Brinson member blocks (`attribution-quarter-blocks`).
- Any "timing skill" claim or per-member timing split.
- Pre-holdings-frontier attribution (returns-based SI read comes from `profile-nav-series`).

## Risks
- Frame consistency: the path betas are holdings-frozen vs the model basis — the UI must label the
  basis (the existing exposure-divergence copy charter applies).
- Adding `beta_mkt` to PATH_COLS changes the path panel schema — coordinate the rebuild with the
  existing exposure-divergence consumers (fix-exposure-divergence-l2-baseline is done/; re-run its
  checks after the rebuild).
