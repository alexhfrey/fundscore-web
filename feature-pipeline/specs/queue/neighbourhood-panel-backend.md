---
id: neighbourhood-panel-backend
title: Neighbourhood panel — twin full-life vs IVV/VT/BND growth, capture, drawdown/recovery (V4 movement 03 serving source)
status: queued
track: backend
repo: fund_score
lane: reviewed
depends_on: ""
source_proposal: feature-pipeline/backlog.md (owner decision 2026-08-06, batch 3b — "IN for beta"; movement 03 of specs/queue/profile-v2-production-cutover.md)
created: 2026-08-06
scope: global
model: opus
effort: high
---

## Owner summary
Before a reader judges the manager, they should judge the space the fund lives in: this ships the
data behind the profile's "neighbourhood" view — how the fund's passive twin has grown since 2008
next to plain US stocks, world stocks, and bonds, and how deep and how long its worst holes were.
Today that view exists only as hand-computed draft numbers in the V4 mockup; this builds the real,
gated data product so the page can render it for every fund with a served twin.

**Lane rationale (reviewed):** brand-new served financial computations (growth, capture ratios,
drawdown depth/recovery durations) shown to retail users, plus a new serving section and a
cross-repo schema mirror — a wrong value here misleads a fund profile. Model `opus` per owner
instruction; the capture/drawdown basis decisions and the window edge cases carry real judgment.

## Goal
A small deterministic gold panel + serving section for V4 movement 03 ("03 · the neighbourhood"):
for each served passive twin (keyed by blend, not by fund — 6,202 unique blend signatures cover
25,386 fund tickers in `passive_alt_blend.parquet`, measured 2026-08-06), a monthly
growth-of-$10,000 series over the twin's FULL life for four legs — the twin (current mix, backcast,
HYPOTHETICAL), IVV (US stocks), VT (world stocks), BND (US bonds) — plus the derived stats the
mockup displays: per-leg annualized return + end value, an up/down capture triple vs VT, the worst
three drawdowns with back-to-even dates, and calendar-year twin-vs-VT returns.

## Context
- **Owner decision 2026-08-06 (batch 3b): IN for beta.** The cutover spec
  (`specs/queue/profile-v2-production-cutover.md` § "03 · The neighbourhood") records: all four
  cards have **no serving source**; the mockup computed them from daily adjusted closes; "this is
  a small, deterministic gold panel + serving section (per-twin, not per-fund: keyed by the served
  blend) … Never compute return series in the web tier."
