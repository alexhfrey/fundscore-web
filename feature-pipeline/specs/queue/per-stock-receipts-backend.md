---
id: per-stock-receipts-backend
title: Per-stock receipts panel — filed holdings × prices vs the twin (V4 movement 04 receipts + movement 01 twin column + agree/disagree annotations)
status: queued
track: backend
repo: fund_score
lane: reviewed
depends_on: foreign-holdings-enrichment   # NOT a spec slug — see § Sequencing. This is the backlog
                                          # Working-set item "Foreign-holdings classification gap"
                                          # (BETA BLOCKER, owner bar 2026-08-06); no spec exists for
                                          # it yet, so the dependency is named by backlog item.
source_proposal: ""
origin: owner decision 2026-08-06 (cutover batch 3a — BUILD before cutover, beta-critical); backlog
  Working-set item "Per-stock receipts backend for V4 movement 04"; consumer =
  feature-pipeline/specs/queue/profile-v2-production-cutover.md §04 "The receipts" + §01 card 2/3
created: 2026-08-06
scope: global
model: opus
effort: high
---

## Owner summary
This builds the data behind V4's most persuasive card: the per-stock receipts table that shows, from
the fund's own SEC filings and real prices, which of the manager's positions made or lost money
against the passive twin — "the picking cleared the fee," proven line by line. The same build gives
movement 01 its position-by-position fund-vs-twin comparison, and both panels tell the truth on
international funds: the slice we can't price is disclosed as exactly that, never papered over.

**Model note (opus, effort high):** the computation reuses proven machinery, but the weight-basis
decision (filed vs renormalized, § Computation) and the identifier-matched twin join carry real
judgment, and a plausible-but-wrong weight basis would produce receipts that look right and lie.
The fable data-reviewer gates backstop; the implementer still needs judgment above plumbing tier.

## Goal
Land, through gold to serving staging, three linked artifacts:
1. **The receipts panel** (V4 movement 04, eyebrow "04 · the manager and their names"): per priced
   position over the fund's holding-period window — filed avg weight, twin look-through weight,
   annualized return, and impact vs the twin in $/yr per $10,000 — plus the priced-coverage totals
   row and the honest unpriced-sleeve disclosure.
