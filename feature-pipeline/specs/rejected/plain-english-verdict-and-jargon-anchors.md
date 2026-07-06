---
id: plain-english-verdict-and-jargon-anchors
title: Add a plain-English verdict line and anchor the jargon for retail
status: queued
track: frontend
repo: fundscore-web
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/plain-english-verdict-and-jargon-anchors.md
created: 2026-06-24
scope: page
---

## Goal
On the `/funds/[ticker]` Value Offering hero, give a free reader (1) one plain-English **verdict
sentence** that nets the page's fee verdict against its skill + exposure verdict, and (2) inline
**anchors/translations** for the three jargon terms that currently carry the read but are unexplained
at the point of use: the Information Ratio, the "% of active risk that is stock-specific" figure, and
the bet profile (active share / effective positions vs the peer reference). This is a
copy/presentation change only — every input is already in the served payload.

## Context (critic evidence)
- Marketing + narrative flagged that the hero hedges to "Selection unproven" then resolves into a
  locked box, **never reconciling** to the page's own "Strong" Fee Fairness verdict. A free/anon
  reader gets a contradiction (Strong fee vs unproven selection) instead of a takeaway. See the
  anon capture `feature-pipeline/captures/fund_profile__FCNTX/text.txt` L33-34 (hero hedge) and
  L87-88 (Fee Fairness "Strong"), which sit far apart on the page and are never netted.
- Jargon is unexplained at use in the hero (`src/components/fund/profile/ValueOfferingHero.tsx`):
  - "Information ratio −0.12 after fees and passive exposures." (`vr.skill.ir`, L114-118) — no
    definition of what IR is or which direction is good.
  - "50% of its active risk is stock-specific; the rest is shared sector/theme risk."
    (`vr.replicability.idio_risk_share` 0.5008, L102-108) — no anchor for whether 50% is high or low
    for a stock-picker.
- The peer anchors the proposal calls for are **already in the served `exposure_xray` payload** but
  unshown. Verified against the staging row for FCNTX: the `exposure_xray.rows[]` array carries
  `concentration` rows with `holdings_baseline: "vs_peer"` / `baseline_ref: "peer_group"`:
  - `concentration::active_share` (vs_peer): `fund_exposure` 0.4968, `passive_exposure` 0.6711,
    `difference` −0.1743  → "active share 0.497 vs peer 0.671".
  - `concentration::effective_positions` (vs_peer): `fund_exposure` 17.70, `passive_exposure`
    29.41, `difference` −11.70 → "effective positions 17.7 vs 29.4".
  These match the proposal's cited numbers exactly. **No new data and no backend work is required.**

Why it fits the product: retail-first comprehension is the north star, the verdict nets data we
already serve, and the anchors are definitional — no new claim, no forecast, no overclaiming.

## Solution
Two presentational additions, both inside the **public** Value Offering hero
(`gates.value_offering_reframed === "public"`, confirmed for FCNTX/FBGRX/DODGX/VDIGX/VOO), plus a
small read of the already-`free`-gated `exposure_xray` peer rows for the bet-profile anchor.

### A. Verdict line (free, public)
Add one synthesized sentence under the badge/axis cards in `ValueOfferingHero.tsx`, rendered **only
when `vr.status === "scored"`** (passive/`unsupported` funds keep the existing `UnscoredHero` path).
It nets three already-served, public facts into a single retail takeaway:
- Fee verdict: `fee_fairness_label` (top-level fact column, public) + `vr.fee.active_fee_bps`
  (the bps premium over indexing).
- Skill verdict: `vr.skill_band` (`strong` | `moderate` | `limited` | `unproven`).
- Bet verdict: `vr.bet_tag` (e.g. "underweight technology").

