---
id: recent-changes-no-lookthrough
title: Stop looking through ETFs in Recent Changes — no-expansion window mode, then measure what it costs
status: queued
track: backend
repo: fund_score
depends_on:
source_proposal: owner ruling 2026-08-21 (design challenge to recent-changes-te-ranked)
created: 2026-08-21
scope: global
priority: 1
model: opus
effort: high
lane: reviewed
---

## Owner summary
The "what has the manager been doing lately" section currently opens up any ETF a fund holds and
reports the underlying share movements instead of the ETF trade itself. The owner's view is that
this is unnecessary complexity for this section — showing "bought the semiconductor ETF" is a
truer description of what the manager did — and it is the source of every fabricated trade we have
been chasing. This spec turns the expansion off and measures honestly what that costs, so the
owner can confirm the simplification rather than take it on faith.

## The two owner rulings this implements (2026-08-21)
1. **Kill the cross-manager filter.** Already retired in the v0.2 code as `R1`; the ruling confirms
   it. Nothing to build — it is recorded here so the intent is not re-litigated. The ranking stays
   `te_impact_bps = |Δ decimal weight| × annualised σ`, which the owner independently derived.
2. **Build a no-expansion mode** so the section is computed on the fund's own filed holdings, with
   ETFs left as single positions.

## ⚠ The trap this spec exists to prevent
**`holdings_lookthrough_window` does TWO jobs and its name advertises one.** Besides expanding
wrappers it **selects the fund's comparison endpoints** — the trailing-year "now" and "a year ago"
quarters, within a ±45-day tolerance, such that `pick_endpoints` in the panel builder reconstructs
them identically.

This was verified, not assumed. Pointing the existing `--lookthrough-frame` flag at
`data/gold/holdings_complete.parquet` **does not work**, even though the column contract is fully
satisfied (all 8 columns the frame path reads are present). Trial build on FCNTX:

| source | result |
|---|---|
| `holdings_lookthrough_window` (current) | 41 rows, **10 surfaced**, types `{theme 4, position 3, concentration 2, sector 1}` |
| `holdings_complete` (raw filed book) | **crash** — preceded by `endpoints: 0 with prior, 1 missing prior` |

The filed book carries whatever quarters were filed, not windowed endpoints. **So this is a mode on
the window builder, not a source swap.** Do not attempt the swap; it is already disproven.

## What to build
Add a no-expansion mode to `scripts/pipeline/build_holdings_lookthrough_window.py` (math in
`src/fundscore/product/lookthrough_window.py`). It must:

- Keep **everything except the expansion**: the universe selection, endpoint-quarter selection,
  multi-quarter pull, per-fund-quarter weight renormalisation, and the `pct_nav` grain.
- Skip the master closure / as-of look-through step, so a held ETF stays one row keyed on its own
  identifier rather than being replaced by its constituents.
- Emit the same schema. `is_unresolved_wrapper` becomes meaningless in this mode — decide
  explicitly whether to emit it as all-False or null, and say which in the report. Do not leave a
  column whose meaning silently changed.
- Be selected by an explicit flag (suggest `--no-expansion`), and **stamp the mode into the output**
  so a consumer can never mistake one frame for the other. The panel builder's `METHOD_VERSION`
  must move too — the basis of `is_surfaced`/`surfaced_rank` changes, and v0.2 already set the
  precedent that a basis change forces a label change.

## Also fix while you are in this check (carried codex advisory, L6 `6fca29f`)
`scripts/checks/check_change_te_impact.py:121-127` — when the canonical panel predates v0.2 and
lacks the TE columns, the in-memory fallback attaches TE fields and reorders ranks but **does not
re-run the v0.2 surfacing rule that excludes `style` rows.** Those old surfaced style rows keep
`classification = null`, so the new G7 baseline fails and the check exits 1 — while still
presenting itself as having validated the code. **Either apply v0.2 surfacing in the fallback, or
fail explicitly on a pre-v0.2 panel.** Do not leave a check that claims to validate what it cannot;
that is the vacuous-check class in constraint 5, and this one was found by the gate rather than by
us.