2. **The latest-as-of fund-vs-twin position diff** (V4 movement 01 card 2 "what the manager holds
   differently" — the twin column + twin-only rows + private/cash lines the twin cannot hold). This
   replaces the fixture-only `top10VsIwf` / `positioningBetBridges` blocks the cutover spec kills.
3. **The holdings agree/disagree annotations** (V4 movement 01 card 3 sublines): per served
   te_decomposition bet, does the filed holdings gap agree in sign with the behavior-basis bet
   direction (Canada "holdings agree — 12 points more"; UK "holdings disagree: 6.5% vs 7.1%").

## What the mockup displays (the contract — enumerated from the V4 HTML)
Source: `fund_score/docs/product/strategy/mockup_fund_profile_v4_2026-07-28.html` (all numbers
below are **era-stamped 2026-07-28 draft-computed, NON-BINDING diff references** — acceptance
recomputes from live sources, with deviations explained by documented basis/universe changes).

**Receipts card** (lines 582–598 + `RCPT` data at 875–892, sources footer line 711):
- Header: "THE RECEIPTS · EVERY POSITION vs THE TWIN · 21 QUARTERS, 2021→2026" — the window is
  NAMED in the header (quarter count + span), not assumed.
- Columns: **Position** (security name + ticker) · **Avg weight** (fund's own filed holdings
  averaged over the window) · **Twin weight** (twin's look-through weight) · **Return /yr**
  (annualized actual prices over the window, e.g. XOM +27.1%) · **Impact /yr per $10,000**
  (how much that weight difference moved the fund against the twin, e.g. XOM −$82).
- Display: top-5 positive impact + bottom-5 negative, a "… 56 more priced positions …" split row
  (the FULL priced table is behind it), and a totals row: "All 66 priced positions together ·
  50.1% · −$122".
- Caption contract: impact = "allocation and stock-picking combined, so it is a different cut from
  the +1.2% picking figure in section 02, which isolates picking alone"; "Covers the two-thirds of
  the portfolio we can price"; sample chip: "the served per-stock panel gates this fund pending
  foreign-holdings enrichment" (i.e. the mockup itself declares TRNEX gated today — confirmed in
  gold, see § Ground truth).

**Movement 01 card 2** (lines 406–407, 913–938 + `AH`/`AS`/`AC`/`AP` arrays at 897–900): every
filed line (127 for TRNEX incl. 11 private companies) vs the twin's same-day look-through —
BY SECTOR / BY COUNTRY (already served: `exposure_xray`) / **LISTED COMPANIES** (per-position:
fund weight, twin weight, difference — incl. twin-only names the fund holds at 0.00%, e.g. NVDA
1.88) / **PRIVATE COMPANIES, NOTES & CASH** (fund-only lines, "the twin cannot hold at any
price"). Footer contract: matched "by security identifier rather than by name" (draft: 94 of 110
listed names matched, 90.2% of the portfolio; the 16 unmatched are genuinely absent from the twin
— their 0.00% is real); the twin's residual small names aggregated as ONE line (draft: "9,833
further names at under 0.25% each (31.9% of it)").

**Movement 01 card 3 sublines** (lines 428–434): per-bet subline `holdings agree — N points more
than the twin` / `holdings disagree: …` under the behavior-basis bet rows.

## Sequencing — HARD PREREQUISITE (owner decision 2026-08-06, batch 3a)
This spec is **blocked on the foreign-holdings enrichment**, which has **no spec slug yet** — it is
the backlog **Working set** item *"Foreign-holdings classification gap"* (BETA BLOCKER,
`feature-pipeline/backlog.md` — the shared identifier-resolution enrichment: foreign ISIN →
sector + ISIN→US-ADR crosswalk, applied to BOTH `build_holdings_complete` and the ETF look-through,
including carrying `cusip`+`security_name` through `passive_blend_holdings`). The `depends_on`
frontmatter names that item, not a spec. Owner rationale: building first = building twice, and the
panel would gate weak for exactly the foreign-heavy funds (TRNEX included) where the proof matters
most. **Do not start Segment 1+ until the enrichment has landed and its rebuilt books are in gold;
Segment 0 (EDA) runs against the post-enrichment books and re-measures coverage.**
**UNBLOCK MECHANICS (2026-08-06 review): this dependency can NEVER auto-clear** — `/implement-next`
only recognizes slugs in `specs/done/`, and the enrichment is a backlog `(data)` item worked through
the fix-data loop, which produces no spec file. When the "Foreign-holdings classification gap"
backlog item is checked off, a human (or the closing loop's finalize step) must edit this spec's
`depends_on:` to `""` — otherwise this spec stays silently blocked forever.

Two things the enrichment does NOT fix — the honest-gating design below covers both eras:
- **Pricing** stays US-listed-only (Sharadar SEP): the ADR crosswalk recovers prices only where a
  US line exists (Shell→SHEL, Total→TTE). Foreign locals with no US listing (Fujikura, Thai Oil,
  Muyuan…) stay honestly unpriced until the EODHD foreign-pricing path (separate, later).
- Therefore foreign-heavy funds keep an **unpriced sleeve** after enrichment. The panel discloses
  it (share + post-enrichment sector composition — classification IS recovered even where pricing
  is not: "~X% of NAV, mostly foreign-listed energy"), and **never renormalizes displayed weights
  over the priced subset and never fabricates a priced value**.

## Ground truth — existing machinery (census; all references checkable)
**REUSE — do not re-derive:**
- **Per-stock Brinson receipts already exist in gold.** `data/gold/return_attribution.parquet`
  (spec #10, `return_attr_v0.2`; builder `scripts/pipeline/build_return_attribution.py` + module
  `src/fundscore/product/return_attribution.py`): per (series, period 1Y/3Y/5Y, dimension
  stock/sector/theme, member) — `fund_weight_avg`, `passive_weight_avg`,
  `member_period_return_bps`, `passive_baseline_return_bps`, `contribution_to_active_return_bps`,
  `holdings_as_of`, `passive_holdings_as_of`. Measured 2026-08-06: 6,278,625 rows, 1,943 series,
  eval_date 2026-04-30; stock-dimension series 1Y 1,941 / 3Y 1,618 / 5Y 1,425. Multi-period
  quarterly Brinson-Fachler on a shared calendar-quarter grid; suppressions surfaced in
  `data/gold/return_attribution_suppressions.parquet`.
- **The quarterly grid + weight frames** (`fund_weights_at`, `passive_weights_at` in
  `build_return_attribution.py`): fund sub-period weights from `data/gold/holdings_snapshots.parquet`
  nearest each grid start (±180d, canonical lexmax `acc_no` dedup), **filed `pct_nav` already
  carried UN-renormalized alongside** the renormalized `weight` (lines ~181–204); passive side
  RECONSTRUCTED no-lookahead per sub-period (L2 blend refit ≤ grid start ×
  `data/gold/etf_holdings_snapshots.parquet` nearest); priced-NAV coverage machinery already
  computed (`priced_coverage = Σ pct_nav(priced longs) / equity_pct_nav`, floors
  `COVERAGE_MIN_PRICED_NAV = 0.80`, `COVERAGE_MIN_NAMES = 5`, `COVERAGE_MAX_SINGLE_WEIGHT = 0.50`
  in `return_attribution.py` lines 121–164).
- **Prices**: constituents = Sharadar SEP (`data/bronze/stock_prices/sharadar_sep/*.parquet` — the
  #10 source since 2026-06-16); fund NAV = `data/gold/fund_daily_adj_close.parquet` (canonical
  panel — NEVER the raw tiingo glob); twin baseline return =
  `data/gold/passive_alt_daily_nav.parquet` `benchmark_nav`.
- **Twin look-through (latest)**: `data/gold/passive_blend_holdings.parquet` — 6,216,998 rows /
  3,594 series (measured 2026-08-06), per-security `passive_weight` + **`passive_pct_nav`** +
  `security_id`/`security_ticker`/`sector`/`inv_country` + `quality_tier`/`missing_reason`.
  Known pre-enrichment regression: NO `cusip`/`security_name` — restored by the enrichment
  (its fix (1)); the identifier-matched join below requires that restoration.
- **Fund filed book (latest, as-filed)**: `fund_holdings_full` — builder
  `scripts/pipeline/build_fund_holdings_full.py` (`FINAL_COLS` incl. `cusip`, `isin`,
  `security_ticker`, `weight_pct` = filed pctVal, `asset_cat`, `position_direction`), staging
  `data/product/fund_profiles/fund_holdings_full_staging.parquet`, long-table load pattern in
  `src/fundscore/serving/load.py` (TRUNCATE+COPY same transaction as `fund_profile_facts`) +
  `apply_serving_schema.py` DDL + web mirror `fundscore-web/src/lib/db/schema/serving.ts:159`.
- **Serving assembler**: `src/fundscore/serving/fact_assembler.py` — `return_attribution` section
  already served ("paid" gate) but TRUNCATED to top+bottom 5 per group
  (`TOP_ATTRIBUTION_PER_GROUP = 5`, `_return_attribution_by_series` line 1019); per-fund
  gate-injection pattern for long tables (gate present ⇔ rows exist, lines 241–245).
- **Sector/country fund-vs-twin aggregates**: `data/gold/exposure_xray_panel.parquet`
  (`exposure_type` ∈ sector/country_region/… with `holdings_value`, `reference_value`,
  `difference`, `coverage_state`, `confidence_state`) — already served (`exposure_xray`, free).
  Movement 01's BY SECTOR / BY COUNTRY tables need NO new backend.
- **Bets for the agree/disagree join**: served `te_decomposition` (v0.2 global basis) rows carry
  `factor_id` with `sector::`/`country::` prefixes (CORRECTED 2026-08-06 review — the live panel's
  prefixes are `country`/`gbf`/`macro`/`rollup`/`sector`/`selection`; there is NO `geo` prefix); the
  backlog sign-agreement item ("Beta/weight sign
  disagreement has no detector", filed 2026-07-30) already scoped the join as "~8 lines, both
  inputs in gold".

**Genuinely NET-NEW:**
1. A **filed-weight-basis** per-stock receipts emission (the existing #10 `fund_weight_avg` /
   `passive_weight_avg` / contribution are on the **renormalized-priced-book** basis — correct for
   #10's sum-to-active contract, WRONG for display on partial books; see § Computation).
2. Display-ready columns: annualized member return, impact in $/yr per $10,000, per-fund window
   metadata (n quarters, span), priced-coverage block + unpriced-sleeve composition.
3. **Full-table serving** (a new long table — today only top/bottom-5 rows are served).
4. The **identifier-matched per-position twin diff** at the latest shared as-of (incl. twin-only
   rows, the small-names aggregate, and fund-only private/cash lines).
5. The **agree/disagree annotation** fields on served te_decomposition bets + the /check-data
   sibling-coherence check.
6. Honest **panel-level suppression reasons served** (so the frontend renders the true absence,
   not a blank).

## Data source (real inputs, as-of)
| Input | Path | Role |
|---|---|---|
| Fund holdings panel (windowed) | `data/gold/holdings_snapshots.parquet` (post-enrichment rebuild) | fund sub-period books; filed `pct_nav` basis |
| Raw N-PORT (atomic checks) | `data/nport/holding/` partitions, recent-2yr glob + lexmax `acc_no` | ground truth for spot checks |
| L2 blend weights | `data/bronze/benchmark_calculation/level2/weights/asof_refit_date=*/` | no-lookahead twin per sub-period |
| ETF holdings | `data/gold/etf_holdings_snapshots.parquet` (post-enrichment) | twin look-through legs |
| Constituent prices | `data/bronze/stock_prices/sharadar_sep/*.parquet` | member returns (US lines + ADRs) |
| Twin NAV | `data/gold/passive_alt_daily_nav.parquet` (`benchmark_nav`) | Brinson sub-period baseline |
| Fund NAV | `data/gold/fund_daily_adj_close.parquet` | reconciliation checks only |
| Latest fund filed book | `fund_holdings_full` staging (as-filed) | movement-01 fund side |
| Latest twin look-through | `data/gold/passive_blend_holdings.parquet` (post-enrichment, with cusip/name) | movement-01 twin side |
| Bets + aggregates | `data/gold/te_decomposition.parquet`, `data/gold/exposure_xray_panel.parquet` | agree/disagree join |

Universe: the `source_inventory` serving scope. As-of: receipts eval_date anchored to
`min(price_frontier, holdings_frontier)` exactly as #10 does (gold today: 2026-04-30; the N-PORT
store spans to 2026-05-31 — the rebuild advances it; era-stamped, non-binding).

## Computation (precise; column names = what is computed)
**A. Receipts (windowed, per stock).** Reuse #10's shared sub-period machinery (grid, weight
frames, SEP return frame, baseline). Refactor the shared pieces into functions both products call
(the te-decomposition "shared basis module" rule — never copy-paste a second engine). Emission per
(series, period, member), **filed basis both sides, never renormalized**:

- `fund_pct_nav_avg` — mean over sub-periods of the member's SEC-filed `pct_nav` (pctVal basis —
  owner decision 2026-07-08 locks pctVal for ALL product-displayed holding weights). NOT #10's
  renormalized `weight`.
- `twin_pct_nav_avg` — mean over sub-periods of Σ_etf blend_w × ETF-filed member `pct_nav`,
  UN-renormalized (the twin's own unresolved sleeve shows as honestly missing weight, mirroring
  the fund side).
- `member_return_annualized_pct` — ((1 + r_cum)^(1/period_years) − 1) × 100 from the same SEP
  cumulative return #10 computes (`member_period_return_bps` also carried raw).
- `impact_bps_window` = Σ_sub (fund_pct_nav_sub − twin_pct_nav_sub) × (r_member_sub −
  r_baseline_sub) — the Brinson-Fachler per-stock term on the filed basis; and
  `impact_usd_per_10k_yr` = impact_bps_window / period_years (1 bps/yr = $1/yr per $10,000).
- Window metadata: `period` (1Y/3Y/5Y), `period_start_date`, `period_end_date`, `n_quarters`
  (sub-periods actually used — the header's "21 quarters" is served, never hardcoded),
  `holdings_as_of`, `method_version`.
- Per-fund coverage block (computed once per (series, period)): `priced_nav_share_avg` (Σ filed
  pct_nav of priced longs ÷ filed equity NAV, averaged over sub-periods — the FILED-NAV
  denominator, per the exposure-path coverage-denominator lesson: never measure coverage against
  the already-subset priced book), `n_priced_members`, `n_filed_lines_latest`, `unpriced_share`,
  `unpriced_top_sectors` (post-enrichment classification of the unpriced sleeve — classify-able
  even where unpriceable), and twin-side `twin_lookthrough_share`.
- Totals (per fund, priced positions only, labeled as such): `total_impact_usd_per_10k_yr`,
  `sum_fund_pct_nav_avg`. **No sum-to-active-return claim is made or served** — that is #10's
  contract on its renormalized basis; the receipts totals row is "what the priced book did," and
  the gap to the fund's actual active return belongs to the unpriced sleeve + fees + trading (the
  One Ledger's future territory, not this spec's).

Notes that bind the implementer:
- The filed basis **structurally removes** #10's Gate-A renormalization blow-up class (a 2%-of-NAV
  ADR can never display as ~100%); keep the `COVERAGE_MIN_NAMES`/single-name floors as display
  sanity, reasons served.
