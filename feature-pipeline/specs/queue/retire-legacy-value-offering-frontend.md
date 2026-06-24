---
id: retire-legacy-value-offering-frontend
title: Drop the legacy Value Offering from the web payload, close the gating leak, add a deep-walk golden test
status: queued
track: frontend
repo: fundscore-web
depends_on: retire-legacy-value-offering-serving
source_proposal: feature-pipeline/proposals/approved/single-headline-verdict-retire-legacy-score.md
created: 2026-06-24
scope: global
---

## Goal
Make the reframed `value_index` / badge the single canonical Value Offering headline in the web app
by removing the legacy 5-leg `valueOffering` column, type, and field-level gating from
`fundscore-web`, closing the gating leak engineering found (the legacy `value_offering_score` and
`fee_gap_bps` ship as **un-gated top-level scalars**), and adding a deep-walk golden test that asserts
no paid scalar survives in an anon payload. Also add one reconciling sentence in Fee Fairness so a
reader understands the fee badge judges *fee fairness* while the index nets fee against *unproven
selection* — the two are allowed to differ.

**This spec is blocked by the backend spec `retire-legacy-value-offering-serving`.** That spec drops
the `value_offering_score`, `value_offering_label`, `fee_gap_bps`, and `value_offering` columns from
the Postgres `fund_profile_facts` table. Because `getFundFactRow` does a full-row `db.select()`
(`src/lib/serving/profile.ts:281-286`), the Drizzle schema must drop the same columns in lockstep —
selecting a column that no longer exists in Postgres would error. Do not merge this until the backend
spec is `done`, and land the Drizzle column drop in the same deploy window as the Postgres drop.

## Context (critic evidence)
- FCNTX served facts (`feature-pipeline/captures/fund_profile__FCNTX/served_facts.json`): top-level
  `value_offering_score` 71 / `value_offering_label` "Strong", `fee_gap_bps` 16.07, a full legacy
  `value_offering` section, vs `value_offering_reframed.value_index` 30 / badge "Selection unproven".
  Three unreconciled verdicts on one fund.
- Engineering leak: `applyGates` (`src/lib/serving/profile.ts:308-317`) nulls only
  `out.valueOffering.value_offering_score` (inside the section). But `getFundFactRow` selects the whole
  row, so the **bare top-level scalars** `valueOfferingScore` and `feeGapBps` (Drizzle columns,
  `src/lib/db/schema/serving.ts:75,81`) stay un-gated. No live leak today only because every consumer
  is an RSC and the page never reads those scalars — but the un-gated paid figure is in the payload.
- The legacy section is **dead**: the page renders only `valueOfferingReframed`, `fees`, `theTake`
  (`src/app/funds/[ticker]/page.tsx:68-149`); nothing imports or renders `valueOffering`
  (grep: the only `valueOffering` references are the type + the gating block in `profile.ts`).

## Solution

### 1. Drop the legacy column + type + gating (the dead, leaking artifact)
- **Drizzle schema** (`src/lib/db/schema/serving.ts`): remove the columns
  `valueOfferingScore` (L75), `valueOfferingLabel` (L76), `feeGapBps` (L81), and `valueOffering` JSONB
  (L88). **Keep** `valueOfferingStatus`, `confidenceState`, `feeFairnessLabel`, `netExpenseRatioBps`,
  and the `fpf_vo_status_idx` index — backend keeps these (states/labels, not the legacy score).
- **Serving types/gating** (`src/lib/serving/profile.ts`):
  - Delete the `ValueOffering` interface (L58-72).
  - Remove `valueOffering: ValueOffering | null;` from `FactRow` (L237).
  - Remove `{ col: "valueOffering", gate: "value_offering" }` from `GATED_SECTIONS` (L261).
  - Delete the field-level legacy-score gating block (L307-317) — the block that nulls
    `value_offering_score` / `legs` / `leg_provenance`. With the column gone there is nothing to null.
  - Leave the reframed `value_index` field-level gate (L321-333) untouched — that is the *correct*
    paid gate and remains the only Value Offering field gate.
  - Update the Drizzle-mapping note comment at L225 so it no longer uses `valueOffering` as the
    example column — e.g. change `// (valueOffering, passiveBaseline, …)` to
    `// (passiveBaseline, riskAttribution, …)`. Otherwise the acceptance grep cannot pass.