## What to measure — this is the deliverable, not the code
The code change is small. **The measurement is the point**, because it is what the owner rules on.

Build the no-expansion frame over the full active-EQ universe at the **same eval date** as the
current gold frame, rebuild the positioning panel on it, and compare against the R1 panel L6
already produced (`data/_tmp/l6/panel_r1.parquet`).

Report, each with the number:
1. **Coverage delta.** Funds gaining a section, funds losing one, and net. Split losses by cause —
   no valid prior endpoint vs no surviving change above the floors.
2. **Do sector and theme rows survive?** They are ~22.6% of served rows (`theme 2,671`,
   `sector 2,043` of 20,894). They are built via `exposure_xray.sector_weights / theme_members`
   from whatever frame is passed in, so they should work — but a fund that expressed a sector bet
   through an ETF will lose that row. **Quantify how many sector/theme rows disappear and for how
   many funds**, and spot-check three against the raw filing.
3. **Does the phantom-trade class actually vanish?** It should: the 10 false "entered" rows and 97
   phantom "exited" rows all originate in failed expansion. **Verify they are gone rather than
   assuming**, and confirm no new artifact replaces them.
4. **Per-fund churn on the specimen set.** FCNTX must still surface its real story (META −6.01pp,
   BRK.A −6.21pp, and the rest of the eight). Also check a known ETF-holding fund so the change is
   visible in both directions.

## ⚠ A comparison that is INVALID — do not reproduce the dispatcher's error
Comparing the fund set of `holdings_lookthrough_window` against `holdings_complete` **is
meaningless**, because the first is windowed and the second is not. The unwindowed book contains
funds with no valid prior endpoint, which cannot get a section under either design. The dispatcher
nearly reported "gains 1,626 funds, loses 212" from exactly this comparison and retracted it before
sending; the same confound weakens an earlier "look-through adds nothing for 97.6% of funds"
figure. **Every coverage comparison in this work must be windowed-vs-windowed.** State in the
report which two artifacts each number compares.

## Standing constraints
1. Writes confined to `data/_tmp/<slug>/`. **Zero** writes under
   `data/{gold,product,silver,bronze,reference,staging,vendors}` without explicit authorisation.
2. Non-mutation proof: `os.walk(followlinks=True)` with a canary written immediately before the
   walk, **plus a seeded-violation self-test**. A CLEAN that cannot go DIRTY proves nothing.
3. Any new rule / threshold / band / allowlist → **STOP and brief**.
4. Never synthesize, impute or default-fill. Coverage up front, honest-missing vs recoverable-missing
   split, spot-checked at the misses.
5. **A check that returns 0 must be shown capable of returning non-zero before its 0 is quoted.**
   Five vacuous checks were caught in the preceding week, one of them inside a spec's own acceptance
   criteria.
6. **A class boundary must be tested against every axis the downstream action branches on.**
7. **A sweep that reports "clean" is itself a check** — vary the pattern or seed a known instance
   before quoting it.

## Sequencing consequence the owner is holding
**This may moot the pending D8-3 merge decision entirely.** The phantom trades, the blunt
fund-level suppression, and the 73.8% recoverable-missing question all exist to manage a
look-through that this section barely uses. If the measurement comes back clean, that whole owner
decision disappears for this section. **The merge decision is HELD pending this work — do not
assume it either way, and report the consequence explicitly.**

## Acceptance
- No-expansion mode builds over the full universe at the pinned eval date, deterministically
  (rebuild-twice, decision columns bit-identical).
- The four measurements above are reported with numbers, each naming the two artifacts compared.
- Every coverage comparison is windowed-vs-windowed, stated as such.
- Phantom-trade class verified gone, not assumed.
- Non-mutation CLEAN with its seeded self-test green.
- Nothing committed by the implementer; the dispatcher owns the commit and the codex gate.
- Stops for a `data-reviewer` checkpoint before any canonical write.
