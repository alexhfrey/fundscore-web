---
id: sector-consensus-canonical-write
title: Wire the US-consensus sector rule into the build and perform the authorised canonical write
status: queued
track: backend
repo: fund_score
depends_on:
source_proposal: owner rulings 2026-08-21 (the rule, delegated; the frame pin, "pin it")
created: 2026-08-21
priority: 1
scope: global
model: opus
effort: high
lane: reviewed
---

## Owner summary
Twenty securities are currently shown under two different sector labels at once — the same company
appearing as Energy in one fund and Industrials in another. Fourteen of them can be resolved, the
rule to do it has been built and independently verified to the cent, and the owner has authorised
writing the corrected labels. This spec performs that write. It is the only work in this run that
changes data users see, and it is a straight label swap — nothing is added, nothing is lost.

## ⚠ THE CANONICAL WRITE IS AUTHORISED — do not stop to ask for it
The owner authorised this write on **2026-08-21** after an adversarial checkpoint returned
PASS-WITH-CORRECTIONS with no blocking issues. **Proceed to the write.** Everything else in this
repo's standing constraints still applies — but "canonical writes need explicit authorisation" is
satisfied for the four artifacts named below, and *only* those four.

**NOT authorised by this ruling: Postgres, the serving reload, or any other canonical path.** The
reload stays behind fence F4 and is a separate owner decision.

## The two owner rulings this implements
**1. The rule (delegated 2026-08-21).** When one security carries two different sector labels and its
**US-filed rows all agree on one**, use that sector for **every row of that security**. If the
US-filed rows disagree with each other, **change nothing**.

**2. THE FRAME PIN (2026-08-21, "pin it").** The consensus map is **evaluated ONCE on
`holdings_complete`**, and that verdict **propagates to every consumer**. Frames do not re-evaluate.

The owner ruled this knowing the consequence, which is stated here so nobody "fixes" it later: on
`holdings_lookthrough_window`, **Scorpio Tankers and NIQ Global would decline on that frame's own US
rows and are relabelled anyway.** That is intended — *decide once on the canonical filed book,
propagate the verdict* — because letting each frame decide for itself recreates the cross-surface
contradiction this work exists to remove (the rule finds **14 / 9 / 12** securities on
`holdings_complete` / `holdings_lookthrough_window` / `fund_holdings_full_staging`).

## ⚠ The precondition the checkpoint attached — this is the point of the segment
**The map MUST be derived inside the build, from the same `holdings_complete` vintage, in the same
run that rebuilds all three consumers.** It must **never** be frozen as a standalone artifact that
the frames later rebuild against independently — if it is, the 14/9/12 frame divergence returns
silently, with no code change and nothing to see.

If single-run, vintage-coherent derivation is not achievable, **STOP and brief** rather than shipping
a frozen map.

## What to build
The rule is already implemented, committed and codex-gated at `0789eb8` on `fix/l14-domicile-routing`
in `/Users/alexfrey/Projects/fund_score-wt-l14`: `src/fundscore/reference/sector_attach.py` provides
`us_consensus_sector_map()` and `apply_us_consensus_sector()`, **additive and currently unwired**
(`attach_sector` is untouched; only the tests import them).

**This segment wires them into the build** and rebuilds the four consumers in one vintage-coherent run.
Start by reading `reports/l14_segment4.md` — §7 (F-1, the frame divergence), §13 (the write bill) and
§16 (the corrections log).

## The authorised write bill — re-derive before writing, do not inherit
| artifact | rows | funds | value |
|---|---|---|---|
| `holdings_complete` | 1,359 | 512 | $2,915,477,693.90 |
| `holdings_lookthrough_window` | 3,452 | 583 | $4,669.005M |
| `fund_holdings_full_staging` | 1,063 | 427 | $2,872.044M |
| `exposure_xray` | 1,479 cells | 512 | 9 sector rows appear / 4 disappear |

**No schema change, no new column.** Every change is a label-for-label swap: **0 fills, 0 losses**,
all non-`sector` columns bit-identical, row order preserved.

## Hard constraints on the write
1. **Back up every canonical target before overwriting** — `<name>.parquet.pre-l14-seg4-bak`. Check
   you are not clobbering an existing backup; several `.pre-*-bak` files already exist.
2. **Write ONLY those four artifacts.** If the rebuild wants to touch any other canonical path,
   **STOP and brief**.
3. **No Postgres, no serving reload.**
4. **One lakehouse-writing session** (fence F2). Verify no other writer is active before starting.
5. **Non-mutation accounting INVERTS here.** Earlier segments proved *zero* canonical writes; this one
   must prove **exactly the intended writes and nothing else** — the four artifacts plus their
   backups, and no other file under `data/{gold,product,silver,bronze,reference,staging,vendors}`.
   Use `os.walk(followlinks=True)` with a pre-walk canary and enumerate every changed path explicitly.