- **No frontend component change for removal**: `ValueOfferingHero` already renders only
  `valueOfferingReframed`; no component imports `valueOffering`. Confirm with a grep after the edit.

### 2. Migration (drop the Postgres columns from the web side too)
Add a Drizzle migration under `drizzle/` (matching the existing
`drizzle/serving_layer_additive.sql` style) that runs:
`ALTER TABLE fund_profile_facts DROP COLUMN IF EXISTS value_offering_score, DROP COLUMN IF EXISTS value_offering_label, DROP COLUMN IF EXISTS fee_gap_bps, DROP COLUMN IF EXISTS value_offering;`
This is the same drop the backend `apply_serving_schema.py` performs — the migration is the web repo's
record of it. (Per project memory, `drizzle push` is gated; coordinate so the column is dropped once,
either via the backend script or this migration, not conflicting. Both use `DROP COLUMN IF EXISTS`, so
the drop is idempotent regardless of which side runs first.)
**Do not register the new file in `drizzle/meta/_journal.json`.** Like the existing
`drizzle/serving_layer_additive.sql`, it is a hand-applied record/DDL file, not a drizzle-kit-generated
migration — the journal lists only `0000_add_serving_layer`, and `package.json` exposes `db:push`
(not `migrate`). Adding it to the journal would risk a future `drizzle-kit migrate` double-apply.
Name it descriptively, e.g. `drizzle/retire_legacy_value_offering.sql`.

### 3. Reconciling sentence (one line, Fee Fairness)
In `src/components/fund/profile/FeeFairness.tsx`, for active funds with a fairness label, add one
plain-language line under the fairness band (near L75-95) that reconciles the two verdicts, e.g.:
"Fee Fairness judges only whether this fund's fee is reasonable for what it charges. The Value
Offering index above also factors in how well its stock-picking has been evidenced — so a fund can be
fairly priced yet still score lower overall." Keep it Confident-Consumer: calm, no hype. Gate: this
text is public (Fee Fairness is a public section); it references only the already-shown badge/label,
no gated number. Show it only when `!isPassive && ff?.fee_fairness_label` (the case where both a fee
label and a reframed badge exist).

### 4. Deep-walk golden test (no paid scalar survives in an anon payload)
There is no test runner in `fundscore-web` yet (no `test` script, no `__tests__`). Add a minimal,
dependency-light golden test that exercises `applyGates` and asserts the gating contract.

**Decouple the test target from the DB first (prerequisite, determinate).** `applyGates` lives in
`src/lib/serving/profile.ts`, but that module imports `db` at line 2 (`import { db } from "../db";`),
and `src/lib/db/index.ts:12` constructs a live Postgres client at module load
(`const client = ... postgres(connectionString)` with `connectionString = process.env.DATABASE_URL!`).
So importing `applyGates` today drags in a live DB connection that needs `DATABASE_URL`. The gating
logic itself is pure — `applyGates`, `isLocked`, `TIER_RANK`, `GATE_RANK`, the gating types, and the
`GATED_SECTIONS` table only touch `db` via `getFundFactRow` (`profile.ts:280-287`). Extract the pure
gating logic + gating types into a `db`-free module `src/lib/serving/gating.ts` (move `UserState`,
`TIER_RANK`, `GATE_RANK`, `Locked`, `isLocked`, `Section`, the section-shape interfaces, the `FactRow`
type, `GATED_SECTIONS`, and `applyGates`), and have `profile.ts` re-export those symbols from it
(`profile.ts` keeps only `getFundFactRow` and its `db`/Drizzle imports). The golden test then imports
`applyGates` from `gating.ts` with no `db/index.ts` in the import graph and no `DATABASE_URL` required.

