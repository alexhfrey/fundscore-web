---
id: look-through-coverage-honesty
title: Look-through coverage-honesty hardening (codex P2 fast-follow) (backend)
status: queued
track: backend
repo: fund_score
lane: reviewed
depends_on: look-through-positioning-changes
source_proposal: codex --high sign-off on fund_score fd982cd (2026-07-10)
created: 2026-07-10
scope: global
model: opus
---

# Look-through coverage-honesty hardening — backend

Fast-follow to the shipped look-through positioning-changes feature (fund_score `fd982cd`). Two P2
advisories from the codex `--high` sign-off, both about **honest partial-coverage disclosure**.
Neither is a live data error today (the data-reviewer verified realized impact is nil), but each is
a latent coverage-honesty gap that will silently under-disclose as the data evolves — the exact
"honest-missing, never silent" rule the house treats as sacred. Bundle both: same theme, same
feature surface, one reviewed pass.

## Problem 1 — unresolved ETF wrappers misclassified as leaf companies

`src/fundscore/product/lookthrough_window.py:315-318` sets `is_unresolved_wrapper` TRUE only when
`msid` resolves (twin-map ticker OR position LEI → a fund series, via `_resolve_msid`, :220-228). A
held ETF/fund whose ticker is NOT in the twin map AND whose position LEI does not resolve to a
series (e.g. VOO / IVV / VEA filed with a non-mapping or absent LEI) gets `msid=null` and is treated
as an ordinary **leaf operating company**. Consequences at that endpoint:
- `lookthrough_coverage` counts the opaque ETF line as resolved → reports FULL coverage when it is
  not (silent under-disclosure — the recoverable-vs-honest-missing class the house forbids).
- sector/theme calcs retain an opaque ETF line as if it were a real company holding.

The current design (comment :311-314) deliberately lets a "UIT wrapper with neither an N-PORT filing
nor a twin" fall to `msid=null` as an opaque direct line, arguing it matches X-Ray's basis. That is
defensible for genuinely-unlookthroughable UITs, but it also swallows **known large ETFs** that
SHOULD be flagged as an honest-missing wrapper residual.

### Fix direction
Detect held fund/ETF wrappers by a signal INDEPENDENT of `msid` resolution and flag them
`is_unresolved_wrapper=True` (honest-missing) even when `msid` is null — never counting them toward
resolved coverage. Candidate signals (pick the cleanest; verify on the raw frame first):
- the held security is in the ETF/fund reference universe (Sharadar ETF list / fund-series ticker
  set / N-CEN registered-fund set) but could not be resolved/looked through, OR
- assetCat / security-type on the raw N-PORT line marks it a registered fund / ETF.

Prefer EXTENDING resolution (add the ETF to the twin map / LEI map so it looks through) where a
filing exists; only flag-as-unresolved when no lookthrough source exists. Never back-fill, never
silently drop. `lookthrough_coverage` must EXCLUDE flagged wrappers from the resolved numerator.

## Problem 2 — partial-coverage metadata dropped for funds with no surfaced shifts

`src/fundscore/serving/fact_assembler.py:785-838` (`_positioning_changes_by_series`) filters the
panel to `is_surfaced` rows and only builds an `out[sid]` entry for series that HAVE surfaced rows;
the `lookthrough_coverage` / `lookthrough_partial` metadata (:837-838) rides inside that per-series
dict. So a fund with **partial look-through (`lookthrough_partial=True`) but zero surfaced shifts**
gets NO `positioning_changes` section at all → the UI cannot show its partial-coverage flag, and the
"we could only see X% of this fund's book" disclosure is lost.

### Fix direction
Decouple coverage-metadata emission from the `is_surfaced` filter. For any series present in the
panel at the latest `eval_date` with `lookthrough_partial=True` (or, more simply, any panel
presence), emit a `positioning_changes` section carrying `rows: []`, plus `status`, `eval_date`,
`lookthrough_coverage`, `lookthrough_partial` — even with no surfaced rows. Keep the existing serving
key/contract so the frontend is unaffected; `rows: []` + a partial flag is the honest "looked, saw
partially, nothing crossed the surfacing bar" state. Confirm the frontend tolerates an empty `rows`
with metadata (coordinate the served shape if not).

## Acceptance
- **P1**: enumerate held wrappers that resolve to `msid=null` at any endpoint; split into
  genuinely-unlookthroughable (honest-missing, correctly flagged) vs known-ETF/fund (must now flag
  or look through). Report the count that FLIPS from "counted as resolved" to "flagged unresolved,"
  and the `lookthrough_coverage` correction per affected fund. No fund's coverage may report higher
  than the true resolved fraction.
- **P2**: the partial-coverage funds with zero surfaced shifts now carry a `positioning_changes`
  section with the coverage metadata; count how many funds gain the section; spot-check 3–5 that the
  flag + coverage are correct and `rows` is legitimately empty.
- **No regression** to the shipped acceptance: THEQ Technology ~29.7%; X-Ray coherence ≥99% within
  1pp; Check 8 served→missing recoverable=0 still holds; `change_z` cross-sectional centering
  unchanged.

## Gates (reviewed lane)
- **data-reviewer** checkpoint(s): the coverage correction is honest (spot-check flipped wrappers vs
  raw N-PORT — each is really an unlookthroughable/known-ETF, not a mislabeled real company); the new
  empty-section funds are really partial + no-surfaced (not a surfacing bug).
- **FINAL DATA GATE**: served == gold; `check_positioning_changes_panel.py` (incl. Checks 6/7/8)
  OVERALL PASS with the coverage-honesty correction applied; `/check-data`.
- **codex `--high`** sign-off (0 P0/P1).

Model/effort: opus implementer; gates stay on the session model (reviewer ≥ implementer).
