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

### R-I. Counter-signature after the round-2 FAIL (2026-08-24) — and H-2 is ANSWERED

**First, the sequencing error is mine, and it is on the record.** R-H was committed at 13:15:35;
the revision round's final snapshot is 13:15:59. The implementer had 24 seconds and did not see
H-1. The reviewer judged the segment against the spec as it stands — correct — but the cause was a
dispatcher writing a ruling into a round already closing, not a worker ignoring one. **Rulings land
between rounds, never into a live one.**

**H-2 IS ANSWERED — no owner brief, and the answer is NO.** I deferred "prefer the LEI-resolved
identity to recover the correct name" to the owner and asked for full-universe sizing before
briefing. The sizing arrived in the same round and **disproves the rule**:

| | |
|---|---|
| surfaced position rows (full universe) | 49,231 |
| → wrapper-naming rows | 465 |
| → COHERENT / DISAGREEMENT / NOT_ASSESSABLE | 405 / **12** / 48 |
| → actually serving a wrong name | **1** (FAEQX `MFUS`) |
| of the 12 contested, LEI-recovery would **corrupt a correct name** | **11** |

The 11 were traced individually, not assumed: `549300X7CW3B8850WA94` → iShares MSCI Australia (would
corrupt IEMG/ESGE), `SMW62R66J4CAWU1R4S26` → VFISX (would corrupt VGSH), the `549300G3FWQPUM47D181`
"Old Name" LEI across the IWM/IWO/IWD/IWF/SCZ/USMV/KSA/IVV block, `TN5Y392EHJ8T3X0XI337` → pre-reorg
Pioneer (STRKX). **Prefer-LEI is rejected on evidence, not deferred.** Record it in the promotion
brief as a closed question with these numbers. This is what sizing-before-classifying is for: the
measurement dissolved the owner question instead of spending an owner turn on it.

**COUNTER-SIGNATURE ON H-1's COST — requested by the reviewer, and it is UPHELD.** Suppressing on
DISAGREEMENT removes **12 surfaced rows, of which 11 are adjudicated SERVED_NAME_OK.** So H-1 costs
11 correct rows to remove 1 wrong one, across 12 funds, at **0.024% of surfaced position rows**. I
ruled H-1 believing disagreement ≈ wrong; it does not. Re-ruling with the true trade in hand:

**H-1 STANDS.** There is no rule-free alternative that never serves a wrong company: prefer-LEI is
disproven above, and hand-adjudication does not scale past this sample. Honest exclusion at 0.024%
is the doctrine's own price, the loss is a *missing* row rather than a *wrong* one, and the upstream
`cusip_reference` fix filed under H-4 progressively empties the class. I am not trading a
wrong-company display for 11 rows of recall.

**BOUNDARY (standing constraint 6) — state it explicitly in code AND report.** H-1 fires on
**DISAGREEMENT only**:
- **NOT_ASSESSABLE (48 surfaced rows) is NOT in the suppressed class** and stays served — these are
  dominated by QQQ/SPY UITs absent from the SEC class file whose filed titles visibly match the
  served ticker. Absence of a cross-reference is not evidence of contradiction.
- The **24 fan-in>1 rows** T1 cannot flag stay **reported-as-unknown**, as the implementer already
  has them.
Do not silently widen or narrow this. A reader must be able to see which of the three buckets each
row landed in and why.

**What the H-1 round must deliver.** (1) The suppression itself, reason-stamped
(`identity_incoherent`), following the `positioning_classification_low` pattern — the detection half
already exists, is non-degenerate in both directions, and fires on the FAEQX known-positive as H-3
demanded. (2) **Re-cut every A/B number**: the reviewer is right that all current figures are
pre-H-1. The sample headline "M1 gained {FAEQX}, net +1" becomes "gained {}, net 0", because that
row is FAEQX's only surfaced row; full-universe M1/M2 move by the 12. (3) The two guard live-fire
refusal transcripts into `evidence/` — or a plain statement that the permission classifier blocked
them again, leaving the weaker condition-evaluation claim standing rather than dressed up.