- `holdings_snapshots` is longs-only — the receipts cover the long book; short/derivative lines are
  out of panel and the coverage denominator follows the existing longs/GROSS convention already in
  `build_return_attribution.py` (see also the queued `holdings-book-basis-disclosure` spec — do
  not fork its contract, reference it).
- The twin per sub-period is the **era-appropriate refit** (no lookahead), same as #10 and the
  graded-history basis — receipts are history; do NOT recompute historical receipts against the
  current twin.

**B. Twin position diff (latest as-of).** One frame per series at the latest shared as-of:
FULL OUTER join of the as-filed fund book (`fund_holdings_full` basis — all lines incl. private/
notes/cash) × twin look-through (`passive_blend_holdings` post-enrichment) on **resolved
`security_id`**, with ISIN/CUSIP crosswalk fallback (the enrichment's shared identifier
resolution; never name-string matching). Columns: identity (`security_id`, `security_ticker`,
`isin`, `cusip`, `security_name`), `fund_weight_pct` (filed pctVal), `twin_weight_pct`
(look-through pct_nav basis), `diff_pp`, `match_state` ∈ {matched, fund_only, twin_only},
`fund_asset_cat` (private/cash lines keep their filed class — "the twin cannot hold these" is
frontend copy), `as_of_fund`, `as_of_twin`, `match_coverage_pct` (share of fund NAV on matched +
fund_only-verified lines). Twin-only rows kept above a floor (default 0.25% look-through weight —
the mockup's own cut); below-floor twin names served as ONE aggregate
(`twin_small_names: {count, weight_sum_pct, floor_pct}`). An unmatched fund line whose identifier
resolution FAILED (vs. genuinely absent from the twin) must be distinguishable:
`match_state = fund_only` requires the twin book to be identifier-complete for that line's class;
otherwise `unmatched_identifier` — never display a false 0.00% twin weight (the mockup footer's
"their 0.00% is real" claim must be TRUE where we serve it).

**C. Agree/disagree annotations.** For each served te_decomposition bet with a holdings analog
(`sector::*` → exposure_xray `sector` rows; `country::*` → `country_region`): emit
`holdings_fund_pct`, `holdings_twin_pct`, `holdings_gap_pp`, and `holdings_agreement` ∈
{agree, disagree, no_data}. `agree` = sign(bet direction) == sign(holdings difference);
`no_data` when the xray row's `coverage_state` is low (never a confident disagreement on an
under-classified book — the 2026-07-13 interim-fix precedent) or when the bet has no holdings
analog (commodity/macro/style). Plus: register the sign-agreement join as a `/check-data`
sibling-coherence check (the 2026-07-30 backlog item (a)) so future rebuilds auto-detect drift.

