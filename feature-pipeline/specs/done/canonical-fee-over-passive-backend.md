---
id: canonical-fee-over-passive-backend
title: Define ONE canonical fee-over-passive figure + a fee-coherence invariant; root-cause the corrupted FCNTX net ER
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/canonical-fee-over-passive-figure.md
created: 2026-06-24
scope: global
---

## ✅ DONE 2026-06-26 (gold rebuilt + in-process serving verified; Postgres activation pending sign-off)
- **B2** never-priced EQ 123 → 8 (5 genuine no-L2-match + 3 no-filed-ER); the matched-but-unpriced 117 were a
  `build_l2_blend_fee_history` ticker-collision bug (already fixed in 14420ae); parquet was stale.
- **B3** FCNTX coherent triple **net 74 / gross 74 / mgmt 73**. The "misparse" suspicion was DISPROVEN against
  SEC filings: FCNTX uses an all-inclusive performance-adjusted management fee, so mgmt==total ER is real.
  `management_fee` now sourced primary-class + same-quarter from the ACTIVE `fee_components/` extractor.
- **B4** build-failing `enforce_fee_coherence` gate; baselines tightened to actuals C1≤280, C2-corruption≤12.
  Non-waiver incoherent triples 112 → 6 (filed source-data residual, tracked in data_gap_analysis.md).
- **DECISION 2 / canonical** `active_fee_over_passive_bps` byte-identical across all 3 consumers; FCNTX = 56.
- **SCOPE EXPANSION (user-approved):** the surfaced FCNTX fee was ~2yr stale (0.39% 2024) vs real **0.74%**
  (2026 prospectus). Root-caused to MFRR ingestion lag + single-class-prospectus class-null parse; fixed by
  ingesting 2026Q1 + a `(series,document)→class` backfill (`alpha/expense.py`). So the canonical is **56 bps**
  (74−18), NOT the spec's original 21 (which was computed on the stale 0.39%).
- `/check-data` PASS (reports/check_data_canonical_fee.md). NOT activated to Postgres (awaiting sign-off).

---

## ⚠️ REWORK — a prior run FAILED at checkpoint-2 (full build). Fix these FIRST, then satisfy the spec below.
The data-reviewer rejected the previous attempt and nothing was committed. The partial prior changes are STILL in the
`fund_score` working tree (uncommitted) — BUILD ON what is already correct, do not redo it, and do not undo it. Verified
correct already: the single canonical producer exists (`fee_efficiency/scoring.py:466` aliases `active_fee_over_passive_bps`);
the gold column `active_fee_bps` was renamed to `fair_fee_active_leg_bps` in `fee_efficiency_score.parquet`; VO-panel
read-through equals the canonical for all 5 spot funds (FCNTX 21 / DODGX 33 / FBGRX 43 / VDIGX 4 / VOO null). Now fix:

**B1 — Serving integration is absent (DECISION 2). Wire all three consumers to the canonical figure:**
- (a) `fact_assembler.py` (~line 1402) still sets the hot scalar from `(fee).get('gap_bps')` → FCNTX serves
  `fee_gap_bps = 16.07` (the fair-fee MODEL gap). Re-point it so `serving_facts_staging` FCNTX `fee_gap_bps` ==
  `active_fee_over_passive_bps` (**~21**, = net 39 − l2_blend 18), NOT 16.07. No second "fee over passive" number may exist.
