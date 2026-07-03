---
id: te-decomposition-by-bet
title: Decompose tracking error by bet (factor tilts + stock-selection sleeve), ranked by TE contribution
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
Serve the Current Positioning section's "where does the tracking error come from" table: the fund's
bets ranked by contribution to tracking error, classified **stock / sector / theme / macro**, with a
grouped rollup headline ("~half of FCNTX's 4.8% tracking error is stock-specific; the biggest factor
source is its Technology tilt"). Math: **TE² = b′Σb + σ²_idio** over the fund's kept active factors;
per-bet component contribution `x_k = b_k(Σb)_k` as a share of factor variance; the idio sleeve is
the "stock selection" bucket.

## Context
- Inputs all exist: `data/gold/risk_decomposition.parquet` (per-fund `kept_factors[]` — F-gated,
  cluster-deduped, capped — plus `idio_risk_share`); `data/gold/risk_model/factor_exposure.parquet`
  (per-factor betas by control model); `data/gold/risk_model/target_return_series.parquet` (weekly
  factor returns for Σ); `value_score.parquet` `te_current` (the total TE anchor, vs the L2
  baseline).
- A prototype was computed ad hoc for the design mocks (2026-07-01,
  `fundscore-web/feature-pipeline/captures/fund_profile__FCNTX/_mock_data_v5.json →
  te_decomposition`): FCNTX 481 bps total ⇒ 340 bps factor sleeve / 340 bps idio sleeve; factor
  variance shares — Technology 52.2%, Mag 7 27.2%, Semis 17.3%, Comm Services 14.1%, Credit HY
  −7.9% (diversifying), EV/Battery −2.9% (diversifying). The prototype used `canonical_v1` betas;
  its raw unscaled √(b′Σb) was 2811 bps vs the 340 bps sleeve — the collinearity warning made
  visible. **Only shares scaled into the risk_decomposition sleeve split are meaningful.**
- **Binding constraint from the risk model itself** (`risk_decomposition.py` docstring): per-factor
  betas on collinear factors are not individually robust; only R²/residual are. The spec must honor
  this, not fight it.

## Computation
Per scored fund:
1. Basis = the fund's `kept_factors` (do NOT expand to all candidate factors). Betas = the SAME
   control-model basis risk_decomposition used to compute `idio_risk_share` (resolve in EDA — the
   sleeve split and the betas must come from one coherent basis).
2. Σ = covariance of weekly factor returns over the same window as the betas (156w), annualized.
3. Factor sleeve TE = `te_current × √(1 − idio_risk_share)`; idio sleeve =
   `te_current × √(idio_risk_share)`. Per-bet allocation = variance share `b_k(Σb)_k / (b′Σb)` ×
   factor sleeve. Negative shares are REAL (diversifying bets) — serve them with a
   `diversifying: true` flag, never clamp to zero.
4. Classification from factor_id prefix (`sector::`/`theme::`/`macro::`); the idio sleeve renders
   as "stock selection". Named single-stock bets (META +11.9pp etc.) listed by ACTIVE WEIGHT from
   the exposure-xray named_bets — **v1 does NOT fake per-stock TE numbers**.
5. Per-bet `confidence_state` carried from `factor_exposure` (t-stats); the grouped rollup
   (sector/theme/macro/selection) is the headline, per-bet rows are the detail.

## Output
- `data/gold/te_decomposition.parquet`: per series — sleeve scalars + per-bet rows
  `{factor_id, label, bet_type, beta, var_share, te_alloc_bps, confidence_state, diversifying}`.
- Serving: new `te_decomposition` JSONB section in `fact_assembler.py`; `teDecomposition` column in
  `fundscore-web/src/lib/db/schema/serving.ts`. Proposed gate: grouped rollup + top bet free
  (proof point); full per-bet table paid.

## Data-integrity guardrails
- One coherent basis: betas, Σ window, and `idio_risk_share` from the same model context — never
  mix `l2_1f` betas with a `canonical_v1` idio share (the mock prep hit exactly this: sectors have
  no `l2_1f` rows).
- **Full-consolidation corollary (owner confirmation 2026-07-02): the idio/factor sleeve split must
  be RECOMPUTED on the standardized basis, not read from legacy `risk_decomp_v0.1`.** σ²_idio is the
  residual variance after the standardized cluster-representative basis under the chosen control
  model — the same engine producing the bets. Consuming the old panel's `idio_risk_share` would
  reintroduce the two-engine seam this migration exists to kill. (`risk_decomposition.parquet`
  remains a diff reference only.)
- The total anchors to the served `te_current` — the page must not show two different TEs.
- Collinearity honesty: per-bet rows carry confidence; the payload includes the basis label so the
  UI can state which baseline the bets are measured against (the mock's `basis_note` pattern).
- No per-stock TE in v1 (comprehension ceiling, same honesty rule as manager sleeve tables).

## OWNER DECISION (2026-07-01): use the STANDARDIZED risk model, not the legacy kept-factor set
The owner ordered attribution migrated from the pre-standardization per-fund kept-factor selection
to the approved standardized model contract (`risk_model/model.parquet`, 2026-06-20; 67-target
catalog, `canonical_v1`/`l2_1f` controls) — see the same-day decision block in
`attribution-factor-path-serving.md`. This spec's bet universe MUST be that same standardized set
with the same cluster-representative policy, so Positioning bets == TE table bets == attribution
bets (one bet universe page-wide). References to `risk_decomposition.kept_factors` above become
"the standardized cluster-representative selection"; the FCNTX prototype ordering remains a diff
reference, not the target.

## EDA questions
1. Which control-model basis matches the served `riskAttribution.factor_betas` headline
   (`canonical_v1` vs `l2_1f`)? Use that one; sectors currently lack `l2_1f` rows in
   `factor_exposure.parquet` — if the L2 frame is wanted for the page, that gap must be filled
   upstream first, which would grow this spec.
2. Distribution of `√(b′Σb)` vs the sleeve-implied factor TE across funds — how big is the
   collinearity inflation typically? (Informs the copy about shares-not-levels.)
3. Coverage: fraction of scored funds with n_kept ≥ 1 and a computable decomposition.

## Acceptance criteria (relational)
- Per fund: Σ per-bet `te_alloc_bps` == factor sleeve (additive by construction — verify);
  sleeve² sum == `te_current²` within rounding.
- FCNTX ranking reproduces the prototype ordering when computed on the same basis (Technology top,
  credit-HY diversifying) — or the deviation is explained by a documented basis change.
- Served == gold (5 fund spot-check); `/check-data` passes (entity = series_id, date = as_of).
- Every row has `bet_type`, `confidence_state`; no clamped/dropped negative shares.

## Out of scope
- Per-stock TE contributions; TE decomposition time series; the Recent Changes TE re-ranking
  (separate spec, depends on this one's Σ machinery).

## Risks
- **Basis mismatch is the top risk** (EDA #1 resolves it before any code).
- Collinear factor sets making individual rows unstable — mitigated by kept_factors basis,
  confidence states, grouped-rollup-first presentation.