Run it under Node 23's `--experimental-strip-types` (this repo is on Node 23 and has **no** `tsx`):
`node --experimental-strip-types scripts/test/gating-golden.ts` (a `.ts` file so the import of the
`.ts` `gating.ts` module type-strips cleanly). The determinate requirement: the test imports
`applyGates` with **no live Postgres client and no `DATABASE_URL`** in its import graph. (If a future
Node makes strip-types import-of-`.ts`-from-`.ts` awkward, compile `gating.ts` + the test with `tsc`
first and run the emitted JS — same no-DB import-graph requirement.)

The test must:
1. Build a representative `FactRow` fixture (use the FCNTX `served_facts.json` capture as the source of
   truth, mapped to camelCase Drizzle column names) including the reframed `value_index` (paid),
   `manager_parent.skill_evidence.manager_moves.impact_bps_per_year` (paid),
   `return_attribution` (paid section), and `risk_attribution.active_return_attribution` (paid).
   **Two fixture guardrails** (`applyGates` reads camelCase at the top level but snake_case inside each
   JSONB section — see the `profile.ts:224-227` note): (a) remap only the **TOP-LEVEL** column keys to
   camelCase (`value_offering_reframed`→`valueOfferingReframed`, `manager_parent`→`managerParent`,
   `risk_attribution`→`riskAttribution`, `return_attribution`→`returnAttribution`, `alternatives`→
   `alternatives`); leave **all keys nested inside** each section in snake_case
   (`skill_evidence`, `manager_moves`, `impact_bps_per_year`, `active_return_attribution`) exactly as
   the capture has them — `applyGates` reads `mp.skill_evidence` / `se.manager_moves` /
   `ra.active_return_attribution` in snake_case (`profile.ts:340-365`). (b) Carry the capture's `gates`
   map **verbatim** onto `row.gates`; `applyGates` looks up `row.gates?.[gateKey]` and defaults missing
   gates to `"public"` (`profile.ts:301`), so an omitted `gates` map would make the
   `return_attribution`/`alternatives` section-lock assertions pass for the wrong reason. FCNTX gates:
   `return_attribution=paid`, `alternatives=paid`, `value_offering_reframed=public`,
   `manager_parent=free`, `risk_attribution=free`.
2. Run `applyGates(row, "anonymous")` and **deep-walk** the resulting object, asserting that **no**
   known paid scalar survives anywhere: specifically `value_index` is null (or its holder is `{locked}`),
   `impact_bps_per_year` is null, and any section gated `paid`/`pro` is `{locked}` — and additionally a
   generic assertion that the post-drop payload contains **no** key named `value_offering_score`,
   `value_offering_label`, `value_offering`, or `fee_gap_bps` at any depth (these must be gone at the
   source now, so their absence is the regression guard against reintroduction).
3. Run `applyGates(row, "paid")` and assert `value_index` and `impact_bps_per_year` ARE present
   (positive control — gating opens at the right tier).
4. Exit non-zero on any failed assertion so it can wire into CI / a `pretest`/`verify` step.

Document how to run it in the spec's acceptance (e.g.
`node --experimental-strip-types scripts/test/gating-golden.ts`).

### Loading / empty / locked states
Unchanged — the hero already handles scored / unscored / locked-`value_index` states
(`ValueOfferingHero` + `UnscoredHero`). No new states introduced.

### Tier gating
The only Value Offering field gate after this change is the reframed `value_index` (paid/pro), which is
already correct. The removal closes the un-gated legacy scalar leak. No section's tier changes.

## Files to touch
- `src/lib/db/schema/serving.ts` — drop `valueOfferingScore`, `valueOfferingLabel`, `feeGapBps`,
  `valueOffering` columns.
- `src/lib/serving/profile.ts` — drop `ValueOffering` type, `FactRow.valueOffering`, the
  `value_offering` `GATED_SECTIONS` entry, and the legacy field-level gating block. (The pure gating
  logic + types these live among move to `src/lib/serving/gating.ts`; `profile.ts` re-exports them and
  keeps only `getFundFactRow` + its `db`/Drizzle imports — see § 4.)