- (b) Add `fair_fee.active_fee_over_passive_bps` (+ `active_fee_over_passive_missing_reason`) to `_fees()` in the assembler.
- (c) REGRESSION: `fact_assembler.py:1114` still emits `fair_fee.active_fee_bps` by reading `f.get('active_fee_bps')` — a
  now-dropped gold key → the served fair-fee leg silently becomes **null**. Repoint to `fair_fee_active_leg_bps` (or drop the
  modeled-leg field per the frontend spec's decision), but do NOT leave it reading the dropped key.

**B2 — The "dominant" pricing-gap fix (spec §A.1) was NOT done — `_compute_l2_blend_fee` got only a docstring reformat.**
Measured: **123 EQ series never price a canonical figure**; **117 of them have a populated `l2_blend_etfs` match**
(e.g. SPY/IWD/IWF — trivially priceable) yet `l2_blend_fee_bps` is null in every eval row → they emit
`passive_fee_unavailable` (122 EQ at the latest row). Root-cause the L2-match→blend-fee JOIN so the never-priced count drops
from 123 toward the **~5** genuine no-L2-match residual (only 6 are true no-match today). Report the HONEST measured
before/after counts (the prior run reported "30", which both missed the target and understated the real 123).

**B3 — FCNTX still ships an INCOHERENT triple (explicit acceptance criterion).** `fund_metadata`: net 39 / gross 39 /
management_fee 63 → `net < management_fee` (C2 violation), and net==gross so it is NOT a waiver. Root cause is a
**commensurability defect**: net traces to `net_er_primary_class` 2024Q1 (class C000016601) while `management_fee` traces to a
2025Q1 raw-fees row at the **SERIES grain** (class=None) — different quarter AND different class grain.
`management_fee` was left as a cross-class median (`build_gold_metadata.py:173`); fix it to **primary-class, same as-of as
net/gross**, like net/gross already are. NOTE (likely the real fix): the surfaced net (39, from 2024Q1) appears ~1yr STALE —
the latest 2025Q1 primary-class filings read 0.0056/0.0063, which would make the triple coherent on their own; verify whether
using the latest non-stale primary-class row resolves both the staleness and C2. Also: 2024Q1 per-class `management_fee`
(0.0039/0.0032) exactly equals `total_expense_ratio` (a likely concept misparse) — confirm the field is real management fee.

**B4 — Wire a BUILD-FAILING fee-coherence invariant (spec §B). `measure_fee_coherence` is diagnostic-only (never raises).**
The prior partial fix REGRESSED C2 from 1,028 → 1,479 full-universe, because primary-class net was compared against the
still-cross-class-median `management_fee` (non-commensurable — fixing B3 should resolve most of this). Even-class C1 was NOT
driven to 0 (126 even-class C1 violations remain). Satisfy ONE of the spec's options and WIRE it to fail the build:
(a) drive C1/C2 to 0 + raise, (b) reconcile as-of/grain (B3) + raise, or (c) scope the gate to even-class median→0 + file the
residual. C1 (gross<net) is already much improved (2,215 → 283 via primary-class net) — keep that.

**Also (warnings):** VOO surfaces a null canonical with a NULL `missing_reason` — the spec mandates an explicit reason
whenever the canonical is null (passive fund → label it, e.g. "passive fund, no active-fee-over-passive"). And: this is a
data-integrity task — report HONEST measured aggregates (the prior run over-reported and falsely claimed unrelated diffs were
"pre-existing"). The working tree DOES contain substantial UNRELATED pre-existing uncommitted work (return-attribution,
risk-model, docs, experimental `alpha_persistence_*` scripts) — do NOT touch, claim, or commit any of it; scope your changes
and the final commit to ONLY the fee-coherence files (scoring.py, build_gold_metadata.py, fact_assembler.py, and their tests).

## Goal
Produce exactly ONE canonical "active fee over the closest passive mix" figure per series, computed
in one place with one definition, and carry it (plus a coherent net / gross / management-fee triple)
through to `serving_facts_staging.parquet` for the frontend to render verbatim — including collapsing
the stray hot scalar `fee_gap_bps` onto that one canonical figure so no second "fee over passive"
number exists end-to-end. Add a hard fee-coherence invariant that fails the build for any series where
`gross_er < net_er` or `net_er < management_fee`, and root-cause the corrupted net ER for series
`S000006037` (FCNTX) at its source rather than papering over it with a default. Where a fund genuinely
has no comparable passive blend, surface that as a first-class honest "unavailable" state (never a
fabricated gap); but treat the dominant cause of a missing passive — a matched-blend whose fee is
simply not priced — as a coverage/pricing gap to root-cause and fix, not a UX case.

## Context (critic evidence — verified against live data)
Five critics flagged that FundScore's core idea ("what do you pay above passive") renders as two
different "active fee" numbers on FCNTX in one scroll, on top of a mathematically impossible expense
table. I reproduced all of it against the shipped panels and the served staging row. Two things are
true and worth fixing; a third (the original "two definitions of one number, one of them null"
framing) was **wrong** and is corrected below.

**1. Two DIFFERENT fee quantities are both labeled `active_fee_bps`, and the value-offering one is
build-unstable due to an as-of row-selection bug.**
The hero/Value-Offering panel and Fee Fairness do NOT compute the same concept by two definitions —
they compute two genuinely different quantities that happen to share the column name `active_fee_bps`:
- **Value Offering** (`value_offering_reframed.py:166-173`):
  `active_fee_bps(...) = max(0, actual_fee_bps − replicable_core_fee_bps)` — a **net-ER-minus-replica-fee
  gap**. `replicable_core_fee_bps` is just an alias of `passive_fee_bps` (`build_value_offering_reframed.py:101`).
  This is what the hero Evidence drawer, `takeaways.py:272` (`tpl_fee_gap_active`), and `the_take.py`
  clause-2 (`tpl_take_paying_more`) all render.
- **Fee Fairness** (`fee_efficiency/scoring.py`): `scoring.py:381` sets
  `passive_fee_bps = l2_blend_fee_bps`; `active_fee_bps` is a **fair-fee MODEL leg** computed at
  `scoring.py:400-405` as `active_share*(factor_leg_bps + idio_leg_bps)`, NOT `actual − passive`. This
  is what `FeeFairness.tsx` reads via `fair_fee.active_fee_bps`. For FCNTX 2024Q1 these are not even
  close: `actual − passive` would be `35.5 − 18 = 17.5`, but the model leg is **32.29**.

  **Root cause of the divergence is an as-of row-selection mismatch on the SAME `passive_fee_bps`
  column, not a missing passive price.** The VO builder does
  `fee.sort("eval_date").group_by("series_id").last()` (`build_value_offering_reframed.py:95-104`),
  which grabs FCNTX's absolute-latest eval row (2026-04-10, `er_quarter_used=2025Q4`) where
  `passive_fee_bps` is null — so `replicable_core_fee_bps` is null and `active_fee_bps()` falls back to
  the full net ER (35.5). The fact_assembler, by contrast, serves the latest **non-null** fee_efficiency
  row (2025-12-19, `er_quarter_used=2025Q3`) where `passive_fee_bps = 18.0` and the model-leg
  `active_fee_bps = 32.29`. Both read the identical L2-blend-fee column; the divergence is
  `.last()` vs latest-non-null, plus the two columns meaning different things.

  Verified (against `serving_facts_staging.parquet` — the row the frontend actually renders):
  ```
  serving_facts_staging  S000006037 → fees.net_expense_ratio_bps = 35.5,
                                       fees.fair_fee.active_fee_bps  = 32.29  (model leg, eval_date 2025-12-19)
                                       fees.fair_fee.passive_fee_bps = 18.0
  value_offering_reframed_panel  S000006037 → active_fee_bps = 35.5 (net-ER fallback; .last() row, passive null)
  fee_efficiency_score (latest non-null row, 2025-12-19) → active_fee_bps = 32.29, passive_fee_bps = 18.0
  fee_efficiency_score (absolute-latest row, 2026-04-10) → active_fee_bps = null, passive_fee_bps = null
  ```
  (The earlier draft claimed `fee_efficiency` returns `None`/`None` for FCNTX — that read the
  absolute-latest 2025Q4 row, which the assembler does NOT serve. The served values are 32.29 / 18.0.)

**2. The underlying net ER is a synthetic cross-class median, and gross is an independently-derived
cross-class median (NOT borrowed/coalesced from net).**
`build_gold_metadata.py:225-227` documents `net_expense_ratio (=median across classes)`. FCNTX has 2
share classes with real filed net ERs (`expense_ratio_history.parquet`, 2024Q1):
  - FCNTX (Contrafund retail, primary class `C000016601`) = **0.0039** (39 bps) — matches public filings
  - FCNKX (K class, `C000064233`) = **0.0032** (32 bps)
The series `net_er_median` = `(0.0039 + 0.0032)/2` = **0.00355** (35.5 bps) — a value **no real share
class charges**. `net_er_min` = 0.0032 (the K class). Separately, `build_gold_metadata.py:267-277`
derives `gross_expense_ratio` **independently** from raw filed concepts — but FCNTX files NO
`gross_expense_ratio` concept, only `total_expense_ratio`, and the derivation takes a **median across
classes** (`group_by("series_id").agg(...median())`, L275-276) after a `group_by("series","concept").first()`
whose tie-break is sort-dependent. The stored `fund_metadata.gross_expense_ratio = 0.0032` is therefore
a stale/unstable cross-class artifact (re-running the same logic on current raw data actually picks the
primary class's 0.0039) — it is **not** coalesced from `net_er_min`; the 0.0032 equality is coincidence.
Result in `fund_metadata.parquet` today:
  ```
  S000006037 → net_expense_ratio = 0.00355, net_expense_ratio_min = 0.0032,
               gross_expense_ratio = 0.0032, management_fee = 0.0063
  ```
  Two impossibilities ship: `gross (32) < net (35.5)` and `net (35.5) < management_fee (63)`. The
  product surfaces the **primary share class** (FCNTX), whose real filed net ER is 0.39%, so the
  displayed 35.5 bps understates the actual fee by ~10% and is internally incoherent with the 63 bps
  management fee. Both impossibilities trace to the same root: cross-class median aggregation (net at
  `net_er_median`, gross at L276), not a borrow-from-net.

## Solution

### A. Canonical figure — define `active_fee_over_passive_bps` once, in one module
Introduce a single canonical fee-over-passive figure with one definition and one owner, and stop two
distinct quantities from both wearing the name `active_fee_bps`. The product already anchors every fund
to a passive baseline (`passive_blend_holdings` / L2 blend); the canonical figure is **net ER of the
primary share class − fee of the matched passive mix**:

```
active_fee_over_passive_bps = primary_class_net_er_bps − passive_blend_fee_bps   # >= 0 floor
```

This is a DIFFERENT quantity from the fee-efficiency fair-fee model leg
(`active_share*(factor_leg_bps + idio_leg_bps)`). Both must exist; they must not share a column name.

- Pick ONE producing module for the canonical figure. The natural home is
  `src/fundscore/fee_efficiency/scoring.py` (it already joins the L2 blend fee → `passive_fee_bps`).
  Compute `active_fee_over_passive_bps` there and write it to `fee_efficiency_score.parquet`.
- **Rename to disambiguate (do NOT merge the two concepts).** The existing fair-fee model leg keeps its
  own producer but is renamed so no two distinct concepts share `active_fee_bps`:
  - `fee_efficiency/scoring.py`: rename the model leg `active_fee_bps` → `fair_fee_active_leg_bps`
    (it is `active_share*(factor_leg_bps + idio_leg_bps)`, a fee-per-active-risk estimate). FeeFairness
    keeps showing/using it for the Strong/Mixed/Weak chip and `fair_fee_bps` build-up.
  - `value_offering_reframed.py`: the VO helper stops computing its own gap. The takeaways / The Take
    builders read the canonical `active_fee_over_passive_bps` (join by `series_id` at the matching
    `eval_date`/`er_quarter_used`) and pass it through unchanged.
  - The canonical `active_fee_over_passive_bps` is the only producer of "fee over passive".
- **Fix the as-of row-selection bug — this is the actual lever for the FCNTX divergence, not a missing
  passive price.** The VO builder currently does
  `fee.sort("eval_date").group_by("series_id").last()` (`build_value_offering_reframed.py:95-104`),
  grabbing the absolute-latest eval row even when its `passive_fee_bps` is null. Change VO (and any
  consumer of the canonical figure) to select the latest **non-null** `passive_fee_bps` / canonical-figure
  row — the same as-of the fact_assembler already serves (latest non-null fee_efficiency row). Once VO
  reads that row (FCNTX 2025-12-19: `passive_fee_bps = 18.0`), the canonical figure is **computable** for
  FCNTX (≈ `39 − 18 = 21` bps net-over-passive at the primary class) and the hero/Fee-Fairness divergence
  disappears. Simply joining the canonical column from `fee_efficiency_score.parquet` (which is already
  written at the non-null as-of) accomplishes the same thing.
- **"No comparable passive alternative" is a first-class state — but the genuine residual is tiny (~5
  funds), and the dominant issue is a PRICING/coverage gap, not a mass UX case.** Measured directly
  against the live panels (`value_offering_reframed_panel.parquet` + `fee_efficiency_score.parquet`):
  - Of **3,144 scored EQ series, only 68 (2%)** NEVER have a priced `passive_fee_bps` in **any** eval
    row. (At each fund's latest active-fee row, **0 funds** lack a priced passive — both the earlier
    "0 of 2623" framing and the review's "~20% / 629 funds" were wrong. The 629 figure was a
    row-selection methodology artifact: it counted funds whose *absolute-latest* `.last()` row is null,
    not funds that genuinely never price.)
  - **All 68 are `management_style = "active"` EQ funds — NONE are passive/index.** They are active
    funds that *should* have a passive alternative.
  - **63 of the 68 already HAVE an L2 passive blend match** (`l2_blend_etfs` is populated) — the blend
    FEE simply is not priced (`passive_fee_bps` / `l2_blend_fee_bps` is null). Only **5** have no L2
    match at all (exotic/niche: hedged ADR, EM small-cap, global-macro).

  Two distinct fixes follow, and they are sized very differently:
  1. **DOMINANT — a coverage/PRICING gap (the 63).** This is *not* a UX problem. It is a missing
     `l2_blend_fee_bps` for funds that already have a matched blend. Root-cause it and price it (see the
     backend prerequisite below); doing so recovers most of the 68 so they show a real fee-over-passive
     number rather than falling into the null state.
  2. **The honest residual (~5).** For the small genuine tail with no L2 match at all, build the
     first-class **"no comparable passive alternative for this fund"** UX state: set the canonical figure
     to **null with an explicit `active_fee_over_passive_missing_reason`** (NOT the raw net ER
     masquerading as a gap), and the page must say plainly that no comparable passive blend exists.
     **Never show a fabricated fee gap.** (Do not paper over a missing passive price with the full net
     ER — that is the substitution the `.last()` bug produced.)

  Keep the null-guard for both cases, but scope it as the ~5-fund residual, NOT a 20% mass case.
  Surface `passive_fee_bps` / `l2_blend_fee_bps` coverage as a build diagnostic.

### A.1 Backend prerequisite — price the matched-but-unpriced L2 blends (the dominant 63)
Before treating any of the 68 as "no comparable passive", root-cause **why `l2_blend_fee_bps` /
`passive_fee_bps` is null for the ~63 funds that DO have an `l2_blend_etfs` match**, and price it.
- The `passive_fee_bps` producer is `src/fundscore/fee_efficiency/scoring.py`:
  `scoring.py:381` sets `passive_fee_bps = l2_blend_fee_bps` only when the row passes the
  `component_missing_reason` cascade (`scoring.py:362` assigns `PASSIVE_MATCH_UNAVAILABLE` whenever
  `l2_blend_fee_bps` is null). So a null `passive_fee_bps` for a fund that DOES have a matched blend means
  the upstream **L2 blend-fee compute/join produced no fee** for that fund/refit/quarter.
- That compute is `_compute_l2_blend_fee` (`scoring.py:130-199`): it joins per-refit L2 `weights`
  (`[fund, etf, weight]`) to ETF expense-ratio history, then aggregates
  `Σ weight * etf_er * 10000 → l2_blend_fee_bps` per fund (`scoring.py:191-198`). A fund with a populated
  `l2_blend_etfs` but null `l2_blend_fee_bps` indicates a break at the **L2 match → fee join** (e.g. the
  fund's weights for the selected refit/quarter didn't land in the joined frame, an `etf`-key mismatch,
  or an as-of/refit-date misalignment between the `l2_blend_etfs` shown and the weights priced).
- **Task:** instrument and root-cause the L2-match → blend-fee join for these ~63 funds, fix at source so
  `l2_blend_fee_bps` (hence `passive_fee_bps`) is non-null wherever an L2 match exists, and re-confirm the
  never-priced count drops to the ~5 genuine-residual funds. Report the recovered count.

### B. Fee-coherence invariant — hard-fail impossible expense pairs
Add a coherence check to the gold-metadata build (`build_gold_metadata.py`, the expense join section
~L220-283) and to `/check-data` for the fee panels. For every series with the relevant fields present:
  - **C1**: `gross_expense_ratio >= net_expense_ratio` (gross can never be below net).
  - **C2**: `net_expense_ratio >= management_fee` (net is management fee + other operating expenses).
Any violation is a build-failing error (not a warning), with the offending `series_id`s listed. This
is the durable guard that stops the FCNTX-class corruption from shipping on other funds.

### C. Root-cause the FCNTX expense triple (do not default)
Both impossibilities trace to the SAME root: cross-class median aggregation that mixes share classes.
Fix at source, on both the net and gross sides.
  1. **Net ER is a cross-class median.** The product displays the primary share class, so the
     series-level net ER it surfaces must be the **primary share class's filed net ER**, not the
     median across classes. Fix in the series-expense aggregation that produces
     `series_expense_ratio_history.parquet` (`net_er_median`): either (a) carry an explicit
     `net_er_primary_class` keyed to the same primary-class resolver `load_tickers()` uses
     (`build_gold_metadata.py:286-310`), and have `build_gold_metadata.py` surface that as
     `net_expense_ratio`; or (b) if the product genuinely wants a series-representative number, document
     it as such AND ensure the coherence invariant still holds against the same class's management fee.
     Option (a) is preferred — it is the number the FCNTX investor actually pays (0.39%) and removes the
     synthetic average.
     - **Units/parse pre-check is already PASS — do not over-investigate.** The FCNTX net-ER series
       declines over time (2011Q1 0.0092 → 2024Q1 0.0039) with a genuine recent fee cut (2023Q1 0.0055 →
       2024Q1 0.0039); there are minor up-bumps (2016/2020-21) but no order-of-magnitude discontinuity, so
       these are real Fidelity Contrafund fee reductions, not a vintage units/parse artifact. Focus the
       root-cause work on the median→primary-class aggregation, not a units bug.
  2. **Gross is an independently-derived cross-class median (NOT borrowed/coalesced from net) — fix the
     class-mixing.** There is no coalesce-from-net code path to remove. `gross_expense_ratio` is derived
     at `build_gold_metadata.py:267-277` from filed `gross_expense_ratio`/`total_expense_ratio` concepts
     (`rrtotalannualfundoperatingexpensesgross` etc., `transforms.py:22-35`), but the derivation takes a
     **median across classes** (L275-276) after a sort-dependent `.first()` tie-break, which is why the
     stored `0.0032` lands below the surfaced net. Fix: source `gross_expense_ratio` from the SAME primary
     share class as the surfaced net (keyed to the same primary-class resolver), not a cross-class median.
     FCNTX files no `gross_expense_ratio` concept, only `total_expense_ratio`; its primary-class
     `total_expense_ratio` 2024Q1 = 0.0039 (= net, coherent). If no real gross/total is filed for the
     primary class, leave `gross_expense_ratio` **null** — the coherence invariant then has nothing to
     compare against (skipped on null), which is correct; better a missing gross than an incoherent one.

## Data source (real input tables + as-of)
- `data/gold/expense_ratio_history.parquet` — ticker/class-level filed net ER (`ticker`, `quarter`,
  `net_expense_ratio`). FCNTX 2024Q1 = 0.0039; FCNKX 2024Q1 = 0.0032. As-of: latest filed quarter.
- `data/gold/series_expense_ratio_history.parquet` — series dense grid (`series_id`, `quarter`,
  `net_er_median`, `net_er_min`, `n_classes`, `is_filed`). This is where the median bug lives; add
  `net_er_primary_class` here. Built by `make build-expense-history`.
- Raw MFRR expense parquets under `<output_dir>/expense_ratios/` (cols `series`, `class`, `concept`,
  `quarter`, `value`) — source for the per-class filed gross/total concept. Note: FCNTX files only
  `total_expense_ratio` (no `gross_expense_ratio` concept), at the class grain (`C000016601`=FCNTX 0.0039,
  `C000064233`=FCNKX 0.0032 in 2024Q1).
- `data/bronze/.../level2/weights/...` + the L2 blend fee join already in `fee_efficiency/scoring.py`
  (`passive_fee_bps`) — source for the passive side of the canonical figure.
- Primary-class resolver: `build_gold_metadata.py::load_tickers()` (the same `clean_ticker_expr`
  preference that picks FCNTX over junk class labels).

## Computation (precise; column names = what is computed)
New / changed columns:
- `series_expense_ratio_history.parquet`: add `net_er_primary_class` (filed net ER of the
  primary-ticker class, decimal) alongside the existing `net_er_median` / `net_er_min`.
- `fund_metadata.parquet`: `net_expense_ratio` now sources `net_er_primary_class` (decimal);
  `gross_expense_ratio` sourced from the primary share class's filed gross/total concept (same class as
  the surfaced net), else null (never a cross-class median).
- `fee_efficiency_score.parquet`: add `active_fee_over_passive_bps` (float, bps, `>= 0` floor) and
  `active_fee_over_passive_missing_reason` (enum: `passive_fee_unavailable` | `net_er_unavailable` |
  null). Rename the existing fair-fee model leg `active_fee_bps` → `fair_fee_active_leg_bps`
  (= `active_share*(factor_leg_bps + idio_leg_bps)`) so it no longer collides with the canonical figure.
  `actual_fee_bps` continues to mean primary-class net ER in bps (now coherent).

## Output (parquet path + schema)
- `data/gold/series_expense_ratio_history.parquet` — `+ net_er_primary_class: f64`.
- `data/gold/fund_metadata.parquet` — `net_expense_ratio` / `gross_expense_ratio` recomputed (coherent).
- `data/gold/fee_efficiency_score.parquet` — `+ active_fee_over_passive_bps: f64`,
  `+ active_fee_over_passive_missing_reason: str`.
- `data/gold/value_offering_reframed_panel.parquet` — its `active_fee_bps` now equals the canonical
  `active_fee_over_passive_bps` (read-through from the latest non-null fee row, not recomputed via the
  buggy `.last()`); when null, the badge/skill logic that depends on fee posture must treat it as
  "fee posture unknown", not "pays 0 more".

## Serving integration (fact_assembler + schema changes)
- `src/fundscore/serving/fact_assembler.py`:
  - `_fees()` (L1031-1057, the `fair_fee` dict at L1044-1055): add the canonical figure as
    `fair_fee.active_fee_over_passive_bps` and `fair_fee.active_fee_over_passive_missing_reason`. Rename
    the existing served `fair_fee.active_fee_bps` (L1046, currently `f.get("active_fee_bps")`) to
    `fair_fee.fair_fee_active_leg_bps` to match the renamed gold column — FeeFairness keeps reading it for
    the Strong/Mixed/Weak chip. Keep `net_expense_ratio_bps`, `gross_expense_ratio_bps`,
    `management_fee_bps` flowing through `_to_bps()` (L1036-1038) — they are now coherent. The frontend
    reads ONLY `fair_fee.active_fee_over_passive_bps` for the "fee over passive" number (see frontend
    spec `canonical-fee-over-passive-frontend`).
  - `_value_offering_reframed()` fee block (L1004-1009): its `active_fee_bps` must equal the canonical
    `active_fee_over_passive_bps` (read-through from the same latest-non-null fee row), so the hero
    Evidence drawer, Fee Fairness, and The Take all show the identical number.
- **Collapse the stray fee scalar (DECISION 2).** A hot scalar `fee_gap_bps` already exists in
  `serving_facts_staging.parquet`, but it is NOT a fee-over-passive figure — it is the fair-fee MODEL
  gap (`fair_fee.gap_bps = fair_fee_bps − actual`). Verified on the live staging row for FCNTX
  (S000006037): `fee_gap_bps = 16.07` (= `fair_fee.gap_bps`, distinct from any net-over-passive number).
  Leaving it alongside the new canonical figure would ship **two different "fee" scalars** end-to-end.
  **Re-point the hot scalar `fee_gap_bps` to the canonical `active_fee_over_passive_bps`** so exactly ONE
  "fee over passive" scalar exists end-to-end. This is an explicit requirement, not a "confirm whether":
  - Set `fee_gap_bps = active_fee_over_passive_bps` (the canonical net-over-passive figure), not
    `fair_fee.gap_bps`, in `serving_facts_staging.parquet`.
  - The fair-fee model gap is still needed for FeeFairness (the Strong/Mixed/Weak build-up); it stays
    available **inside** the `fees.fair_fee` struct as `fair_fee.gap_bps` — it just no longer occupies the
    top-level hot scalar.
  - **Migrate every consumer that depends on the OLD `fee_gap_bps` meaning** (top-level fair-fee gap) in
    the SAME change — repoint them to read `fees.fair_fee.gap_bps` if they need the model gap, or to the
    canonical scalar if they actually wanted fee-over-passive. Grep `fee_gap_bps` across both repos and
    reconcile each reference; do not leave a consumer silently reading a re-pointed value.
- Also keep `active_fee_over_passive_bps` itself addressable inside `fees.fair_fee` (it is a *new* served
  field — see depends_on / `canonical-fee-over-passive-frontend`). Coordinate the Drizzle column with the
  frontend spec; the top-level `fee_gap_bps` scalar now carries the canonical value, so no new top-level
  scalar column is needed.

## EDA question (plot before building)
1. Distribution of `n_classes` across EQ series, and for `n_classes` even vs odd, the gap between
   `net_er_median` and `net_er_primary_class`. How many series does the median misstate by > 2 bps?
2. Coverage of `passive_fee_bps` across the EQ universe, split two ways (already measured against the
   live panels — confirm and reproduce):
   - **At the latest non-null `active_fee` row** (the as-of the assembler serves): **0 funds** have a null
     `passive_fee_bps` — so the canonical figure is essentially always computable at the served as-of.
   - **Across ALL eval rows (never-priced)**: of **3,144 scored EQ series, 68 (2%)** NEVER price a
     passive in any eval row. All 68 are active funds; **63 already have an `l2_blend_etfs` match** (the
     blend fee is just unpriced — the dominant PRICING gap, fixed by prerequisite A.1), and only **5**
     have no L2 match at all (the genuine null-state residual). Plot the 68 by reason
     (matched-but-unpriced vs no-match) and confirm the 63/5 split. (NB: the review's "~20% / 629" figure
     was a `.last()` row-selection artifact, not a real coverage gap — do not reproduce it.)
   - Also count how many series the buggy `.last()` as-of would have wrongly nulled (this is the real
     defect VO suffers, and the source of the spurious 629).
3. Coherence violations under the new invariant on the CURRENT data: how many series have
   `gross < net` or `net < management_fee` today, **broken down by `n_classes` (even vs odd vs
   single-class `n_classes==1`)**, and root-cause the residual. The measured baseline in the served EQ
   universe (8,656 series): **C1 (`gross < net`) = 1,173** and **C2 (`net < management_fee`) = 371**.
   Of the 1,173 C1 violations, **731 are even-class** (clean cross-class-median candidates — `net_er_median`
   is a synthetic average no class charges) but **442 are odd-class** and **51 are single-class
   (`n_classes==1`, where `net_er_median == net_er_min == net_expense_ratio`, so no cross-class mixing
   exists at all)**. The odd/single-class violations **cannot** be the cross-class-median artifact and
   will survive the primary-class fix; in those rows `gross` and `net` are sourced from **different
   quarters/concepts** (e.g. a stale gross concept vs a fresher net), not a class average. Measure how
   many C1/C2 violations the primary-class fix actually clears, and attribute the residual to this
   different-as-of/concept cause before the invariant is wired build-failing.

## Verification plan
Gate at small scale BEFORE rebuilding the full panels (CLAUDE.md extraction gate):
- **Atomic spot checks (≥ 5 series, manual vs raw SEC):** FCNTX (S000006037) plus 4 other
  multi-class families (e.g. DODGX, FBGRX, VDIGX, and one passive — VOO). For each, pull the actual
  prospectus net/gross ER and management fee from the SEC filing and confirm: primary-class net ER
  matches the surfaced `net_expense_ratio`; gross >= net; net >= management fee; and the canonical
  `active_fee_over_passive_bps` equals (surfaced net − passive blend fee) to the bp, computed from the
  SAME (latest non-null) fee row. FCNTX must read **~0.39% net** (primary class), with gross >= 0.39%
  (or null), and `active_fee_over_passive_bps` ≈ **21 bps** (`39 − 18`, since FCNTX's served passive
  blend fee is 18.0 at the 2025-12-19 row) — NOT 35.5 dressed as a passive gap, and NOT null
  (`passive_fee_unavailable` does not apply to FCNTX once the non-null as-of is used).
- **Aggregate sanity checks:** measure the coherence-violation count before and after the fix and
  attribute the residual. Baseline today in the served EQ universe: **C1 = 1,173** (`gross < net`),
  **C2 = 371** (`net < management_fee`). The primary-class median→primary fix is expected to clear the
  **731 even-class** C1 violations (synthetic-average artifacts, FCNTX included); the **442 odd-class +
  51 single-class** C1 violations come from gross/net being filed at different quarters/concepts and
  require the gross/net as-of reconciliation to reach 0 — confirm post-fix counts match this attribution
  rather than assuming a single root clears everything. `net_er_primary_class` vs `net_er_median`
  correlation and bias (median should be biased low/high only on even-class series). Compare the
  served figure for the page-type default targets (FCNTX, FBGRX, DODGX, VDIGX, VOO) head-to-head
  across the hero, Fee Fairness, and dollar-gap consumers — they must be byte-identical (this is the
  whole point).
- **Statistical-coherence / no-leakage:** the canonical figure's two operands (primary-class net ER
  and passive blend fee) must come from the same `eval_date` / quarter; flag any as-of mismatch.