## Output
- `data/gold/stock_receipts_panel.parquet` — grain (series_id, period, member_id); columns § A
  (+ `series_id`, `fund_ticker`, `eval_date`, `member_id`, `member_label`, `security_ticker`).
- `data/gold/stock_receipts_suppressions.parquet` — (series_id, period, reason) for every
  serving-scope equity fund with NO panel rows: reasons at least
  {below_priced_floor, too_few_priced_names, degenerate_book, no_holdings_history,
  non_equity_book}. **Every scope fund appears in exactly one of panel/suppressions per period —
  missing entry = fail-open = build failure** (the applyGates-owns-the-section lesson, backend
  edition).
- `data/gold/twin_holdings_diff.parquet` — grain (series_id, security row) per § B + the per-fund
  `twin_small_names` aggregate (separate small parquet or nested — implementer's call, documented).
- Serving staging (next to `serving_facts_staging.parquet` per the long-format pattern):
  `data/product/fund_profiles/fund_stock_receipts_staging.parquet` (ONE window per fund — the
  longest available period, window labeled in every row; 1Y/3Y stay in gold) and
  `data/product/fund_profiles/fund_twin_holdings_diff_staging.parquet`.

## Serving integration
- `fact_assembler.py`: new `receipts` JSONB section (SECTION_COLUMNS + GATES) — summary only:
  window metadata, coverage block, totals row, suppression reason when suppressed, and
  `basis_note` stating the two-cuts distinction (impact = allocation+picking combined; the skill
  headline's picking figure is factor_attribution's selection-only cut — the caption contract).
  Gate **"paid"** (match `return_attribution`); free teaser = counts/coverage/as-of/window only
  (the free-proof-point pattern), NO per-stock rows below the gate.
- Two new long tables `fund_stock_receipts` + `fund_twin_holdings_diff`: DDL in
  `apply_serving_schema.py` (correct on fresh-DB and upgrade paths), loaders in
  `serving/load.py` LONG_TABLES — TRUNCATE+COPY **in the same transaction** as
  `fund_profile_facts` (teaser counts and rows can never diverge mid-deploy). Per-fund gate
  injection: `gates.receipts` / row presence coherent, exactly the `holdings_full` pattern
  (fact_assembler lines 241–245).
- te_decomposition serving rows: add the § C annotation fields (additive — no existing field
  changes; the web `TeBet` type gains optional fields).
- Web mirror (`serving.ts` tables + types) is the FRONTEND spec's first task; this spec publishes
  the column contract in the build module docstrings + `docs/status/pipeline_status.md`.
- **STAGING ONLY**: the Postgres push rides the owner-gated serving reload (campaign hard stop) —
  never load serving from a branch missing other features' emitters.

## Coverage doctrine — measured baseline + honest gating (first-class, up-front)
Pre-enrichment baseline (measured 2026-08-06 on gold `return_attr_v0.2`, eval 2026-04-30):
- Stock-dimension coverage: 1Y **1,941 of 4,002** in-universe series (48.5%); 3Y 1,618 (+1,756
  suppressed); 5Y 1,425 (+1,559 suppressed). Suppression mass is overwhelmingly
  `insufficient_priced_coverage` (filed-NAV priced share < 0.80): 2,047 / 1,754 / 1,557 series.
- TRNEX (= series S000002105, primary ticker PRNEX): suppressed all three periods,
  `insufficient_priced_coverage` — exactly the mockup's "gates this fund pending foreign-holdings
  enrichment" chip.

Gating design (both eras):
- **Display floor** (proposed default — Segment 0 confirms with data and the owner signs it):
  serve the receipts panel when `priced_nav_share_avg ≥ 0.50` AND `n_priced_members ≥ 5` AND no
  single priced name ≥ 50% of the priced book; between 0.50 and 0.80 the panel serves WITH the
  unpriced-sleeve disclosure mandatory in the payload (share + composition); below the floor,
  suppress with a served reason. Rationale: on the filed basis every displayed number is exact
  filed evidence regardless of overall coverage — what low coverage invalidates is completeness,
  which the disclosure carries; the mockup itself displays TRNEX at ~2/3 priced. The 0.80 floor
  remains #10's contract for sum-to-total attribution — unchanged.
- **Never renormalize, never fabricate**: displayed weights are filed pct_nav; unpriced lines are
  absent from rows but present in the disclosure; no imputation anywhere.
- Twin-side honesty is symmetric: `twin_lookthrough_share` served; a twin book that is itself
  under-resolved (global ETFs pre-enrichment) reads as low twin coverage, not as false zeros.

## EDA gate (Segment 0 — data-scientist, BEFORE any build; blocks on enrichment landing)
Deliver a short report; headline = the coverage number. Questions:
1. **Post-enrichment coverage census** (the headline): fraction of serving-scope equity funds
   clearing the proposed display floor per period, vs the 2026-08-06 baseline above. Split the
   remainder **honest-missing** (no US line/ADR exists for the unpriced mass — spot-check ≥10
   misses against raw N-PORT + the crosswalk) vs **recoverable-missing** (crosswalk exists but the
   pipeline missed it — a DEFECT, iterate before building on). Same census for the twin side
   (global-ETF look-through resolution, IXC-class).
2. **Golden funds**: TRNEX/PRNEX (does it clear the floor post-enrichment? mockup expectation ~66
   priced of 127 filed; anchor on the mockup's own COMPUTED totals-row 50.1% avg priced weight, not
   its "two-thirds" caption prose — the mockup is internally inconsistent between the two (2026-08-06
   review) — 2026-07-28 draft figures, non-binding), FCNTX (domestic
   high-coverage), one intl/EM fund, one passive index fund (receipts ≈ 0 impact — a natural
   no-signal control).
3. **Filed-basis vs renormalized-basis deltas** on high-coverage funds (priced ≥ 0.9 both sides):
   per-stock impact distribution of |filed − renormalized|; the filed-basis priced-book total vs
   #10's stock-dimension sum vs the measured active return — establish and document the tolerance
   band before the build claims coherence.
4. **Window depth**: distribution of `n_quarters` at 5Y (the "21 quarters" class); how many funds
   fall back to 3Y/1Y as their longest window; holdings frontier after the rebuild.
5. **Twin-diff match rate** (movement 01): identifier-match coverage on 10 sampled funds incl. 2
   foreign-heavy — matched share of fund NAV, and the unmatched split (genuinely-absent vs
   unresolved-identifier). Mockup diff reference: 94/110 names, 90.2% NAV (TRNEX, 2026-07-28).
6. **Agreement-rate prior** (§ C): across funds, what fraction of sector/geo bets agree in sign
   with holdings gaps? (Backlog TRNEX probe 2026-07-30: 6 of 8 mappable bets agreed.) A very low
   global agree rate = join bug, not a finding.

Checkpoint: EDA report → **owner briefing** (display floor + coverage bar + any basis surprise) →
data-reviewer sanity pass on the report's claims. Only then build.

## Build segments (assembly-line; data-reviewer checkpoint closes each)
**Workflow-fit note (2026-08-06 review):** `implement-backend-spec.js` provides exactly TWO
pre-serving checkpoints (`implement-sample`, `implement-full`) plus one combined final gate — not
one per segment below. Mapping: segments 1+2+4 all land inside the sample/full passes, so the
implementer must cover ALL THREE artifacts (receipts panel, twin diff, agree/disagree rider) in
each pass and the reviewer's checklist at each checkpoint spans all three; segment 3 (serving) and
segment 5 map onto the final combined gate. If the cutover timeline pinches, split segment 4 into
a follow-on spec instead of skipping its checks.
1. **Receipts gold panel** (§ A): shared-machinery refactor + filed-basis emitter + suppressions +
   invariants wired into the build CLI (fail the build on violations — the te-decomp P2 lesson) +
   `run_checks.py` registration. Reviewer: atomic + aggregate checks below (panel scope).
2. **Twin position diff** (§ B): builder `build_twin_holdings_diff.py`. Reviewer: match-state
   honesty (no false 0.00%), identity-join spot checks vs both raw books.
3. **Serving** (§ Serving integration): staging parquets, DDL, loaders, `receipts` section,
   gate/teaser coherence. Reviewer: served == gold field-by-field on sampled funds; leak check
   (teaser carries no per-stock rows); every-fund-has-entry (section or suppression).
4. **Agree/disagree rider + /check-data sibling check** (§ C — separable if the cutover timeline
   pinches; it degrades to "rows carry behavior figures only" per the cutover spec). Reviewer:
   sign-join spot checks incl. the TRNEX UK/Australia known-disagree pair.
5. **Final gate**: `/check-data` protocol (below) + final adversarial data-reviewer pass +
   codex gate per house workflow.

## Verification plan (for the data-reviewer gates)
Sample sizes: **15 funds** for atomic checks (stratified: 5 domestic high-coverage, 5
foreign-heavy incl. TRNEX/PRNEX, 2 intl/EM near the floor, 2 passive controls, 1 fund-of-funds),
**3 rows per fund** traced end-to-end; plus the full-universe aggregates. Baseline/prior = the
2026-08-06 measurements in this spec + `return_attr_v0.2` gold as diff reference.

Atomic (vs raw source, not vs our own intermediate):
- `fund_pct_nav_avg`: recompute from raw `data/nport/holding/` partitions (lexmax acc_no dedup) for
  the sampled member across the window's sub-period snapshots; must match exactly.
- `twin_pct_nav_avg`: recompute one sub-period by hand from the L2 blend weight file × the ETF's
  raw N-PORT filing.
- `member_return_annualized_pct`: recompute from Sharadar SEP adjusted closes.
- `impact_usd_per_10k_yr`: arithmetic identity recomputed independently from the served
  components; the TRNEX XOM row against the mockup's −$82 as an era-stamped diff reference (2026-07
  draft — deviation explained or investigated, not auto-accepted).