- **Redesign-collision check (2026-08-06):** clean. The only in-flight item touching movement 03 is
  the cutover spec itself, which explicitly *requests* this backend spec as its prerequisite; no
  queued spec or approved proposal retires or replaces the panels/paths named here. The cutover
  spec's frontend movement-03 work consumes this spec's output (it is the "backend spec
  pre-cutover" its batch-3 decision (b) called for).
- **What the mockup renders** (`fund_score/docs/product/strategy/mockup_fund_profile_v4_2026-07-28.html`,
  eyebrow "03 · the neighbourhood", enumerated 2026-08-06):
  1. **Growth of $10,000** — log scale, monthly points Jun 2008 → Jul 2026, four lines
     (twin / US stocks / world stocks / bonds), caption "EACH LINE NET OF ITS OWN ETF FEE"; tiles
     per leg: annualized return, `$10,000 → $X` end value, window length ("The twin · 18 years").
     Caption canon: "The window starts June 2008 because that is when Vanguard Total World began —
     we do not splice in proxies to reach further back."
  2. **Capture triple** (monthly, VT as reference): "WHEN WORLD STOCKS FELL 110% of the fall came
     through — across 79 down months", "WHEN THEY ROSE 97%", "ROSE ANYWAY 15 of 79".
  3. **The holes** — worst three twin drawdowns, "Measured on the twin mix, daily closes":
     peak month, depth %, trough month, back-to-even month, underwater months
     (Jul 2014 −53% → May 2021, **82 months**; Jul 2008 −56% → Apr 2011, 33; Apr 2011 −29% →
     Sep 2013, 29).
  4. **Year-by-year bars** — twin vs VT calendar-year returns derived from the same monthly
     series; 2008 and 2026 flagged as partial years.
  The neighbourhood series has **no fund leg** — the fund-vs-twin story is movement 02
  (`profile_nav_series`), on the graded window; movement 03 is the asset-class question on the
  twin's full life. The mockup's own sources block: "neighbourhood — computed from daily adjusted
  closes: twin (IGE/VT), IVV, VT, BND, Jun 2008 → Jul 2026".
- **All mockup figures are era-stamped 2026-07-28 draft-computed and NON-BINDING** (twin +5.4%/yr
  → $25,600; VT +8.9% → $46,500; IVV +12.4% → $82,500; BND +2.9% → $16,800; 110%/97%/15-of-79;
  the three drawdown rows). They are diff references only; acceptance recomputes from live gold,
  and any deviation must be explained by a documented basis/universe change (e.g. panel as-of
  advanced past 2026-07-10, or a new refit changed the TRNEX blend).
- **Mockup defects found while grounding (do not reproduce):**
  - *"Global bonds = BND" is a mislabel.* BND is Vanguard **Total Bond Market** — US investment-
    grade bonds, not global. The honest global vehicle (BNDW) begins 2018-09-06 (measured in the
    canonical panel) and cannot reach 2008; the no-proxy canon forbids splicing. Ruling: keep BND,
    serve the label **"US bonds (BND)"** — never "global bonds". Flagged for the cutover copy.
  - Movement 06's "Twin IXC 55% + VT 45%" is the stale pre-pool-add twin (already flagged
    non-binding in the cutover spec); the sources block's IGE 67.8% + VT 32.2% (refit 2026-06-30)
    is the current one.
  - The cutover spec's claim "SPY has ZERO rows in `fund_daily_adj_close.parquet`" is now stale:
    SPY has 6,669 rows (2000-01-03 → 2026-07-10, measured 2026-08-06). Irrelevant to the design
    (IVV stays the S&P line per the mockup) but the staleness gate should not trip on it.
- **Labeling canon that binds** (Crescent-preview backlog item, backlog.md line 65; V3 iteration
  memo `crescent_v3_iteration_2026-07-27.md` window doctrine): the twin full-life series is the
  CURRENT mix backcast — **HYPOTHETICAL**, and must carry `hypothetical: true` + `mix_as_of` so
  the web renders the "HYPOTHETICAL · MIX-AS-OF <refit>" chip. The since-2017 start was ruled
  effectively cherry-picked (it began three weeks after the twin's 42-month underwater stretch
  ended); the full-life window with the binding-inception reason stated is the replacement.

## Data source (real inputs, as-of measured 2026-08-06)
- **Prices — canonical panel ONLY as primary:** `data/gold/fund_daily_adj_close.parquet`
  (`ticker, date, adj_close`; NEVER the raw tiingo glob — random adjustment vintage, see
  `docs/context/data-dictionary.md` + the canonical-panel memory card). Verified present with full
  histories through the panel's current as-of 2026-07-10:
  IVV 2000-05-19→, VT 2008-06-26→, BND 2007-04-10→, IGE 2001-11-26→, IXC 2001-11-16→.
  Of the 138 ETFs used in served blends, **137 are in the canonical panel; the single miss is GLD**,
  which is in `data/vendors/sharadar/sfp/daily/adj_close_all.parquet` (`closeadj`). Fallback rule:
  sharadar `closeadj` only for members absent from the canonical panel (today: exactly GLD), with
  the fallback membership logged. **Never** the proxy-spliced series
  (`fundscore.passive_match.etf_proxies.splice_etf_proxies` extends ETF history with proxies for
  the solver — the no-proxy canon forbids it here; use raw first-price dates).
- **Twin weights:** `data/gold/passive_alt_blend.parquet` (`fund, etf, etf_name, weight, rank`;
  weights sum to 1.0 ± ~1e-7 (measured max deviation 9.34e-8 across 25,386 funds), ≤3 ETFs per
  blend) — the SAME artifact `_blend_by_ticker` serves as
  `passive_baseline.etf_weights`, so the neighbourhood twin is by construction the displayed twin.
- **Mix as-of + fit floor:** `data/gold/l2_passive_candidate_fit.parquet` — `asof_refit_date`
  (currently unique = 2026-06-30; build-fail if not unique) and `below_fit_floor` per series_id
  (807 of 4,611 series below floor today).