## Acceptance criteria
- Exactly one producer of `active_fee_over_passive_bps` (the NEW canonical column); `value_offering_reframed`,
  takeaways, and The Take read it and no longer compute their own gap. The legacy fee-efficiency model leg
  is renamed `fair_fee_active_leg_bps` (it is a legitimately different quantity), so `active_fee_bps`
  no longer names two distinct concepts. Gate: grep `active_fee_over_passive_bps` returns one producer;
  grep `active_fee_bps` returns no producer (only consumers/renamed references), confirming the collision
  is gone.
- The FCNTX hero/Fee-Fairness/The-Take divergence is closed by fixing the as-of row-selection
  (`build_value_offering_reframed.py:95-104` and any canonical-figure consumer select the latest
  **non-null** `passive_fee_bps` row, matching the assembler), not by a suppression branch.
- Fee-coherence invariant (C1, C2) is enforced. Because the primary-class fix only clears the
  **even-class cross-class-median** violations (731 of the 1,173 measured C1 today; FCNTX is one of
  these), it does **not** by itself reach 0 — the 442 odd-class + 51 single-class C1 violations (and the
  residual C2) come from gross/net being sourced from different quarters/concepts and need their own fix
  (source gross and net at the same as-of/quarter for the same primary class, else null). The bar is
  therefore: (a) measure the post-fix violation count, (b) drive the remaining violations to **0 by
  also reconciling the gross/net as-of mismatch** (the preferred end state), and only THEN wire the
  invariant as build-failing; OR (c) if a triaged, documented residual cannot be eliminated at source
  in this task, scope the build-failing gate to the violation class that IS root-caused and fixed here
  (even-class median → 0) and file the odd/single-class as-of-mismatch residual as a tracked
  prerequisite, so the invariant never blocks the build on an un-fixed cause. Do **not** ship a
  build-failing `0 violations` gate before the residual is measured and attributed.
