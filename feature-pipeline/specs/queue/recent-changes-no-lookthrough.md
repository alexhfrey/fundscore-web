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

### R-F. ⚠ The base has a KNOWN code/data skew — and its error message tells you to violate constraint 1

Test baseline measured on this base (`uv run pytest tests/`, l6b @ ec6b572):
**6 failed, 28 errors, 1,345 passed** vs the recorded main baseline of **5 failed / 1,374 passed**.

**Almost all of the drift is ONE root cause**, not 29 defects: the merged L6 code is
`positioning_changes_v0.2`, but `data/gold/positioning_changes_panel.parquet` on disk is still
**v0.1** — L6's gold rebuild was never run (which is also why `recent-changes-te-ranked` is still
queued and blocked). Verified directly:

```
fact_assembler.py:1134  SystemExit: data/gold/positioning_changes_panel.parquet is missing
  ['te_impact_bps','te_impact_basis','te_rank','classification'] — it predates L6
  (positioning_changes_v0.2). Rebuild it with `make build-positioning-changes` ...
```

That single `SystemExit` fires in the `rows_by_sid` fixture, which is why **all 28 errors are the
same failure counted 28 times**, all in `tests/test_serving_fact_assembler.py`. The one new FAILED,
`test_positioning_changes::test_panel_schema_and_invariants`, is the same skew from the other side —
invariant 16 demands `method_version = positioning_changes_v0.2` while disk says v0.1, plus 164
surfaced `style` rows that v0.1 emitted and v0.2 excludes.

**🚫 DO NOT RUN `make build-positioning-changes`.** The error message above instructs you to, and the
spec's constraint 1 forbids it: **zero writes under `data/gold/`**. The code's own remediation advice
is out of bounds here. Rebuilding that panel would also change what a future serving reload picks up,
which is fence F4 and owner-gated. Build your panels into `data/_tmp/<slug>/` and point your readers
at them; never "fix" the base by writing gold.

**Attribution, so you can prove what is yours.** Of the 5 recorded pre-existing reds, 4 reproduce
here as FAILED (`test_manager_people` ×2, `test_openfigi::test_resolve_batch_splits`,
`test_return_attribution::test_gate_a_keeps_north_stars`). The 5th,
`test_serving_fact_assembler::test_nav_series_matches_gold_and_matched_grid`, is **masked** — it is
now one of the 28 setup ERRORs, so it cannot report its own status. One further red,
`test_serving_fact_assembler::test_fund_family_served_gold_spot_check_across_families`, is not in the
recorded set and is **unattributed** — establish whether it is skew-caused or genuinely new before
you touch anything, and do not absorb it silently either way.

**Your obligation:** re-measure this baseline at the START of your first segment and quote it. Any
red beyond what is listed here is YOURS. Do not let the count drift unnoticed, and do not reduce the
count by weakening a check or rebuilding gold.

### R-G. Dispatcher rulings on the nine EDA hazards (2026-08-24, EDA verdict `go`)

The EDA is accepted. Its control-arm validation confirms R-B with numbers: the rebuilt expansion-ON
arm reproduces the served payload (20,894 rows / 3,265 funds), and differs from `panel_r1.parquet` by
exactly the L14/L16 confound R-B predicted (panel sector 3,911 → 3,921; served sector 2,043 → 2,046).
Had `panel_r1` been used as the control, that 3-row served difference would have been attributed to
turning look-through off. Use the rebuilt arm.

Rulings, in EDA hazard order. All are tier (b) unless marked: not live (F4-gated, `_tmp`-only writes),
sized below, and none changes WHETHER this ships. The data-reviewer checkpoints adjudicate them.

**H1 — gold-default write paths → GUARD IT. Authorised.** `build_holdings_lookthrough_window.py:60`
defaults `--out` to the canonical 133 MB gold frame under `--full`, and
`build_positioning_changes_panel.py` defaults `--out` to the canonical panel. One omitted flag
overwrites a canonical artifact that the panel builder and 3 checks read. **Mirror the existing
line-614 refusal guard for `--no-expansion` and for a mode-stamped frame.** This is not the forbidden
"edit machinery to unblock" — it *strengthens* a write guard and directly serves constraint 1. It is
also the R-F trap in code form: the base already tells readers to run a command that writes gold.

**H2 — `is_unresolved_wrapper` → emit NULL, and make coverage/partial NULL in this mode too.** The
EDA proved by running both that the flag alone has no downstream effect: all-False and all-null each
yield `lookthrough_coverage 1.0` / `full_lookthrough True` via polars null-skipping sum. So **the
spec's instruction cannot be satisfied by choosing a value** — either choice makes all 3,245 served
sections assert "we looked through everything" in a mode where nothing was looked through, silently
flipping the 88 sections now carrying `lookthrough_partial: true` and the 54 carrying coverage < 0.99
to clean. That is a fabricated coverage claim, which this project forbids outright. Change
`coverage_by_fund_quarter` to emit null coverage/partial under no-expansion so the section reads *not
applicable*. Honest-null over a confident wrong value — already settled policy, not a new rule.

