---
id: serve-l2-passive-candidate-fit
title: Serve per-candidate L2 passive-alternative fit scores (correlation / tracking error / beta) so "What's the closest passive alternative?" renders from data
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: ""
origin: FCNTX fund-profile design exploration — public/_reviews/design-mocks/combined-v4.html (2026-06-25); revised 2026-07-22 against fund_score HEAD (home/value-prop-refresh) by the /implement-next staleness gate
created: 2026-06-25
scope: global
model: fable
effort: xhigh
---

## Owner summary
Backend for the "why this index fund is your cheapest alternative" table — the heart of our fee-vs-passive promise. The first build FAILED our data review (it recommended alternatives that don't resemble the fund, in the worst case a *negatively* correlated ETF held long) and is blocked until it ships with a **quality floor** (a weak-match fund serves an honest "no close passive alternative" state, not a confident card) and **one consistent, labeled set of fit numbers** (the prior build showed three different "tracking error vs the benchmark" numbers on one page).

## Goal
Persist and serve, for each active fund, the **candidate-ETF comparison the L2 passive-replication pipeline already
reasons over** — each candidate ETF with its **correlation, tracking error, and beta vs the fund**, a flag for the
**selected** closest match, and a small amount of display metadata for the winner (name, asset class, one-word style tag,
fee, replica R²). Today only the *winner* is persisted (`l2_replica_quality.top_l2_etf` = `SPY` for FCNTX as of the
2026-07-16 canonical-panel migration); the per-candidate fit table is computed nowhere durable **for TE/beta** (per-candidate
*correlation* IS retained in a bronze diagnostics partition — see Context), so a "closest passive alternative" UI would have to
recompute TE/beta at render time from raw ETF prices. Land a gold panel + serving fields so the section is **data-backed and
reproducible**, with the selection rule auditable: the served table must make clear that the L2 selection is **min-tracking-error
under a simplicity penalty** (not max-correlation), so when the correlation-closest ETF differs from the selected ETF the payload
carries a reason instead of implying correlation drives the pick.

Design target (the shape to populate — **era-stamped 2026-06-25 mock, NON-BINDING**; the live L2 winner has since flipped from
IWF to **SPY** and the mock's numbers mix bases — see the te_basis section): the **"What's the closest passive alternative?"**
section in `public/_reviews/design-mocks/combined-v4.html` — a winner card plus an ~11-row candidate table sorted closest-first.
Populate it from the recomputed live values, not the mock's figures.

## Problem / why it fits
"What do you pay above passive, and *why that passive*?" is the product's core question. The whole fund-profile page reads
FCNTX **against its L2 winner** without ever showing *why* that ETF — leaving the baseline an unexplained assertion. The L2
solver (`src/fundscore/passive_match/solver.py`, driven by `run_benchmarks.py` → `runner.py`, gold-built via
`scripts/pipeline/build_passive_match_gold.py` / `build_passive_alt_blend.py` / `build_l2_replica_quality.py`) already fits the
fund's returns against a curated pool of liquid ETFs and selects the min-TE blend; it discards the runner-up **TE/beta** scores
(it retains per-candidate **correlation** in a bronze diagnostics partition). Surfacing them (a) justifies the baseline, (b) lets
a reader sanity-check the match, and (c) is a genuine differentiator. It is also a **data-integrity win**: it replaces render-time
recomputation (which would drift by window/method) with one canonical, as-of-stamped, **basis-labeled** figure set.

## Context (verified against `fund_score` HEAD `home/value-prop-refresh` @0e272b8, 2026-07-22)
- **Winner-only today; the winner flipped to SPY.** `data/gold/l2_replica_quality.parquet` (8,434 rows, **schema now ~25 cols**
  incl. `asset_class, taxonomy_size, taxonomy_geo, blend_pct_*, size_conflict_flag, low_replica_flag, method_version`) has ONE
  row per series. FCNTX (series_id `S000006037`) → `top_l2_etf=SPY`, `top_l2_wt=1.0`, `replica_r2=0.9479`, `replica_te_bps=445.78`,
  **`n_obs=943`** (n_obs is in **weeks** — full-history weekly overlap, not the 5Y selection window). The winner flipped from IWF
  to SPY when the L2 batch migrated to the canonical price panel (fund_score `76020e1`, 2026-07-16). **Do NOT hardcode IWF
  anywhere.** `passive_alt_blend.parquet` FCNTX → SPY weight 1.0 rank 1. No per-candidate TE/beta is stored.
- **Two bases exist and must not be conflated (this is the whole point of the te_basis work).** Two distinct return-fit numbers
  live in the pipeline for the SAME winner:
  - **Selection-window basis** — the solver screens/selects on **weekly** returns over the **mandate 5Y lookback**
    (`OBJECTIVE_PRESETS["mandate"]`: `lookback_years=5, penalty=0.30, max_etfs=2`, freq weekly; `runner.py`). On this basis
    (bronze `solver_detail`, asof `2026-06-30`) FCNTX↔SPY corr = **0.949** and SPY's single-ETF TE_ann ≈ **5.41%**.
  - **Replica basis** — `l2_replica_quality.replica_r2` (0.9479) / `replica_te_bps` (445.78) is computed by
    `risk_model/replica_diagnostics.replica_quality()` as `corr(fund, blend)²` over the **full weekly history** (n_obs 943 weeks),
    where `blend = fund_return − tracking_diff`. This is a DIFFERENT window and a DIFFERENT quantity than a single-candidate corr².
  - Consequence: **`winner_corr² ≈ replica_r2` does NOT hold** (SPY selection-window corr² ≈ 0.90 vs replica_r2 0.9479). The
    original spec's "corr² within ±0.01 of replica_r2" invariant was a spec-time coincidence from an ad-hoc 3Y-**daily** fit and
    is factually wrong on the live basis. The reconciliation anchor must be **same-basis** (see Solution §4).
- **FCNTX is itself a live selection-divergence case** — do not assume selected == correlation-closest. On the selection window,
  the max-correlation candidate is **IWF (corr 0.963)**, but the **selected** ETF is **SPY (corr 0.949)**, because the
  mandate objective minimizes **TE** under a simplicity penalty and SPY is the min-TE single ETF (SPY TE 5.41% < IWF 5.45%; the
  min-TE *blend* IWF+SPY loses to the penalty). Use FCNTX/SPY as the canonical example that exercises `selection_divergence_reason`.
- **The price inputs are the canonical de-duped panels — NEVER the raw tiingo glob.** The batch L2 pipeline reads
  (`run_benchmarks.py` defaults): funds `data/gold/fund_daily_adj_close.parquet` (:67), ETFs
  `data/vendors/sharadar/sfp/daily/adj_close_all.parquet` (:72), tiingo `data/gold/fund_daily_adj_close.parquet` (:77) —
  migrated by `76020e1`. The raw `data/bronze/stock_prices/tiingo_daily/*.parquet` glob is retired and is a **known
  garbage-returns source** (random adjustment vintages); the builder MUST NOT read it. Point every price input at exactly the
  panels the solver reads so served fit == solver fit on ONE basis.
- **The candidate universe is solver-owned — read it from the pools, not a UI list, not `refresh_l2_tiingo_etfs.py`.** The scored
  pool lives in `src/fundscore/passive_match/etf_pools.py`: `MANDATE_POOLS` (:13, key `AC.GEO.FOCUS.SIZE`) and `MIMICKING_POOLS`
  (:221), routed per fund via `get_mandate_pool()` (:375). `refresh_l2_tiingo_etfs.py` is only a price-fetch helper for a
  hardcoded top-up list — NOT the scored universe. **Per-candidate correlation is already persisted durably** in bronze:
  `data/bronze/benchmark_calculation/level2/solver_detail/asof_refit_date=*/data.parquet` (latest `2026-06-30`), columns
  `[fund, record_type, etf, corr, abs_corr, screened]` — `record_type=='correlation'` rows carry each screened candidate's corr
  and a `screened` flag ("what the pipeline actually considered"). Per-candidate **TE and beta are NOT retained** (`adapters.py`
  `WindowMetrics` keeps only winning-blend aggregates) and must be recomputed from the same canonical panels + window.
- **The inverse-ETF sign guard already exists (docs are stale on this).** `solver.py:202` filters `corr > 0` before selection
  (from `54e1b17`), so an anti-correlated/inverse ETF can no longer screen in — a fund whose only candidates are anti-correlated
  returns None (honest null). ⚠️ `docs/context/passive-match.md:14` still claims "there is NO explicit inverse/leveraged guard" —
  that line is **stale**; trust the code, not the doc. This spec does NOT re-implement a sign guard; it owns the **quality floor**
  layered above the (screen-level) sign guard.
- **Prior implementation exists, stranded unmerged — reference material, NOT a cherry-pick, NOT a reconciliation target.**
  Branch `wip/concurrent-fund-family-l2` commit `58c8824` (2026-07-04) contains a full prior build of this exact spec:
  `src/fundscore/product/l2_passive_candidate_fit.py` (543 lines), `scripts/pipeline/build_l2_passive_candidate_fit.py`,
  `scripts/reports/check_l2_passive_candidate_fit.py`, `fact_assembler.py` serving wiring (`candidates`, `selected_summary`,
  `fit_window`, `fit_basis_id/label`, `selection_basis/_note`, `pool_key`, `pool_etfs`, `k_chosen`, `source`), and tests. None of
  it exists in HEAD. **Salvage its column design and serving-wiring shape** rather than re-authoring blind, BUT (a) rebuild ALL
  logic against the current **sign-guarded** solver (`solver.py:202`) and **canonical price basis** — the prior build predates
  both; (b) do NOT cherry-pick `58c8824` wholesale: `fact_assembler.py` has diverged since and the commit entangles unrelated
  fund-family work (see the shared-worktree-contamination lesson).
- **The on-disk output artifact is contaminated — regenerate from scratch; never read it as input or a reconciliation target.**
  `data/gold/l2_passive_candidate_fit.parquet` (2026-07-04, 51,509 rows) is the pre-sign-guard FAILED build: of 8,424 `is_selected`
  rows, **121 have NEGATIVE correlation** (min −0.909), **2,519 have `etf_type='Unknown'`**, and FCNTX still selects IWF. Delete/
  overwrite it; a rebuilt panel must not be validated against it.
- **Serving path.** The frontend renders from `serving_facts_staging.parquet` via `src/fundscore/serving/fact_assembler.py`.
  Today `_passive_baseline()` (`fact_assembler.py:1977`) emits only `{display_name, match_status: "matched" (unconditional),
  etf_weights}` — **no quality floor, no candidates, no basis labels**. Extend this block (see Solution), do not invent a parallel one.

## Solution (backend)
1. **New gold panel `l2_passive_candidate_fit.parquet`** — one row per (series_id, candidate_etf), produced as a sibling builder
   that reads the SAME canonical panels the solver reads (`fund_daily_adj_close.parquet` + the sharadar ETF `adj_close_all.parquet`)
   and the SAME candidate pool (`etf_pools.get_mandate_pool()` / the fund's `pool_key`), over the SAME window/frequency the solver
   used (mandate 5Y weekly). Columns (minimum):
   `series_id, candidate_etf, etf_name, asset_class, style_tag, expense_ratio_bps, correlation, tracking_error_bps, beta,
    n_obs, fit_window_start, fit_window_end, te_basis, is_selected (bool), selection_rank, screened, method_version`.
   - `correlation / tracking_error_bps / beta`: fund weekly returns vs candidate weekly returns over ONE stated window (the
     solver's selection window; read it from the pipeline / `solver_detail` asof, do not hardcode "3Y daily"). One method, one
     window, stamped — never recomputed downstream. `correlation` MUST reconcile to `solver_detail` `record_type='correlation'`
     corr for the same (fund, etf, asof) within tolerance (same-basis anchor, §4).
   - **Basis labeling is mandatory (2026-07-01 — codex adversarial review of the profile mock flagged three different "tracking
     error vs the benchmark" figures on one page: the ~4.8% headline `te_current` [weekly, β-adjusted] vs this table's return-fit
     TE vs a third risk-stat variant).** The served payload must carry a `te_basis` label (e.g. `return_fit_weekly_5y`) and
     display metadata naming it plainly ("return-fit TE, weekly, 5Y selection window"), so the UI can NEVER render this figure
     under the same unqualified label as the headline `te_current`. Likewise the winner's `replica_r2` (carried from
     `l2_replica_quality`, §2) is a THIRD basis (full-history weekly blend R²) and must carry its own label — it is NOT this
     table's `correlation²`. Acceptance: the served candidate-fit TE, `te_current`, and `replica_r2` are distinguishable by label
     in the payload alone.
   - `is_selected`: exactly one true per series, and it MUST equal `l2_replica_quality.top_l2_etf` (reconciliation invariant §4).
     `etf_name / asset_class / style_tag` from ETF reference metadata (§5) — no fabricated descriptors.
2. **Selected-match summary** carried alongside (either columns on the winner row or a small struct): `one_word_summary`
   (a single style word, e.g. "Large-blend"), `replica_r2` + `replica_te_bps` (carried verbatim from `l2_replica_quality`, with a
   basis label — do NOT recompute or equate with the candidate-fit corr), and the existing fee.
3. **Serve it.** Extend `_passive_baseline()` in `fact_assembler.py` to add `candidates: [...]` (the sorted candidate rows, each
   with its `te_basis`) and a `selected_summary` (name, asset_class, one_word_summary, fee_bps, correlation, tracking_error_bps,
   beta, te_basis, replica_r2 [labeled], fit_window, source). Wire through `serving_facts_staging.parquet` + the fact assembler.
   Suppress honestly: omit `candidates`/`selected_summary` (keep `display_name`/`match_status`) for funds where the solver produced
   no scored universe; for **passive/index funds** emit nothing (no "closest alternative" for an index fund).
4. **Reconciliation (same-basis, fault-first) — replaces the old cross-basis corr²≈replica_r2 invariant.**
   - **Exact:** exactly one `is_selected` per series, and `is_selected.candidate_etf == l2_replica_quality.top_l2_etf`. A mismatch
     is a DEFECT the data-reviewer halts on.
   - **Same-basis anchor:** the winner's (and every candidate's) `correlation`, recomputed on the selection window, reconciles to
     `solver_detail` `record_type='correlation'` corr for the same (fund, etf, asof) within a tight tolerance (they are the same
     computation on the same panel/window). This is the fault-first anchor.
   - **Cross-basis, DOCUMENTED, NOT an equality gate:** `replica_r2` (full-history weekly blend) is carried as a separate labeled
     field; the spec/gate must NOT assert `winner_correlation² == replica_r2`. (If a full-history reconciliation is wanted, the
     builder may ALSO compute a full-history-weekly winner corr and reconcile THAT to replica_r2 — but that is optional and clearly
     a second, separately-labeled basis.)
5. **Fit-quality floor (owner-mandated; this spec owns QUALITY suppression above the screen-level sign guard).** The solver's
   `corr>0` screen removes inverse ETFs at *screen* level; per the 2026-07-11 owner decision (`54e1b17`), THIS spec owns serving a
   weak match as an honest "no close passive alternative" state instead of a confident card.
   - **Floor metric:** define on the served fit basis — a minimum winner `correlation` and/or a maximum winner `tracking_error_bps`,
     and/or reuse the pipeline's existing `low_replica_flag` (`LOW_REPLICA_R2 = 0.75` on `replica_r2`, `replica_diagnostics.py`) and
     per-AC `R2_SCORE_FLOORS` (`runner.py`: EQ .60 / FI .40 / MU .30 / RE .40 / ALT −1). The EDA phase MUST derive/confirm the exact
     threshold from the real cross-fund distribution of winner fit (replica_r2 today: p05 0.50 / p25 0.80 / p50 0.89 / p95 0.97;
     504 funds already carry `low_replica_flag=true`) — **never invent the number**; write the chosen rule into the spec after EDA.
   - **Honest served state below floor:** set `match_status='no_good_match'` and **omit `selected_summary`** (no confident
     "your cheapest alternative" claim), while STILL emitting the `candidates` table so the evidence (this fund has no close passive)
     stays visible and honest. Below-floor examples in the live data: SPC (SPAC, replica_r2 0.0004), CBHCX (market-neutral, 0.001),
     EAGMX (global macro, 0.005).
6. **Honesty about the selection rule.** The L2 selection is **min-TE under a simplicity penalty over a taxonomy-routed pool**, not
   max-correlation. Carry a `selection_basis` note string and, when the correlation-closest candidate ≠ the selected candidate
   (e.g. FCNTX: IWF corr-closest, SPY selected), a `selection_divergence_reason` so the UI never implies correlation is the whole
   selection. Keep the caveat sourced from a served field, not hardcoded in the component.

## Data-integrity guardrails (non-negotiable — see feature-pipeline/README "Data-integrity")
- **No synthetic candidates or metrics.** A candidate with insufficient overlapping history is OMITTED (record nothing), never
  zero-filled. Missing reads as missing. Never read the retired raw tiingo glob.
- **Commensurability:** every candidate's corr/TE/beta share the SAME fund return series, window, frequency, and as-of — asserted
  in the builder, stamped in the row (`te_basis`, `fit_window_start/end`).
- **Reconciliation (fault-first):** exactly one `is_selected` per series == `top_l2_etf`; candidate `correlation` reconciles to the
  same-basis `solver_detail` corr. `replica_r2` is carried, labeled, and NOT equated to `correlation²` (different basis).
- **Coverage of display metadata is first-class (§5):** report populated % for `etf_name / asset_class / style_tag`, split
  honest-missing vs recoverable; a large recoverable miss is a DEFECT, not "partial coverage."
- **Run `/check-data`** on `l2_passive_candidate_fit.parquet` after the build (entity = series_id, date = fit_window_end).

## ETF display-metadata sources & coverage (§5 detail)
Name the real sources; do not fall back to `get_etf_type()`'s hardcoded dict alone (it returned `Unknown` for 2,519 selected rows
in the failed build):
- `etf_name` — `data/gold/fund_metadata.parquet` (join candidate ETF → name); the wip builder's `ETF_NAME_FALLBACK` dict is
  reference-only.
- `asset_class` — `data/gold/fund_taxonomy.parquet` / `etf_classification_signal.parquet`
  (`series_id, asset_class, geography, focus, size, confidence`; 73 curated ETFs).
- `style_tag` / `one_word_summary` — derive from `etf_classification_signal.parquet` (`size` + `focus` + `geography`) where the ETF
  is covered; OMIT (never guess a style word) where it is not.
- `expense_ratio_bps` — the existing fee/expense-ratio history used elsewhere in the assembler.
**Coverage requirement:** report populated % for `etf_name / asset_class / style_tag` over served candidate rows, split
honest-missing (ETF genuinely absent from the reference) vs recoverable (present but the join dropped it); treat a large
recoverable miss as a defect to fix, not accept.

## Tier gating
The passive-baseline / fee comparison is already public/free; the candidate table + fit floor ride the same gate as
`passive_baseline`. No paid-only field introduced; verify `applyGates` does not leak nor over-strip the new fields.

## Acceptance criteria
- `l2_passive_candidate_fit.parquet` exists, **regenerated from scratch on the canonical panels** (the 2026-07-04 on-disk artifact
  is deleted/overwritten, never used as input or target), with ≥1 scored candidate per active fund that has an L2 match.
- **FCNTX spot-check (era-stamped 2026-07-22, non-binding — recompute from live sources; deviation allowed only if explained by a
  documented basis/universe change):** `is_selected=true` on **`SPY`** (== `top_l2_etf`), NOT IWF; the candidate `correlation` for
  SPY reconciles to `solver_detail` corr (~0.95 on the selection window) within tolerance; `selection_divergence_reason` is
  populated because IWF is correlation-closest but SPY (min-TE) is selected; `replica_r2` 0.9479 is carried verbatim under its own
  label and is NOT asserted equal to SPY's `correlation²`.
- `served_facts.passive_baseline.candidates` is populated (sorted closest-first, each carrying `te_basis`) and `selected_summary`
  carries name, asset class, one-word tag, fee, corr/TE/beta + `te_basis`, labeled `replica_r2`, and fit window + source, for FCNTX
  and ≥4 other active funds.
- The served candidate-fit TE, headline `te_current`, and `replica_r2` are **distinguishable by label in the payload alone**.
- **Fit floor:** at least one below-floor fund (e.g. SPC / CBHCX / EAGMX) serves `match_status='no_good_match'`, omits
  `selected_summary`, and still emits an honest `candidates` table.
- Passive/index funds (e.g. VOO) serve NO candidate table; funds with no scored universe omit `candidates`/`selected_summary` but
  keep `display_name`/`match_status`.
- **Metadata coverage** reported (populated % for etf_name / asset_class / style_tag, honest-vs-recoverable split); no large
  recoverable miss.
- Data-reviewer PASS at each step; `/check-data` clean; the same-basis reconciliation holds across the sampled universe; served
  value == gold.

## Test plan
- Atomic: recompute FCNTX corr/TE/beta vs SPY from `fund_daily_adj_close.parquet` + the sharadar ETF panel over the served
  (selection) window and match the served values; confirm the SPY `correlation` matches `solver_detail`'s SPY corr for asof
  `2026-06-30` within tolerance.
- Cross-fund: sample ≥10 active funds; assert one `is_selected` each, equal to `top_l2_etf`, and each candidate `correlation`
  reconciles to `solver_detail` (same basis). Do NOT gate on `correlation² == replica_r2`.
- Divergence: assert FCNTX carries a non-empty `selection_divergence_reason` (IWF corr-closest ≠ SPY selected) and that a fund
  whose corr-closest == selected carries an empty reason.
- Floor: assert a low_replica / below-floor fund serves `no_good_match` with `selected_summary` omitted and `candidates` present.
- Negative: a value-style ETF (e.g. IWD for a growth fund) appears with low correlation / high TE (method discriminates); a
  passive fund yields no table.

## Out of scope
- **Frontend rendering** of the section (the React `passive_baseline` consumer) — a follow-on frontend-track spec; the design
  reference is `combined-v4.html` (era-stamped, numbers non-binding). This spec only lands the data + serving fields.
- Changing the L2 selection algorithm, the sign guard, or the candidate universe — only persist + serve what the solver already
  scores.
- The corrupted-net-ER / canonical-fee work — owned by `canonical-fee-over-passive-backend` (separate queued spec).

## Risks
- **Window/basis ambiguity is the central risk.** The selection window (5Y weekly) and the replica window (full-history weekly)
  give different R²; pin the candidate-fit to the SELECTION window (so corr reconciles to `solver_detail`), carry `replica_r2`
  separately-labeled, and NEVER equate them. Re-derive any sanity claim on the live basis before asserting it.
- The prior wip build (`58c8824`) predates the sign guard and canonical panels; treat it as design reference only, rebuild logic,
  and never reconcile against the contaminated on-disk parquet.
- ETF reference metadata (asset_class / style_tag) coverage gaps → omit the tag rather than guess; never invent a style word; but
  report coverage and fix recoverable misses.
- `fact_assembler.py` has diverged from the wip branch; re-wire `_passive_baseline()` against HEAD, don't cherry-pick.
