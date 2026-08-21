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