- **Serving key map:** `data/gold/fund_metadata.parquet` `series_id → primary_ticker` guarded by
  the `_valid_ticker` regex — identical to `build_profile_nav_series._series_ticker_map()`.
- Orientation: `docs/agent_context_map.md` (alpha-nav + passive-match rows),
  `docs/context/alpha-nav.md`, `docs/context/passive-match.md`.

## Computation
New builder `scripts/pipeline/build_neighbourhood_panel.py` (+ Makefile target
`build-neighbourhood-panel`), `METHOD_VERSION = "neighbourhood_v1_<build-date>"`. Reuse the
month-end-downsample / contiguity / honest-truncation mechanics of
`scripts/pipeline/build_profile_nav_series.py` (the proven pattern); do NOT reuse
`compute_benchmark_nav` (it is piecewise-refit with a >50%-coverage fill rule — the neighbourhood
twin is a clean fixed-current-weights backcast with full membership required).

Per unique blend (`blend_key` = members sorted by ticker, `"{ETF}:{round(weight*10000)}"` joined
with `|`, e.g. `IGE:6780|VT:3220`):
1. **Window**: `window_start` = max over {blend members ∪ IVV, VT, BND} of each ticker's first
   priced date (unspliced); `window_end` = last date all legs are priced. VT (2008-06-26) binds
   unless a blend member is younger. Record `binding_ticker` (the argmax). No proxies, no
   backfill, ever. Blends with fewer than **36 month-ends** in-window are dropped (honest
   too-short — a "worst three drawdowns" table on <3y is noise); count reported.
2. **Daily NAVs**: twin = cum-product of `Σ weight_i × r_i(t)` (fixed current weights, daily
   rebalanced — the same convention the mockup states: "rebalanced daily") over member daily
   adjusted-close returns; comparator legs = each ETF's own adjusted-close cum-product. Every
   in-window (leg, date) must be priced — a missing member day is a data defect to surface, not a
   fill-with-zero. Adjusted closes embed each ETF's expense ratio, so every leg is net of its own
   ETF fee by construction (verified precedent: `build_profile_nav_series.py` docstring — the
   IWF passive leg reproduces raw `closeadj` compounding to 1e-14).
3. **Monthly series**: month-end downsample (last trading day per calendar month) of all four
   daily NAVs; normalize all legs to **$10,000 at the first common month-end**; grid must be
   contiguous (same guard as `build_profile_nav_series`).
4. **Tiles** (per leg, from the monthly grid): `ann_return_pct = ((end/10000)^(12/n_ret) − 1)×100`
   with `n_ret` = monthly return count; `end_value`; `years = n_ret/12`.