6. **Rebuild-twice determinism** on each written artifact before accepting it — decision columns
   bit-identical across two runs.
7. Any new rule / threshold / band / allowlist → **STOP and brief**.

## Verify after writing — the write is not done until this passes
1. **Re-derive the four counts** on the written `holdings_complete`: 20 securities carry ≥2 sectors,
   14 resolve, 6 decline, 0 lack US rows. **Confirm the 6 are still declined, Navigator named.**
2. **Confirm the cross-surface claim landed.** `return_attribution`, `holdings_brinson_summary` and
   the passive solver key sector off `cusip_reference`, and all 14 winning labels equal that label —
   so this write should **remove** a basis disagreement. **Verify it is gone rather than assuming.**
3. **Per-fund diff against the backups, not aggregates.** The coverage-weight check
   (`scripts/checks/l14_classified_weight_regression.py`) is **LABEL-BLIND here and will report clean
   no matter what happens** — it proved that itself: 0 improved / 0 regressed while 3,452 rows changed
   sector. Do not use it as evidence.
4. **Spot-check at least three funds end to end against raw N-PORT**, including one on the lookthrough
   frame where the pin overrode a local decline (**Scorpio or NIQ**) — that is the case the owner
   explicitly accepted, and it must be visibly correct.
5. `/check-data` on the affected features.

## Standing rules this run earned — apply them to your own work
- **A check that returns 0 must be shown capable of returning non-zero before its 0 is quoted.** Five
  vacuous checks were caught in the preceding week, one inside a spec's own acceptance criteria.
- **A class boundary must be tested against every axis the downstream action branches on.**
- **A sweep that reports "clean" is itself a check** — vary the pattern or seed a known instance.
- **`inv_country` carries a string sentinel `'N/A'`** (3 rows in `holdings_complete`, 4,959 in
  `fund_holdings_full_staging`, 10 in the lookthrough frame). Audit it explicitly; do not infer
  cleanliness from a null count.

## Acceptance
- Map derived in-run from one `holdings_complete` vintage; **no frozen map artifact**.
- Four artifacts written, backed up first, each deterministic on rebuild-twice.
- Non-mutation accounting shows **exactly** those four paths plus backups changed.
- The four counts re-derived post-write; the 6 still declined, Navigator named.
- Cross-surface disagreement verified **removed**.
- Per-fund diff reported; the label-blind check explicitly not used as evidence.
- Three raw-N-PORT spot-checks including a pin-override case.
- `/check-data` clean on affected features.
- Nothing committed by the implementer — the dispatcher owns the commit and the codex gate.
- Stops for a `data-reviewer` checkpoint once the write is verified.

---

## Dispatcher re-grounding note (2026-08-21, `/implement-next`)
Verified before dispatch; every reference in this spec resolves. Two items the write-bill table
compressed are pinned here so they are not re-decided mid-write.

**1. `exposure_xray` in the write bill = `data/gold/exposure_xray_panel.parquet`.**
`exposure_xray_contributors.parquet` carries **no `sector` column** (verified against its schema), so
it is not a sector-relabel target. Report §13 writes it as "(+ `_contributors`)" meaning *rebuilt
alongside*, not *relabelled*. If a rebuild changes `_contributors` bytes, that is in scope as a
co-rebuild of the same builder; a change to its **semantics** is not — STOP and brief.

**2. `passive_blend_holdings.parquet` is NOT authorised and must NOT be rebuilt in this run.**
`src/fundscore/product/passive_holdings.py` inherits `sector` from its input holdings frames
(lines 276-280, 387-390) rather than keying off `cusip_reference` — so it does **not** self-correct,
and report §13's "same pinned map applies" is a *future* statement, not part of this bill. Do not run
`build_passive_holdings_foundation.py`. Consequence, **measured at dispatch, not estimated** — carry
these numbers into the final report as a surfaced finding for the owner:

| measure | value |
|---|---|
| passive-side rows on the 14 consensus ISINs | **808** across **375 funds** |
| of those, rows whose label contradicts the consensus | **808** (all of them) |
| worst single fund, passive NAV left on the stale label | **0.638 pp** |
| median fund | **0.014 pp** |
| funds > 1 pp | **0** · funds > 0.1 pp: **90** |

So after this write the Exposure X-Ray compares a fund book on the new basis against a passive book
on the old one, for 375 funds, at ≤0.64 pp of NAV. Real, bounded, and **out of scope here** — the
owner authorised four artifacts. Surface it; do not fix it.