- Twin-diff: one matched, one fund_only-private, one twin_only row per sampled fund traced to both
  raw books.

Aggregate:
- **Renormalization detector**: distribution of per-fund `sum_fund_pct_nav_avg` ÷ filed equity NAV
  share — a spike at exactly 1.0 among partial-coverage funds = renormalization bug (FAIL).
- Coverage: served-fund count per period vs the EDA bar; suppression-reason histogram vs EDA;
  panel ∪ suppressions == universe (no silent absences).
- Coherence: on priced ≥ 0.9 funds, filed-basis priced-book total within the EDA tolerance band of
  #10's stock sum and the measured active return; passive controls ≈ 0 total impact.
- Per-series regression diff vs the pre-build #10 panel for shared members (the
  aggregate-gate-masks-per-series lesson: diff per-series, not medians).
- No-leakage: staging teaser fields ⊄ per-stock rows; gate present ⇔ rows exist (both tables).
- Statistical: impact heavy-tail scan (|impact| > 99.9th pct rows hand-checked — the VEON/TSM
  degenerate class must be structurally gone on the filed basis); agree/disagree rate vs EDA prior.

## Acceptance criteria
- **Coverage headline reported first**: served %, per period, honest-vs-recoverable split
  spot-checked at the raw source; recoverable-missing ≈ 0 or itemized as defects fixed before
  ship. Meets the Segment-0 owner-signed bar.