- `src/components/fund/profile/FeeFairness.tsx` — add the one reconciling sentence.
- `drizzle/retire_legacy_value_offering.sql` (new) — the column-drop record/DDL file (mirrors backend
  DDL; NOT registered in `drizzle/meta/_journal.json`).
- `src/lib/serving/gating.ts` (new) — `db`-free gating module (pure logic + types extracted from
  `profile.ts`, re-exported by it) so the golden test imports `applyGates` without a live Postgres
  client.
- `scripts/test/gating-golden.ts` (new) — deep-walk golden test (run under
  `node --experimental-strip-types`).

## Data dependencies (exact `fund_profile_facts` fields)
- **Removed** (blocked-by backend): `value_offering_score`, `value_offering_label`, `fee_gap_bps`
  scalars and the `value_offering` JSONB section — these are dropped by
  `retire-legacy-value-offering-serving`. This spec must not run until that lands.
- **Kept and used**: `value_offering_reframed` (badge + `value_index`, paid-gated), `fees`
  (`fair_fee.fee_fairness_label`, `fair_fee.gap_bps`, `net_expense_ratio_bps`), `value_offering_status`,
  `confidence_state`. All already present in the served payload (verified in the FCNTX capture).
- No new field required. Nothing assumed into existence.

## Acceptance criteria
- `npm run build` and `npm run lint` pass with the legacy column/type/gating removed.
- `grep -rnE "valueOffering\b|value_offering_score|valueOfferingScore|feeGapBps" src` returns zero
  references (these tokens match neither `valueOfferingReframed` nor `valueOfferingStatus`). Note the
  bare term `fee_gap_bps` still legitimately appears in the unrelated portfolio feature
  (`src/components/portfolio/XrayResult.tsx`, `src/lib/serving/portfolio-solver.ts`) — that is out of
  scope and intentionally NOT in this pattern.
- The FCNTX `/funds/FCNTX` page renders the reframed badge ("Selection unproven") + the paid-gated
  `value_index` (30) as the sole Value Offering headline; the legacy 71/"Strong" appears **nowhere**.
- The reconciling sentence renders for active funds with a fairness label (e.g. FCNTX) and is absent
  for passive funds (VOO/FXAIX).
- The deep-walk golden test passes: anon payload contains no `value_offering_score` /
  `value_offering_label` / `value_offering` / `fee_gap_bps` at any depth and no surviving paid scalar
  (`value_index`, `impact_bps_per_year`); paid payload exposes them. The test exits non-zero on failure.
- No gated data leaks to anon/free: the `applyGates(row, "anonymous")` output holds no `value_index`,
  no manager-moves bps, and `{locked}` markers for paid sections.

## Test plan (capture N tickers)
Render and capture (or assert via the golden fixture) for: `FCNTX` (active, contradiction case — the
north star), `DODGX` (active, scored), `VOO` and `FXAIX` (passive — reconciling sentence suppressed,
unsupported hero), and one `status='building'`/partial-data fund (hero shows the building message,
`value_index` absent). Confirm in each that exactly one Value Offering verdict shows and the legacy
score is gone.

## Out of scope
- Backend removal of the columns from the assembler / Postgres DDL / staging parquet (the linked
  backend spec).
- Removing `valueOfferingStatus` / `confidenceState` (states kept by backend).
- Any change to the reframed `value_index`, the badge typology, or the Fee Fairness `gap_bps` value.
- Adding a general test framework — the golden test is a single dependency-light script.

## Risks
- **Lockstep with Postgres**: `db.select()` selects all schema columns. If the Drizzle schema still
  declares a column Postgres dropped (or vice versa), reads error. Land the Drizzle drop + the Postgres
  drop together; `depends_on` enforces ordering. Verify against the live DB after the backend reload.
- **Stale capture**: the `served_facts.json` capture still contains the legacy fields; the golden-test
  fixture should be derived from it but with the legacy keys removed to reflect the post-change payload
  (the test's job is to prove they are gone, not to re-encode them).
- **Reconciling-copy scope**: keep it to one sentence and reference only already-shown labels; do not
  introduce a new gated number into a public section.