**3. Environment pinned at dispatch.** `fundScoreRoot` is the worktree
`/Users/alexfrey/Projects/fund_score-wt-l14` (branch `fix/l14-domicile-routing` @ `0789eb8`, clean
tree) — the consensus functions exist **only** on that branch. Its `data/` symlinks the shared
lakehouse `/Users/alexfrey/Projects/fundscore-lakehouse`, so a worktree isolates code, **not data**.
Use the main venv: `UV_PROJECT_ENVIRONMENT=/Users/alexfrey/Projects/fund_score/.venv uv run python`.

**4. Pre-dispatch verification already performed** (re-derive anyway; do not inherit):
`us_consensus_sector_map()` on the current `holdings_complete` vintage returns **exactly 14** —
the spec's count reproduces. Backup suffix `.pre-l14-seg4-bak` collides with **nothing** in the
lakehouse. Fence **F2 verified clear**: no active lakehouse writer and no lakehouse file modified in
the 60 min before dispatch. **Re-check F2 yourself before the first write** — 15 worktrees share this
one lakehouse and another session may have started since.

### ADDENDUM — owner ruling 2026-08-21 (mid-run), supersedes the "surface it" disposition above
The owner reviewed the passive-basis gap and ruled **two things**:

1. **Sequencing: land these four now; the passive side ships as its own spec.** This run's bill is
   **unchanged — still exactly four artifacts.** Do not touch `passive_blend_holdings.parquet`, and do
   not run `build_passive_holdings_foundation.py`. The follow-on is
   `feature-pipeline/specs/queue/passive-book-sector-basis-parity.md` (priority 1, runs next).
   **You no longer need to brief this** — it is ruled and specced. Report the gap as a known,
   owner-accepted interim state and move on.
2. **The identity rule (for the follow-on, recorded here so the ruling lives with its evidence):**
   where the passive book contradicts itself, the passive rows **inherit the fund-side US-filed
   consensus label**. Fund and passive match by construction.