Compose deterministically from those fields (no free text from data). Example assembled tone for
FCNTX: *"Cheap for an active fund — but you pay a 36 bps premium over indexing that only pays off if
the stock-picking does, and right now the selection is unproven."* The "36 bps" there is the rounded
display of FCNTX's served `active_fee_bps` (35.5 → `Math.round` → 36); the helper must **derive the
bps clause from `Math.round(active_fee_bps)` (or reuse `fmtBps`), never a hard-coded constant**, so
the netting sentence stays true for every fund (FBGRX = 97, DODGX = 46, VDIGX = 22). Drive the clause
choices off `skill_band` (proven-edge vs unproven vs costs-more) and the sign/size of `active_fee_bps`,
and off `fee_fairness_label` for the "cheap / fairly priced / expensive for an active fund" clause.
Keep it to one sentence; this is distinct from `theTake.assembled_text` (which already renders below
it) —
the verdict line is the **netting** sentence, The Take is the synthesis paragraph. If The Take
already says essentially the same thing for a given fund, prefer not to duplicate: render the verdict
line above The Take and let The Take elaborate.

Put the composition in a small pure, exported, side-effect-free helper (e.g.
`composeVerdictLine(vr, feeFairnessLabel)` in `src/lib/serving/format.ts`, returning `string | null`)
so it is independently verifiable (the repo has no JS unit-test runner — verify via render-capture or
a throwaway `node`/`tsx` import, see Test plan) and returns `null` when any required field is missing
(then render nothing — never a guessed sentence). Pass
`fee_fairness_label` into the hero from `page.tsx` (it is the top-level `fundProfileFacts` Drizzle
column `row.feeFairnessLabel` (Postgres `fee_fairness_label`); not currently passed to the hero).

### B. Jargon anchors (translations) in the hero
In the two `AxisCard`s already in `ValueOfferingHero.tsx`:
- **Selection-evidence card** (IR): append a one-clause translation, e.g. "Information ratio −0.12 —
  the return the manager added per unit of active risk, after fees; **below zero means the active
  bets have not paid off** so far." Keep the number; add the plain meaning + direction anchor.
- **What-kind-of-bet card** (`idio_risk_share`): anchor the 50% figure, e.g. "50% of its active risk
  is stock-specific … — **about half from individual stock picks, half from sector/theme tilts**
  (a balanced mix for an active manager)." Phrase the anchor as a neutral reference, not a grade.

### C. Bet-profile peer anchor (free, from exposure_xray vs_peer rows)
Surface the two peer-relative concentration stats the proposal calls for. Because the underlying rows
live in `exposure_xray` (gated `free`), this anchor renders for **free+ users only**; for anon it is
either omitted or shown as the existing free-account affordance — do **not** read `exposure_xray`
into the public hero (that would leak a free-gated section to anon). Two acceptable placements,
implementer's choice. **C.2 is recommended as lowest-risk** because it sidesteps the existing
`concentration::*::vs_peer` mis-render in the main table (see C.1 correction below); C.1 is acceptable
but requires fixing that latent bug as part of this work:
  1. **In Exposure X-Ray** (`ExposureXray.tsx`): render the `holdings_baseline === "vs_peer"`
     `concentration` rows (`active_share`, `effective_positions`) as a short "How concentrated vs
     peers" readout with the fund value, the peer value, and a plain anchor ("0.497 active share vs
     0.671 for the average peer — it makes **fewer distinct bets** than its peers"). **Correction to
     the component's current behavior**: `ExposureXray.tsx` does **not** filter by baseline — its sort
     (lines 66-84) ranks ALL rows by `abs(difference ?? fund_exposure)` with no `holdings_baseline`
     filter, so it already renders `vs_peer` and absolute `concentration` rows mixed into the main
     table. Worse, `concentration::effective_positions::vs_peer` carries `difference = −11.70` (a raw
     **count** delta, not a weight fraction), and `DiffPill` (lines 155-169) computes `pp = diff * 100`
     → `fmtPP(−1170)` → it currently renders a garbage **"−1170.0 pp"** as a top FCNTX row. The local
     `XrayRow` interface (lines 16-30) also has no `holdings_baseline`/`baseline_ref` field, so the
     component cannot distinguish baselines today. Therefore, if placement C.1 is chosen, the
     implementer **must**: (a) extend `XrayRow` with `holdings_baseline` and `baseline_ref` (already in
     the JSONB payload, just untyped), (b) **EXCLUDE `concentration` rows (or specifically `vs_peer`
     concentration rows) from the main difference table** so the count-vs-percentage data is not
     double-shown and the "−1170 pp" mis-render is removed, and (c) render those excluded `vs_peer`
     concentration values **only** in the dedicated peer-anchor block, formatting `effective_positions`
     as a plain count (17.7 vs 29.4) and `active_share` as a ratio (0.497 vs 0.671), never as `pp`. The
     latent "−1170 pp" bug is **in scope** for C.1 — fix it, do not leave it in place.
  2. **In the hero**, only for free+ (guard on the section not being a `Locked` marker), as a third
     muted line under the bet card.
