# F3 — Recent Changes flip (movement-01 "biggest recent move" posline)

**Branch:** `f3/recent-changes-flip` (off `night/drain-2026-08-25` @ b071a27) · not pushed
**Spec:** `feature-pipeline/specs/queue/profile-v2-production-cutover.md` §01 poslines (lines 200-202)
**Serving:** `serving_manifest` id=58, active, `src_inv_v0_20260731`, 5,819 fact rows, built 2026-08-25T23:39Z
**Gates:** lint 0 errors · build exit 0 (resolved `127.0.0.1:54322/postgres`) · gating-golden all pass · db:check-serving PASS

---

## 1. COVERAGE — lead with it

Recomputed with the EXACT predicate the shipped code uses (`eligibleShift` in `derive.ts`), so
the table and the render agree by construction:

| Population | Funds | % of 5,819 |
|---|---:|---:|
| Total served funds | 5,819 | 100.0% |
| `positioning_changes` non-null | 3,244 | 55.7% |
| **Posline renders a move** | **3,037** | **52.2%** |
| &nbsp;&nbsp;— of which say "**Biggest** recent move" (served `te_rank` 1) | 2,846 | 48.9% |
| &nbsp;&nbsp;— of which say "A recent move that mattered" (served best rank ≥ 2) | 191 | 3.3% |
| Honest absence — no `positioning_changes` section at all | 2,575 | 44.3% |
| Honest absence — rows served, none carries a TE estimate | 207 | 3.6% |

3,037 + 207 + 2,575 = 5,819. **The remainder is honest-missing, not a read-path defect:**

- **The 207** serve only `concentration` (Active Share / Effective Positions) and `cash` rows.
  The backend serves `te_impact_bps: null` for those types ON PURPOSE — `specs/done/
  recent-changes-te-ranked.md` line 50, *"no TE mapping in v1 ... don't force a fake common
  scale"*. There is no significance ranking to render, and a magnitude-ranked posline is exactly
  what the spec forbids. They get the reason instead.
- **The 2,575** have no section. The payload carries no reason code for a fund that is absent
  entirely, so the copy states only what is known (a year-over-year comparison is not served),
  the same discipline movement 03 uses.
- **Dual as-of stamps cost zero coverage.** Measured: 0 served rows are missing either stamp,
  so the mandatory-stamp guard is drift protection, not a live filter.

### Significance ranking is not cosmetic — measured
Of the 3,037 eligible funds, the TE-ranked top change is **NOT** the largest change by raw size in
**1,787 funds (58.8%)**. FCNTX: TE-top is `META −6.01pp`; the loudest is `Financial Services
−7.73pp`. Magnitude-ranked prose would name the wrong move for the majority of funds. Where the two
disagree the loudest change is now named in the posline as well, so the claim can be checked.

---

## 2. What was built

| File | Change |
|---|---|
| `src/lib/serving/gating.ts` | **Gate-integrity fix** (see §3.1) + `ShiftPreview` gains `te_rank`, `prior_value`, `current_value`; `pickTopShift` fills them. Sort key unchanged. |
| `src/components/fund/profile/v4/derive.ts` | New `buildRecentMove()` + `RecentMove` / `RecentMoveView` types + `eligibleShift()`. Pure; imports `isLocked`/`getPreview` from `gating` (db-free) not `profile`. |
| `src/components/fund/profile/v4/M01WhatIsIt.tsx` | New `RecentMovePosLine` replaces the hold-back copy; `positioningChanges` prop threaded. |
| `src/app/(site)/preview/funds/[ticker]/page.tsx` | Reads `row.positioningChanges` (still gated, deliberately) and passes it to `M01WhatIsIt`. |
| `src/lib/methodology/registry.ts` | Corrected the stale `asOf`; corrected the exposure-family list; documented the TE ranking + the concentration/cash limitation. |
| `scripts/test/gating-golden.ts` | FCNTX `positioningChanges` fixture (3 real rows) + 12 assertions incl. the fail-closed tripwire. |

**Not built, per the scope correction:** no Recent Changes section, no new movement, no client
island. `v2/RecentChanges.tsx`, `v2/RecentChangesTable.tsx` and `crescent/AnatomySection.tsx` were
**not touched** — verified dead (exported from the v2 barrel, rendered by no route).