**Corrected sizing** (the dispatcher's first pass joined on ISIN only and under-counted ~5x; the
passive book's key is mixed — 47% of its rows carry a non-ISIN `security_id`):

| measure | ISIN-only (wrong) | full identity (honest) |
|---|---|---|
| passive rows on the 14 | 808 | **3,895** |
| funds | 375 | **1,871** |
| worst fund, passive NAV on a stale label | 0.638 pp | **0.774 pp** |
| median · >1pp · >0.5pp | — | **0.007 pp · 0 · 24** |

**Context that makes the interim acceptable:** the crossed basis is **pre-existing, not created by
this write** — of the fund/passive pairs directly comparable today, **84 of 244 (34.4%), across 63
funds, already disagree**. These four writes fix the fund side and make the residual gap uniform and
measured instead of random.

### ADDENDUM 2 — dispatcher rulings under delegated authority (2026-08-21)
The owner delegated these three decisions ("pick a sensible option and fix this"). Decided as follows;
each is recorded so it can be reversed knowingly.

**1. THE BILL CHANGES SHAPE — still four artifacts, but one is replaced.**
`holdings_lookthrough_window.parquet` **carries no `sector` column** (14 columns; sector is attached at
READ time in `build_positioning_changes_panel.py:613`). There is nothing in it to relabel, so it
**leaves the bill**. The artifact that persists and serves those 3,452 rows —
**`data/gold/positioning_changes_panel.parquet`** → `facts.positioning_changes` — **takes its place.**

Rationale: the owner's standing intent is that surfaces be read on ONE basis. Dropping the frame
entirely would leave the served positioning surface on the old basis for **509 of 583 affected funds**,
recreating the contradiction this segment exists to remove. The authorised bill is therefore:

| artifact | status |
|---|---|
| `gold/holdings_complete.parquet` | unchanged from the authorised bill |
| `gold/positioning_changes_panel.parquet` | **REPLACES** `holdings_lookthrough_window` |
| `product/fund_profiles/fund_holdings_full_staging.parquet` | unchanged |
| `gold/exposure_xray_panel.parquet` | unchanged |

**⚠ This one is NOT a clean label swap — size it and report it.** On that panel sector is not a column:
it is `change_name` on **39,533 `change_type='sector'` rows across 4,359 funds**, of which **992 funds
carry a currently-surfaced sector change**. Relabelling can make rows **merge, appear, vanish, or change
`surfaced_rank`**. Before accepting the write you MUST report, as explicit counts: sector rows moved /
merged / appeared / vanished, and **how many of the 992 funds see a different surfaced headline**. That
is a reported number the `data-reviewer` checkpoint validates — **not** a reason to stop and ask.
The other three remain 0-fills / 0-losses label swaps and must still prove it.

**2. PIN SCOPE — accept the third class; propagate to every row.**
Caesarstone (103 rows), Dynagas (3), FGI (2) — **108 rows / 82 funds / $17.00M** — show no
contradiction on that frame and file zero US rows there, yet the pin flips their single label. **This is
accepted**, consistent with the pin as ruled: decide once on the canonical filed book, propagate the
verdict to every consumer. Narrowing the pin to contradicted-only would reintroduce the per-frame
divergence (14/9/12) the pin exists to prevent. **Report all three by name** with before/after and fund
counts; do not let them pass inside an aggregate.

**3. COVERAGE — ship this write, and CORRECT THE FRAMING.**
The 6 declines are **NOT** a genuine US-side disagreement. All six are **recoverable identity defects**
(the `cusip='N/A'` sentinel falling through to the FMP fallback; a wrong filed CUSIP binding a different
company). Therefore:
- **Report BOTH coverage numbers, and lead with the weighted one**: **47.0% of contradicted filed value**
  ($3.856B of $8.199B) and 62.7% of contradicted rows, alongside 70.0% by security count. The count
  figure alone overstates the result — the two largest contradictions in the book, **SharkNinja ($3.19B)
  and Shift4 ($0.99B), are both unresolved.**
- **Correct `reports/l14_segment4.md` §1**, which presents the six as genuine disagreement. That framing
  is exactly what would let 47% value coverage pass as "honest partial coverage" later. Per the standing
  rule, a large recoverable-missing fraction is a **DEFECT**, not acceptable partial coverage.
- The write still ships now: the resolved 14 are correct and independently verified, and the six are
  tracked as their own fix — `feature-pipeline/specs/queue/sector-identity-defect-recovery.md`.

## Implementation Result — SHIPPED 2026-08-21 (fund_score `8590fc5`, web `a24bc3d`)
Authorised canonical write performed on branch `fix/l14-domicile-routing`. Bill re-derived vs the
backups, not inherited; **0 fills / 0 losses** on every frame.

| artifact | written |
|---|---|
| `gold/holdings_complete.parquet` | 1,359 rows / 512 funds / $2,915,477,693.90 |
| `product/fund_profiles/fund_holdings_full_staging.parquet` | 1,063 rows / 427 funds / $2,872,044,048.95 |
| `gold/positioning_changes_panel.parquet` *(replaced `holdings_lookthrough_window`)* | sector rows 39,533 → 39,538 (6 appear, 1 vanish, 1,412 move / 461 funds) |
| `gold/exposure_xray_panel.parquet` | 3,583 sector cells / 485 funds |

**The write did its job, proven non-vacuously:** cross-surface disagreement against the
`cusip_reference` basis went **435 ticker-matched rows / $1,082,879,255.69 → 0 rows / $0.00**.

**Churn on the swapped-in artifact** (the number the bill change turned on): **5 headline flips of
2,826 funds (0.18%)**; **4 of the 992-fund surfaced cohort (0.40%)**.

**Coverage, led by value:** **47.0% of contradicted filed value** ($3.857B of $8.199B) · 62.7% rows ·
70.0% security count. Remainder is **0% honest-missing / 100% recoverable** — the 6 declines are
identity defects, report §1 corrected accordingly, tracked in `sector-identity-defect-recovery`.

**Gates:** both `data-reviewer` checkpoints **pass** · final combined gate **pass** · `/check-data`
clean · raw-N-PORT spot checks exact incl. both pin-override cases (Scorpio/AVUV, NIQ/LACAX) ·
**codex high-tier `pass`, 0 blockers / 0 advisories** (3 rounds: round 1 blocked on 2×P1).

**Fixed because the gate blocked** — canonical-path guards compared unresolved paths, so a relative
`--out data/gold/...` bypassed them and could overwrite gold (`build_exposure_xray_panel`,
`build_positioning_changes_panel`, and its sibling `build_holdings_complete`, found by sweeping the
class). `l14_seg6_walk` claimed a canary in its docstring but never planted one — now implemented,
**refuses** the comparison unless the canary shows as changed, with both pass and refuse paths
demonstrated.

**Not done, by design:** no Postgres, no serving reload — **fence F4 remains the owner's call**, so
none of this is user-visible yet. Follow-ons queued: `passive-book-sector-basis-parity` (priority 1),
`sector-identity-defect-recovery` (priority 2), plus an X-Ray tie-break determinism bug filed to the
backlog (pre-existing, control-proven).
