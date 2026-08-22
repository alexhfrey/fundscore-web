---
id: passive-book-sector-basis-parity
title: Put the passive book on the same sector basis as the fund book — build the identity bridge, then relabel
status: done
track: backend
repo: fund_score
depends_on: sector-consensus-canonical-write
source_proposal: owner ruling 2026-08-21 ("we need to fix that passive bug — they should be compared on same basis")
created: 2026-08-21
priority: 1
scope: global
model: opus
effort: high
lane: reviewed
---

## Owner summary
The fund page compares what a fund holds against its best passive alternative. Right now those two
sides can label the same company differently — the fund book calls it Energy, the passive book calls
it Industrials — so the comparison is quietly apples-to-oranges for about 1,871 funds. The preceding
spec fixed the fund side. This one fixes the passive side, so both are read on one basis. It is a
label swap: nothing is added, nothing is lost.

## Why this is a separate spec (and not part of the write it follows)
The preceding write (`sector-consensus-canonical-write`) was a clean label-for-label swap on a clean
ISIN key, sized to the cent and independently verified. **This is not that shape.** It needs an
identity bridge that does not exist in the code today, and it needs a rule for rows the filed
evidence cannot resolve. The owner ruled on 2026-08-21 to sequence them apart rather than bolt this
onto a run already in flight.

## The two owner rulings this implements
**1. Sequencing (2026-08-21).** The four-artifact canonical write lands first, on its own verified
bill. The passive side follows here.

**2. THE IDENTITY RULE (2026-08-21).** Where the passive book contradicts itself and no filed
evidence resolves it, the passive rows **inherit the fund-side US-filed consensus label**. Fund and
passive then match **by construction**, which is the outcome the owner asked for. The owner ruled
this knowing the consequence, stated here so nobody "fixes" it later: **the passive book takes a
label its own vendor source did not assert.** That is intended — the comparison basis is the fund
book, and a passive alternative is only meaningful when read on the same basis.

## ⚠ The trap that makes this spec necessary — do not join on ISIN
`passive_blend_holdings.parquet` keys on `security_id`, which is a **MIXED key**: **2,903,175 of its
6,232,681 rows (47%) carry a non-ISIN `security_id`** (a ticker). The 14 consensus securities live in
the passive book **predominantly under tickers** — `NIQ`, `CMPR`, `LION`, `PAGS`, `STNG`, `TNK`,
`CVEO`, `DHT`, `DLNG`, `FGI`, `GAMB`, `VGNT`, `CSTE`, `DGXX`.

A naive `security_id ∈ isins` join relabels **808 of 3,895 rows (21%)** and leaves **1,496 funds**
still crossed — while every row-count and coverage-weight check reports clean. **That is silent
under-extraction, i.e. a DEFECT, not partial coverage.** Measured at dispatch:

| join surface | rows | funds |
|---|---|---|
| ISIN-only (**wrong — do not ship this**) | 808 | 375 |
| ISIN + `security_id` + `security_ticker` (**honest**) | **3,895** | **1,871** |
| residual a naive join silently misses | **3,087** | **1,496** |

## What to build
**1. The identity bridge.** A deterministic ISIN ↔ ticker ↔ `security_id` resolver so a consensus map
keyed on ISIN can reach passive rows keyed on a ticker. Derive it from the canonical book
(`holdings_complete` carries `isin`, `security_id`, `security_ticker`, `cusip` on the same row —
27 distinct identity rows cover the 14 securities). **In-run, from the same vintage** as the map, per
the frame pin — **never a frozen artifact**.

Adjudicate identity from the join surface, and where two claimants tie, **exclude honestly rather
than pick a stable-but-wrong winner** — a deterministic wrong binding is worse than an honest gap.

**2. Apply the pinned consensus map** through that bridge to `passive_blend_holdings.sector`.

**3. The three self-contradictory tickers.** `NIQ` (1,011 rows), `PAGS` (492) and `LION` (448) each
carry **two different sectors inside the passive book itself**. Per the identity rule above, they
take the fund-side consensus label. Report each of the three explicitly with its before/after and
row counts — do not let them pass inside an aggregate.

## Hard constraints
1. **Back up before overwriting** — `passive_blend_holdings.parquet.pre-passive-parity-bak`. Verify
   the name is free first; several `.pre-*-bak` files already exist.
2. **Write ONLY `passive_blend_holdings.parquet`** plus any consumer the owner authorises explicitly.
   `exposure_xray_panel` re-derives from it — confirm whether it needs a co-rebuild and **size that
   before writing it**; if the rebuild reaches any other canonical path, **STOP and brief**.