- All Segment reviewer checkpoints green; `/check-data` passes for BOTH new gold panels and both
  staging tables (entity = series_id, date = eval_date/as_of); FAIL blocks, WARNs to the owner.
- Served == gold on the 15-fund sample, field-by-field, both tables + the `receipts` section.
- Honest degradation proven on a foreign-heavy fund: either rows + mandatory unpriced-sleeve
  disclosure, or a served suppression reason — demonstrated for TRNEX/PRNEX whichever side of the
  floor it lands post-enrichment.
- Zero renormalized displayed weights (detector above); zero fabricated/imputed values; twin-diff
  serves no false 0.00% (unresolved ≠ absent).
- Mockup numbers treated ONLY as era-stamped diff references; every acceptance figure recomputed
  live, deviations explained by documented basis/universe changes.
- Build CLIs fail on invariant violations; panels registered in `run_checks.py`; staging load is
  same-transaction; nothing pushed to serving Postgres (owner-gated reload).
- `docs/status/pipeline_status.md` + the backlog item updated (archive protocol) on completion.

## /check-data protocol (final gate inputs)
Run per rebuilt artifact with: feature name (`stock_receipts_panel` / `twin_holdings_diff` /
staging pair), path, format parquet, entity column `series_id`, date column `eval_date` (receipts)
/ `as_of_fund` (diff), universe type = serving-scope equity funds, report to
`fund_score/reports/per-stock-receipts-backend_check_data.md`. Then the adversarial data-reviewer
semantics pass (green gate ≠ sufficient — the serve-l2 inverse-ETF lesson).