- FCNTX (S000006037) surfaces a coherent triple: net ≈ 39 bps (primary class), gross >= net (or null),
  management fee 63 bps consistent — and `active_fee_over_passive_bps` ≈ 21 bps (the real net−passive
  gap at the served as-of), never the bare net ER, never null for FCNTX.
- For the default targets the fee-over-passive figure is identical across all three consumers (verified
  on the served staging row).
- **Pricing-gap prerequisite (A.1) closed.** The L2-match → blend-fee join is root-caused and fixed so
  that any fund with a populated `l2_blend_etfs` has a non-null `l2_blend_fee_bps` (hence
  `passive_fee_bps`). The never-priced count drops from **68** to the ~**5** genuine no-L2-match residual,
  and the recovered count is reported. No fund with a matched blend falls into the null state for want of
  a price.
- **"No comparable passive alternative" UX state is first-class — and scoped to the ~5 residual, not a
  mass case.** For the ~5 funds with no L2 match at all, `active_fee_over_passive_bps` is **null** with an
  explicit `active_fee_over_passive_missing_reason`, and the page says plainly that no comparable passive
  blend exists. No fund ever renders a fabricated fee gap (no raw net ER masquerading as a passive gap).
- **DECISION 2 — exactly ONE "fee over passive" scalar end-to-end.** The hot scalar `fee_gap_bps` in
  `serving_facts_staging.parquet` is re-pointed from `fair_fee.gap_bps` (the fair-fee MODEL gap,
  currently 16.07 for FCNTX) to the canonical `active_fee_over_passive_bps`. Gate: after the change,
  `fee_gap_bps` for FCNTX equals `active_fee_over_passive_bps` (≈ 21 bps), NOT 16.07; grep confirms no
  consumer still reads the old top-level-`fee_gap_bps`-means-fair-fee-gap meaning unmigrated (consumers
  needing the model gap read `fees.fair_fee.gap_bps`); and there is exactly one "fee over passive"
  scalar surfaced.
