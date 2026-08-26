---
id: effective-positions-segment1
title: Effective positions on the filed EC-long basis — committed frame, serving repoint, peer baseline recompute (L10 Segment 1)
status: queued
track: backend
repo: fund_score
lane: reviewed
depends_on: ""
source_proposal: feature-pipeline/specs/queue/v4-serving-riders-skill-strip-effective-positions.md
origin: >
  Owner rulings 2026-08-26 (beta-execution-plan.md § Decision register, "2026-08-26 (midday) —
  OWNER RULINGS on the Path-to-Live batch", first bullet) over the Segment-0 measurement report
  /Users/alexfrey/Projects/fund_score-wt-l10/reports/l10_effective_positions.md (branch
  fix/l10-effective-positions, base 75980a3).
created: 2026-08-26
scope: global
model: opus
effort: high
---

## Owner summary
Today the site tells readers a fund is far more concentrated than its SEC filings say — one fund
that files 288 positions displays "1.0 effective positions" — and the figure exists for under half
of funds. This ships the corrected number, computed on the same filed holdings the page displays,
raising coverage from ~45% to ~96% of funds, fixing the top-10 concentration split and the
"fewer/more distinct bets than peers" sentence (which flips for 1 in 6 funds) in the same pass.

---

## 1. Authority, lineage, and what happened to the prior spec

**Four owner rulings (2026-08-26) are BINDING on this spec.** They ratified the Segment-0 report's
recommendations verbatim:

| # | ruling | binding meaning here |
|---|---|---|
| (a) | position set = filed long **EC** book (PRNEX **56.24**, commensurable with the served top-10 cell) | the statistic is computed over filed long lines with `asset_cat == 'EC'` — see §2.1 for the gloss note |
| (b) | validity gate = the **balance-sheet coherence split rule** (96.43% coverage, +175 funds over `90 ≤ S ≤ 110`) | `effective_positions` gated on the UNION (band OR balance-sheet coherence); `top10_weight_pct` stays on the band alone — §4.2 |
| (c) | degenerate single-line/feeder books **serve as filed plus a disclosure field**, no invented threshold | `book_shape` + `max_line_weight_pct` fields; nothing suppressed — §4.3 |
| (d) | `PeerConcentrationReadout` **recomputes the peer baseline on the new basis** — never silently drops the sentence | the design REPOINTS the `exposure_xray` row instead of retiring it, so `build_peer_rows` re-derives the peer median in-run on the new basis — §3 |

Decision 4 of the original five (the §3 as-of mislabel) **is already fixed at source and merged**
(`exposure_xray_v0.5`, fund_score main — `build_concentration_rows` now stamps the div-panel
metrics with `quarter_end_used` and derives confidence/coverage from the row's own book age).
This spec must NOT redo it and must NOT regress it (acceptance A12).

**Segment-0 caveat (dispatcher-recorded, load-bearing):** Segment 0 produced ONLY the report — no
committed source, no tests. Its intermediate parquet lived in a session scratchpad that no longer
exists, so **none of the report's numbers are re-runnable from the branch**. Segment 1 therefore
starts by re-deriving the filed-basis frame as real, committed pipeline code (§4/S1) and treats
every report figure as an **era-stamped diff reference** (staging mtime 2026-08-18, 5,819 served
funds), never as a binding acceptance value.

**Disposition of `specs/queue/v4-serving-riders-skill-strip-effective-positions.md`:** this spec
**replaces its Rider B (effective positions / `holdings.concentration`) in full**, under the four
rulings above (which override its all-filed-long position set, its band-only gate, and its
retire-in-both-emitters plan). **Rider A (the P(skill) population strip) is NOT covered here and
stays queued in that spec.** A superseded-in-part banner is added to that file in this change-set
so no implementer builds Rider B from the stale text.

**Redesign-collision check (done 2026-08-26):** `profile-v2-production-cutover.md` (movement 06)
*depends on* this spec landing first — it renders `holdings.concentration` and explicitly refuses
the current value; not a collision. `holdings-book-basis-disclosure.md` D1 already delivered the
`position_direction`/`asset_cat` columns this spec reads. `positioning-isin-rekey.md` (Segments 1+
owner-gated) and the ruled wrapper-look-through build both touch `build_positioning_changes_panel.py`
/ `positioning_changes.py` — a **merge-sequencing risk**, not a supersession (§9). No queued item
retires the components this spec touches before it lands.

---

## 2. Ruling translation — two points that must not be re-litigated by the implementer

### 2.1 "EC" means equity-common, not "equity+credit"
The plan-register entry glosses ruling (a) as "filed long equity+credit (EC-long)". In N-PORT and
in this codebase **`EC` is the equity-common asset category** — `fundscore.nport.book_basis.EQUITY_CAT
= "EC"`, and the row-inclusion contract (`src/fundscore/nport/holdings_inclusion.py`, rule 1:
"``assetCat = 'EC'`` — equity-common only. Bonds / preferred / derivatives / cash-equivalents are
different books"). The ruling ratified the report's DECISION-1 option (b): *"filed long EC lines,
which is exactly the book `concentration::top10_weight` (already rendered on V4) uses"* — i.e. the
`holdings_complete` basis. Credit/debt lines (`DBT`, ~13k rows in staging) are **excluded**. The
falsifier that pins this: PRNEX recomputes to **56.236822** on the equity-common long set and
**59.834041** on the all-long set (report §1.2/§6.2, era-stamped) — acceptance A2 asserts the
former. If the recomputation lands on neither, stop and escalate; do not pick silently.

### 2.2 The ruled gate is the UNION, and it is split across the two cells
Report §2.3's arithmetic: band `90 ≤ S ≤ 110` → 5,436 funds (93.42%); balance-sheet coherence
alone → 5,289 (90.89%, would DROP 322 the band keeps); **either** → **5,611 (96.43%)**. The ruling
cites "96.43% coverage, +175 funds over the spec's 90<=S<=110", which is only satisfiable by the
union. So:

- `effective_positions` (scale-invariant in `w`) is served when
  `n_lines_used ≥ 1 AND (90 ≤ S_long ≤ 110 OR |S_long/100 − totAssets/netAssets| < 0.05)`.
- `top10_weight_pct` (NOT scale-invariant) keeps the band alone: `90 ≤ S_long ≤ 110`.
- The resulting null-asymmetry between the two cells in one block is the ruled, disclosed cost;
  `long_weight_sum_pct` is served either way so a consumer can caption it.
- A filing whose `acc_no` has no snapshot balance-sheet row **cannot pass the coherence leg**
  (the gate degrades to the band — never an assumed pass; zero synthetic data).

---

## 3. Design — repoint, don't retire (the engineering translation of ruling d)

Segment 0 (§7.1.3) planned to retire `concentration::effective_positions` from BOTH emitters and
flagged the peer sentence as an open decision. Ruling (d) closed that decision: the sentence stays
and its baseline is recomputed on the new basis. The clean implementation is to **repoint the
`exposure_xray` absolute row at the new filed-basis frame instead of deleting it**:

- `build_peer_rows` (`exposure_xray.py` L1270–1330) derives the `vs_peer` median **in-run from the
  absolute rows** (peer-group median, gold-taxonomy key, `min_peers=5`). Repointing the absolute
  row makes the peer baseline recompute on the new basis with **zero new peer machinery** — exactly
  the [[sector-consensus-pin-derived-in-run]] pattern (never freeze a propagated baseline).
- The v2 page needs **zero web edits**: `format.ts:441 → betProfilePeerAnchor` and
  `ExposureXray.tsx:134/147/210 → PeerConcentrationReadout` keep reading the same
  `exposure_id`/`holdings_baseline` and simply start rendering the corrected values; the sentence
  is never silently dropped (ruling d satisfied by construction). `CurrentPositioning.tsx:422`
  likewise.
- The v4 grid reads the NEW `holdings.concentration` block (movement 06 of the cutover spec, which
  stays gated closed at `derive.ts:718/740` until that spec lands). Both surfaces are fed from the
  **same parquet**, so the one-book-per-concept rule holds.
- `positioning_changes` is the one true retirement: its effective-positions change rows compare two
  *quarters* of `eff_n_raw`, and the filed frame has exactly one as-of per series (grain asserted
  by `_holdings_full_teaser_by_series`), so the rows **cannot be recomputed on the new basis** and
  quoting the old book's counts is the defect. They are dropped, with per-fund fall-through
  verification (§5, S2d).

Rejected alternative (documented, not silent): retiring the xray row and serving
`peer_median_effective_positions` inside `holdings.concentration` — satisfies (d) but re-implements
peer medians in a second module, forces web edits on three live v2 files, and creates a second
peer-baseline convention to keep coherent. More surface, no added honesty.

---

## 4. Segment 1 — the filed-basis frame as committed pipeline code

### Data source (real inputs, as-of)
- `data/product/fund_profiles/fund_holdings_full_staging.parquet` — 1,398,380 rows / 5,740 series
  (era 2026-08-18 lake); columns used: `series_id, as_of, acc_no, weight_pct, position_direction
  ∈ {long, short, derivative_na}, asset_cat` (`EC` = 1,324,137 rows). Filed `pctVal` copied through
  EXACTLY, never rescaled (builder docstring, `scripts/pipeline/build_fund_holdings_full.py`).
  One `as_of`/`acc_no` per series (grain asserted upstream).
- `data/nport/snapshot/year=*/month=*/*.parquet` — the N-PORT balance sheet; columns
  `acc_no, seriesId, totAssets, netAssets, report_period_end`. Join by `acc_no` (Segment 0 matched
  302/302 of the gate-failure cohort on this key).
- Raw N-PORT holding store `data/nport/holding/year=*/month=*/` via
  `fundscore.nport.paths.recent_holding_globs` — **verification only** (independent recompute path;
  never an input to the build).

### Computation (binding; column names = what is computed)
New module `src/fundscore/product/holdings_concentration.py` (pure function over input frames — no
I/O, unit-testable) + `scripts/pipeline/build_holdings_concentration.py` (CLI; writes parquet with
build metadata that RECORDS the real build date — [[build-clock-recorded-not-frozen]]). Per series
(one row per series present in the staging parquet):

```
long_set     = filed lines with position_direction == 'long' AND weight_pct > 0
ec_set       = long_set ∩ (asset_cat == EQUITY_CAT)        # book_basis.EQUITY_CAT — no second 'EC' literal
S_long       = Σ weight_pct over long_set                   → long_weight_sum_pct
S_ec         = Σ weight_pct over ec_set                     → ec_long_weight_sum_pct
Q_ec         = Σ weight_pct² over ec_set
effective_positions = S_ec² / Q_ec                          # inverse Herfindahl, normalised by the
                                                            # retained set's OWN sum, never by 100
top10_weight_pct    = Σ of the 10 largest weight_pct in ec_set (all of them when n < 10)
coherent     = |S_long/100 − totAssets/netAssets| < 0.05    # false when no balance-sheet row joins
band_ok      = 90 ≤ S_long ≤ 110
gate_effpos  = n_lines_used ≥ 1 AND (band_ok OR coherent)   # ruling (b), §2.2
gate_top10   = n_lines_used ≥ 1 AND band_ok
```

Output `data/product/fund_profiles/holdings_concentration.parquet`, schema:

| column | type | rule |
|---|---|---|
| `series_id`, `as_of`, `acc_no` | str/date/str | copied from staging; one row per series |
| `effective_positions` | f64, nullable | null unless `gate_effpos` |
| `top10_weight_pct` | f64, nullable | null unless `gate_top10` |
| `n_lines_filed` | i64 | ALL filed lines for the accession (== `holdings_full.n_positions`) |
| `n_lines_used` | i64 | \|ec_set\| |
| `long_weight_sum_pct` | f64 | S_long — disclosed even when a value is null |
| `ec_long_weight_sum_pct` | f64 | S_ec — the statistic's normaliser |
| `nonlong_gross_share_pct` | f64 | Σ\|w\| non-long / Σ\|w\| all lines × 100 |
| `max_line_weight_pct` | f64 | largest retained `weight_pct` — a filed fact, no threshold (ruling c) |
| `book_shape` | str, nullable | `"single_line"` iff `n_lines_used == 1`, else null (ruling c; the only threshold-free degenerate class) |
| `missing_reason` | str, nullable | `effective_positions` leg: `no_long_ec_positions` \| `weight_sum_incoherent`; null when served |
| `top10_missing_reason` | str, nullable | `no_long_ec_positions` \| `weight_sum_out_of_range`; null when served |
| `basis` | str | `"filed_pctval_ec_long_book"` |
| `method_version` | str | `"holdings_concentration_v0.1"` |

Rules: a series absent from the staging parquet gets **no row** (79 era-stamped, honest-missing,
verified at the raw store in Segment 0). `missing_reason` and value are mutually exclusive per leg.
No renormalisation to 100, no imputation, no borrowing, no clamps — a gate-failed fund serves null
with a reason, period.

### EDA question (data-scientist, before building — coverage is the headline, up front)
1. **Coverage under the ruled gate, on the live lake:** non-null `effective_positions` count / % of
   served funds; the union-gate count (era: 5,611 = 96.43%) MINUS the gate-passing zero-EC cohort
   (BRPIX/SHPIX/SOPIX/URPIX class — Segment 0 named it but never counted it; count it and list its
   composition). Split the whole remainder honest-missing vs gate-failed vs zero-EC.
2. **The losers, enumerated per fund:** today-served funds (2,610) that end up null under the new
   basis. Era upper bound: 66 (the band-failures served today) — but the union gate can RESCUE some
   of the 66, and zero-EC can ADD losers. Produce the exact list with per-fund reason.
3. **Degenerate cohort under EC-long:** how many `n_lines_used == 1` books survive (era: 71 on
   all-long; the EC filter moves feeder/money-market single-liners like JINTX to
   `no_long_ec_positions` — confirm on JINTX: its one line is STIV, so it must serve null now, not
   1.0, and not 70.4).
4. **Two-answers bound:** distribution of `top10_weight_pct` − served `concentration::top10_weight`
   (era: identical sums for 93.0%, differences = single-line dedups) — sets the A7 tolerance.

### Segment-1 verification (data-reviewer checkpoint 1 — gate blocks)
- **Atomic (20 funds):** the report's §8 ten (PRNEX, JFEAX, TWAAX, EAISX, AGTHX, GITRX, SSILX,
  CHKLX, JINTX, DFSTX) + 10 fresh random gate-ok funds. Recompute `effective_positions` /
  `top10_weight_pct` **from the raw N-PORT holding store** (independent path, EC+long+positive
  filter), match to 1e-6 vs the frame. Era anchors, non-binding: PRNEX 56.236822 (EC) /
  59.834041 (all-long — must NOT be the served value); JFEAX ~118.7; JINTX null
  (`no_long_ec_positions`); DFSTX's gate outcome re-adjudicated under the union rule (it band-fails
  at S=118.28 — serve iff coherent with its balance sheet, else null).
- **Gate adjudication (10 funds):** 5 band-fail/coherence-pass (must be genuinely levered on
  `totAssets/netAssets`) and 5 of the era-18 "gross-up not on the balance sheet" misfilers (must
  stay null). Self-test: doubling the leverage term must flip the coherence verdict — every check
  shown able to fail ([[vacuous-check-and-boundary-axis]]).
- **Determinism:** build twice, stable-sort, byte-diff ([[rebuild-twice-proves-determinism]]).
- `/check-data` on the new parquet (entity `series_id`, date `as_of`); FAIL blocks.

---

## 5. Segment 2 — serving integration and the three consumers

**S2a — `fact_assembler.py`.** New `_holdings_concentration_by_series()` beside
`_holdings_full_teaser_by_series` (L660), reading the new parquet with the same fail-fast
`FileNotFoundError` pattern (the teaser's codex-P2 precedent: an optional read once silently
stripped a section). Nest as `holdings.concentration` at the holdings-section merge (L2876–2880 /
L2975). Assert per series `concentration.as_of == holdings_full.as_of` (same accession — build
fails on drift). **No `SECTION_COLUMNS` change, no DDL, no `GATES` change** (`holdings` is
`public`, L231) and no `gating.ts` edit — verify, don't assume: `apply_serving_schema.py` untouched
and `npm run db:check-serving` passes unchanged in fundscore-web (A13).

**S2b — `exposure_xray.py` repoint.** `build_concentration_rows` (now ~L866–935; the report's
L776–809 refs pre-date the v0.5 merge): drop `("effective_positions", "eff_n_raw")` from `metrics`;
take the new frame as an input (thread through `ex.build(...)` and
`scripts/pipeline/build_exposure_xray_panel.py` ~L158) and emit the
`concentration::effective_positions` row from `holdings_concentration.effective_positions`
(non-null rows only), stamped `fund_holdings_as_of = frame.as_of`. `active_share`/`hhi` keep their
`quarter_end_used` stamps and age-derived confidence/coverage untouched (**v0.5 non-regression** —
A12). `top10_weight` row unchanged. Update
`tests/test_exposure_xray.py::test_concentration_rows_carry_the_book_each_number_was_computed_on`
(L280–293): the two-stamp partition becomes {active_share, hhi} → div-panel date;
{effective_positions, top10_weight} → newest filed book.

**S2c — the peer-baseline leg (ruling d — its own verification leg).** No code change is expected
(`build_peer_rows` is generic over absolute rows) — that claim must be **verified, not asserted**:
- For 3 peer groups, recompute the `vs_peer` effective-positions median independently from the
  rebuilt absolute rows and match the panel's `reference_value` exactly; self-test with `mean`
  must mismatch (Segment 0's non-degeneracy pattern).
- Sentence-direction sample: 10 tickers including EAISX (era: served 2.34 vs peer 10.21 → "fewer";
  filed ~250 vs peer median ~59 → "more"). Flip-rate vs era-stamp **425/2,524 = 16.8%**
  (like-for-like 15.7%) — recomputed on the live build; a deviation passes only with a documented
  basis/universe explanation.
- Assert the sentence's inputs survive for every fund carrying the row: `betProfilePeerAnchor`
  requires `fund_exposure` + `passive_exposure` on the `vs_peer` row — zero rows with a null side
  among served rows. Never silently absent (the ruling's exact words).

**S2d — `positioning_changes` retirement (its own verification leg).**
- `scripts/pipeline/build_positioning_changes_panel.py::build_concentration_metrics` (L325–348):
  drop the `("effective_positions", "concentration::effective_positions", …, "count")` spec entry
  and its `long_parts` plumbing; `active_share` and the panel's `concentration::top10_weight`
  builder stay.
- `src/fundscore/product/positioning_changes.py`: remove the `passes_floor` eff-pos branch
  (L350–351) and `FLOOR_EFF_POS_REL` (L108).
- `scripts/reports/check_positioning_changes_panel.py`: CHECK 4's unit map (L744–771) — `count`
  leaves the domain: expected units become `{pp, z}` and **any `count` row or any
  `concentration::effective_positions` `change_id` is a FAIL** (the check stays able to fire;
  never delete the assertion). CHECK 3's era prose about count-unit rows (L706–708) updated.
- `tests/test_positioning_changes.py:74` fixture updated.
- **Per-fund fall-through, verified not assumed:** all 17 era row-carriers re-examined on the
  rebuilt panel; for the 10 that rendered it as the headline shift (GTSIX, SVOAX, SCNUX, VSTCX,
  GEMZX, BBIEX, DSMZX, MXEOX, VFQY, MXEVX) name what each fund's `surfaced_rank = 1` row now is.
  A fund left with zero surfaced rows must land in the section's existing honest-empty state —
  count and name them. No web edit expected (`pickTopShift` takes the next row).

**S2e — rebuild + the mandatory per-fund diff.** Rebuild `exposure_xray_panel.parquet`,
`positioning_changes_panel.parquet`, then re-assemble `serving_facts_staging.parquet` (pin
`--as-of` per [[skill-read-beta-adjusted-v2]]; isolated worktree with symlinked `data/`,
[[fund-score-worktree-shared-lakehouse]]). Then the gate the dispatcher mandates
([[aggregate-gate-masks-per-series-regression]]): a **per-fund served-vs-new diff over all 2,610
currently served figures** — every fund classified `corrected` (old → new value, ratio recorded) /
`lost` (enumerated, with reason — must reconcile exactly to the EDA-2 loser list) / `gained`
(new coverage). No aggregate substitute. Era shape references for the diff: 86.8% understated
today, median ratio 1.10, p90 8.3; the 163 "<5 shown, ≥50 filed" funds and the 9 arithmetically
impossible funds must all land in `corrected` or `lost`, none unchanged.

**Data-reviewer checkpoint 2 (adversarial, session-model):** semantics of the served rows —
[[green-gate-not-sufficient]]. Atomic re-checks off the STAGING (not the frame): PRNEX's
`holdings.concentration` + its xray row equal to 1e-9; JFEAX no longer serves 1.0 anywhere;
JINTX serves null with reason; sentence spot-checks incl. one flip and one non-flip; the
commensurability sweep (top-10 two-answers, `n_lines_filed` == teaser `n_positions`, as_of
equality) per [[data-tasks-sweep-all-inconsistencies]].

---

## 6. Acceptance criteria
Era-stamped numbers are 2026-08-18/2026-08-20 diff references, NON-BINDING; each recomputes from
the live lake and a deviation passes only with a written cause (cascade rebuild, universe change).

- **A1 — presence partitions exactly.** `holdings.concentration` present ⇔ series in
  `holdings_concentration.parquet` ⇔ series in `fund_holdings_full_staging` (set equality, not
  sampled). Per leg: value non-null ⇔ its gate passed ⇔ `missing_reason` null (zero exceptions).
- **A2 — atomic reproduction.** The 20-fund raw-store recompute of §4 matches served values to
  1e-6, on the EC-long basis (era: PRNEX **56.236822**, and explicitly NOT 59.83 or 30.48).
- **A3 — the ruled gate, independently re-derived.** For every non-null `effective_positions`,
  band-or-coherence re-verifies from staging + snapshot store; the era-18 misfiled `S>110` funds
  serve null; no fund passes coherence without a joined balance-sheet row.
- **A4 — invariants, non-degenerate.** `1 ≤ effective_positions ≤ n_lines_used` and
  `0 < top10_weight_pct ≤ ec_long_weight_sum_pct` — zero violations, and the era-9 "served value >
  filed line count" funds demonstrably gone (the check's ability-to-fail proof). Segment 0's A5
  amendment, carried.
- **A5 — coverage printed, both directions (fixes the old A7).** The build prints: non-null counts
  + % for both legs (era targets: effective_positions ≈ 5,611 minus the zero-EC cohort, from 2,610
  = 44.9% today); the `missing_reason` histogram; the absent-from-staging count; AND the enumerated
  per-fund loser list (era ≤ 66) — gains alone never pass.
- **A6 — the per-fund diff gate (S2e) ran and is attached.** All 2,610 classified; zero funds
  silently lost; JFEAX/GITRX/SSILX/TWAAX/EAISX in `corrected` with ratios consistent with era
  values.
- **A7 — one top-10 answer (DECISION-3 asserted, not assumed).** `holdings.concentration.
  top10_weight_pct` vs the rendered `concentration::top10_weight`: agreement within the EDA-4
  tolerance; every fund beyond it adjudicated (dedup-explained or defect); count reported (era:
  93.0% identical). The cutover's movement-06 cell can then source either without a fork.
- **A8 — the fixed grep (Segment 0's amendment).** `grep -Rn "concentration::effective_positions"`
  over **`FUNDSCORE/{src,scripts}`** (not `src` alone — the old A8 could not fail on the second
  emitter) hits ONLY `exposure_xray.py` + its tests; zero hits in the positioning chain; zero
  `eff_n_raw` references in `exposure_xray.py`; zero served `positioning_changes.rows[]` with
  `change_id == "concentration::effective_positions"` (asserted over ALL rows).
- **A9 — ruling (d) verified.** S2c's three legs pass: median reproduction (with failing
  self-test), flip-rate vs era 16.8% explained, zero one-sided `vs_peer` rows.
- **A10 — positioning fall-through verified per fund.** S2d's 17-fund table attached.
- **A11 — determinism.** Frame and staging each built twice → stable-sort byte-diff clean on the
  `holdings`, `exposure_xray`, `positioning_changes` columns.
- **A12 — no regression of the shipped as-of fix.** `scripts/checks/check_exposure_xray_asof_coherence.py`
  green; `active_share`/`hhi` rows still stamp `quarter_end_used`; updated stamp-partition test
  passes.
- **A13 — serving is a no-op schema-wise.** `apply_serving_schema.py` untouched;
  `npm run db:check-serving` (fundscore-web, unchanged checkout) exits 0; **no Postgres load in
  this spec** — the staging rides the next owner-gated reload ([[serving-db-ahead-of-branches]]),
  and the fundscore-web build/lint gate is run once to prove the unchanged web tier still builds
  against the new staging shape (`npm run build && npm run lint`).
- **A14 — gates.** `uv run make check` / `scripts/checks/run_checks.py` green (incl. the updated
  positioning check); `/check-data` FAIL blocks on both rebuilt artifacts; adversarial
  `fundscore-data:data-reviewer` checkpoints 1 and 2 passed; `codex --high` pass gating the commit.
  Zero synthetic/imputed/defaulted values anywhere (A10-old, carried).

## 7. Verification plan (for the review gate)
Sample sizes: 20 atomic funds (raw-store recompute), 10 gate adjudications, 3 peer-group medians +
10 sentence funds, 17 positioning funds, full-universe per-fund diff (2,610) — within the 10–30
item / 100–400 filing convention where sampled, exhaustive where the lesson demands it. Baseline /
prior: the Segment-0 report's era-stamped tables (§1–§6) as diff references; the live
`serving_facts_staging.parquet` as the served-today side. Statistical coherence: ratio-distribution
shape vs §1.1, flip-rate vs §4.4, coverage vs §2 — deviations explained in writing or FAIL.
No-leakage: not applicable (single latest filed book per series, stamped `as_of`; no
forward-looking joins — the reviewer confirms the frame carries no date later than its accession).

## 8. Out of scope
- **Rider A** (P(skill) population strip) — stays in the prior spec, untouched.
- `concentration::active_share` / `concentration::hhi` values and their div-panel basis (the as-of
  MISLABEL is already fixed; the basis itself is a separate question), and
  `diversification_panel.eff_n_raw` as the fee-efficiency multiplier input (verified non-consumer
  of the serving change, report §4.1).
- The `holdings_snapshots` / `holdings.top_holdings[]` book itself (L9 converges it toward the
  filed book; the movement-06 top-10 cell sources this spec's frame instead — cutover contract).
- The 217 funds receiving `vs_peer` rows against a peer group the page cannot name (pre-existing,
  filed by Segment 0). `identity.holdings_count` vs `n_positions`. Any Postgres load.

## 9. Risks
- **Same-file merge collisions:** the ruled wrapper-look-through build (queued first) and
  `positioning-isin-rekey` both touch `build_positioning_changes_panel.py` /
  `positioning_changes.py`. Rebase S2d onto whatever has merged before branching; isolated
  worktree, scoped commits ([[shared-worktree-contamination]]).
- **Era drift:** every §-referenced number was measured on the 2026-08-18 staging; the cascade
  rebuilds these panels. A5/A6 force live recomputation.
- **The EC gloss** (§2.1): if anyone re-reads the ruling as equity+credit, PRNEX pins the answer;
  escalate rather than choose if the anchor fails to reproduce.
- **Zero-EC coverage dip:** the ruled gate's 96.43% shrinks by the zero-EC cohort (uncounted in
  Segment 0). If EDA-1 finds it large (>1% of served funds), brief the owner before build — it is
  a basis consequence the ruling did not size, not a defect.
- **v2 value jump without a code change:** the live page's effective-positions figures change on
  reload day by design (that is the fix); the per-fund diff (A6) is the audit trail the owner
  brief cites.