## Out of scope
- EODHD foreign constituent pricing (separate backlog item; shrinks the unpriced sleeve later).
- The One Ledger reconciliation chain (receipts feed it later; no sum-to-NAV claim here).
- Changing #10's renormalized attribution contract or its 0.80 floor; the returns-based
  low-coverage attribution fallback (separate story item).
- Frontend rendering (a `depends_on: per-stock-receipts-backend` frontend spec under the cutover
  umbrella; display-language locks noted below bind it).
- Manager identity/skill blocks of movement 04 (already served).

## Display-language locks (bind the payload + the future frontend)
- Receipts are **past-tense evidence** — "added/cost over this window", never forecast, never
  "will".
- Never "timing skill"; any moving-the-tilt figure is "the realized contribution of moving the
  exposure".
- No "biggest bet" superlatives off behavior-basis bets when `top_bet_confident` is false;
  receipts-table superlatives ("the biggest drag") are permitted ONLY as arithmetic on served
  filed rows, past-tense, on the displayed window.
- The two-cuts caption (impact ≠ the picking-alone figure) ships in `basis_note` so no consumer
  can conflate them.

## Risks
- **Weight-basis subtlety is the top risk**: filed-basis impact quietly diverging from #10 on
  high-coverage funds beyond the EDA tolerance would mean a grid/join bug, not a basis choice —
  Segment-1 reviewer must treat any unexplained divergence as blocking.