The two values + delta are exactly: active share 0.497 vs 0.671 (Δ −0.174); effective positions 17.7
vs 29.4 (Δ −11.7). Read them by `row_id` (`concentration::active_share::vs_peer`,
`concentration::effective_positions::vs_peer`) or by `(exposure_id, holdings_baseline === "vs_peer")`.

### States
- **Scored active fund** (FCNTX/FBGRX/DODGX/VDIGX): verdict line + both anchors render.
- **Passive/index** (VOO/FXAIX): `vr.status === "unsupported"`, skill/fee/bet all null → render the
  existing `UnscoredHero` message; **no verdict line**, no IR/idio anchors. The vs_peer concentration
  rows may still exist (VOO has 2) but the bet-profile verdict framing does not apply — suppress.
- **Building / partial** (`vr.status === "building"` or `skill_band == null`): no verdict line; keep
  the building-track-record message. Note: **no row in the current staging data has
  `status === "building"`** (distribution is `scored` 3845 / `unsupported` 1705 / unscored-null 3106).
  This branch is therefore not exercisable today, but the verdict-line suppression for it is covered
  transitively by the `status !== "scored"` guard — so it is safe and needs no separate handling. The
  existing `UnscoredHero` already covers `status === "building" || skill_band === null`
  (`ValueOfferingHero.tsx` ~L200-203); do not build new building-specific UI.
- **Missing fields**: `composeVerdictLine` returns `null` → render nothing (no fabricated sentence).
  If `exposure_xray` is a `{locked}` marker (anon) → omit the peer anchor / show the free affordance.

### Tier gating
- The verdict line + IR/idio anchors use **public** hero fields → ship to anon/free. Safe.
- `value_index` (0-100) stays paid-locked — unchanged; the verdict line must **not** reference or
  imply the numeric index.
- The peer-concentration anchor reads `exposure_xray` (gated `free`) → must render only when that
  section is not a `Locked` marker for the current user. Never read `exposure_xray` fields into the
  public hero path. No change to `applyGates`.

## Files to touch
- `src/components/fund/profile/ValueOfferingHero.tsx` — verdict line (scored-only) + IR/idio anchors
  in the two `AxisCard`s.
- `src/lib/serving/format.ts` — `composeVerdictLine(vr, feeFairnessLabel)` pure helper; optionally a
  small `betProfilePeerAnchor(xrayRows)` helper that returns the two `vs_peer` concentration values.
- `src/app/funds/[ticker]/page.tsx` — pass `row.feeFairnessLabel` into `<ValueOfferingHero>` (new
  prop); no gating change.
