# PRD: Look-through positioning-changes for ETF-wrapper funds

- **Slug:** look-through-positioning-changes
- **Source:** backlog (story), owner decision 2026-07-08 ("build a full-history LOOKED-THROUGH
  positioning source", not suppress/basis-note)
- **Date:** 2026-07-09
- **Status:** RESOLVED — owner answered all 7 questions on 2026-07-09 (see Owner decisions). Spec
  queued: `feature-pipeline/specs/queue/look-through-positioning-changes.md`.
- **Track (proposed):** backend (fund_score) — new/parallel gold panel + serving change; frontend
  unaffected only if the serving contract is preserved (Open Q1)

## Problem

On a fund profile, two sections tell contradictory stories for funds that hold third-party wrapper
ETFs:

- **Exposure X-ray** (built from `holdings_complete`) looks **through** wrapper ETFs to their
  underlying constituents — a position in an ETF that is itself an N-PORT filer is expanded into
  that ETF's own holdings (LEI→series master-feeder recursion, `build_holdings_complete.py`
  `lookthrough()`).
- **Positioning changes** (built from `holdings_snapshots`) shows only the thin **direct** book: a
  wrapper ETF is a single opaque position, so the sector/theme exposure it carries is invisible.

For a wrapper fund the two sections disagree by tens of points. Measured 2026-07-08: **10 funds
diverge >5pp on some sector, 17 >3pp, 37 >1pp** (of 3,215 in both panels). Example — **THEQ** (79%
of NAV in one ETF, TSPA): X-ray Technology **29.7%** vs Positioning Technology **3.0%** (TSPA maps
to no GICS sector, so only the tiny direct names classify). Others: FAEQX 74.6% SCHX; GSEQX 34%
SPYM; CGHIX 11% SPY; KOOL XLK. None is tagged `is_fund_of_funds`.

## Who & why

Retail investors reading "what has this fund been doing lately" (positioning) against "what am I
actually exposed to" (X-ray). When the two disagree by tens of points, the page loses trust and the
positioning story is simply **wrong** for wrapper funds — it reports ~0% tech for a fund that is
30% tech through its ETF sleeve.

## What it does (behavior)

Positioning-changes weights and their quarter-over-quarter changes are computed on the **same
looked-through basis** as the X-ray, across the fund's filing history — so sector / theme /
concentration and the entered/exited/increased/decreased single names reflect the fund's true
underlying exposure, not the opaque single-ETF line.

Concretely: at each historical endpoint the panel already uses, each wrapper-ETF position is
expanded into the wrapper's own constituents **as of ~that quarter** (nearest-prior wrapper
filing), scaled by the position weight — exactly the X-ray expansion, recursing to the **same depth
X-ray uses** (`max_depth=6`, so nested ETF-of-ETF resolves the same way), but applied at every
endpoint rather than only the latest. Where the wrapper's own filing history does not reach a
fund's older quarter, that look-through is **honest-null** (surfaced as missing, never back-filled
with the direct book or a fabricated value).

## In scope

- A **full-history looked-through holdings frame** (series × quarter × looked-through security),
  carrying **both** `pct_nav` (display basis) **and** a per-endpoint renormalised `weight` —
  generalizing the existing latest-only look-through (`MAX(report_period_end)`) to all quarters with
  an as-of join to each wrapper's own filing. The `weight` leg is required, not optional: the
  positioning surfacing gate computes `classified_weight` from `weight`
  (`build_positioning_changes_panel.py:157,184`), so a frame that looks through only `pct_nav`
  leaves the wrapper's `weight` as the single unresolvable ETF line (`classified_weight ≈ 0` →
  `assign_status` stamps sector/theme "missing") and the very rows this feature exists to fix never
  surface.
- Positioning-changes weights + change magnitudes recomputed on that basis (sector, theme, top-10
  concentration, single-name entered/exited/increased/decreased).
