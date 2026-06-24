---
id: free-proof-point-per-gated-section
title: Surface one free proof point per gated section instead of paywalling the whole basis
status: queued
track: frontend
repo: fundscore-web
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/free-proof-point-per-gated-section.md
created: 2026-06-24
scope: page
---

## Goal
On `/funds/[ticker]`, stop hiding the entire basis behind a tier gate. The four gated lower-page
sections (Exposure X-Ray; Risk & Attribution; Selection Evidence — which splits into three
independently-gated sub-cards: skill/Manager Moves, Return Attribution, Portfolio Shifts;
Alternatives) expose **six proof-point surfaces**. For each surface, surface **one concrete,
already-computed proof point for free**, then gate the full breakdown. Collapse the wall of
near-identical locked boxes so the lower page has a second focal point and a single clear unlock path
instead of six repeated CTAs in ~1.5 scrolls. (Six proof-point surfaces = the six `PREVIEW_PROJECTORS`
entries below; that registry is the source of truth, not the section count.)

The deliverable is: a free/anon reader sees the headline number that justifies the hero verdict
(e.g. FCNTX: "tech 27.9pp underweight vs its passive blend", "P(skill) ~4%", "IR −0.12 over ~17yr",
"top detractor −627 bps"), and is invited to unlock the depth — rather than being asked to trust a
damning "Selection unproven" call with its entire evidence base withheld.

## Context (critic evidence)
Three critics (marketing, design, narrative) flag the same failure on the FCNTX profile:
- The free hero resolves to a negative verdict ("Selection unproven") plus a locked 0–100 box
  (`text.txt` L33-34), so the headline deliverable is withheld.