- `src/components/fund/profile/ExposureXray.tsx` — (if placement C.1) render the `vs_peer`
  concentration peer-anchor block; extend the local `XrayRow` interface with `holdings_baseline` and
  `baseline_ref` (already present in the JSONB payload, just not typed); **and EXCLUDE `concentration`
  `vs_peer` rows from the main difference table** so they are not double-shown and the existing
  `effective_positions::vs_peer` "−1170 pp" mis-render (count delta run through `DiffPill`'s
  `diff * 100`) is removed. Format `effective_positions` as a plain count and `active_share` as a
  ratio in the peer block — never as `pp`. (Placement C.2 avoids touching this file.)
- `src/components/fund/profile/ValueOfferingHero.tsx` prop type for `fee_fairness_label`.

## Data dependencies (all already served — no blocker)
From `fund_profile_facts` (Drizzle camelCase columns; nested keys snake_case):
- `valueOfferingReframed.status`, `.skill_band`, `.bet_tag` (public)
- `valueOfferingReframed.skill.ir` (public)
- `valueOfferingReframed.replicability.idio_risk_share` (public)
- `valueOfferingReframed.fee.active_fee_bps` (public)
- `fee_fairness_label` (top-level fact column; public)
- `exposureXray.rows[]` where `exposure_type === "concentration"` and `holdings_baseline ===
  "vs_peer"` — fields `fund_exposure`, `passive_exposure` (= the peer value), `difference`,
  `exposure_name` (gated `free`)

No missing field. No backend prerequisite. Verified against
`/Users/alexfrey/Projects/fund_score/data/product/fund_profiles/serving_facts_staging.parquet`
for FCNTX, FBGRX, DODGX, VDIGX, VOO, FXAIX.

## Acceptance criteria
- `npm run build` and `npm run lint` pass.
- FCNTX (free or paid) hero shows: a one-sentence verdict that names the fee premium (36 bps),
  references the unproven selection, and reads as a single takeaway (no internal contradiction);
  the IR axis line includes a direction anchor (below-zero meaning); the idio line includes a
  high/low anchor; the bet-profile peer anchor shows 0.497 vs 0.671 active share and 17.7 vs 29.4
  effective positions, each traceable to its `vs_peer` row.
- VOO and FXAIX (passive) show **no** verdict line and **no** IR/idio anchors — the existing
  unsupported/passive message only.
- A `skill_band === "strong"` fund (DODGX) produces a verdict line whose skill clause reflects the
  proven edge (not "unproven"); FBGRX (Weak fee, strong skill, sector/theme bet) produces a verdict
  that nets the expensive fee against the proven-but-theme-driven read — no clause is hard-coded to
  FCNTX's case.
- **No gated-data leak**: anon receives no `exposure_xray` field values and no `value_index`; the
  verdict line text contains no 0-100 number. Confirm by fetching the page as anon and grepping the
  HTML with a precise allow/deny list:
  - **MUST BE ABSENT** for anon: the two peer-anchor values (`0.497`, `0.671`, `17.7`, `29.4` — the
    `exposure_xray` `vs_peer` numbers) and any 0-100 `value_index`.
  - **PRESENT / allowed** for anon (do **not** flag these as a leak): the fee premium `36 bps`
    (`vr.fee.active_fee_bps` is on the **public** hero and is intentionally shown), the IR anchor, and
    the idio-share anchor — all composed only from public hero fields. The verdict line is built from
    `skill_band` / `fee_fairness_label` / sign of `active_fee_bps`, none of which is a 0-100 index, so
    the only real leak vector is the peer-anchor numbers.
- Every number rendered traces to a served fact field — no fabricated values, no `~`/placeholder.
- **(If placement C.1)** The main Exposure X-Ray difference table no longer renders any
  `concentration::*::vs_peer` row, so the FCNTX "−1170.0 pp" effective-positions mis-render is gone;
  those values appear only in the dedicated peer-anchor block, formatted as a count (17.7 vs 29.4) and
  a ratio (0.497 vs 0.671), never as `pp`. Confirm by capturing FCNTX's X-Ray and grepping the HTML
  for `-1170` / `−1170.5 pp` (must be absent — the served `effective_positions::vs_peer` difference is
  −11.7046, so `fmtPP(diff * 100, 1)` would render `−1170.5 pp` if the row leaked into the table).