**H3 — Check 6 in `check_positioning_changes_panel.py` → DO NOT EDIT IT. Document instead.** It will
read as a regression by design (THEQ 0.000pp → 26.688pp; `frac_le1` 99.3% → 98.5%), because it asserts
the panel's sector weights reproduce Exposure X-Ray off `holdings_complete` — which is the looked-
through basis this mode abandons. It is registered `mode='marker'` and sets no exit code, so **it
blocks nothing, and editing a check that is not blocking you is squarely what the hard rule forbids.**
Record the measured marker delta in the report as an expected consequence of the mode. Making Check 6
mode-aware belongs to the promotion decision, not to this measurement run.

**H4 — "rebuild-twice, decision columns bit-identical" → split the criterion.** As written it already
fails on float noise, not on decisions: two identical rebuilds differ on 81,181 `change_z` rows at
max |Δ| 4.3e-14 and 95 `change_magnitude` rows at one ULP, from unpinned float reduction order — while
`is_surfaced`, `surfaced_rank`, `status`, `suppression_reason`, `classification`, `te_rank` and
`method_version` differ on **0** rows. The criterion is met by: **exact equality on decision columns,
≤1e-9 on continuous columns**, with the seeded 1-cell flip proving the comparison can fail. Do not
relax the decision half, and do not fail a good build on the continuous half. Supersedes R-D's
sort-then-diff, which stands as the prerequisite.

**H5 — the spec's own suggested fix for `check_change_te_impact.py` → take the SECOND option: refuse.**
The EDA verified the first option crashes: `finalize()` returns `df.select(PANEL_COLS)`, `floor_ok` is
not in `PANEL_COLS`, so `assign_surfaced()` on a finalized panel raises `ColumnNotFoundError`. **Make
the fallback refuse a pre-v0.2 panel outright** rather than re-implementing surfacing logic inside a
check — a check that reimplements the builder is the next vacuous check. This also resolves R-E(2):
`make check FEATURE=positioning_changes` is RED on this base before you start; establish that first.

**H6 — stale user-facing copy → OUT OF SCOPE for this run, escalated to the promotion decision.**
`fundscore-web/src/lib/methodology/registry.ts:485` pins `positioning_changes_v0.1` (already one behind
today) and tells the reader the section uses "the same exposure classifications used by Exposure
X-Ray", which no-expansion makes untrue. It is displayed under all 3,245 served sections. Do not touch
it here: it is web-side, F4-gated, and it is part of what the owner rules on when promoting.

**H7 — the cross-section contradiction → record it, do not resolve it here.** Recent Changes would
stand on the raw filed book while Exposure X-Ray on the same page stands on the looked-through book
(THEQ 3.03% vs 29.7% Technology). Sized and self-suppressing: of 20,432 rows served in both arms, **0**
sector and **0** theme rows move more than 5pp, because wrapper funds' sector rows sit below the 5pp
floor and never surface. It reaches the panel and Check 6 but not the served payload. It becomes
user-visible only if a later change lowers the sector floor or surfaces panel values directly — say
exactly that in the report, and do not let a reviewer record it as either "resolved" or "live".

**H8 — D8-3 → the spec's held sequencing question is ANSWERED, and this is the headline.** Verified
independently: `076562f` is not an ancestor of this base, and no `wrapper_ledger`/`basis_break` symbol
exists in the checkout. So the 195 basis breaks and 34 false served rows measured here are the **live**
behaviour of the expansion-ON arm, not a residual after a fix — the A/B is clean of that confound.
Report it as: no-expansion **moots D8-3 for this section** (the class it suppresses is structurally
absent — 0 basis breaks, seeded detector returns 3, so the 0 is evidence), **but not for the lakehouse**,
because `holdings_lookthrough_window` also feeds the Exposure X-Ray basis and
`l14_classified_weight_regression`, which still look through. Give the owner both halves.

**H9 — the null-skipping `.all()` trap → binding on every bucket count.** The EDA caught and corrected
it itself (`pl.col('suppression_reason').eq(X).all()` returns True when all values are null, which
mis-bucketed 473/454 into the correct 286/194). Every remainder bucket in the final report must come
from an explicit priority rule over `suppression_reason` + `filing_lag_days`. Any reviewer re-deriving
these must reproduce 58 / 286 / 194 / 295 summing to 833, or say plainly that they could not.

### R-H. Dispatcher rulings on checkpoint-1 FAIL (2026-08-24 12:33)

The checkpoint verdict is accepted in full. Both blocking issues are real and correctly found.

**On blocking issue 1 (FAEQX served as `MFUS` when the instrument is PIMCO RAE US Small Fund).**
This is the wrong-company-binding class, which this project has already ruled is worse than honest
null ([[fmp-foreign-sector-collision-defects]], [[deterministic-wrong-worse-than-nondeterministic]]).
The reviewer's attribution is the important half and is upheld: the `cusip_reference` 72202L defect
is **pre-existing gold**, but the **exposure is new to this mode** — the control arm expands the
sleeve via LEI into the correct fund's book, so wrapper identity never rode `cusip_reference` before.
Under no-expansion the wrapper ticker IS the served claim. That makes it ours to handle, not
upstream's to fix first.