5. **Capture triple** (monthly returns, VT the reference; definition pinned here because the
   draft's is unrecoverable): down months = VT monthly return < 0;
   `down_capture_pct = 100 × mean(twin_r | down) / mean(vt_r | down)`; up months analog;
   `n_down_months`; `n_down_months_twin_up = count(down ∧ twin_r > 0)`. The mockup's 110/97/15-of-79
   are non-binding draft values — if the pinned definition reproduces materially different
   figures, report the diff (definition difference is itself a documented basis change).
6. **Drawdowns** (on the DAILY twin NAV — "daily closes" per the mockup caption): running-max
   episodes; keep the **top 3 by depth**; per episode: `peak_date`, `trough_date`,
   `depth_pct` (< 0), `recovery_date` (first date NAV regains the peak; NULL if not yet),
   `underwater_months` = calendar month difference peak→recovery (formula
   `(y2*12+m2) − (y1*12+m1)`, verified to reproduce all three mockup rows: 82/33/29), computed
   to `window_end` with `ongoing = true` when unrecovered. Never clamp; display ordering is the
   web's call — emit `rank` by depth.
7. **Calendar years** (from the same monthly grid — never a second return computation): twin and
   VT year returns; `partial = true` for the first and last calendar years when they don't span
   Jan→Dec.

Degenerate blends (twin = 100% VT, or containing IVV/BND) are served as computed — the twin leg
duplicates a comparator; honest, and the web may visually dedupe.

## Output (gold parquets)
- `data/gold/neighbourhood_series.parquet` — one row per (blend_key, month_end):
  `blend_key (str), month_end (date), twin_growth, ivv_growth, vt_growth, bnd_growth (f64, $ per
  $10k), method_version (str)`.
- `data/gold/neighbourhood_stats.parquet` — one row per blend_key:
  `blend_key, mix_as_of (date), window_start (date), window_end (date), binding_ticker (str),
  n_months (i64), years (f64), twin_ann_pct, twin_end_value, ivv_ann_pct, ivv_end_value,
  vt_ann_pct, vt_end_value, bnd_ann_pct, bnd_end_value, down_capture_pct, up_capture_pct,
  n_down_months (i64), n_down_months_twin_up (i64), method_version`.
- `data/gold/neighbourhood_drawdowns.parquet` — up to 3 rows per blend_key:
  `blend_key, rank (i8, by depth), peak_date, trough_date, depth_pct, recovery_date (nullable),
  underwater_months (i64), ongoing (bool), method_version`.
- `data/gold/neighbourhood_years.parquet` — one row per (blend_key, year):
  `blend_key, year (i32), twin_pct, world_pct, partial (bool), method_version`.
All writes sorted + zstd via the tmp-then-replace pattern; **build twice must be byte-identical**
(the `l2_blend_etfs` non-determinism lesson — sort every group-by output before write).

## Serving integration
- `src/fundscore/serving/fact_assembler.py`:
  - New `_neighbourhood_by_series()` following the `_nav_series_by_series()` passthrough pattern:
    load the four gold parquets once, key payloads by `blend_key`, then map each series_id →
    primary_ticker → its `passive_alt_blend` components → recomputed `blend_key`.
  - **Fail-closed sibling coherence** (same doctrine as the `passive_baseline` rank-1-vs-selected
    guard at `fact_assembler.py:~2195`): the blend_key recomputed from `passive_alt_blend` for a
    fund MUST exist in the neighbourhood panel or the fund serves `neighbourhood: null`; a
    non-unique `l2_passive_candidate_fit.asof_refit_date` fails the build.
  - **Suppression**: no blend row (passive funds / unmatched — they have no twin) → `null`;
    `below_fit_floor` series (`match_status='no_good_match'`) → `null` — never present a
    below-floor twin as "the neighbourhood"; blend below the 36-month floor → `null`.
  - Payload (one JSONB section; ~218 monthly points × 4 legs ≈ 6–12 KB, inside the nav_series
    precedent):
    ```
    neighbourhood: {
      hypothetical: true, mix_as_of: "2026-06-30",
      window: {start: "2008-06", end: "YYYY-MM", years, binding_ticker},
      series: [{t: "YYYY-MM", twin, ivv, vt, bnd}, ...],          # $ per $10k, 2dp
      tiles: {twin: {ann_pct, end_value}, ivv: {...}, vt: {...}, bnd: {...}},
      capture: {reference: "VT", down_capture_pct, up_capture_pct,
                n_down_months, n_down_months_twin_up},
      drawdowns: [{rank, peak, trough, depth_pct, recovered|null, underwater_months, ongoing}],
      years: [{year, twin_pct, world_pct, partial}],
      labels: {ivv: "US stocks (S&P 500, IVV)", vt: "World stocks (VT)",
               bnd: "US bonds (BND)"},                            # BND is US, not global
      method_version
    }
    ```
  - Register `"neighbourhood"` in `SECTION_COLUMNS` and `GATES` (proposed `"public"` — it contains
    the twin identity, already public in `passive_baseline`, and asset-class history; no
    fund-level performance. Web `gating.ts` owns any final re-tiering). Wire into
    `assemble_fact_rows` like `nav_series`.
- `src/fundscore/serving/load.py`: add the four parquets to `_SOURCE_PANELS` (provenance in
  `serving_manifest`). No other change — staging parquet + Postgres COPY are driven by
  `ALL_COLUMNS` automatically. CORRECTED 2026-08-06 review: `load_to_postgres` does NOT fail-close
  on a missing column — `copy_columns` silently DROPS any `ALL_COLUMNS` entry absent from the live
  schema (only 5 hardcoded required columns raise), i.e. it fails OPEN if `fund_profile_facts` lacks
  the column.
- **Web schema mirror note** (required BEFORE any Postgres reload — "serving DB ahead of
  branches" lesson): `fundscore-web/src/lib/db/schema/serving.ts` adds
  `neighbourhood: jsonb("neighbourhood")` to `fund_profile_facts`;
  `src/lib/serving/gating.ts` section list adds `{ col: "neighbourhood", gate: "neighbourhood" }`
  (fail-closed applyGates ownership — a missing entry is fail-open, per the section-flip lesson).
  Rendering is the cutover spec's movement 03, not this spec. The Postgres reload itself stays
  owner-gated per the refresh-campaign protocol; this spec lands gold + staging
  (`make build-serving-facts`).
- **Methodology-registry forward-note** (same pattern; added 2026-08-06 review): the cutover's flip
  protocol makes a `src/lib/methodology/registry.ts` anchor a hard gate ("no live movement without
  its `/methodology#anchor`"). The cutover implementer sources the `neighbourhood` entry
  (method_version, sources, notMeaning, limitations) from THIS spec's own language: hypothetical
  current-mix backcast, no-proxy window truncation, and the pinned capture/drawdown definitions.

## EDA gate (data-scientist, BEFORE building at scale)
Coverage is the headline, computed on a real sample and led with:
1. **Who gets a neighbourhood?** Of the series in the current staging universe
   (`serving_facts_staging.parquet`), the % resolving to a buildable blend_key, split:
   honest-missing (no blend/passive — they ARE the passive; `below_fit_floor` — 807/4,611 series
   today; window <36 months) vs **recoverable-missing** (blend member unpriced beyond the GLD
   fallback → DEFECT; primary_ticker map miss). Also: comparator coverage per leg — confirm
   IVV/VT/BND have zero in-window gaps on the canonical panel.
2. **Window-start distribution** across the 6,202 blends: share binding at VT 2008-06-26 vs bound
   later by a young member (e.g. GNR, 2010 inception); p50/p90 window start.
3. **Proxy-contamination spot check**: first canonical-panel price date vs real-world inception for
   3 member ETFs + the GLD-from-sharadar leg (a first date materially BEFORE real inception means
   a spliced/contaminated source — hard stop).
4. **Draft diff**: recompute the New Era fund's neighbourhood via its SERVABLE ticker **PRNEX**
   (CORRECTED 2026-08-06 review — the 2026-08-06 metadata rebuild re-pointed S000002105's
   primary_ticker from TRNEX to PRNEX; TRNEX is no longer reachable via the series_id →
   primary_ticker → passive_alt_blend serving path, and PRNEX's own blend row differs slightly:
   IGE 67.765/VT 32.235 vs TRNEX's 67.808/32.192. A raw TRNEX-row check is a gold-panel-only
   computation check, distinct from what renders on a live page) and diff every
   mockup figure (tiles, capture triple, three drawdown rows); explain each deviation (panel
   as-of, weight rounding, capture definition).
5. **Cross-vendor sanity**: IVV vs SPY annualized return over the common window (expect within
   ~15 bps/yr); BND vs AGG similarly.
6. Payload size at p99 history length.

## Verification plan (fundscore-data:data-reviewer gate)
Sample: **15–20 blends**, stratified — 1-/2-/3-ETF blends; equity, bond-containing, and mixed;
must include the New Era fund via PRNEX (IGE/VT blend; see the TRNEX→PRNEX correction above), a
100%-single-ETF blend (e.g. IWF), a below-floor fund
(assert served `null`), a passive fund (assert `null`), and the youngest-window blend served.
Baseline/prior: the 2026-07-28 mockup draft figures as era-stamped diff references (non-binding).
- **Atomic**: for 3 blends, hand-recompute from `fund_daily_adj_close.parquet`: endpoint growth
  values, one tile's annualized return, and the deepest drawdown's peak/trough/depth/recovery —
  match to rounding tolerance. Recompute the capture triple for 2 blends.
- **Same-page coherence** (the two twin series must not contradict each other on one profile):
  for 5 funds, the neighbourhood twin's monthly returns over dates ≥ the 2026-06-30 refit vs
  `passive_alt_daily_nav.benchmark_nav` monthly returns — same weights era, so residual diff is
  vendor adjustment only; report max abs monthly diff, investigate anything > ~10 bps/month.
- **Aggregate**: every series' first month == exactly 10000.0 on all four legs; contiguous month
  grids; `depth_pct ∈ (−100, 0)`; `peak < trough ≤ recovery` where recovered;
  `underwater_months` reproduces the calendar-diff formula; no month_end beyond the canonical
  panel as-of (no-leakage); tiles reproduce from the served series arithmetically.
- **Statistical coherence**: distribution of `down_capture_pct` across equity-only twins centers
  near 90–115 vs VT; bond-heavy twins materially lower; flag and explain outliers (|capture| > 200
  usually means a tiny-denominator month set — report `n_down_months` alongside).
- **Determinism**: rebuild twice, diff byte-identical.

## Acceptance criteria
1. Coverage headline reported UP FRONT: "neighbourhood serves X% of the staging universe; Y%
   honest-missing (no twin / below floor / too short), Z% recoverable" — with **recoverable = 0**
   or filed as a defect before ship.
2. All four gold parquets exist with the schemas above; builder is deterministic (twice-built
   byte-identical); `make build-neighbourhood-panel` registered.
3. `/check-data` protocol run on `neighbourhood_series.parquet` (entity = blend_key, date =
   month_end) and `neighbourhood_stats.parquet` — PASS; FAILs block, WARNs to the owner.
4. Data-reviewer gate above PASSES, including the atomic recomputes and the same-page twin
   coherence check.
5. Served `neighbourhood` == gold rows for 5 spot-check funds (staging parquet, after rounding);
   suppressions verified: passive fund → `null`, `below_fit_floor` fund → `null`, and the
   blend-key coherence guard demonstrably fail-closes on a synthetic desync (unit test).
6. Mockup-draft diffs (New Era via PRNEX; mockup drafts were TRNEX-basis — small weight delta
   expected and must be named in the diff) reproduced within tolerance OR each deviation explained by a
   documented basis/universe change; the 2026-07-28 numbers never hard-coded anywhere.
7. Labels: BND served as "US bonds (BND)"; `hypothetical: true` + `mix_as_of` present on every
   non-null payload (the web chip depends on them).
8. `_SOURCE_PANELS` provenance updated; `make build-serving-facts` rebuilds staging cleanly;
   no Postgres reload in this spec (owner-gated); web mirror columns noted for the cutover
   implementer (serving.ts + gating.ts entries, migration before any reload).
9. Docs: `docs/context/alpha-nav.md` (or a new product-panels entry) + `docs/agent_context_map.md`
   gain the panel row; no stale "no serving source" claim left in the cutover spec (update its
   movement-03 section to point here).

## Out of scope
- Web rendering of movement 03 (lives in `profile-v2-production-cutover.md`; donor `GrowthChart`).
- A fund leg in the neighbourhood series (movement 02 owns fund-vs-twin, graded window).
- A comparators-only fallback for `no_good_match` funds (product decision, not taken here).
- BNDW / global-bond comparator (inception 2018-09 — cannot reach 2008 without proxies).
- Manager-era tick marks, X-Ray integration, drawdown charts beyond the top-3 table.

## Risks
- **Refit advance desyncs the panel**: a new L2 refit changes blends → blend_keys vanish → funds
  silently serve `null` until rebuilt. Mitigation: the fail-closed unique-`asof_refit_date` guard
  + add this panel to the passive-match runbook's "refit must rebuild" list
  (`docs/context/passive-match.md` pattern, same clause as `l2_passive_candidate_fit`).
- **Vendor adjustment vintage**: the GLD leg (sharadar) vs canonical-panel legs may differ in
  adjustment convention; the same-page coherence check bounds the effect — if it exceeds
  tolerance, fix at the source (get GLD into the canonical panel), don't paper over.
- **Capture-definition drift vs the draft**: the draft's exact formula is unrecoverable; the spec
  pins mean-based capture. A materially different triple is expected to be explainable, not
  silently matched.
- **Thin windows on young-member twins**: bounded by the 36-month floor; EDA reports the
  suppressed count so the owner can revisit the threshold.
- **Canonical panel staleness** (currently as-of 2026-07-10): the series end is whatever the panel
  serves — the recency-gate-over-frozen-feed lesson says do not add a hidden recency filter here;
  the `window.end` label is the honest as-of.