**Carried forward, unchanged:** sample attrition disclosure (11 tickers → 7 funds, DODGX named but
absent); the KSA row with `fund_ticker=null`; the stale committed
`reports/product/positioning_changes_check_data.md` (my call at finalize); M4's wording narrowed;
the H5 deviation named explicitly in the final report.

---

## ⛔ STOPPED BY OWNER — 2026-08-24. Spec stays in `queue/`; do NOT treat as done.

**Owner instruction:** *"Let's stop after this round, we're spending too much here on a small item."*
The spec is deliberately NOT moved to `specs/done/`. Read this block before resuming anything.

### What is FINISHED and proven

| | |
|---|---|
| `--no-expansion` mode on the window builder | built; mode stamped into the frame; the panel builder DERIVES the basis from the frame's own stamp, never from a CLI claim; unknown/mixed/null stamp fails closed |
| `METHOD_VERSION` split | control `positioning_changes_v0.2` · treatment `positioning_changes_v0.3_no_expansion`, closed enum |
| Two canonical-write guards | `build_holdings_lookthrough_window.py:137`, `build_positioning_changes_panel.py:738` — conditions verified True on canonical targets / False on `_tmp`, and each lexically precedes every write |
| H2 (coverage honesty) | `lookthrough_coverage` / `lookthrough_partial` NULL on any non-look-through basis instead of a fabricated `1.0 / False` |
| The three base-merge P2 advisories | fixed (`build_change_te_impact_sample` ordering, `run_checks` default, `fact_assembler` fail-open) |
| H-1 identity suppression | **built and smoke-proven** — see below |