- Every section that would let a reader verify the verdict collapses to a CTA:
  `text.txt` L109/L112/L118 "Create a free account to view"; L119/L123 "Upgrade to view" — three
  sign-up CTAs and two upgrade CTAs (plus the hero's paid 0-100 unlock) inside ~1.5 scrolls.
- Design: four near-identical lavender locked boxes (`LockedNotice` in
  `src/components/fund/profile/primitives.tsx:76-95`) flatten the lower page into one long paywall
  with no focal point after the hero; the section list is a flat equal-weight stack
  (`src/app/funds/[ticker]/page.tsx:116-137`).

**Data finding (verified, not assumed):** every cited proof point already exists in the served
payload. Confirmed against
`/Users/alexfrey/Projects/fund_score/data/product/fund_profiles/serving_facts_staging.parquet`
(the source of `fund_profile_facts`) for FCNTX:
- `exposure_xray.rows` → `technology` sector `difference = -0.2792` (27.9pp underweight vs passive).
- `return_attribution.rows` → 3Y top stock detractor `BROADCOM INC = -627 bps`; 5Y top detractor
  `SALESFORCE INC = -359 bps` (the proposal's −359 figure is the 5Y detractor).
- `manager_parent.skill_evidence` → `p_skill = 0.0418`, `alpha_ir = -0.1241`, `t_years = 17.38`.
- `value_offering_reframed.skill` → same `ir`/`p_positive_skill`; `badge = "Selection unproven"`.

**This is NOT purely a CSS change.** The blocker is the *gating mechanism*, not the data. Gating runs
server-side in `applyGates()` (`src/lib/serving/profile.ts:295-375`): when a section's gate exceeds
the user's tier, the **entire section object is replaced with `{ locked: <tier> }`**, so the proof
point never reaches the client for gated sections. To show a free proof point we must change
`applyGates` to preserve a small, explicitly-whitelisted **preview subset** per gated section instead
of nuking the whole section — while still stripping the full detail. No fund_score / backend change is
required; the data is already served.

Section gates (verified from FCNTX `gates` JSONB):
| Section (component)                | Drizzle col / gate key                | Gate   | Free user sees today        |
|------------------------------------|----------------------------------------|--------|-----------------------------|
| Exposure X-Ray                     | `exposureXray` / `exposure_xray`       | free   | anon: locked; free: full    |
| Risk & Attribution (section)       | `riskAttribution` / `risk_attribution` | free   | anon: locked; free: full    |
| Risk & Attribution → attribution   | inner `active_return_attribution`      | paid   | free: locked                |
| Selection: skill + Manager Moves   | `managerParent` / `manager_parent`     | free   | anon: locked; free: full    |
| Selection: Return Attribution      | `returnAttribution` / `return_attribution` | paid | free: locked              |
| Selection: Portfolio Shifts        | `positioningChanges` / `positioning_changes` | free | anon: locked; free: full |
| Alternatives                       | `alternatives` / `alternatives`        | paid   | free: locked                |

So the wall is hit at two boundaries: **anon→free** (Exposure X-Ray, Risk & Attribution,
manager_parent, positioning_changes) and **free→paid** (Return Attribution, Alternatives, inner
active_return_attribution). The redesign must produce a free proof point at *both* boundaries.

## Solution

### A. Preview-subset gating (server-side, `src/lib/serving/profile.ts`)
Replace the all-or-nothing section lock with a **preview projection**. Today `applyGates` does
`o[col] = { locked: gate }` whenever `rank < GATE_RANK[gate]`. Change it so that for the sections in
scope, instead of overwriting the whole section it builds a `{ preview, locked }` shape:
- `preview`: a tiny, hand-picked subset of the served section — only the single proof-point fields,
  never the full breakdown.
- `locked`: the tier required to unlock the rest (so the component still renders an upgrade CTA).

Implement as a per-section **preview-projector** registry, e.g.:
```ts
// section col -> (fullSection) => previewObject   (returns null if no proof point available)
const PREVIEW_PROJECTORS: Record<string, (s: any) => unknown | null> = {
  exposureXray: pickTopExposureDiff,          // top |difference| row: name, type, difference, dates
  riskAttribution: pickDivergenceHeadline,    // top divergence row OR top theme active beta
  managerParent: pickSkillProofPoint,         // skill_evidence: label, p_skill, alpha_ir, t_years
  returnAttribution: pickTopDetractor,        // top 3Y stock detractor: member_label, bps, period
  positioningChanges: pickTopShift,           // top surfaced_rank shift: name, direction, magnitude
  alternatives: pickCheapestSubstitute,       // cheapest TRUE substitute: cheaper_share_class first,
                                              // then cross_wrapper; null if neither (see §B for rule)
};
```
Then in the gate loop, when `rank < GATE_RANK[gate]` and a projector exists, set
`o[col] = { preview: projector(full) ?? null, locked: gate }` instead of `{ locked: gate }`.
Sections without a projector keep today's hard `{ locked }` behavior.

**Hard requirement — no gated-data leak:** the projector must copy *only* the whitelisted proof-point
fields into `preview`. It must never spread the whole section. The full row arrays
(`exposure_xray.rows`, `return_attribution.rows`, `alternatives.rows`, divergence/beta tables, the
bias/timing/idio attribution) must NOT appear in any payload for a user below the gate. Re-verify by
asserting that the serialized anon/free payload contains none of the gated detail (see Test plan).

Also extend the `isLocked` contract: a `{ preview, locked }` object is **still locked** (it has a
`locked` key), so existing `isLocked()` checks keep treating it as locked. Add a sibling helper
`getPreview(v)` returning `v.preview ?? null` when `isLocked(v)`.

Keep the existing field-level locks (value_index, manager-moves bps, inner active_return_attribution)
exactly as-is — those are orthogonal and already tested. In particular, the inner
`active_return_attribution` sub-panel of Risk & Attribution stays a **hard `{ locked: "paid" }`**: it
is a separate paid-tier code path (`profile.ts:363-372`) keyed off the outer `riskAttribution` section,
not the `PREVIEW_PROJECTORS` registry (which is keyed only on the outer `riskAttribution` col and so
never reaches it). It gets **no** free proof point in this change. The `riskAttribution` projector
surfaces a free proof point for the *outer* section (factor betas + divergence) only.

### B. Component rendering — proof point + single unlock affordance
Each in-scope component already branches on `isLocked(x)` and renders `<LockedNotice>`. Change that
branch to: if `getPreview(x)` is non-null, render a compact **ProofPoint** card (the one number, with
its as-of stamp and a one-line readout) followed by a single muted unlock line; if preview is null,
fall back to today's `<LockedNotice>`. Specifically:
- `ExposureXray.tsx` — preview = the largest-|difference| *sector/theme* row (skip the
  `concentration` pseudo-rows so the headline is "technology −27.9pp", not "Effective Positions"):
  render `"{name}: {fmtPP(diff*100)} vs passive"` + readout, then "See the full exposure breakdown".
- `RiskAttribution.tsx` — preview = the divergence headline ("you hold X% but actively bet Y%") or,
  if absent, the top theme active beta. Render the one line + "See all factor & theme bets".
- `SelectionEvidence.tsx` — three sub-cards already exist; give each its own preview:
  - skill (`managerParent` preview): "Selection evidence: {label} · P(skill) {pct} · IR {ir} over
    {t_years}y" then "See the full skill read & Manager Moves".
  - Return Attribution (`returnAttribution` preview): "Top detractor: {member_label} {signed bps}
    ({period}, vs passive)" then "See all contributors & detractors".
  - Portfolio Shifts (`positioningChanges` preview): top shift line + "See all recent shifts".
- `Alternatives.tsx` — preview = the cheapest **true substitute**, selected by a fixed precedence so
  we never headline a passive index fund as the "cheaper option" for an active fund: take the cheapest
  `cheaper_share_class` row first; if none, the cheapest `cross_wrapper` row; if neither exists, return
  null and fall back to `LockedNotice`. (Do **not** pick the global-cheapest row: for FCNTX that is
  `FXAIX`/`FLCPX`/`ACLEX` at 1 bp, all `same_category` passive index funds, which is a misleading proof
  point for an active large-cap fund. The correct FCNTX proof point is `FCNKX` at 32 bps
  `cheaper_share_class`.) Render "Cheaper way to hold this: {ticker} at {bps}" then "See all
  alternatives".

### C. New shared `ProofPoint` primitive + unlock collapse (design ask)
Add a `ProofPoint` primitive to `src/components/fund/profile/primitives.tsx` (Confident Consumer:
white `Card`, a small label, the bold number, a one-line plain-language readout, an `AsOf` stamp).
Pair it with a single quiet `UnlockLine` affordance (one CTA, not a lavender box). Replace the
repeated heavy lavender `LockedNotice` boxes in the in-scope sections with `ProofPoint` + `UnlockLine`
so the lower page reads as evidence-with-more-available, not as a wall.

To address design's "four near-identical boxes / no second focal point": the proof points themselves
become the second focal point (they carry real numbers and vary per section). Do **not** add a new
data-bearing module; reuse the existing section frames. Keep `LockedNotice` for any section that has
no projector / no proof point so the fallback still works.

### Tier behavior matrix (must hold)
| Section            | anon                          | free                          | paid/pro      |
|--------------------|-------------------------------|-------------------------------|---------------|
| Exposure X-Ray     | proof point + unlock          | full                          | full          |
| Risk & Attribution | proof point + unlock          | full (betas+divergence; inner attr stays paid-locked) | full |
| Skill / Mgr Moves  | proof point + unlock          | full (bps still paid-locked)  | full          |
| Return Attribution | proof point + unlock          | proof point + unlock          | full          |
| Portfolio Shifts   | proof point + unlock          | full                          | full          |
| Alternatives       | proof point + unlock          | proof point + unlock          | full          |

(Passive funds keep their existing `Unavailable` suppression for Selection Evidence / Manager
Moves — proof points only render where the section actually has data.)

### Loading / empty / locked states
- **Empty** (section present but no proof-point-eligible row, e.g. no qualifying detractor): render
  today's `Unavailable` copy, not a stub number. Never fabricate a proof point.
- **Locked-with-no-preview** (projector returned null): render today's `LockedNotice` fallback.
- **Unavailable upstream** (`null` section): unchanged honest `Unavailable`.

## Files to touch
- `src/lib/serving/profile.ts` — add `PREVIEW_PROJECTORS` + `pick*` projector fns, `getPreview()`
  helper, and the preview branch in `applyGates`. Extend the `Locked`/preview type.
- `src/components/fund/profile/primitives.tsx` — add `ProofPoint` and `UnlockLine`; keep
  `LockedNotice` for fallback.
- `src/components/fund/profile/ExposureXray.tsx`
- `src/components/fund/profile/RiskAttribution.tsx`
- `src/components/fund/profile/SelectionEvidence.tsx`
- `src/components/fund/profile/Alternatives.tsx`
- `src/components/fund/profile/index.ts` — export new primitives if needed.
- (No change to `src/app/funds/[ticker]/page.tsx` data flow; it already passes the gated sections
  down via `section<T>()`. Confirm `section()` still returns the `{preview,locked}` marker via
  `isLocked` — it does, since the object has a `locked` key.)

## Data dependencies (exact `fund_profile_facts` fields — all CONFIRMED present)
- `exposure_xray.rows[].{exposure_name, exposure_type, fund_exposure, passive_exposure, difference,
  holdings_as_of}` and `fund_holdings_date`, `passive_holdings_date`.
- `risk_attribution.exposure_divergence.rows[].{exposure_name, total_exposure_holdings,
  beta_active_mkt, divergence_state, holdings_as_of, factor_eval_date}` and/or
  `risk_attribution.factor_betas.themes[].{target_id, beta_active_mkt, beta_active_tstat}`.
- `manager_parent.skill_evidence.{label, p_skill, alpha_ir, t_years, peer_group, method_version}`.
- `return_attribution.rows[].{member_label, period, dimension, contribution_to_active_return_bps,
  rank_direction, period_start_date, period_end_date}` + `method_version`.
- `positioning_changes.rows[].{change_name, change_type, change_direction, change_magnitude,
  value_unit, surfaced_rank, holdings_as_of_current, holdings_as_of_prior}`.
- `alternatives.rows[].{ticker, name, alternative_type, expense_ratio_bps, annual_dollar_savings_10k,
  wrapper_alternative}`. **Selection key is `alternative_type`** (values `cheaper_share_class` /
  `cross_wrapper` / `closest_passive` / `same_category` / `similar_active`): `pickCheapestSubstitute`
  filters on `alternative_type === 'cheaper_share_class'` first, then `'cross_wrapper'`, per §B —
  matching the existing component's grouping (`Alternatives.tsx` filters `r.alternative_type`).
  `wrapper_alternative` (`etf` / `mutual_fund`) is **display-only** (the ETF/Mutual-fund label), never
  the selection key.

**No missing field. No backend prerequisite.** If any projector finds its section empty for a given
fund, it returns null and the component falls back to the honest `Unavailable` / `LockedNotice` state.

## Acceptance criteria
1. `npm run build` and `npm run lint` pass.
2. For an **anonymous** session on FCNTX, each section that has proof-point-eligible data shows exactly one proof point
   (not the full breakdown) plus one unlock affordance; Portfolio Shifts, whose positioning_changes is null for FCNTX, correctly falls back to the honest Unavailable state — no stub number; the headline numbers match the served data
   (tech −27.9pp; P(skill) ~4%; IR −0.12; top 3Y detractor ~−627 bps / 5Y −359 bps).
3. **No gated-data leak:** the rendered HTML / serialized payload for an anonymous and a free user
   contains none of the gated detail rows — no full `exposure_xray.rows`, no full
   `return_attribution.rows`, no full `alternatives.rows`, no bias/timing/idio numbers, no
   Manager-Moves bps. Only the whitelisted preview fields appear. (Grep the dynamic HTML / inspect the
   RSC payload.)
4. Field-level locks are unchanged: `value_index` (anon/free), Manager-Moves `impact_bps_per_year`
   (free), inner `active_return_attribution` (free) remain stripped to null/`{locked}`.
5. Passive funds (VOO) render no fabricated proof points — Selection Evidence stays in its
   `Unavailable`/suppressed state; Exposure X-Ray / Alternatives behave per their data.
6. The lower page no longer shows six near-identical lavender CTA boxes in ~1.5 scrolls; locked
   sections that *do* have a proof point render the `ProofPoint` + single `UnlockLine` instead.

## Test plan
Capture and eyeball N tickers across the gate boundaries and data shapes, at each tier
(anon / free / paid), using the test users in MEMORY (`{free,paid,pro}@test.dev` / `password123`):
- **FCNTX** — active; the proposal's worked example. Five of the six surfaces are populated
  (Exposure X-Ray, Risk & Attribution, skill/Manager Moves, Return Attribution, Alternatives);
  `positioning_changes` is null, so Portfolio Shifts must fall back to the honest `Unavailable` state —
  it is the built-in empty-state check, not a stub proof point.
- **VOO** — passive; verify Selection Evidence suppression holds and no proof point is invented.
- **DODGX** and **FBGRX** — additional active funds (DODGX value, FBGRX theme-tilted) to confirm the
  projectors pick sensible headline numbers across exposure shapes.
- **A partial-data fund** — pick one whose `return_attribution` or `positioning_changes` is
  empty/suppressed (e.g. a fund with `return_attribution.suppressions` non-empty); confirm the
  empty-state fallback, not a stub proof point.
For each, in the anon and free payload, assert (a) the proof point text matches the served value, and
(b) none of the gated detail arrays/fields are present. Compare the served value to the staging
parquet via a quick polars read for at least FCNTX (atomic spot check) so the rendered number == gold.

## Out of scope
- Any new gold panel, parquet, or `fact_assembler` change (the data already exists — this is a
  presentation/gating change only).
- Changing which sections are gated at which tier (gates stay where they are; we only change what a
  locked section *renders*).
- The Value Offering hero's 0–100 `value_index` lock (separate field-level lock, already shipped).
- Reordering or re-weighting the section stack beyond the proof-point/unlock collapse.

## Risks
- **Leak risk** is the main one: a careless `{ ...section, preview }` spread would ship gated data.
  Mitigation: projectors copy only named fields; add an explicit no-leak assertion to the test plan.
- **Preview ≠ full mismatch:** the free proof point must be computed from the *same* served fields the
  full section uses, so the free number and the unlocked number agree (no "−27.9pp free vs −28.1pp
  paid" discrepancy). Use identical selection logic (top |difference| sector/theme row, top 3Y stock
  detractor) in projector and full component.
- **Empty-state honesty:** never let a projector emit a zero/placeholder when its section is empty —
  return null and fall back. Aligns with the data-integrity rule (no fabricated proof points).
