---
id: fix-exposure-divergence-l2-baseline
title: Build the deferred l2_1f control so exposure divergence compares like-for-like baselines
status: done
track: backend
repo: fund_score
depends_on: ""
created: 2026-06-24
scope: global
---

## Goal
Add the deferred `control_model_id = l2_1f` (regression with the fund's **own L2 passive blend** stripped)
to the factor-exposure model, and re-point the `exposure_divergence` diagnostic to use it — so the
holdings-based reading (active weight vs the L2 blend) and the returns-based reading (beta) are measured
against the **same baseline**. Today they are not, and the mismatch manufactures false "holdings vs
returns" divergences across the product.

## Context (verified — do not re-litigate the numbers, confirm them)
The `exposure_divergence` panel pairs **holdings-active (vs L2 blend)** with **`beta_active_mkt`
(market-stripped)** — two different baselines. For FCNTX (`series_id S000006037`), Mag-7:
- holdings active weight = **−8.19 pp** vs its L2 blend (Russell 1000 Growth/IWF, ~50% Mag-7); absolute Mag-7 = **42.3%**.
- surfaced `beta_active_mkt` = **+0.21** (t=7) — but vs the **market**, not the L2 blend.
- methodologically-consistent betas (same 156-wk window): **(fund − L2) ~ mag7 = −0.12 (t=−7.3)**;
  unconstrained twin `fund ~ (L2, mag7)`, mag7 incremental = **−0.02 (t=−0.5)**. **Both ≤ 0 — they AGREE
  with the −8.19 pp holdings underweight.** Mechanism: FCNTX raw mag7 β 0.57 < its benchmark IWF's 0.69.
There is **no real divergence on a consistent baseline**; the "+0.21 overweight" is a market-baseline artifact.

The control is a **documented deferred gap**: `src/fundscore/risk_model/factor_exposure.py` and
`build_factor_exposure.py` list `l2_1f` ("β with the fund's own L2 blend stripped") as deferred to v0.1.

## Data source (all exist — no new data)
- Fund weekly returns: `data/gold/fund_daily_adj_close.parquet` (Friday `resample_to_weekly`, as the model does).
- L2-blend weekly return per fund: `benchmark_nav` in `data/gold/passive_alt_daily_nav.parquet` (the
  fund's own L2 blend daily NAV); blend weights in `data/gold/passive_alt_blend.parquet`.
- Target/factor returns: `data/gold/risk_model/target_return_series.parquet` (use the SAME `theme::*` /
  factor series the existing regressions consume).
- Existing controls for reference: `factor_exposure.parquet` (`null`, `mkt_1f`, `canonical_v1`).

## Computation (column names = what is computed)
- Add `control_model_id = 'l2_1f'`: **strip the fund's L2-blend return**, exactly mirroring how `mkt_1f`
  strips the market — reuse `batch_two_factor_ols` with `base_weekly` = the fund's L2-blend weekly return
  (from `benchmark_nav`). Emit the target's incremental `beta` (+ `t`, `r2`, `n_obs`, window) just like
  the other controls. Same window/as-of policy as the existing builds. Keep statistical coherence (point
  estimate and t from the same N/window).
- This is additive: `null`/`mkt_1f`/`canonical_v1` rows are unchanged; `l2_1f` rows are new.

## Output
- `data/gold/risk_model/factor_exposure.parquet` — `+ rows` with `control_model_id='l2_1f'`.
- `data/gold/risk_model/exposure_divergence.parquet` — its returns-side beta now reads the **`l2_1f`**
  beta (the like-for-like one), not `beta_active_mkt`. Keep `beta_active_mkt` available as a separate
  column (it answers a different, vs-market question), but the **divergence headline must use `l2_1f`**.

## Serving integration
- `src/fundscore/serving/fact_assembler.py` `_exposure_divergence_by_series` (≈ L772-831) — surface the
  `l2_1f` active beta as the divergence's returns reading; relabel so the served field names the baseline
  (vs the fund's passive blend), not the market. Rebuild `serving_facts_staging` and load Postgres.

## EDA question (plot before building)
1. FCNTX Mag-7 before/after: `beta_active_mkt` (+0.21) vs the new `l2_1f` beta — confirm the new one is ≤ 0.
2. Across the EQ universe: distribution of `beta_active_mkt` vs `l2_1f` for the targets that drive the
   divergence panel — how far apart are they, and for how many (fund, target) pairs does the **sign flip**?

## Verification plan (gate at small scale first — CLAUDE.md extraction gate)
- **Atomic (≥5 funds incl. FCNTX):** recompute `l2_1f` by hand for FCNTX/Mag-7 and confirm it matches the
  builder to the bp, and is ≤ 0 (agreeing with the −8.19 pp holdings underweight). Spot-check 4 other
  multi-theme funds: the `l2_1f` beta sign should track the holdings active-weight sign.
- **Aggregate / RE-AUDIT (the headline check):** of all (fund, target) pairs currently flagged as a
  holdings-vs-returns **divergence** in `exposure_divergence.parquet`, how many **collapse** (no longer
  diverge) once the beta is on the L2 baseline? Report the count and rate — this sizes the artifact.
- **Statistical coherence:** `l2_1f` point estimate and t from the same window/N; the L2-blend base and
  the target series share the eval window.
- `/check-data` on `factor_exposure.parquet` + `exposure_divergence.parquet`. Served == gold for FCNTX.

## Acceptance criteria
- `l2_1f` computed for every (fund, target) that has the other controls; additive, others unchanged.
- `exposure_divergence` headline beta = the `l2_1f` (L2-baseline) beta; FCNTX Mag-7 reads ≤ 0, no longer
  contradicting the −8.19 pp holdings underweight.
- The re-audit count of collapsed divergences is reported.
- `/check-data` passes; served value == gold for the divergence reading.
- Docs updated: `docs/product/data_contracts/risk_exposure_model.md` (l2_1f no longer deferred),
  the divergence/risk-attribution data-product spec, `docs/status/pipeline_status.md`, and a MEMORY note.

## Risks
- Betas recompute for the whole universe → the divergence story changes **site-wide**; many "divergences"
  will shrink or flip. That is the correct fix, but re-check there are no implausible swings and that the
  risk/attribution UI copy still reads sensibly.
- `benchmark_nav` for some funds (incl. FCNTX) ends ~1 week short of the factor eval date — eval `l2_1f`
  one week behind the other controls (transparent as-of) or refresh the NAV panel; do not fabricate the gap.