- `change_z` recomputed on the same basis (cross-sectional z per `change_id` — see Open Q2).
- Honest-null look-through for endpoints the wrapper history can't reach.
- Data-integrity gates: /check-data, data-reviewer, codex.

## Out of scope

- **New ETF-constituent ingestion / new vendor feed** — not needed under either design. The wrapper
  ETFs are themselves N-PORT filers already in the lakehouse (2019–2026, 20–23 quarters each in
  `holdings_snapshots`). (No new *data source* — but note this is NOT a free "reshape": full-history
  look-through is a heavier rebuild than the current latest-only pull, and under the foreign-inclusive
  design (Open Q7) it is a full raw-N-PORT recursion, not a reshape of `holdings_snapshots`. See
  Open Q6/Q7.)
- Frontend redesign — the section keeps its serving contract if Open Q1 lands on "replace".
- Re-classifying wrapper funds as fund-of-funds (Open Q5), unless the owner wants it.

*Resolved for the Q7 foreign-inclusive basis.*

- At the latest endpoint, positioning sector/theme weights equal the X-ray looked-through weights to
  within ≤1pp **for the whole universe** (both now stand on the same foreign-inclusive LEI-recursion
  book), when compared against the same wrapper filing X-ray used (a common as-of — X-ray expands
  using the wrapper's latest filing, so the acceptance comparison must pin positioning to that same
  wrapper snapshot, else legitimate constituent drift fails the test). The 10/17/37 wrapper-fund
  divergence cohort collapses to ~0.
- THEQ latest Technology reads **~29.7%** in positioning (matching X-ray), not 3.0%.
- **Plain DOMESTIC** funds' positioning is unchanged within numerical noise. Plain **international**
  funds legitimately change (foreign names they hold directly now enter the book) — an accepted,
  expected consequence of the foreign-inclusive basis, not a regression; the change-set is
  characterized in the build report (how many funds move, by how much) so it's auditable.
- Endpoints where the look-through is incomplete serve a **partial** result with a coverage flag
  (Q3), the unresolved constituent(s) honest-missing — never a direct-book fallback or a back-fill.
- /check-data + data-reviewer green on the rebuilt panel; CODEX_GATE pass.

## Owner decisions (2026-07-09)

Owner answered all 7 questions. A lean spec is queued at
`specs/queue/look-through-positioning-changes.md`.

- **Q1 → REPLACE in place.** One coherent looked-through basis across both sections — no parallel
  direct-book section.
- **Q2 → WHOLE active-EQ universe** recomputed on the looked-through basis, so `change_z` stays
  cross-sectionally comparable.
- **Q3 → PARTIAL coverage with a flag.** Where an endpoint's look-through is incomplete (wrapper
  history doesn't reach the quarter, a UIT with no twin, a null-`pct_nav` constituent), serve the
  partial looked-through result carrying a coverage flag — honest-missing for the unresolved piece,
  never back-filled or a direct-book fallback. Do NOT null the whole endpoint because one
  constituent is missing. (Resolves red-team N2/N3 sub-cases the same way: drop the unresolved
  constituent, flag reduced coverage.)
- **Q4 → EXTEND the twin map.** Give QQQ (and other UIT/foreign wrappers) a twin series so they look
  through too; the twin map (today only in `build_holdings_complete.py`) must be newly wired into
  the positioning look-through.
- **Q5 → NO taxonomy change (practical pick).** Do not re-tag ETF-wrapper funds as fund-of-funds.
  The look-through fix removes the reason to special-case them; re-tagging is a broader taxonomy
  change with unclear downstream effects (screens/other panels) and isn't needed to fix the
  incoherence. Leave the surfacing gate as-is.
- **Q6 → BOUND to the served window (practical pick).** No full 104-quarter rebuild. The positioning
  panel only needs its endpoints (current / ~182d / ~365d ≈ trailing ~1yr) plus the cross-sectional
  eval_date, so look through only the recent window those endpoints land on (reuse the existing
  recent-window glob). "Full-history" in the story meant "more than `holdings_complete`'s single
  latest quarter," not literally all 104 quarters.