### Copy as shipped (FCNTX, all three tiers)
> **Biggest recent move:** META — 16.3% of the portfolio in holdings filed 31 Mar 2025, 10.3% in
> holdings filed 31 Mar 2026. Ranked by its estimated effect on the fund's risk rather than by the
> size of the change; the biggest change by size was Financial Services. *How we calculate this →*

---

## 3. Defects found and fixed

### 3.1 `gating.ts` — `positioning_changes` failed OPEN (fixed, in scope)
The entry carried no `defaultGate`, so `applyGates` fell through to `?? "public"`. A load that
dropped the `gates.positioning_changes` key would have published the **full ranked change list to
anonymous clients**. Fixed to `defaultGate: "free"` (matching the two neighbours) and covered by a
golden assertion.

**Proved non-vacuous.** With the fix reverted, the golden test FAILS exactly where it should:
```
FAIL positioning_changes with MISSING gate key fails CLOSED for anon (default free)
FAIL positioning_changes with MISSING gate key leaks no ranked rows to anon
```
and passes with it restored. The gate is live-correct today (all 5,819 rows carry
`gates.positioning_changes = "free"`), so this is drift protection — the same class that bit before.

### 3.2 `registry.ts` — the `asOf` string was wrong in both halves (fixed)
Was: *"Current holdings 2026-04-30 versus the prior qualifying filing (as early as 2024-01-31)."*
Measured against manifest 58:
- **2026-04-30 is the panel's EVALUATION date, not any fund's holdings date.** Only 978 of 3,244
  funds file that late; the modal date is 2026-03-31 (1,632 funds). Served range: 2026-01-30 →
  2026-04-30.
- **No served prior stamp is earlier than 2025-01-31**, not 2024-01-31. Served range: 2025-01-31 →
  2025-05-31, and the gap is 365 days for 97.5% of rows — it is a year-over-year comparison,
  not open-ended.