## Test plan
**Verification convention**: this repo has **no JS unit-test runner** — `package.json` has only
`dev/build/start/lint/db:*` scripts, no `vitest`/`jest` dependency, and no `*.test.ts` files. Prior
frontend tracks verified via **render-capture + the anon/free/paid HTTP matrix** (see
`feature-pipeline/captures/fund_profile__FCNTX/`). Do **not** assume `npm test`; do not add a test
framework for this spec. Verify `composeVerdictLine` through render-captures, not a unit runner.
- **`composeVerdictLine` behavior** validated across these served rows via the render-capture matrix
  (the helper's output is what the hero prints, so capturing the hero exercises it):
  scored-unproven (FCNTX), scored-strong-cheap (DODGX), scored-strong-expensive (FBGRX),
  passive/unsupported (VOO → helper returns `null` → no verdict line rendered). For the
  missing-`active_fee_bps` → `null` path, since no current seed row has a null `active_fee_bps` on a
  scored fund, assert it via a throwaway `node`/`tsx` snippet that imports the pure helper and checks
  it returns `null` (the helper is exported and side-effect-free) — or, if no `tsx` is available,
  reason it through the code path and note it. Do not stand up a test framework just for this.
- Render-capture the hero for: **FCNTX** (scored, unproven, the proposal's exemplar),
  **DODGX** (stock-picking edge), **FBGRX** (sector/theme bet, Weak fee), and **VOO** (passive,
  partial-data edge — must suppress the verdict + anchors). No `building`-status fund exists in the
  current staging data (status distribution is `scored` / `unsupported` only — see States note), so
  there is no `building` capture to take; the `status !== "scored"` guard covers it transitively.
  Confirm the rendered peer numbers equal the served `vs_peer` row values.
- Anon vs free vs paid matrix on FCNTX: verdict line + IR/idio anchors present in all three; peer
  anchor present for free/paid, absent (or free-affordance) for anon; `value_index` only paid.

## Out of scope
- Removing the legacy 0-100 score / headline-verdict reconciliation (a separate approved proposal).
- Any new metric, new peer benchmark, or any backend/serving change — the data exists and is served.
- Re-wording The Take or changing `theTake.assembled_text` assembly.

## Risks
- **Duplication with The Take**: the verdict line and `theTake.assembled_text` can overlap. Mitigate
  by making the verdict line the short netting sentence and letting The Take elaborate; review on
  3-4 funds that the two read as complementary, not repetitive.
- **Tone hard-coding**: easy to write a sentence that only makes sense for FCNTX's unproven-but-cheap
  case. Drive every clause off `skill_band` / `fee_fairness_label` / sign of `active_fee_bps` and
  test the strong-edge and expensive cases so the verdict stays true across funds.
- **Gating slip**: the peer anchor reads a `free`-gated section — guard against rendering it for anon
  (would leak `exposure_xray` values). Keep it out of the public hero path.

---

## RETIRED — superseded (2026-07-03)

Implemented in commit `000878b` (composeVerdictLine + two jargon anchors + Exposure X-Ray peer
anchor), then **orphaned** by commit `99ac335` which replaced `ValueOfferingHero` (the host of the
verdict line + jargon anchors) with `ValueScoreHero` (breakeven_state / value_bps framing).
`src/components/fund/profile/index.ts` marks `ValueOfferingHero` as `// legacy badge hero (retired
from the page)` and `page.tsx` no longer imports it — so the verdict-line/jargon-anchor deliverables
are dead code on the production render path. Owner decision: **retire as superseded** by ValueScoreHero.
The Exposure X-Ray peer-anchor readout (the 3rd deliverable) survived the swap and remains live.
