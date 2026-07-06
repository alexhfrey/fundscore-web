---
id: fund-named-manager-ui
title: Surface named portfolio manager, tenure, and a filed manager-transition flag
status: done
track: frontend
repo: fundscore-web
depends_on: fund-named-manager-source
source_proposal: feature-pipeline/proposals/approved/fund-identity-manager-freshness.md
created: 2026-06-24
scope: page
---

## Goal
Once the backend lands real PM data (`fund-named-manager-source`), name the portfolio manager,
show tenure, and surface any **filed** manager-change / retirement event as a first-class fact with
a transition flag — instead of crediting only the adviser firm. This is the single most-checkable
real-world fact on the page; a skeptical reader who sees the firm but not the star manager dismisses
the whole analysis.

## Context (critic evidence)
- Proposal `source_critiques: [data-quality, narrative]`. Today `SelectionEvidence.tsx` gates the
  footer on `manager_names.length > 0` (SelectionEvidence.tsx:144,225) but renders the firm via
  `adviser_name ?? manager_names.join(", ")` (line 227) — so it shows only "Adviser: …" because
  both the served `manager_names` and `adviser_name` are the adviser firm, not the PM (placeholder
  panel). After the backend swap, `manager_names` will carry
  real PM names plus a `manager_transition` block and per-manager `{role, start_date,
  tenure_years}`.
- **BLOCKED until `fund-named-manager-source` is `done`.** This spec must not render PM names while
  `manager_assignments` is still the all-`unavailable` placeholder; doing so would either show the
  adviser firm as a "manager" (current bug) or fabricate. The component must keep its honest
  unavailable state when `manager_names` is empty.

## Solution
Render in the existing **Selection Evidence** section (`SelectionEvidence.tsx`), inside the
"Manager Moves" card's footer area where "Adviser: …" already lives, and add a transition flag near
the top of the section when present.

**A. Named-manager line (replaces the firm-as-manager footer)**
- Extend the `ManagerParent` interface in `SelectionEvidence.tsx` with the backend's enriched
  shape: `managers: { name, role, start_date, tenure_years, confidence_state }[]`,
  `manager_as_of: string|null`, `manager_transition: {...}|null` (keep `adviser_name`,
  `fund_family`, `has_sub_adviser`).
- When `managers.length > 0`: render lead-first, e.g. "Will Danoff — lead PM since 1990 (36 yrs)"
  using `start_date`/`tenure_years`; co-PMs on the same line or a compact list. Keep "Adviser:
  {adviser_name}" as a separate, clearly-firm-level line below (do not conflate firm with person).
- When `managers.length === 0`: keep the current honest copy — show "Adviser: {adviser_name}" only,
  with no fabricated PM. (This is also the state while the backend is still a placeholder.)
- **Single source-of-truth for the PM line — `manager_parent.managers[]`, NOT `manager_names`.**
  Note that after the backend swap the backend spec also repurposes the existing
  `manager_parent.manager_names` to carry the real active PM names lead-first
  (`fund-named-manager-source.md`), so BOTH arrays will hold PM data. To avoid double-rendering: drive
  the new named-PM line solely from `managers[]` (it has the rich per-PM `role`/`start_date`/
  `tenure_years` objects the line needs). Leave the existing footer (`SelectionEvidence.tsx:144,225,
  227`) keyed on `manager_names.length > 0` but rendering `adviser_name` — it stays the firm-level
  "Adviser:" line. Do **not** also surface `manager_names` as a second PM list, and do not wire the
  new PM line off `manager_names`.

**B. Transition flag (first-class fact)**
- When `manager_transition?.has_pending_transition`, render a calm, prominent flag at the top of
  the Selection Evidence section (a `Card` with an amber accent, not a fear banner): e.g. "Manager
  transition filed: {departing_manager} is expected to step back on {effective_date}; {incoming}
  named." Source it from `manager_transition.evidence` via the existing `Evidence` disclosure.
- Confident-Consumer tone: factual, dated, sourced — never speculative about performance impact.