- `/check-data` passes on `fee_efficiency_score.parquet` and `series_expense_ratio_history.parquet`
  (new columns), with the coherence checks included; served value == gold value for the canonical figure.
- Docs updated: `docs/status/pipeline_status.md`, `docs/status/data_gap_analysis.md`,
  `docs/agent_context_map.md` (fee-efficiency + value-offering rows), and the relevant data-product
  spec for the canonical figure + invariant. MEMORY note for the FCNTX net-ER root cause.

## Out of scope
- **Building new L2 passive-MATCH coverage** (finding a passive blend for a fund that has none).
  The genuine no-match residual is only **5 funds** (exotic/niche: hedged ADR, EM small-cap,
  global-macro); for those we keep the honest "no comparable passive alternative" null-state UX rather
  than inventing a match. *In scope, by contrast,* is **pricing the L2 blends that already exist but
  whose fee is null** (the ~63 matched-but-unpriced funds) — that is prerequisite A.1, a join/coverage
  fix, not a match-architecture change. FCNTX itself is neither case: its `passive_fee_bps` IS priced
  (18.0 at the served as-of) — its fix is reading the right (non-null) as-of row.
- Any change to the badge typology or skill model beyond making it read the canonical fee figure.

## Risks
- Switching `net_expense_ratio` from median to primary-class shifts the displayed fee for many
  multi-class series; this is correct but must be communicated (it changes Fee Fairness bands). Re-run
  the fee-efficiency labels and confirm no implausible swings.
- If a series' primary ticker has no filed net ER for the latest quarter, fall back to the latest
  filed quarter for THAT class (transparent as-of), not to the cross-class median.