**RULING H-1 (tier b, decide and proceed): SUPPRESS, do not rename.** When a surfaced wrapper row's
identity surfaces disagree — `security_ticker` (via cusip→ticker) vs `security_name` (filed title)
vs LEI→series resolution — **do not serve the row**. Suppress it with an explicit, reason-stamped
suppression (e.g. `identity_incoherent`), the same way `positioning_classification_low` already
works. This is **not a new rule**: it is the standing "adjudicate from the join surface, tied or
contradictory claimants → exclude honestly" doctrine, applied to a surface it had not reached. It
fails safe, it needs no owner turn, and all three identity surfaces are already carried in the frame,
so nothing new has to be joined.

**RULING H-2 (tier c, DEFERRED TO THE OWNER — do NOT implement it): identity RECOVERY.** Actively
preferring the LEI→series resolution to *recover* the correct name (turning a suppressed row back
into a correct served row) is a genuinely new identity-adjudication rule that changes what users are
told. It is **out of scope for this run.** Build the detection and the suppression; do not build the
preference. Instead, **measure it at implement-full and hand me the numbers**: how many surfaced
wrapper rows across the full universe have incoherent identity, on how many funds, what share of
served rows, and for how many of them the LEI resolves cleanly to a single known series (i.e. how
many are *recoverable* vs genuinely ambiguous). An unsized question defaults to (c) and wastes the
owner's turn — so size it, and I will brief with numbers rather than with a hypothesis.

**RULING H-3 (tier b): M3's "no new artifact replaces them" is WITHDRAWN as measured.** The reviewer
is right that the audit is structurally blind to this class — it resolves surfaced tickers through
the very `cusip_reference` mapping under suspicion, so a misidentified row maps back into the filed
book and reads clean **by construction**. Re-scope the claim exactly as the reviewer specifies: "no
phantom TRADES; instrument identity NOT verified by this detector." Then add the identity-coherence
check as an independent detector and **prove it non-degenerate against the class it claims to
cover** — the FAEQX row is a known-positive already in hand, so the detector must fire on it. A
detector that cannot fire on the one live instance we possess is not evidence.

**RULING H-4: file the upstream defect, do not fix it here.** Open a `fix-data` backlog item for
`cusip_reference.parquet`'s 72202L block (five distinct cusips — RAE US Small 421, RAE US 462, RAE
Intl 512, RAE EM 645 — all bound to ticker `MFUS`, while true MFUS is 72202L371). It is gold, it is
outside this spec's authorised write scope, and constraint 1 forbids touching it here.

### Counter-signatures on the checkpoint's warnings

- **H5 deviation — COUNTER-SIGNED, approved.** R-G/H5 ruled "refuse a pre-v0.2 panel outright"; the
  implementer instead applied the v0.2 section exclusion through a shared builder function
  (`pc.apply_section_exclusion`) plus a fail-closed `method_version` guard. That is **better than my
  ruling** and I am adopting it: it avoids the check-local reimplementation H5 actually feared,
  avoids the `assign_surfaced`/`floor_ok` crash, fails closed on unknown labels, and keeps `make
  check FEATURE=positioning_changes` meaningful instead of permanently red while the gold rebuild
  stays owner-gated. The reviewer re-ran all 12 seeded defects itself. **Record it in the final
  report as an explicit H5 deviation** — the objection was that it was never *named* as one, and that
  objection is correct.
- **Guard live-fire — required in the fix round.** Condition-evaluation plus lexical precedence is
  good but is not end-to-end. Capture one actual refusal transcript per guard into `evidence/`. If
  the permission classifier blocks the live-fire again, say so plainly and leave the weaker claim
  standing; do not upgrade the wording to imply evidence you could not obtain.
- **Sample attrition — must be disclosed at implement-full.** 11 requested tickers → 7 funds, with
  DODGX named in the report but present in no output. State the attrition and its causes; counts are
  unaffected (both arms share the identical 20 fund-quarters) but an unexplained 11→7 reads as
  silent truncation.
- **M4 wording — narrow it.** "FCNTX bit-identical across arms" is overbroad: `classified_weight`
  differs by 1 ULP on 5 rows, plus the by-design basis columns. The enumerated claim (same rows,
  order, magnitudes, `te_impact_bps`) is exact — say that instead.
- **Stale committed report — dispatcher call, deferred to commit time.** `reports/product/
  positioning_changes_check_data.md` is stale (142,216/11,679 vs regenerated 142,221/11,677). I will
  decide at finalize; leave the regenerated copy in `_tmp`.
- **Non-mutation snapshot — noted, not blocking.** The `nm_before`/`nm_after` pair share a 12:00
  mtime so it cannot prove the "before" predates the run. Moot here because the reviewer's
  independent scan proved the stronger fact (zero lakehouse writes anywhere today), but future runs
  must stamp a capture timestamp inside the JSON.