3. **No Postgres, no serving reload** (fence F4 — separate owner decision).
4. **One lakehouse-writing session (F2).** 15 worktrees share
   `/Users/alexfrey/Projects/fundscore-lakehouse`. Verify no other writer is active immediately
   before the first write — a worktree isolates code, **not data**.
5. **Prove exactly the intended writes and nothing else** — `os.walk(followlinks=True)` with a
   pre-walk canary, every changed path enumerated.
6. **Rebuild-twice determinism** on the written artifact; decision columns bit-identical.
7. Any rule / threshold / allowlist beyond the ruled identity rule → **STOP and brief**.

## Verify after writing
1. **Coverage is the headline number.** Report relabelled rows / **3,895** and funds / **1,871**.
   Anything short of full coverage is a recoverable miss until proven honest — spot-check the misses
   against the raw source, do not assume.
2. **Prove the bridge is non-vacuous.** A check that returns 0 must be shown able to return non-zero:
   seed a known ticker-keyed row and confirm it is caught. The ISIN-only join is the counter-example
   to beat — demonstrate the bridge finds the 3,087 rows it misses.
3. **Cross-basis parity re-derived.** Today **84 of 244 (34.4%)** directly comparable fund/passive
   pairs disagree across **63 funds**. Post-write that must be **0**. Verify it is gone, don't assume.
4. **Per-fund diff against the backup, not aggregates.** The coverage-weight check
   (`scripts/checks/l14_classified_weight_regression.py`) is **LABEL-BLIND and will report clean no
   matter what happens** — it proved that on the preceding segment (0 improved / 0 regressed while
   3,452 rows changed sector). **Do not cite it as evidence.**
5. **Spot-check ≥3 funds end to end**, including one where the fund holds the security directly and
   one where only the passive side does, plus **all three** of NIQ / PAGS / LION.
6. **Audit `inv_country`'s string sentinel `'N/A'`** explicitly; never infer cleanliness from a null
   count.
7. `/check-data` on the affected features.

## Acceptance
- Identity bridge derived in-run from one vintage; **no frozen artifact**; ties excluded honestly.
- Coverage reported as **relabelled / 3,895 rows and / 1,871 funds**, with any residual proven honest.
- The bridge demonstrated non-vacuous against the ISIN-only counter-example.
- Cross-basis disagreement re-derived and shown to be **0** (from 84 / 63 funds).
- NIQ, PAGS and LION each reported individually with before/after.
- Backup taken; non-mutation accounting shows exactly the intended paths; rebuild-twice deterministic.
- Per-fund diff reported; the label-blind check explicitly **not** used as evidence.
- `/check-data` clean.
- Nothing committed by the implementer — the dispatcher owns the commit and the codex gate.
- Stops for a `data-reviewer` checkpoint once the write is verified.

## Sizing carried from dispatch (re-derive, do not inherit)
Worst fund **0.774 pp** of passive NAV on a stale label · median **0.007 pp** · **0** funds >1pp ·
**24** >0.5pp · **91** >0.1pp. Direction of the contradiction, by row count: Technology→Communication
Services, Industrials→Energy, Industrials→Technology, Industrials→Communication Services,
Communication Services→Consumer Cyclical.

## ADDENDUM — dispatcher rulings (2026-08-21, pre-dispatch re-grounding)
Every load-bearing reference and number in this spec was re-derived against the current tree and the
live lakehouse before dispatch. **Reproduced exactly:** consensus map = **14 securities**
(fingerprint `572f50b78506`, via `pinned_us_consensus_map()`) · **27** identity rows · passive book
**6,232,681** rows · non-ISIN `security_id` **2,903,175 (46.6%)** · ISIN-only **808 rows / 375 funds**
· honest bridge **3,895 rows / 1,871 funds** · residual **3,087 rows** · NIQ **1,011** / PAGS **492** /
LION **448**, each carrying exactly two sectors. The acceptance targets stand unchanged.

**Ruling A — `exposure_xray_panel` + `exposure_xray_contributors` are IN the write bill.**
`scripts/pipeline/build_exposure_xray_panel.py:78` reads `passive_blend_holdings.parquet` and takes
the passive/reference side of every sector cell from its `sector` column, so relabelling the passive
book without a co-rebuild leaves the served panel with a consensus-labelled fund side against an
old-labelled passive side — it would *relocate* the apples-to-oranges bug this spec exists to kill,
not fix it. Sized: **131,342 sector cells / 5,385 funds** on the panel (**83,831** with a non-null
`reference_value`); the analogous preceding write moved 3,583 cells / 485 funds, so expect a delta of
that order. That builder writes **exactly two** canonical paths (`exposure_xray_panel.parquet`,
`exposure_xray_contributors.parquet`) and reaches **no other** — so this spec's own STOP trigger
("if the rebuild reaches any other canonical path") does **not** fire, and the co-rebuild is taken
under the conditional authorisation in Hard constraint 2. Both get the same backup +
non-mutation-accounting + rebuild-twice discipline as the primary target. **`sector` is not a column
on this panel** — it is a *value* of `exposure_type`, so verify by sector cells, never by a column diff.