- Enrichment lands with lower-than-hoped ADR pricing recovery → coverage bar misses; the EDA gate
  catches this BEFORE build and re-briefs the owner (floor vs bar trade-off), no silent shipping.
- Row volume (full stock dimension ≈ 2.2M rows at 5Y alone): one-window-per-fund serving keeps the
  table bounded; loaders must stay COPY-based.
- Identifier-join wrong-binding class (the FMP BHP lesson): tied/ambiguous claimants in the
  twin-diff join → honest exclusion (`unmatched_identifier`), never a forced match.
- Concurrent worktree contamination on shared `data/` (known lesson): isolated worktree, scoped
  commits, symlinked lakehouse, pinned `--as-of` on rebuilds.


## ADDENDUM — 2026-08-26 owner ruling on DECISION 1 (pricing basis)

Owner, in-session (Path-to-Live batch): *"we have foreign stocks from EODHD, try to use that and
fallback to US if not available."* This supersedes the three framings (1a/1b/1c) in the S2-D4
decision section. Binding consequences for Segment 1:

- **Pricing precedence for a non-US-listed holding:** (1) the ordinary share's own price history from
  EODHD, once the `eodhd-international-prices` ingestion lands — that spec is now a PREREQUISITE of
  this segment; (2) fallback where EODHD lacks the ordinary: the US listing. Ra (US-primary listing)
  recovery is unconditional either way — it is a defect fix, not a basis change. A true ADR proxy is
  used only as the labelled fallback, under 1b's full contract (row-level label, corporate-action
  screen, honest exclusion on screen-fire).
- **`pricing_basis` becomes a served per-row enum: `{eodhd_ordinary, us_line, adr_proxy}`.**
- The Segment-0 wedge measurements (F-S2.9) remain the acceptance baseline for any `adr_proxy` rows;
  EODHD-priced rows need their own spot-check leg vs filed `valUSD/balance` marks (same method,
  new vendor).
- **Sequencing (not silently chosen):** if this spec is dispatched before the EODHD ingestion is
  served, STOP and check the register/run log for the owner's sequencing answer — the interim
  (build on `us_line` + labelled `adr_proxy`, re-price when EODHD lands) was offered to the owner
  on 2026-08-26; do not assume either way.