- **Q7 → FOREIGN-INCLUSIVE basis (match X-ray everywhere).** Positioning rebuilds on X-ray's
  foreign-inclusive, LEI-recursion book (the `holdings_complete` construction), generalized over the
  Q6 served window — NOT a US-ticker reshape of `holdings_snapshots`. Positioning and X-ray reconcile
  everywhere, including international wrappers. **Accepted trade-off:** plain international, non-wrapper
  funds' positioning also changes (foreign names they hold directly now enter the book), and the
  build is heavier (full raw-N-PORT LEI recursion over the window). So "non-wrapper funds unchanged"
  is NOT a guarantee — only *plain domestic* funds are unchanged.

## Open questions — original framing (Q1–Q6 RESOLVED above; Q7 open)

**Q7 is load-bearing** — it picks the holdings basis and thereby the whole engineering path; Q1–Q6
are the surrounding product calls.

1. **New parallel section vs replace the existing positioning source.** Keep the direct-book
   positioning AND add a looked-through one, or replace the basis in place? Affects the serving
   contract and whether the frontend changes. *(Recommendation: replace in place — X-ray already
   looks through every fund, so a single coherent basis across both sections is the cleaner story;
   but this is an owner/serving-contract call.)*
2. **`change_z` universe basis.** `change_z` is a cross-sectional z of each `change_id`
   (e.g. `sector::technology`) across the whole active-EQ universe. A mixed basis (some funds
   looked-through, some direct) contaminates the z. *(Recommendation: move the ENTIRE active-EQ
   universe to the looked-through basis — the natural choice, since `holdings_complete` already
   looks through all funds. Confirm acceptable.)*
3. **Honest-missing policy for older quarters.** ~10% of material (≥10% NAV) wrapper positions
   predate the wrapper's first filing or are non-equity/UIT wrappers. For those endpoints: null the
   whole positioning endpoint for that fund, or serve a partial result with a coverage flag?
   (Data-integrity: must be honest-null, never back-filled.) Two sub-cases the policy must name
   (from red-team): (a) an individual **constituent whose `pct_nav` is null** under the coherence
   guard — drop it (silent under-count) vs null the whole expansion; (b) a **mid-endpoint (~182d)
   gap** where the wrapper skipped a quarter so mid is null while prior/current exist — this makes
   `persistence_state` uncomputable and a real sustained change silently fails the surfacing gate
   (`persistence_state == "sustained"` required). Both are rare today but need a stated rule.
4. **UIT / non-N-PORT wrappers (QQQ and others).** SPY already looks through via a hard-coded twin
   (Vanguard 500, `SPY_TWIN`); **QQQ is a UIT with no N-PORT filing and no twin today**, so funds
   holding QQQ would look-through-miss. Extend the twin map, or leave those positions
   un-looked-through (a mixed basis within one fund)? (Impl note: `SPY_TWIN`/`universe_series()`
   live only in `build_holdings_complete.py:70,199` — the twin map must be **newly wired into** the
   positioning look-through, not merely extended.)
5. **FOF / ETF-wrapper taxonomy gate.** THEQ (79% one ETF) currently passes the active-EQ, non-FOF
   surfacing gate. Should ETF-wrapper funds be re-flagged, and does looked-through positioning
   change how the gate treats them?
6. **Compute/scale strategy.** Full-history look-through over ~104 quarters with recursive master
   expansion is far heavier than the current single-latest pull (the builder deliberately scans
   only ~2 recent years to avoid unioning ~340k files). Scope to the active-served universe /
   recent-N-years window, or cover full history? (Affects build time and which older endpoints
   exist at all.)
