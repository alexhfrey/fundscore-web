---
id: serve-l2-passive-candidate-fit
title: Serve per-candidate L2 passive-alternative fit scores (correlation / tracking error / beta) so "What's the closest passive alternative?" renders from data
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: ""
origin: FCNTX fund-profile design exploration — public/_reviews/design-mocks/combined-v4.html (2026-06-25)
created: 2026-06-25
scope: global
model: opus
---

## Goal
Persist and serve, for each active fund, the **candidate-ETF comparison the L2 passive-replication pipeline already
reasons over** — each candidate ETF with its **correlation, tracking error, and beta vs the fund**, a flag for the
**selected** closest match, and a small amount of display metadata for the winner (name, asset class, one-word style tag,
fee, replica R²). Today only the *winner* is persisted (`l2_replica_quality.top_l2_etf` = `IWF` for FCNTX); the
per-candidate fit table is computed nowhere durable, so a "closest passive alternative" UI would have to recompute
correlation/TE/beta at render time from raw ETF prices. Land a gold panel + serving fields so the section is **data-backed
and reproducible**, with the selection rule auditable (the chosen ETF should be the return-fit-closest OR carry a reason
when the L2 selection diverges from return-fit because it also weighs holdings overlap / size taxonomy).

Design target (the shape to populate, already built against real computed values): the **"What's the closest passive
alternative?"** section in `public/_reviews/design-mocks/combined-v4.html` — a winner card (IWF · US Large-Cap Growth ·
"Large-growth" · corr 0.974 · TE 5.54% · beta 0.86 · R² 0.95 · 0.18%) plus an 11-row candidate table sorted closest-first.

## Problem / why it fits
"What do you pay above passive, and *why that passive*?" is the product's core question. The whole fund-profile page reads
FCNTX **against IWF** without ever showing *why* IWF — leaving the baseline an unexplained assertion. The L2 solver
(`src/fundscore/product/portfolio_passive_solver.py`, run via `scripts/pipeline/run_portfolio_passive_solver.py` →
`build_passive_alt_blend.py`) already fits the fund's returns against a library of liquid ETFs and selects the closest
blend; it just discards the runner-up scores. Surfacing them (a) justifies the baseline, (b) lets a reader sanity-check the
match, and (c) is a genuine differentiator. It is also a **data-integrity win**: it replaces render-time recomputation (which
would drift by window/method) with one canonical, as-of-stamped figure set.

## Context (verified against the live `fund_score` repo, 2026-06-25)
- **Winner-only today.** `data/gold/l2_replica_quality.parquet` has ONE row per series: `top_l2_etf`, `top_l2_wt`,
  `replica_r2`, `replica_te_bps`, `n_obs` (FCNTX → `IWF`, wt 1.0, r2 0.948, te 445 bps, n_obs 938). `passive_alt_blend.parquet`
  holds only the selected blend components (FCNTX → single row, `IWF` rank 1). No per-candidate correlation/TE/beta is stored.
- **The inputs to compute candidates exist locally.** ETF daily adjusted closes are in
  `data/bronze/stock_prices/tiingo_daily/*.parquet` (`ticker, date, adj_close`; the L2 candidate ETFs IWF/VUG/SCHG/MGK/IWB/
  IVV/SPY/VOO/QQQ/VTI/IWD all covered 2018→2025). Fund total-return NAV is in `data/gold/passive_alt_daily_nav.parquet`
  (`ticker, date, fund_nav, benchmark_nav`). A 3Y-daily fit of FCNTX vs each candidate reproduces the selection: IWF is
  closest on **both** highest correlation (0.974) and lowest TE (5.54%), and IWF's corr² (0.949) matches the stored
  `replica_r2` 0.948 — so the new panel must reconcile to `l2_replica_quality` for the winner row.
- **The candidate universe is solver-owned.** Persist exactly the universe the solver scores (do NOT hardcode a UI list);
  read it from the solver / `refresh_l2_tiingo_etfs.py` ETF set so the served table = what the pipeline actually considered.
- **Serving path.** The frontend renders from `serving_facts_staging.parquet` via the fact assembler (the canonical-fee
  spec documents this path). `served_facts.passive_baseline` today carries `etf_weights`, `display_name`, `match_status` —
  extend it rather than inventing a parallel block.

