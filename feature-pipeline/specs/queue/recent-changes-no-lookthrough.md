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
priority: 2
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

---

## ADDENDUM — dispatcher rulings (2026-08-24)

All four rulings below FAIL the materiality test and are therefore the line's call, not the owner's:
(1) nothing here is live to users — spec constraint 1 confines every write to `data/_tmp/<slug>/`, and
serving is F4-gated regardless; (2) they are sized in the numbers below; (3) every option still ships —
they change HOW this is measured, never WHETHER it ships. They are tier (b): recorded explicitly here,
and the data-reviewer checkpoint after each segment reviews the calls themselves.

### R-A. Base branch: `l6b/recent-changes-no-lookthrough` = main + L6 (NOT either alone)

Work in the worktree `/Users/alexfrey/Projects/fund_score-wt-l6b` (branch
`l6b/recent-changes-no-lookthrough`), NOT in the main checkout and NOT in `fund_score-wt-l6`.
`data/` is symlinked to the shared lakehouse there; use `uv run python`.

Neither branch alone can carry this spec:

| base | what it has | what it is missing |
|---|---|---|
| `main` @ 60eb7c9 | L14 seg 6 (`8590fc5`, sector US-consensus write) + L16 (`781d638`) | still `positioning_changes_v0.1` — no TE ranking, no style-row exclusion, **no `scripts/checks/check_change_te_impact.py` at all**, which this spec devotes a section to fixing |
| `feat/l6-...` @ 6fca29f | `positioning_changes_v0.2` | forked at `75980a3` (2026-08-17); **LACKS L14 seg 6 and L16** |

This is material because `holdings_lookthrough_window.parquet` **has no `sector` column** (verified:
14 cols, no `sector`) — sector is attached at READ time by the code path L14/L16 changed. Building on
an L6-only base would attach pre-consensus sector labels to the very rows measurement #2 counts.
Confirming evidence: the merged panel builder carries `--sector-basis {consensus,pre}` (L14's flag,
default `consensus`) — on an L6-only base that flag does not exist.

The merge is committed and was clean on **all code**; the single conflict was
`reports/product/positioning_changes_check_data.md`, resolved to the L6 side after proving both sides
carry the identical 6-fund set (parsed the ids; seeded-difference self-test returns False, so the
check is non-degenerate).

### R-B. The A/B control MUST be rebuilt on this base — do NOT use `data/_tmp/l6/panel_r1.parquet` as the control

The spec body says to compare against `panel_r1.parquet`. **That is now an invalid control**, for the
same reason the spec's own "⚠ A comparison that is INVALID" section gives: `panel_r1` was built on the
L6-only base, so a no-expansion panel built on THIS base differs from it by **two** changes at once —
the expansion switch (the thing under test) and the L14/L16 sector-consensus relabel (a confound).

Required instead: build **both arms on this same base at the same pinned eval date and the same
`--sector-basis consensus`** — expansion-ON as the control, expansion-OFF as the treatment. `panel_r1`
may still be quoted as a provenance reference for the R1 lineage, never as the control arm. State for
every number which two artifacts it compares, as the spec already requires.

### R-C. Grounding verified — the spec's quoted figures reproduce exactly

Re-derived from `data/_tmp/l6/serving_facts_staging_r1.parquet` → `positioning_changes.rows`
(the SERVED payload — not the panel's surfaced rows, which are 58,933 on v0.2 / 11,677 on v0.1):

| figure | spec | re-derived | |
|---|---|---|---|
| served rows | 20,894 | **20,894** | ✓ |
| theme | 2,671 | **2,671** (1,359 funds) | ✓ |
| sector | 2,043 | **2,043** (1,293 funds) | ✓ |
| sector+theme share | ~22.6% | **22.6%** | ✓ |
| funds with a section | — | **3,265** | — |

Also `position` 15,309 (2,955 funds), `concentration` 639, `cash` 232. Use these as the denominators
for measurement #2; they are confirmed current, so a re-derivation that disagrees is a finding, not a
correction to be quietly absorbed.

### R-D. The "rebuild-twice, bit-identical" acceptance check must sort before diffing

The merge conflict above was caused by **unstable ordering in the generated check-data report** —
identical content, different order, in both hunks. The acceptance criterion "rebuild-twice, decision
columns bit-identical" will therefore false-fail on ordering noise. Sort on a stable key before
diffing — and per [[rebuild-twice-proves-determinism]], never dismiss a diff as "probably row order"
without proving set-equality, because that same dismissal previously hid a real non-determinism bug
(`l2_blend_etfs`, 117 funds, genuinely differing ETF sets).

### Unchanged and still binding
The advisory in `scripts/checks/check_change_te_impact.py` is **live, not already fixed**: the merged
code fails explicitly on PARTIAL TE columns (good), but the `if not had:` fallback still attaches TE
and re-orders **without** re-running the v0.2 surfacing rule that excludes `style` rows. Fix it as the
spec directs. All other spec references verified present on this base: `pick_endpoints` (in BOTH
`build_holdings_lookthrough_window.py:73` and `build_positioning_changes_panel.py:105` — the two-jobs
trap is real), `--lookthrough-frame` (:603), `exposure_xray.sector_weights` (:237) / `theme_members`
(:264). `--no-expansion` does not yet exist and is yours to add.

### R-E. Three P2 advisories from the codex gate on the base merge — carried to you

The base merge (`ec6b572`) passed its codex gate high-tier with **0 blockers, 6 advisories (3 distinct
P2s)**. None blocked the merge; all three are in the same family as the advisory this spec already
carries, so fix them here rather than re-filing them:

1. **`scripts/pipeline/build_change_te_impact_sample.py:108-110`** calls `validate()` straight after
   `attach_te_impact()` without `apply_te_ordering()`. The production builder and the check fallback
   both order before validating, so **the advertised sample command exits `GATE FAILURE`** whenever a
   sampled fund's old `surfaced_rank` disagrees with TE impact.
2. **`scripts/checks/run_checks.py:109-114`** registers `change_te_impact` as a **gating default**
   while the canonical panel is still v0.1 — so `make check FEATURE=positioning_changes` is **red on
   this base** until the gold panel is rebuilt. This is the same defect the spec's "Also fix" section
   describes, seen from the registration side rather than the fallback side; fix both together and
   make the check either non-default or explicitly targeted at the rebuilt panel.
3. **`src/fundscore/serving/fact_assembler.py:1143-1144`** silently **drops** surfaced rows whose
   `classification` is null instead of failing closed, serving a truncated Recent Changes section.
   Serving can run independently of the builder's G7, so this is a genuine fail-open at the serving
   boundary — the exact class this project keeps getting bitten by. Detect surfaced null/out-of-enum
   classifications and abort rather than filter.

Note for your own gates: because of (2), a red `make check FEATURE=positioning_changes` on this base
is **pre-existing, not yours**. Establish that it is red BEFORE you start, so you can prove what you
changed. Do not "fix" it by weakening the check.