7. **Holdings basis — US-ticker vs foreign-inclusive (LOAD-BEARING).** The two sections do NOT share
   a holdings frame today: X-ray's look-through is **LEI-recursion on `holdings_complete`**
   (foreign-inclusive, composite security key, depth≤6); positioning reads **`holdings_snapshots`**
   (US-ticker-keyed, no `lei` column, foreign names dropped). So "same basis as X-ray" forces a
   basis choice:
   - **(b) US-ticker reshape of `holdings_snapshots`** — cheap, plain funds stay byte-identical, but
     identifies wrappers by ticker→series (misses non-ticker/foreign feeders X-ray catches on LEI)
     and under-counts exposure through wrappers that hold foreign names; the residual must serve
     honest-null, so positioning still won't *fully* reconcile with X-ray for international wrappers.
   - **(a) foreign-inclusive rebuild matching X-ray** — full coherence with X-ray, but also changes
     **plain international, non-wrapper** funds (foreign names enter their top-10 / single-name
     positioning) — a scope expansion beyond the wrapper cohort — and is the heavy full raw-N-PORT
     recursion of Open Q6.
   This is a data-truth + scope call only the owner can make; it decides whether the "non-wrapper
   funds unchanged" guarantee survives and which acceptance criteria above apply. *(Recommendation:
   US-ticker basis for v1 — keeps the change surgical and the "unchanged" guarantee real, foreign-
   wrapper residual served honest-null rather than under-counted; revisit foreign-inclusive only if
   international wrappers prove material.)*

## Evidence (grounding research, 2026-07-09)

- Look-through lives upstream in `build_holdings_complete.py` `lookthrough()` (`:135-195`), an
  LEI→series master-feeder expansion against N-PORT itself (depth ≤6), consumed by
  `build_exposure_xray_panel.py:47,65`. Wrapper ETF TSPA = series S000071604, present in
  `data/reference/nport_lei_series_map.parquet`.
- `holdings_complete` is latest-only by construction (`_PULL_SQL` `MAX(report_period_end)`, `:87`):
  1 quarter/series. `holdings_snapshots` is full-history: med 20 / max 27 quarters, 2019-09-30 …
  2026-05-31.
- Wrapper ETFs' own constituent history already exists in `holdings_snapshots` (TSPA 20 q, SCHX 22,
  SPYM 23, XLK 23, VOO/SPY-twin 23). **QQQ and SPY are UITs and do NOT file N-PORT** — SPY handled
  by twin, QQQ unhandled.
- positioning panel: `build_positioning_changes_panel.py` reads `holdings_snapshots`; endpoints
  current / prior(~365d) / mid(~182d); `change_z` = cross-sectional z of `change_magnitude` per
  `change_id` across active-EQ, nulled when <30 funds (`src/fundscore/product/positioning_changes.py:206-218`).
- Coverage: ~90.4% of material (≥10% NAV) wrapper positions have as-of constituents available; THEQ
  ~100% (TSPA history covers all its positioning quarters). Honest-missing tail = pre-inception
  quarters + non-equity/UIT wrappers (HYG, IUSB, QQQ, …).
- Serving: `fact_assembler.py` `_positioning_changes_by_series()` (`:785-832`) and
  `_exposure_xray_by_series()` (`:623`); both "free" tier sections into `fund_profile_facts`.

## History

- Rev 1 (2026-07-09): grounding research in fund_score (feasibility + panel internals + coverage);
  minimal PRD written.
- Rev 2 (2026-07-09): one red-team round (spec-reviewer stance). Folded in the clarification-type
  findings — B6 (frame must carry a looked-through `weight`, not only `pct_nav`, or the surfacing
  gate keeps the fixed rows suppressed), B5 (recurse to X-ray's depth≤6 for nested wrappers), B4
  (acceptance pinned to a common wrapper as-of), B2 (≤1pp scoped to the all-US-ticker cohort), and
  nits N1–N3 into Q4/Q3 — and added **Q7** (the load-bearing US-ticker-vs-foreign-inclusive basis
  decision, the product half of the red-team's B1/B2/B3). Escalating to owner: **7 open product
  questions** remain.