## Solution (backend)
1. **New gold panel `l2_passive_candidate_fit.parquet`** — one row per (series_id, candidate_etf), produced inside the L2
   passive-solver pipeline (where the candidate scores already exist transiently) or as a thin sibling builder reading the
   same ETF return panel + fund NAV. Columns (minimum):
   `series_id, candidate_etf, etf_name, asset_class, style_tag, expense_ratio_bps, correlation, tracking_error_bps, beta,
    n_obs, fit_window_start, fit_window_end, is_selected (bool), selection_rank, method_version`.
   - `correlation / tracking_error_bps / beta`: fund daily returns vs candidate daily returns over ONE stated window
     (use the solver's fit window; if unavailable, 3Y daily). One method, one window, stamped — never recomputed downstream.
   - **Basis labeling is mandatory (added 2026-07-01 — codex adversarial review of the profile mock flagged three
     different "tracking error vs IWF" figures on one page: 4.8% headline te_current [weekly, β-adjusted, 3Y] vs this
     table's raw-daily return-fit TE [5.54% for FCNTX] vs a third risk-stat variant).** The served payload must carry a
     `te_basis` label (e.g. `return_fit_raw_daily_3y`) and display metadata naming it plainly ("return-fit TE, raw
     daily, 3Y"), so the UI can NEVER render this figure under the same unqualified label as the headline te_current.
     Acceptance criterion: the served candidate-fit TE and te_current are distinguishable by label in the payload alone.
   - `is_selected`: exactly one true per series, and it MUST equal `l2_replica_quality.top_l2_etf` (reconciliation
     invariant). `etf_name / asset_class / style_tag` from ETF reference metadata (no fabricated descriptors).
2. **Selected-match summary** carried alongside (either columns on the winner row or a small struct): `one_word_summary`
   (a single style word, e.g. "Large-growth"), `replica_r2` (from `l2_replica_quality`), and the existing fee.
3. **Serve it.** Extend `served_facts.passive_baseline` with `candidates: [...]` (the sorted candidate rows) and a
   `selected_summary` (name, asset_class, one_word_summary, fee_bps, correlation, tracking_error_bps, beta, replica_r2,
   fit_window, source). Wire through `serving_facts_staging.parquet` + the fact assembler. Suppress honestly (omit
   `candidates`, keep `display_name`/`match_status`) for funds where the solver produced no scored universe, and for
   **passive funds** emit nothing (no "closest alternative" for an index fund).
4. **Honesty about the selection rule.** The served table is return-fit (corr/TE/beta); the actual L2 selection also weighs
   holdings overlap + size taxonomy. Carry a `selection_basis` note string and, when the return-fit-closest ETF ≠ the
   selected ETF, a `selection_divergence_reason` so the UI never implies return fit is the whole selection (the design mock
   states this caveat verbatim — keep it sourced from a served field, not hardcoded in the component).

## Data-integrity guardrails (non-negotiable — see feature-pipeline/README "Data-integrity")
- **No synthetic candidates or metrics.** A candidate with insufficient overlapping history is OMITTED (record nothing),
  never zero-filled. Missing reads as missing.
- **Commensurability:** every candidate's corr/TE/beta share the SAME fund return series, window, frequency, and as-of —
  asserted in the builder, stamped in the row.
- **Reconciliation invariant (fault-first):** `is_selected` row's `correlation²` must be within tolerance of
  `l2_replica_quality.replica_r2`, and `is_selected.candidate_etf == top_l2_etf`. A mismatch is a DEFECT to root-cause
  (the data-reviewer halts the assembly line), not a number to reconcile away.
- **Run `/check-data`** on `l2_passive_candidate_fit.parquet` after the build (entity = series_id, date = fit_window_end).

## Tier gating
The passive-baseline / fee comparison is already public/free; the candidate table rides the same gate as
`passive_baseline`. No paid-only field introduced; verify `applyGates` does not leak nor over-strip.

## Acceptance criteria
- `l2_passive_candidate_fit.parquet` exists with ≥1 scored candidate per active fund that has an L2 match; FCNTX has the
  full scored universe with `is_selected=true` on `IWF` and `IWF.correlation² ≈ replica_r2` (±0.01).
- `served_facts.passive_baseline.candidates` is populated (sorted closest-first) and `selected_summary` carries name,
  asset class, one-word tag, fee, corr/TE/beta, R², and the fit window + source, for FCNTX and ≥4 other active funds.
- Passive funds (e.g. VOO) serve NO candidate table; funds with no scored universe omit `candidates` but keep
  `display_name`/`match_status` (honest unavailable state).
- The selection-divergence note is served (empty when return-fit-closest == selected).
- Data-reviewer PASS at each step; `/check-data` clean; the reconciliation invariant holds across the sampled universe.

## Test plan
- Atomic: recompute FCNTX corr/TE/beta vs IWF from `tiingo_daily` + `passive_alt_daily_nav` over the served window and match
  the served values exactly; confirm IWF is min-TE / max-correlation in the served set.
- Cross-fund: sample ≥10 active funds; assert one `is_selected` each, equal to `top_l2_etf`, and corr²≈replica_r2.
- Negative: a value-style ETF (e.g. IWD for a growth fund) appears with low correlation / high TE (method discriminates);
  a passive fund yields no table.

## Out of scope
- **Frontend rendering** of the section (the React `passive_baseline` consumer) — a follow-on frontend-track spec; the design
  is `combined-v4.html`. This spec only lands the data + serving fields.
- Changing the L2 selection algorithm or candidate universe — only persist + serve what the solver already scores.
- The corrupted-net-ER / canonical-fee work — owned by `canonical-fee-over-passive-backend` (separate queued spec).

## Risks
- If the solver does not retain per-candidate scores internally, the sibling builder must recompute them from the same ETF
  return panel the solver uses — pin to that panel + window so served fit == solver fit (no second method).
- ETF reference metadata (asset_class / style_tag) coverage gaps → omit the tag rather than guess; never invent a style word.
- Window choice changes the magnitudes; fix ONE fit window, stamp it, and assert the winner reconciles to `replica_r2`.