### 3.3 `registry.ts` — fixture-era exposure families in the methodology copy (fixed)
`measures`/`method` claimed **six** families including **region** and **style**. Served
`change_type` is exactly `{position, sector, theme, concentration, cash}` — **five**, with zero
`region` rows and zero `style` rows (the owner's style exclusion holds; nothing to report there).
Corrected, and the TE ranking + the concentration/cash "no risk scale" limitation added, since the
posline now links here (protocol step 3).

### 3.4 A bug in my own first cut, caught by rendering (fixed before commit)
`eligibleShift` initially required `te_impact_bps != null`. That field is deliberately NOT in the
`ShiftPreview` whitelist, so **every anonymous fund failed closed** and got the reason instead of
the free proof point. `te_rank` alone is the correct test — the backend assigns it only to rows
carrying a TE estimate, and the two agree exactly (1,913 rows null on each, same 1,913). Caught by
rendering the real page at `?tier=anonymous`, not by the type checker.

---

## 4. Decisions taken (owner triage tiers)

| # | Tier | Decision |
|---|---|---|
| D1 | (b) | **Do not print `te_impact_bps`.** It is a STANDALONE estimate (`\|Δw\| × σ`); the `te_alloc_bps` figures inches away in the same card are ALLOCATIONS of total TE. Printing both invites the standalone-vs-allocation conflation M01's own header exists to prevent. The ranking basis is stated in words instead, with "estimated" in it as the backend spec's guardrail requires. Reversible if the owner wants the number. |
| D2 | (b) | **Branch the label on `te_rank === 1`.** `te_rank` ranks all TE-estimated CANDIDATE rows while the panel surfaces a subset, so 191 funds have a served best of rank 2+ — a bigger priced change exists that the panel does not carry, and calling the served one "the biggest" would be false. Those get "A recent move that mattered" plus an explicit "changes that scored higher are not shown". Same discipline as `top_bet_confident`. No invented threshold. |
| D3 | (b) | **Widen `ShiftPreview` by three fields (`te_rank`, `prior_value`, `current_value`); leave `pickTopShift`'s sort key alone.** Measured: `surfaced_rank = 1` IS the min-`te_rank` row for all 3,037 eligible funds (0 disagreements), so the projector already returns the significance-ranked row — it just could not TELL the consumer which case it was in. Carrying `te_rank` lets the posline fail closed on the 207 without changing what any existing consumer picks. Legacy `/funds/[ticker]` behaviour is byte-unchanged. |
| D4 | (b) | **Pass the section to M01 still gated.** A `free` gate has three outcomes and only the gated value distinguishes them; `unlocked<T>()` would flatten the locked-with-preview case to null and silently drop the free proof point. `buildRecentMove` reads the marker and never reaches past it. |
| D5 | (a) | **Name the loudest change when it differs from the ranked one**, restricted to priced (`te_rank` non-null, `value_unit === "pp"`) rows so the comparison stays on one scale — comparing a weight change against an Active Share or cash row would be the cross-type fake commensurability the backend spec forbids. Anon does not get this clause (one row only); it is a subtraction, not a different claim. |
| D6 | (a) | **`persistence_state` not rendered** (`single_quarter` / `sustained` / `reversing`). Real signal, but it needs its own vocabulary and is not in the spec's posline. Noted as a cheap follow-on. |

**Parked (tier c) — nothing:** no product call blocked any part of this.

---

## 5. Verification

### 5.1 Rendered vs DB, 8 funds across all 3 tiers (dev server, real serving row)
| Fund | Case | Rendered | DB | ✓ |
|---|---|---|---|---|
| FCNTX | many rows (8), rank 1 | META 16.3% → 10.3%, 31 Mar 2025 → 31 Mar 2026; loudest = Financial Services | prior 16.29739258221, cur 10.28753354151, mag −6.0099 vs FS −7.7307 | ✓ |
| AAIPX | **one** row, rank 3 | "A recent move that mattered: its Financial Services sector — 17.2% → 23.1%", 30 Apr 2025 → 30 Apr 2026, no size clause | prior 17.185751146062, cur 23.086050434731, te_rank 3, size-top = same row | ✓ |
| AAAAX | rank 2 (softened) | "its Real Estate sector — 32.7% → 27.2%" + "changes that scored higher are not shown" | prior 32.70735502095, cur 27.184305255184, te_rank 2 | ✓ |
| DMCVX | `entered`, prior null, **`change_z` null path** | "RKT — no weight in holdings filed 28 Feb 2025, 1.9% of the portfolio in holdings filed 28 Feb 2026"; loudest = BURL | prior null, cur 1.92638, size-top BURL −2.31196 | ✓ |
| CDGCX | `exited`, current null, **`change_z` null path** | "CNQ — 1.4% of the portfolio … , no weight in …"; loudest = ROST | prior 1.354053494611, cur null, size-top ROST 1.524349 | ✓ |
| VOO | passive, **no section** | "…that comparison is not served for this fund…" identically at anon/free/paid | `positioning_changes` NULL | ✓ |
| FAEQX | **no section** | same honest absence | `positioning_changes` NULL | ✓ |
| MPMCX / PAEAX | **rows but unpriced** (the 207) | "…none of the served changes carries a risk-impact estimate…" identically at all tiers | only `concentration` rows, `te_rank` null | ✓ |

No rounding drift: every displayed figure is `served.toFixed(1)`.

**PAEAX is worth naming.** Its `surfaced_rank = 1` row is `Effective Positions 67.4 → 50.5` — the
exact quantity L10 proved is computed on the wrong book and that `buildConcentration` refuses to
render. The `te_rank` guard excludes it **by construction**, so the posline cannot resurrect a
figure the page deliberately withholds a few lines above.

### 5.2 Tier-leak grep (context-checked, not a bare term grep)
Searched the anon HTML for 15 markers that exist ONLY inside `positioning_changes` — field names
(`surfaced_rank`, `te_impact_bps`, `te_impact_basis`, `persistence_state`, `change_z`,
`filing_lag_days`, `lookthrough_coverage`), change_ids (`position::BRK.A`,
`theme::ai_infrastructure`), the basis label `delta_weight_x_factor_vol`, and the full-precision
`te_impact_bps` / `prior_value` of rows 2, 3, 5, 6 and 7. **Result: zero present at anonymous,
free or paid.** `grep -c surfaced_rank` = 0 in all three tiers. The one row anon holds is the
whitelisted proof point (META), exactly as designed.

Note for the record: the whitelist grew by three fields, so `prior_value` (full precision) now
crosses the anon boundary for that single row. `change_magnitude` was already there and
`current = prior + magnitude`, so `prior_value` is the only genuine increment — one weight for a
position the proof point already names, inside a `free`-gated section.

### 5.3 Golden test — 12 new assertions, all pass
Locked-for-anon; locks at `free`; the proof point is META **not** Financial Services (a magnitude
sort would pick the latter — the fixture is deliberately non-degenerate); `te_rank` present; both
as-of stamps present; prior/current present; the other two rows do not cross the gate; full list
opens for free; and the three missing-gate-key fail-closed assertions.

---

## 6. Dispatcher item 4(b) — the FAEQX wrong-name exposure: **NOT LIVE**

`backlog.md:40` records FAEQX's rank-1 row rendering "MFUS entered +2.31pp" for a position filed as
*PIMCO RAE US Small Fund*. Under manifest 58 that row is gone:

- `FAEQX` (`S000059561`) has `positioning_changes = NULL` — no rows at all, so it renders honest
  absence and the posline surfaces nothing for it.
- **`MFUS` appears as a `change_name` in ZERO rows across all 3,244 served funds.**

So this flip does not expose the wrong-binding defect. The backlog item is still worth keeping
open against `cusip_reference` generally, but its named instance is not reachable from this page
today. I did not special-case anything.

---

## 7. Left in place, reported not fixed (out of scope)

1. **`v2/RecentChanges.tsx` ranks by magnitude and says so.** Line ~56 sorts on
   `Math.abs(change_magnitude)` and the takeaway reads *"The biggest year-over-year move: …"* —
   the precise pattern the spec forbids. Its panel note still says *"Ranking by tracking-error
   impact is in development"*, which is now false. **Dead code** (no route renders it), but a
   revival would ship the defect. Recommend deleting it at route cutover with the rest of the v2
   layout.
2. **`v2/RecentChangesTable.tsx`** is typed on the fixture `RecentChangeRow` and its `dirChip()`
   only colours `cut` / `trimmed` / `down` — none of which are served directions
   (`entered|exited|increased|decreased`). Fixture-era; same recommendation.
3. **`recentChangesTe` fixture** (`src/lib/fixtures/profile-v2-fcntx.ts:46`) is already unreachable:
   its only loader `overlayV2Fixtures` has **zero callers**. Protocol step 4 is effectively
   satisfied for the V4 graph; deleting the module belongs to the cutover item, which already
   lists it under "Die at cutover".
4. **Legacy `/funds/[ticker]` anon proof point** still labels the `surfaced_rank = 1` row "Biggest
   recent portfolio shift" for the 207 unpriced funds. Pre-existing, unchanged by this work
   (D3 deliberately left the sort key alone), and it dies at route cutover.
5. **`persistence_state`** not surfaced (D6).

---

## 8. Acceptance criteria walked (the §01 posline clause)

| Criterion | Result |
|---|---|
| Posline renders from the top TE-ranked change | **PASS** — `buildRecentMove` sorts on served `te_rank`, verified on 8 funds |
| Significance-ranked, not magnitude-ranked prose pretending to be | **PASS** — fails closed on null `te_rank`; the label is conditioned on rank 1; the loudest change is named separately where it differs |
| Rendered entirely from served data, no fixture | **PASS** — every figure traced to `fund_profile_facts.positioning_changes`; fixture graph unreachable |
| `applyGates` OWNS the section, fail-closed | **PASS** — `defaultGate: "free"` added; tripwire proved non-vacuous |
| Dual as-of stamps | **PASS** — both rendered on every branch; a row missing either is refused |
| Methodology anchor exists and is linked | **PASS** — `/methodology#positioning-changes` renders; posline links it |
| Honest absence for funds without data | **PASS** — 2,782 funds, tier-invariant, no placeholder, no invented reason |
| `npm run lint` | **PASS** — 0 errors (1 pre-existing warning in `.claude/workflows/implement-backend-spec.js`, not mine) |
| `npm run build` | **PASS** — exit 0, resolved `127.0.0.1:54322/postgres` |
| `db:check-serving` | **PASS** — no mirror change made |
| Golden gating test | **PASS** — all assertions, 12 new |

**Codex NOT run** — the dispatcher owns that gate. **Nothing pushed.**
