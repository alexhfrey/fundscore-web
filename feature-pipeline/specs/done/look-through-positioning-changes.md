---
id: look-through-positioning-changes
title: Look-through positioning-changes for ETF-wrapper funds (backend)
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/prds/look-through-positioning-changes.md
created: 2026-07-09
scope: global
---

# Look-through positioning-changes for ETF-wrapper funds — backend

PRD: `feature-pipeline/prds/look-through-positioning-changes.md` (owner-resolved all 7 questions
2026-07-09). **Read it first** — the acceptance numbers and the seven decisions below come from it.

## Problem

Two fund-profile sections disagree for funds holding third-party wrapper ETFs. **Exposure X-ray**
(from `holdings_complete`) looks THROUGH a wrapper ETF to its underlying constituents; **Positioning
changes** (from `holdings_snapshots`) shows only the thin DIRECT book, so the wrapper is one opaque
line. THEQ (79% of NAV in TSPA): X-ray Technology 29.7% vs Positioning Technology 3.0%. Measured
2026-07-08: 10 funds diverge >5pp on some sector, 17 >3pp, 37 >1pp (of 3,215 in both panels). None
is tagged `is_fund_of_funds`. Owner decision: put positioning on the **same looked-through basis as
X-ray**.

## Owner decisions (from the PRD — build to these)

1. **Q1 REPLACE in place** — one coherent looked-through positioning section; no parallel direct-book
   section. Keep the existing serving section key/contract so the frontend is unaffected.
2. **Q2 WHOLE active-EQ universe** recomputed on the looked-through basis (not a wrapper-only
   overlay) so `change_z` stays cross-sectionally comparable.
3. **Q3 PARTIAL coverage with a flag** — where an endpoint's look-through is incomplete, serve the
   partial looked-through result carrying a coverage flag; the unresolved piece is honest-missing.
   Never null the whole endpoint for one missing constituent; never back-fill / direct-book-fallback.
4. **Q4 EXTEND the twin map** — give QQQ (and other UIT/foreign wrappers with no N-PORT filing) a
   twin series so they look through too.
5. **Q5 NO taxonomy change** — do not re-tag ETF-wrapper funds as fund-of-funds; leave the surfacing
   gate as-is (the look-through fix removes the reason to special-case them).
6. **Q6 BOUND to the served window** — no full 104-quarter rebuild; look through only the quarters
   the positioning endpoints need.
7. **Q7 FOREIGN-INCLUSIVE basis** — rebuild positioning on X-ray's foreign-inclusive LEI-recursion
   book (the `holdings_complete` construction), NOT a US-ticker reshape of `holdings_snapshots`.
   Accepted trade-off: plain *international* funds' positioning also changes; only plain *domestic*
   funds stay unchanged.

## What to build

1. **A windowed, full-look-through holdings frame.** Generalize `build_holdings_complete.py`
   `lookthrough()` (LEI→series master-feeder recursion, `max_depth=6`, foreign-inclusive) from
   latest-only (`_PULL_SQL` `MAX(report_period_end)`, :87) to a **multi-quarter** frame over the Q6
   window:
   - Grain: series × quarter_end × looked-through security. For each fund quarter Q in the window,
     expand each wrapper position using the wrapper's own filing **as-of ~Q** (nearest-prior;
     define the max lookback window and state it — the coverage estimate used 120d). Recurse to the
     same depth X-ray uses so nested ETF-of-ETF resolves identically.
   - **Carry BOTH legs (required):** `pct_nav` (display; multiplicative look-through scaling
     `f_pct_nav × m_pct_nav` exactly as `lookthrough()` does today — NOT renormalized) **and** a
     per-endpoint renormalised `weight`. The `weight` leg is non-optional: the positioning surfacing
     gate computes `classified_weight` from `weight` (`build_positioning_changes_panel.py:157,184`),
     so a pct_nav-only frame leaves the wrapper's `weight` as one unresolvable ETF line
     (`classified_weight ≈ 0` → `assign_status` stamps sector/theme "missing",
     `positioning_changes.py:271`) and the rows this feature exists to fix never surface.
   - **Window (Q6):** only the quarters the endpoints land on — `current` (latest ≤ eval_date),
     `mid` (~182d), `prior` (~365d), i.e. trailing ~1yr / ~4–5 quarters. Reuse the recent-window
     glob (`src/fundscore/nport/paths.py`); do NOT union all 340k files / 104 quarters.
   - **Twin map (Q4):** extend the wrapper-twin map (today `SPY_TWIN`/`universe_series()`, only in
     `build_holdings_complete.py:70,199`) to cover QQQ and other UIT/foreign wrappers, and **wire it
     into this new positioning look-through** (it is not shared with the positioning builder today).
     A wrapper with neither an N-PORT filing nor a twin → its underlying is honest-missing (Q3).