**Ruling B — the trap table's residual fund count is a subtraction artifact.** It reads 1,496; the
measured value is **1,562**. 1,871 − 375 = 1,496 assumes the ISIN-matched and residual fund sets are
disjoint, and they overlap. Row count (3,087) is exact. No acceptance number depends on it.

**Ruling C — the 84 / 244 / 63-fund parity baseline does not reproduce under a bridge-complete
definition.** Measuring every (series_id, isin) pair the fund and passive books share with both sides
labelled gives **159 of 239 pairs (66.5%) disagreeing across 88 funds** — *worse* than the stated
baseline, consistent with the original figure having been taken on a partly ISIN-only surface (the
very undercount this spec was written to expose). The acceptance target is unaffected: post-write
disagreement must be **0**, which holds under either definition. **The EDA re-derives this and its
number is authoritative** — do not inherit 84/244/63.

**Ruling D — the honest-exclusion tie rule is inert this run.** Zero `security_id` and zero
`security_ticker` in the bridge claim more than one mapped ISIN, so there is nothing to exclude. The
rule must still be *implemented and demonstrated able to fire* (a vacuous check proves nothing) — seed
a synthetic tie and show it excludes.

**Ruling E — `inv_country` is clean pre-write:** 0 `'N/A'` string sentinels and 0 nulls across all
6,232,681 passive rows. Constraint 6's audit is a post-write re-confirmation, not a discovery.

**Materiality:** none of A–E is user-visible — fence **F4 holds** (no Postgres, no serving reload), so
nothing written here reaches a user. None changes whether this ships. Decided by the dispatcher and
recorded here so they are knowingly reversible.

**Branch base:** the consensus code (`src/fundscore/reference/sector_attach.py`) lives on
`fix/l14-domicile-routing` (worktree `fund_score-wt-l14`) and is **not merged to main** — this work
must be based there, or `pinned_us_consensus_map()` does not exist.

## ADDENDUM 2 — dispatcher rulings on the sample checkpoint (2026-08-21 16:5x)
The sample segment returned `ready_for_review: true` and explicitly **did not block the sample**; its
three items and the EDA's seven hazards are answered here. **Materiality verdict on all of them: not
one passes.** Every item is behind **fence F4** (no Postgres, no serving reload — nothing reaches a
user), every one is sized in rows/funds/pp, and none changes *whether* this ships, only *how*. So they
are dispatcher calls, recorded here to be knowingly reversible. **None was escalated to the owner.**

**Ruling F — Hard-constraint 6 is restated PER-ARTIFACT (implementer option (a)).**
`exposure_xray_panel` is non-deterministic on identical inputs *with no L16 code in the path* — a
**pre-existing** defect, already filed to the backlog by `sector-consensus-canonical-write` as the
X-Ray tie-break bug, so it is not this spec's to fix (option (b) touches a served ranking outside the
ruled scope) and dropping the co-rebuild (option (c)) is refused because the EDA proves the desync is
**live in gold right now** (`holdings_complete` rebuilt 13:47, panel 13:49, passive book still
2026-08-09). Therefore:
- **`passive_blend_holdings.parquet` — bit-identical across rebuilds, no tolerance.** Already proven.
- **`exposure_xray_panel` / `_contributors` — tolerance-bounded**, and the bar is *raised*, not
  lowered: bit-identity is replaced by an **exact diffable prediction**. The EDA's simulation
  reproduces today's `reference_value` with **max abs error 0.0 across 37,134 matched cells**, so
  implement-full must show the observed delta equals the predicted bill — **2,623 `vs_benchmark`
  sector cells across 1,155 funds, 0 cells appear, 0 vanish** — after subtracting a noise floor
  established by a **control** (two rebuilds, no L16 code). Compare `sector_active_share` at a
  tolerance ≥1e-15: the noise is ≤2.8e-17 and real moves are 0.004pp median / 0.638pp max, thirteen
  orders of magnitude apart, so the separation must be *shown*, not asserted. The 4 `theme`
  `sort_priority` tie flips must be enumerated and shown **not to touch a sector cell**.

