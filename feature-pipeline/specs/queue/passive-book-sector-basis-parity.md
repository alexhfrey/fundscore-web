---
id: passive-book-sector-basis-parity
title: Put the passive book on the same sector basis as the fund book — build the identity bridge, then relabel
status: queued
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