**H-1 smoke test (2026-08-24 14:01, sample arm, 8 funds):** 1,651 (fund,instrument) keys assessed,
19 name a wrapper line → coherent 18 / disagreement 1 / not_assessable 0. The contested key is
stamped `identity_incoherent`, `status=missing`, `is_surfaced=false`; invariant 19 PASSes with 0
violating rows. **The FAEQX `MFUS` wrong-company row flips `is_surfaced` true → false** and surfaced
totals move 60 rows/6 funds → **59 rows/5 funds**, exactly the predicted M1 change ("gained {FAEQX},
net +1" → "gained {}, net 0"). The constraint-6 boundary is encoded as
`IDENTITY_SUPPRESSING = (IDENTITY_DISAGREEMENT,)` with NOT_ASSESSABLE explicitly excluded in code.

### The measurement — usable NOW, and it answers the held D8-3 question
From the EDA + round-1/2 evidence, all windowed-vs-windowed on one base (see R-B):
- **Phantom-trade class ELIMINATED**: 195 expansion-state basis breaks across 103 funds → **0**
  (seeded detector returns 3, so the 0 is evidence). At the served layer, 34 false rows (27 false
  "entered", 7 false "exited") → 7 honest ones. Traced to raw N-PORT: GBXC's wrapper LEI changes
  between filings, serving "entered SPYM +99.94pp" plus 8 phantom "exited" rows.
- **Coverage cost**: −20 funds net (29 lost / 9 gained), −0.49pp; 0 funds lost to endpoint loss.
- **Sector/theme**: served sector 2,046 → 2,027, theme 2,671 → 2,603.
- **FCNTX unchanged** (META −6.01, BRK.A −6.21 identical across arms).
- **D8-3**: no-expansion moots it **for this section**, NOT for the lakehouse —
  `holdings_lookthrough_window` still feeds the Exposure X-Ray basis and
  `l14_classified_weight_regression`.
- **H-2 (prefer-LEI recovery) REJECTED on evidence**: full universe 49,231 surfaced position rows →
  465 wrapper-naming → 405/12/48 → **1** actually wrong; LEI-recovery would **corrupt 11 correct
  names**. Closed question, not an open owner decision.

### What is NOT done — the exact resume point
1. **A/B numbers are still PRE-H-1 headlines.** The sample is re-cut (above); the FULL-universe
   panels are not. Full M1/M2 move by the 12 suppressed rows.
2. **No data-reviewer pass on the H-1 round.** Rounds 1–2 were reviewed; this one was not.
3. **Guard live-fire refusal transcripts** never captured into `evidence/` (the condition-evaluation
   claim stands; the end-to-end one does not).
4. **Post-round test baseline not re-measured.** The pre-round run was still in flight when the
   implementer died. Recorded base: 6 failed / 28 errors / 1,345 passed, ONE root cause (v0.2 code
   vs v0.1 gold panel). Re-measure and diff BY TEST ID before trusting anything.
5. Carried: sample attrition (11 tickers → 7 funds, DODGX named but absent) · the KSA row with
   `fund_ticker=null` · the stale committed `reports/product/positioning_changes_check_data.md`
   (regenerated copy lives in `_tmp`) · M4 wording to be narrowed · **the H5 deviation must be named
   explicitly in any final report** (dispatcher adopted the implementer's better approach over R-G).

### Ground truth for whoever resumes
Worktree `/Users/alexfrey/Projects/fund_score-wt-l6b`, branch `l6b/recent-changes-no-lookthrough`
(base merge `ec6b572` = main + L6). `data/` symlinks the shared lakehouse. **Zero writes ever landed
outside `data/_tmp/recent-changes-no-lookthrough/`** — gold frame mtime is still 2026-08-09 and the
gold panel 2026-08-21. Fences held: F2 one lakehouse worktree, F3 web main untouched, F4 no reload.
`feature-pipeline/reviews/` on the branch carries the codex verdicts.

---

## ✅ OWNER DECISION 2026-08-24 — SWITCH TO NO-LOOK-THROUGH. Un-parked.

**Owner ruling: "Yes switch it."** No-expansion becomes the design for Recent Changes. The `⛔ STOPPED
BY OWNER` block above is superseded; the spec is live again. Decided on the measurement as it stood:
phantom-trade class eliminated (195 basis breaks → 0), coverage cost −20 funds (−0.49pp), FCNTX
unchanged, D8-3 mooted for this section but not for the lakehouse.

### What this ruling DOES and does NOT authorise

**Authorised:** finishing the verification (below), on the same `_tmp`-only footing as before.

**NOT authorised by this ruling — still separately owner-gated, do not do them:**
1. **The canonical gold rebuild.** `positioning_changes_panel.parquet` on the no-expansion basis is a
   canonical write. Standing constraint 1 still binds, and the guard built in this very spec
   (`build_positioning_changes_panel.py:738`) actively refuses it. **Leave that guard in place.** It
   is the safety net while we finish verifying; making it basis-aware is part of the promotion step,
   not this one. A design decision is not a write authorisation.
2. **The serving reload (F4)**, which still carries its three recorded preconditions — stale
   downstream panels incl. 5 funds crossing the sector-tilt floor · the 1,194-fund leaderboard
   reshuffle · the dedup in the parity check that can pass falsely.
3. **Merging L6 + this branch into `fund_score` main.** The owner merges (F2/F3 pattern).

### Sequencing note that matters for the reader-facing copy

`fundscore-web/src/lib/methodology/registry.ts:485` pins `positioning_changes_v0.1` and tells the
reader the section uses "the same exposure classifications used by Exposure X-Ray". Under
no-expansion that sentence becomes false. **It must flip WITH the serving reload, not before** —
landing it early would describe a basis the served data does not yet have. Prepare it; ship it in the
promotion step.

### The finishing round — bounded, and deliberately NOT the full shipping stack

Per the retro ([[lane-must-match-deliverable]]): EDA and the sample round are done and do not repeat.
The remaining work is one implementer round + one data-reviewer pass + codex. Scope:
1. **Full-universe re-cut with H-1 applied**, both arms, one base, pinned eval date,
   `--sector-basis consensus`. The full no-expansion frame already exists from EDA (2,600,937 rows /
   5,062 series) — do not rebuild it if it is still valid; verify and reuse.
2. **Restate M1–M4 post-suppression**, each naming the two artifacts compared, windowed-vs-windowed.
   Current headlines are pre-H-1 and will move by the 12 suppressed rows.
3. **Guard live-fire refusal transcripts** into `evidence/` — or a plain statement that the
   permission classifier blocked them, leaving the weaker claim standing.
4. **Test baseline before/after, diffed by test id** against 6 failed / 28 errors / 1,345 passed.

---

## 🟢 OWNER AUTHORISATION 2026-08-24 — all three gates opened

**Owner: "I want you explicitly to do all 3 things that you say are gated on me. Let's efficiently
bring this home."** This authorises (1) the canonical gold rebuild, (2) the F4 serving reload, and
(3) merging L6 + this branch into `fund_score` main. Recorded here because a canonical write and a
serving reload need their authorisation on the record, not in a chat scrollback.

### ⚠ ARCHITECTURE CALL (tier b, dispatcher): the gold FRAME stays EXPANDED. Only the PANEL switches.

Do **not** overwrite `data/gold/holdings_lookthrough_window.parquet` with a no-expansion frame. It is
not the positioning section's private input — it is read by **7 modules**, including
`sector_attach.py`, `l14_classified_weight_regression.py`, `check_positioning_changes_panel.py` and
the Exposure X-Ray basis (EDA hazard H8). Replacing it would silently move X-Ray and the L14
regression onto a basis nobody agreed to, which is the "repointing a source couples everything that
rode that join" failure ([[join-through-aux-frame-couples-coverage]]).

**Promotion shape instead:**
- `data/gold/holdings_lookthrough_window.parquet` — UNCHANGED, still expanded, still X-Ray's basis.
- `data/gold/holdings_lookthrough_window_no_expansion.parquet` — NEW sibling artifact, mode-stamped
  (convention already exists in gold: `positioning_changes_panel_directbook_baseline.parquet`).
- `data/gold/positioning_changes_panel.parquet` — rebuilt FROM the new sibling. This is the switch.
- The canonical-panel guard **inverts rather than disappears**: after promotion the canonical panel
  must come FROM the no_expansion frame and must refuse an `expanded` one. The guard is not deleted
  — a guard that only ever refused is replaced by a guard that enforces the new truth.

### F4's three recorded preconditions — how each is handled, not waived
1. **Stale downstream panels (incl. 5 funds crossing the sector-tilt floor)** — rebuild the affected
   downstream panels BEFORE the reload rather than reloading over staleness. This is the actual fix.
2. **1,194-fund leaderboard reshuffle** — an expected consequence, not a defect. Report the realised
   number after the rebuild; do not present a reshuffle as a regression.
3. **The parity-check dedup that can pass falsely** — known latent (already filed in the backlog).
   It may return a false clean, so **it does not count as evidence**; verify the reload with a
   row-level served==gold comparison instead of leaning on that check.

### Order of operations
1. Finish the in-flight verification round + one data-reviewer pass. **No gold write on unverified
   numbers.**
2. Invert the guard; build the no-expansion gold sibling; rebuild `positioning_changes_panel`.
3. Rebuild downstream consumers, then serving staging.
4. Reload serving (TRUNCATE+COPY in one transaction), verified row-level served==gold.
5. Flip the web methodology copy (`registry.ts:485`) **in the same step as the reload**, never before.
6. Merge L6 + `l6b/recent-changes-no-lookthrough` into `fund_score` main.

### ⚠ Scope note the owner should hold: merging L6 ships MORE than this spec
`feat/l6-recent-changes-te-ranked` carries the TE-impact ranking feature (`positioning_changes_v0.2`,
`change_te_impact.py`, the surfacing rule that drops `style` rows). Its own spec
(`recent-changes-te-ranked`) is still in `queue/`, blocked on `unify-te-decomposition-global-basis`.
Its code is codex-gated and green, so merging is safe — but the merge **ships TE-ranked Recent
Changes as well as no-look-through**. That is a bigger user-visible change than "switch off ETF
expansion" alone, and it is now authorised. Recorded so it is not discovered later as a surprise.

### R-J. Round 4 results — and TWO CORRECTIONS to numbers already briefed to the owner

**Correction 1 — the "195 basis breaks / 103 funds" and "34 false served rows → 7" figures are
WITHDRAWN. Neither generating definition survives** in `_tmp` or the repo, so round 4 could not
reproduce them and correctly refused to restate them as its own. What replaces them, both
independently derived and both non-degenerate:

| | verified figure |
|---|---|
| frame-level expansion-state basis breaks | control **35 / 30 funds** → treatment **0** (seeded 3 → detector returns 3) |
| **served-level phantom rows vs RAW N-PORT** | control **138 rows (1.01%) on 33 funds** → treatment **0** (seeded 5 → detector returns 5) |

The served-level 138 → 0 is the end-to-end number and the one to quote. Note the direction: the
**mechanism** count was overstated (195 → 35) but the **reader-facing harm** was UNDERSTATED
(34 → 138). Within those 33 funds, **81.2% of served entered/exited rows are phantom**, and **20 of
the 29 funds that lose their section are in that cohort** — the coverage cost is dominated by
removing sections that were mostly fabricated.

**Correction 2 — R-I's "12 contested rows / 0.024%" is an undercount.** R-I keyed on
`.unique(["series_id","tkr"])` (one arbitrary quarter's verdict); the builder aggregates with
`suppressing.any()`, so a key that disagrees at one endpoint and agrees at the other suppresses.
Same population under the builder's own rule: **402 / 15 / 48**, i.e. **15 panel rows on 13 funds =
0.030%**, adjudicated 11 SERVED_NAME_OK + 1 SERVED_NAME_WRONG (FAEQX `MFUS`) + **3 unadjudicated**
(ONEZ `JULZ`/`DECZ`/`MAYZ`, left as residual unknown rather than folded into either side). R-I's
ruling direction is unchanged; its number was wrong and is corrected here.

**M1 moved, M2 did not.** Served funds 3,265 → **3,244**, net **−21** (29 lost / **8** gained,
−0.64%). The lost set is the identical 29 tickers pre and post; the only change is **FAEQX drops out
of GAINED**, because its single surfaced row WAS the wrong-company row. M2 is untouched (sector
2,046 → 2,027, theme 2,671 → 2,603) because H-1 fires only on wrapper-naming `position` rows.
M4 FCNTX identical across arms.

**A trap round 4 caught that would have silently corrupted the result:** the EDA's full no-expansion
frame **had no `lookthrough_mode` column** (it predates the stamp), so reusing it made the builder
read `basis = expanded`, label the TREATMENT arm `positioning_changes_v0.2`, and emit a fabricated
`lookthrough_coverage = 1.0`. It rebuilt (33 min) rather than reuse. Absent-stamp-means-expanded is
correct for legacy artifacts and dangerous for new ones.

**Guard live-fire CAPTURED** (no classifier block this time): both guards fired at the real canonical
`--out`, with gold sha256 identical before and after. Line-number drift for the record: the panel
guard is at `:793`/`:795` on HEAD, not `:738`. Both guards left unmodified.

**Test baseline: zero drift** — 6 failed / 28 errors / 1,345 passed before AND after, with 0 ids
only-before, 0 only-after, 0 outcome changes. Non-mutation CLEAN with `captured_at_utc` stamped
inside both JSONs, closing the R-H objection.

### R-K. FINAL GATE = FAIL. My R-I boundary was wrong on its premise. Reload is HELD until fixed.

The gate reproduced **every** round-4 headline independently — served cut, M1, M2, M3(a), M3(b), M4,
R-I, coverage buckets, frame honesty, tests, non-mutation, both guard live-fires. It then found
something none of us had: **B-1**.

**B-1 — three rows would tell readers "increased TFGZ" when the instrument is a cash fund.** Funds
**THOAX** (+6.78pp, rank 5), **THMGX** (+4.18pp, rank 5) and **TXUE** (+5.44pp, rank 4) serve ticker
`TFGZ`, which `cusip_reference` names *Thornburg Focus Growth Fund*. Every raw observation says the
instrument is the **Thornburg Capital Management Fund**, an affiliated cash vehicle: cusip `885216739`
appears in filings ONLY under that name, its filed LEI `549300GLR0WG6ALV5277` resolves in our own map
to `S000051223 "Thornburg Capital Management F…"`, and TFGZ's other reference cusip `885216671`
appears in **zero** filings. *"Added to a growth-fund bet"* versus *"parked more cash"* is a
materially different story. **This is a REGRESSION created by the promotion** — the control arm serves
0 of these, because expansion opened the wrapper via LEI into the correct book.

**MY RULING R-I WAS WRONG, and this is the correction.** R-I said NOT_ASSESSABLE stays served because
*"absence of a cross-reference is not evidence of contradiction."* That premise is false for this
sub-class: **a cross-reference EXISTS here** — the LEI resolves, and together with the filed title it
*affirmatively contradicts* the served ticker. What made these rows NOT_ASSESSABLE was merely that
`TFGZ` is absent from `data/tmp_sec_mf_tickers.json`, so `series_from_ticker` returned null.

The structural consequence is the serious part: **the detector's ticker surface is null for any
ETF-style ticker**, so *any* wrapper mis-bound by `cusip_reference` to a non-mutual-fund ticker lands
in NOT_ASSESSABLE-and-served. FAEQX/`MFUS` was caught only because `MFUS` happens to be in the MF
class file. We fixed an instance and left the class open.

**RULING K-1 (tier b — existing doctrine, not a new rule): close the sub-class, then re-cut.**
Reclassify as DISAGREEMENT (and therefore suppress) any wrapper row where **the ticker is
unresolvable in the class file BUT the filed LEI resolves to a series AND the filed title contradicts
the served ticker.** Absence of evidence still stays served — 25 of the 28 NOT_ASSESSABLE served rows
have filed titles that match their ticker (QQQ ×12, SPY ×7, …) and must remain served. Only the 3
contradicting rows change. This is the standing "contradictory claimants → exclude honestly" doctrine
reaching the surface R-I mistakenly exempted; it needs no owner turn.

**RULING K-2: also file the upstream block.** Add `885216671`/`885216739 → TFGZ` to the H-4
`cusip_reference` backlog item as a second proven bad block alongside the 72202L→MFUS one. Do not fix
gold reference data inside this spec.

**Cost of the fix: ≤3 rows.** All three funds keep 4 other surfaced rows, so **no fund loses its
section**; M1 is unchanged, M2 position rows move by −3.

**RELOAD IS HELD** until B-1 is fixed and this gate re-runs on the delta. Everything else is verified
and ready.

### Corrections the gate forced on our own record
- **The 3 ONEZ rows are DECIDED, not unknown.** TrueShares monthly ETFs reorganised into Elevation
  Series Trust mid-window; filed titles match the served ticker at BOTH endpoints, both LEIs resolve.
  **SERVED_NAME_OK.** So H-1's true cost is **14 correct rows removed of 15 (1 genuinely wrong)** at
  0.030% — not "11 OK / 3 unknown". Suppression still fails safe, but the record must say 14/15.
- **"Reproduces the payload bit-for-bit" is overbroad.** The four headline counts are exact, but 16
  row keys and 59 sector magnitudes (max |Δ| 4.4pp) differ from the staging payload — all confined to
  the known L14/L16 sector-consensus relabel, exactly as R-G predicted. Say **"identical up to the
  L14/L16 relabel"**.
- **M3(b)'s treatment 0 is STRUCTURAL, and must be stated that way.** Under no-expansion the served
  name is drawn from the fund's own filed rows through the same cusip→ticker resolution the detector
  inverts, so a phantom TRADE is impossible absent a code bug. The class elimination is real and the
  implementation is confirmed correct (seeded 5 → 5), but the 0 is a **design consequence, not an
  independent empirical discovery**. The residual risk moves entirely onto the identity axis — which
  is precisely where B-1 lives. Do not let the brief imply the 0 proves more than it does.

### R-L. Provenance + commit hygiene for finalize (round 4's own flag, adopted)

Round 4 re-woke after reporting and observed uncommitted edits in its worktree. **That is the K-1 fix
round, dispatched after round 4 reported — sequential, not a collision** (round 4's last artifact
write 16:35; K-1's first code edit 17:23). No F2 breach: one worktree, one writer at a time. But two
of its points are adopted:

1. **Round-4 numbers were measured on pristine `2cfe22c` and are NOT reproducible on today's tree.**
   Provenance is pinned in `evidence/r4_code_provenance.txt` (per-file sha256 as-measured vs as-now;
   every artifact mtime ≤16:35; no tracked `.py` touched between 14:30 and 17:23). **A reviewer
   verifying round 4 must check out `2cfe22c` clean.** Three of its identity figures are deliberately
   superseded by K-1 and must NOT be carried forward: the 28 NOT_ASSESSABLE-served rows become 25,
   the "0 disagreement among served" becomes non-zero, and the 15-row/13-fund suppressed class grows.
   M1/M2 can move again if a K-1-suppressed row is a fund's only served row — the FAEQX pattern.
2. **Do NOT `git add -A` at finalize.** Round 4 changed no code, so the only tracked edits are K-1's
   (`lookthrough_window.py`, `build_positioning_changes_panel.py`) — but untracked reports and
   check-run artifacts are also present, and a blanket add would hand the codex gate a diff nobody
   scoped. Stage the K-1 files explicitly. And **round 4's "clean tree" line must not be quoted as a
   verification result** — it was true when measured and is false now.

**Both canonical-write guards verified intact by CONDITION, not by message text** (round 4 briefly
mis-grepped on the message and thought guard 2 was gone, then self-corrected):
`build_holdings_lookthrough_window.py:137` unchanged, and the panel guard now at `:812` — moved from
`:793` purely by K-1's insertions above it, not relaxed and not made basis-aware.

### R-M. DELTA RE-GATE = PASS. B-1 closed. Reload cleared to proceed.

The gate re-derived everything **from raw inputs, not from round 5's outputs**, and returned **pass,
no blocking issues**, with an explicit *"Proceed… nothing that would be wrong on a fund page after
the reload."*

Verified independently: all 33 TFGZ frame lines fire (`disagreement`/`name_contradiction`) and
exactly the 3 served rows are removed — THCGX/TVAFX are stamped too but sat at surfaced_rank 28/23,
outside the top-8 cut, which is why 5 stamped → 3 removed. The 25 spared rows were checked **one at a
time against raw sources**, and the spare is *layered rather than lucky*: QQQ/SPY are spared at
condition 2 (UIT LEIs present with `series_id = null`), and the CRTOX filer typo
(`"Invesco QQQ Trust, Sries 1"` — real) would still be spared at condition 4 by the registry surface.
Seeded both ways by the reviewer's own seeds (its first TFGZ seed was degenerate; it re-ran).
Adjudication reconciles to 20 = 14 OK + 6 WRONG with **zero unadjudicated**.

**The `_names_match` root cause is CONFIRMED by execution**, not inference: the reviewer ran it —
`_names_match("THORNBURG FOCUS GROWTH FUND","THORNBURG CAPITAL MANAGEMENT FUND")` → **True**, while
`fund_name_is_shortening` on the same pair → **False**. And it checked the other displayed surface:
**0 TFGZ rows in `holdings_complete.parquet`**, so no fund page serves the mis-name today. Filed
upstream with root cause (backlog K-2).

**Warnings adopted (none blocking):**
- **"Control payload byte-identical" is overbroad — the same claim-class R-K already corrected once.**
  `change_z` IS a served column (`fact_assembler.py:1197`) and differs on 4,617/20,890 control served
  rows at ≤2.3e-14 — pre-existing float-summation jitter, present pre-K-1, invisible at any display
  precision. Row sets and all 32 other columns are bit-identical, so M3(b)'s phantom figures stand.
  Say **"identical up to pre-existing ≤2e-14 `change_z` jitter"**. The delta-audit's `VALUE_COLS`
  should have included it.
- **No regression test guards the K-1 predicate.** Deferring it was legitimate for a round that had
  to diff a by-id baseline, and both directions were live-fired twice — but after this session
  nothing red protects `normalize_fund_name` / `fund_name_is_shortening` / `name_route_verdict`, and
  a future "cleanup" of the single-char-token drop would silently re-open B-1 or over-fire.
  **File the unit tests to land at finalize**, when the baseline legitimately moves anyway.
- The 9 MoA firings are false positives from **stale reference names** (pre-rebrand), not collisions —
  name that explicitly in the H-4 item, which is currently framed around collisions only.
- `identity_route` is a frame-level column and is **not persisted in the panel parquet** — true as a
  code claim, not queryable in the artifact.
- Non-mutation's r5 capture window closed 17:21, before the 17:41 builds; the reviewer **closed that
  gap itself** (nothing modified after 17:21 outside `_tmp`; both canonical golds re-hashed to their
  pre-run values).