**Ruling G — the `build_style_rows` fix is ACCEPTED, not reverted.** It is a latent crash
(`ColumnNotFoundError` on a zero-COLUMN frame when no fund in the universe has a qualifying factor
fit), it changes no data semantics, and without it no `--series` sample build runs at all. Add a
regression test covering `_empty_style_rows` and flag it to codex as an in-diff out-of-scope fix.

**Ruling H — `cross_basis_sector_parity` STAYS a default gating check.** EDA hazard 5 is the reason:
the country axis has a permanent coherence tripwire and the sector axis has none, which is precisely
why this cross-basis split survived unnoticed. A check registered `default=False` is one nobody ever
turns on. It is already proven non-vacuous (35-fund sample: **FAIL exit 1, 51 pairs / 25 funds →
PASS exit 0**) and it gates on the **consensus scope only**, so the honest residual in Ruling J does
not make it fail forever. Red `make check` on an unmerged branch is the correct state until the write
lands — and if implement-full fails, red is the right answer.

**Ruling I — the coverage acceptance wording is REPLACED (EDA hazard 1, a real defect in this spec).**
"relabelled rows / 3,895" would score a correct 100%-coverage write as a **43% recoverable miss**.
Report **four separate denominators**: **reached 3,895/3,895 rows (100%) and 1,871/1,871 funds (100%)
· changed 1,664 rows / 1,166 funds · already-correct 2,231 · filled-from-null 0.** Coverage is
`reached`; `changed` is never the coverage numerator. Residual is zero, so nothing needs proving honest.

**Ruling J — acceptance #3 becomes "0 on the consensus scope", with residuals reported, never gated.**
A literal whole-book 0 is unachievable and the EDA says so. Two residuals with **distinct causes**,
and implement-full must **reconcile them into one authoritative statement** — the EDA's "1 pair (ROP)"
and the implementer's "11 pairs on 3 ISINs" are different scopes and both are currently in the record:
- **Rule abstention (honest):** 11 pairs on `US82452J1097` ×7, `MHY621321089` ×3, `JE00BPG99318` ×1 —
  their US-filed rows disagree with *each other*, which the owner-ruled L14 rule deliberately declines.
- **Identity defect (not this spec's):** `ROP` in `S000015906`, 0.081pp of that fund's passive NAV — a
  CH-domiciled line collapsed onto Roper's US ticker with the sector read off the Swiss ISIN. Same
  wrong-company-binding class as the recorded FMP foreign-sector collisions, and invisible to an
  ISIN-keyed rule. **File it to the existing `sector-identity-defect-recovery` spec** (already queued,
  priority 2) rather than a new backlog item — do NOT widen this spec.
State which parity definition every reported 0 was measured on.

**Ruling K — do NOT rebuild the three further-downstream consumers (EDA hazard 3).** Rebuilding them
reaches further canonical paths, which is this spec's own STOP trigger. Record the ordered staleness
with numbers in the run notes and file it as a **hard precondition on the F4 serving reload**:
`risk_decomposition` + `exposure_path_attribution` read the `vs_benchmark` sector `difference` through
`risk_model.select_candidates()` and gate on `SECTOR_TILT_FLOOR = 0.05` — **5 cells across 5 funds
cross that floor, so those funds gain or lose a sector regressor** (name the 5 `series_id`s);
`value_offering_payload` consumes `concentration::sector_active_share`, leaving **up to 1,155 funds**
on a stale value bounded by 0.64pp. None is user-visible while F4 holds; all must be rebuilt **in
dependency order before the reload**.

**Ruling L — report FIVE self-contradictory securities, not three (EDA hazard 4).** NIQ/PAGS/LION are
the only `security_id`s carrying two sectors, but **CMPR (`IE00BKYC3F77`) and STNG (`MHY7542C1306`)
each carry two different sectors ACROSS their two key forms** in the same book (Scorpio is Energy
under `STNG` and Industrials under its ISIN). Reporting three would let the two cross-key
contradictions pass inside an aggregate — the exact failure the spec's rule 3 exists to prevent.

**Ruling M — the co-rebuild bill is corrected.** Addendum 1's Ruling A estimated "3,583 cells / 485
funds order"; measured it is **2,623 cells / 1,155 funds** — understating funds ~2.4×. The measured
bill governs. Also confirmed by the EDA and carried forward: `return_attribution` is **not** owed a
rebuild (it reads sector from `cusip_reference` by ticker, a third basis that already agrees 14/14),
and `l14_classified_weight_regression.py` is **structurally blind here** — the relabel moves weight
between sectors and never in or out of "classified", so it must report 0 by construction. The positive
control is the per-fund cell diff.