2. **Recompute positioning on that frame (Q1 replace, Q2 whole universe).** Feed the looked-through
   frame into `build_positioning_changes_panel.py` in place of `holdings_snapshots` for the **whole
   active-EQ universe**. Reconstruct the two/three endpoints and recompute sector / theme / top-10
   concentration / single-name entered-exited-increased-decreased on the looked-through `pct_nav`,
   and **`change_z` cross-sectionally on the same looked-through basis for the whole universe**
   (`positioning_changes.py:206-218`; a mixed basis contaminates the z — do not mix). The sector/
   theme taggers are already shared with X-ray (`exposure_xray as xr`); keep them.
3. **Partial-coverage semantics (Q3).** Add a per-endpoint (or per-change_id) coverage flag on the
   panel. Rules: (a) a constituent with null `pct_nav` under the coherence guard → drop it and mark
   reduced coverage (not a silent under-count, not a whole-endpoint null); (b) a mid-endpoint (~182d)
   gap where the wrapper skipped a quarter → serve what's available and flag it (note the
   `persistence_state == "sustained"` surfacing dependency — a gap must not silently suppress a real
   sustained change). Honest-missing is surfaced, never back-filled.
4. **Serving.** `fact_assembler._positioning_changes_by_series()` (:785-832) consumes the rebuilt
   gold panel. Because Q1 = replace, keep the same section key / served shape (frontend unaffected),
   extending it only with the coverage flag where present. STAGING only — the Postgres push stays
   sign-off-gated per house rules.
5. **Checks** (a `check_*` script + invariants wired into the build):
   - **Coherence with X-ray (the point of the feature):** at the latest endpoint, positioning
     sector/theme weights equal the X-ray looked-through weights to ≤1pp for the whole universe when
     compared against the **same wrapper filing X-ray used** (common as-of). THEQ Technology ~29.7%
     (not 3.0%). The 10/17/37 divergence cohort → ~0.
   - **Blast-radius characterization:** report how many funds' positioning moved and by how much,
     split plain-domestic (should be ~unchanged) vs plain-international (expected to change) vs
     wrapper (the target) — so the international change-set is auditable, not a surprise.
   - **Coverage headline:** % of served funds with full look-through vs partial (flagged), remainder
     split honest-missing vs recoverable with spot checks on misses (house coverage rules).
   - **Data-integrity:** no synthetic fills; look-through `pct_nav` is multiplicative (not
     renormalized); no double-count through recursion; a nulled/guarded constituent is dropped +
     flagged, never fabricated.

## Out of scope

Full 104-quarter history (Q6 — windowed only); re-tagging wrapper funds as fund-of-funds (Q5); any
frontend change beyond consuming the (contract-preserved) served shape; any Postgres push; changing
the X-ray section itself (positioning conforms to X-ray, not vice-versa).

## Acceptance

The PRD's acceptance (resolved for the foreign-inclusive basis): whole-universe positioning==X-ray
≤1pp at the latest endpoint on a common wrapper as-of; THEQ tech ~29.7%; plain-domestic funds
unchanged within noise; plain-international change-set characterized in the report; incomplete
look-through served partial+flagged (not nulled, not back-filled). Assembly-line gates apply —
data-reviewer checkpoint after every step, /check-data (positioning) PASS, codex CODEX_GATE pass
before done.

## Notes for the implementer

- This is a heavier build than the current latest-only pull (foreign-inclusive LEI recursion over a
  window). Keep it bounded to the served window (Q6) and reuse existing helpers (`lookthrough()`,
  the recent-window glob, the shared sector/theme taggers, the canonical-accession dedup from the
  NPORT-refresh double-count fix) — do NOT re-derive them.
- Ground the as-of lookback window and the twin-map additions in real coverage before scaling: the
  grounding research measured ~90.4% of material (≥10% NAV) wrapper positions have as-of
  constituents available (THEQ ~100%); the honest-missing tail is pre-inception quarters + non-equity
  / UIT wrappers — those are the Q3 partial-coverage cases.
- `change_z` is nulled below 30 populated funds per change_id (`MIN_FUNDS_FOR_Z`); recompute on the
  looked-through basis for the whole universe so the z population and threshold stay honest.
- Sanity anchors from research: THEQ = series S000089786 holds TSPA = S000071604 (in the LEI map);
  wrapper histories in `holdings_snapshots` — TSPA 20q, SCHX 22q, SPYM/XLK/VOO(SPY-twin) 23q. QQQ is
  a UIT (ticker→series None) — needs a twin (Q4).