**C. Inline manager freshness**
- Core inline freshness has **no cross-spec dependency**: show `as of {fmtDate(manager_as_of)}` next
  to the manager line (reuse the `AsOf` primitive or a muted span) — both `manager_as_of` (served by
  the backend) and `fmtDate` already exist, so this works standalone.
- The richer "· stale" affordance is an **optional, layered-on nice-to-have**, gated on the sibling
  spec having merged. `stampByDomain(... ,"manager")` does **not exist in `src/` today**
  (`grep -rn stampByDomain src/` returns nothing) — it is introduced by
  `fund-inception-relabel-inline-freshness` (and the backend emits the matching `source_domain =
  'manager'` stamp). Therefore: do NOT wire `stampByDomain` unconditionally (it would break the
  build while undefined). Only use it `IF` that sibling has landed `stampByDomain` in
  `src/lib/serving/profile.ts` AND the backend's `manager` source stamp is present; otherwise this
  spec degrades gracefully to the `manager_as_of` + `fmtDate` line above with no stale flag. This
  keeps the spec self-contained and consistent with Out-of-scope ("ships independently, no
  dependency").

Loading/empty/locked states: `managerParent` may be `{locked}` (gate `free`) → keep the existing
`LockedNotice`. Empty `managers` → honest firm-only state. Missing `manager_transition` → no flag.
Tier gating: the section gate stays `free`; PM name + tenure + transition are `free` (public-interest
facts, not paid analytics) — confirm with the backend that no PM field is gated higher.

## Files to touch
- `src/components/fund/profile/SelectionEvidence.tsx` — extend `ManagerParent`/`SkillEvidence`
  interfaces with `managers[]`, `manager_as_of`, `manager_transition`; render named PMs, tenure,
  transition flag, inline as-of; preserve the empty/locked/placeholder states.
- `src/lib/serving/profile.ts` — extend the `managerParent` typing (it is currently
  `Record<string, unknown>`) with a typed `ManagerParent` shape including the new fields, OR add the
  fields to the section interface used by `SelectionEvidence`. No gating change (section already
  `free`); confirm `applyGates` does not need a new field-level lock.
- `src/app/funds/[ticker]/page.tsx` — no structural change (section already wired); pass through if a
  new typed prop shape is introduced.

## Data dependencies (exact `fund_profile_facts` fields)
All under the existing `manager_parent` JSONB section (gate `free`) — populated by
`fund-named-manager-source`:
- `manager_parent.manager_names: string[]` — **real PM names after backend** (today: adviser firm —
  BLOCKER). 🔒 blocked_by_backend.
- `manager_parent.managers[]: {name, role, start_date, tenure_years, confidence_state}` — **new,
  backend-provided**. 🔒 blocked_by_backend.
  **CONTRACT (shared key — already bilaterally pinned):** the per-manager array MUST be served
  under the exact JSONB key `manager_parent.managers` (array of objects with exactly the keys above).
  The backend spec `fund-named-manager-source.md` (`_manager_parent` in `fact_assembler.py`) owns
  emitting this key and already locks it explicitly — `fund-named-manager-source.md:96-99` states
  the array "MUST be served under the JSONB key `manager_parent.managers[]`" and names it the
  cross-spec contract — so the name is bound on both sides; no amendment is needed. If the assembler
  instead ships it under a different key (e.g. `manager_details`), this UI reads `undefined` and
  silently falls back to the honest firm-only state (passes build, never renders PMs). Drive the
  named-PM line solely from `managers[]`, not `manager_names`.
- `manager_parent.manager_as_of: string|null` — **new, backend-provided**. 🔒 blocked_by_backend.
- `manager_parent.manager_transition: {has_pending_transition, event_type, effective_date,
  departing_manager, incoming_managers[], evidence}|null` — **new, backend-provided**.
  🔒 blocked_by_backend.
- (optional, layered) `source_inventory.source_stamps[]` with `source_domain = 'manager'` — **new,
  backend** (emitted by `fund-named-manager-source`). Drives the optional inline stale flag via
  `stampByDomain`, **only if** the sibling `fund-inception-relabel-inline-freshness` has landed that
  helper in `src/lib/serving/profile.ts`. Not required for the core freshness line (which uses
  `manager_as_of` + `fmtDate`).

## Acceptance criteria
- `npm run build` and `npm run lint` pass.
- After the backend is `done` and the staging load is rebuilt: FCNTX shows the real PM (Will
  Danoff) with tenure since 1990 and a transition flag for the filed retirement/succession; the
  "Adviser:" line is clearly the firm, separate from the person.
- A fund with no sourced PM (or while the backend is still placeholder) shows ONLY the adviser firm,
  no fabricated name, no broken transition flag.
- A passive fund (VOO) keeps the existing passive-suppressed Selection Evidence state.
- No gated data leaks: the `manager_parent` section stays `free`; anon sees the `{locked}` marker,
  free/paid see the PM facts; confirm via anon-vs-free payload diff that no PM field crosses the
  wrong gate.

## Test plan
Render 5 tickers and capture the manager line + transition flag: `FCNTX` (named PM + filed
transition), `DODGX` (named PMs, no transition), `VDIGX` (named PM), `VOO` (passive — suppressed),
and one fund where the backend produced no PM (verify firm-only honest state). Verify anon (locked),
free, and paid renders behave correctly for `manager_parent`.

## Out of scope
- The inception relabel + non-manager freshness stamps (sibling spec
  `fund-inception-relabel-inline-freshness` — ships independently, no dependency).
- Sourcing the PM data itself (`fund-named-manager-source`).
- Any predictive claim about the transition's effect on returns.

## Risks
- **Do not ship while the backend panel is still the placeholder** — the component must keep the
  empty/firm-only state until `manager_names` carries real people. Gate merge on
  `fund-named-manager-source` = `done` and a rebuilt staging load.
- Conflating firm with person: keep "Adviser: {firm}" visually and semantically distinct from the
  named PM line.
- Alarmism on the transition flag: factual + dated + sourced; no performance speculation.

## Implementation addendum — backend SHIPPED; serving realities to honor (2026-07-05)

`fund-named-manager-source` is **done** (serving_manifest 26 live; spec in specs/done/ with
addendum 3). The `manager_parent` JSONB now carries the contract exactly as specified:
`manager_names` (lead-first actives, `[]` when none), `managers[]`, `manager_transition`,
`manager_as_of`. Verified served FCNTX: Danoff (since 1990) + Anolic + Weiner (2025) + transition
`{departed, 2026-12-31, has_pending_transition: true}`.

**Product decision (owner-decided): a needs_review fund HIDES the manager module — no claim, no
firm fallback.** Serving already enforces this: needs_review/uncovered funds serve
`manager_names: []` / `managers: []` / no transition / null `manager_as_of`, indistinguishable
from never-covered. The UI needs NO special needs_review state — the empty-roster honest state IS
the hide behavior (keep the existing firm-only "Adviser:" line).

Serving realities the render MUST honor (from the data-review + check-data,
`fund_score:reports/feature_pipeline/manager_canonical_20260705_check_data.md`):
1. **`start_date` is year-precision for 87.5% of rows** (`YYYY-01-01` means "since YYYY").
   Render the YEAR ("since 1990"), never a full date; tenure_years is Jan-1-convention (36.15 →
   "36 yrs" is fine).
2. **12.4% of named PMs have null `start_date`/`tenure_years`** (filing stated no tenure).
   Render name (+role if known) with no "since"/tenure fragment — no placeholder dashes.
3. **All current transitions are successor-less** (`incoming_managers: []`). The flag copy must
   read naturally without an incoming name ("{departing} is expected to step back on {date}") and
   only append "; {names} named" when non-empty.
4. **Roles are mostly `unknown` (75%) or `co_manager`; `lead` is rare** (stated-lead only). Do
   not label a PM "lead" unless role === 'lead'; for `unknown` render just "PM"; roster order is
   already lead-first-then-earliest-start — preserve served order.
5. Coverage expectation for QA: 2,778 of 5,799 profiles serve rosters (47.9%); DODGX serves 6
   named committee members; VOO/passive stays suppressed.
