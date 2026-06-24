---
id: retire-legacy-value-offering-serving
title: Retire the legacy 5-leg Value Offering from the serving layer (stop emitting score/label/section)
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/single-headline-verdict-retire-legacy-score.md
created: 2026-06-24
scope: global
---

## Goal
Stop shipping the **legacy 5-leg Value Offering** through to the serving layer so the served
fact row carries exactly one Value Offering verdict — the reframed v0.3 `value_index` / badge.
Today the fact row also carries the contradicting legacy figure (`value_offering_score` = 71 /
"Strong" for FCNTX, whose reframed `value_index` is 30 / "Selection unproven"). Remove the
contradicting artifact at the source: drop the top-level `value_offering_score`,
`value_offering_label`, and `value_offering` (legacy 5-leg JSONB section) scalars/columns from the
assembled fact row, the staging parquet, the Postgres load, and the table DDL. Also drop the
top-level `fee_gap_bps` scalar, which engineering flagged as a paid figure that leaks un-gated at
the top level (the gated copy lives inside the `fees` section).

This is the backend half of a two-spec change. The frontend spec
`retire-legacy-value-offering-frontend` `depends_on` this one: it removes the now-dead
`valueOffering` column/type/gating in `fundscore-web` and adds the deep-walk golden test. **The
frontend must not be merged until this backend spec is `done`** (it removes the Drizzle column and
the loader must already have stopped writing it).

## Context (critic evidence)
- Served facts (FCNTX capture `feature-pipeline/captures/fund_profile__FCNTX/served_facts.json`):
  top-level `value_offering_score` = 71, `value_offering_label` = "Strong", `fee_gap_bps` = 16.07;
  `value_offering` section present (legacy 5-leg); `value_offering_reframed.value_index` = 30,
  `value_offering_reframed.badge` = "Selection unproven". One fund, three unreconciled verdicts.
  - **Stale-capture note**: this capture (and any Postgres/staging data taken with it) **predates the
    current `fact_assembler.py`**. The working tree already has an uncommitted edit that removed the
    `"value_offering": "public"` GATES entry, so the current GATES dict no longer emits a
    `value_offering` gate key — but the capture's `gates` block still shows `value_offering => public`
    (and the legacy section/scalars). **Do not verify against this capture.** Regenerate the
    served/staging data via the rebuild+reload sequence in **Serving integration** and run every
    acceptance check (especially the gates-key and byte-identical checks) against the **fresh build**,
    not this pre-change capture.
- Narrative / marketing / data-quality critics: a reader who unlocks the paid 0-100 index sees a 30
  that flatly contradicts the "Strong" surfaced from the legacy score.
- Engineering: the legacy 5-leg `value_offering` section **ships unused** — the frontend renders only
  `valueOfferingReframed`, `fees`, and `theTake` (`src/app/funds/[ticker]/page.tsx`). The legacy
  section and `value_offering_score` / `fee_gap_bps` scalars are dead weight that also open a gating
  leak (handled in the frontend spec).

## Data source
No new data. The legacy 5-leg figures are read in
`/Users/alexfrey/Projects/fund_score/src/fundscore/serving/fact_assembler.py` from the existing gold
panel `data/gold/value_offering_payload.parquet` (the `vo` dict, e.g. `vo["value_offering_score"]`,
`vo["leg_skill_evidence"]`, …). **Do not touch or delete `value_offering_payload.parquet`** — it is
an upstream input to at least six other pipelines (`build_exposure_xray_panel.py`,
`build_holdings_complete.py`, `build_return_attribution.py`, `build_factor_exposure.py`,
`build_passive_holdings_foundation.py`, `reconcile_taxonomy_holdings.py`). This change only stops the
serving layer from *surfacing* the legacy figures; the panel stays as a pipeline dependency.

## Computation (the precise removals)
This is a deletion, not a new metric. In
`/Users/alexfrey/Projects/fund_score/src/fundscore/serving/fact_assembler.py`:

1. **Scalar column contract** — `SCALAR_COLUMNS` (around L95-113): remove `"value_offering_score"`,
   `"value_offering_label"`, and `"fee_gap_bps"`.
   - **Keep** `"value_offering_status"` and `"confidence_state"` — these are availability/confidence
     *states* (NOT NULL in the DDL, backing the `fpf_vo_status_idx` index and the screener's
     `vo_status` axis). They are not the contradicting score; out of scope.
   - **Keep** `"fee_fairness_label"` and `"net_expense_ratio_bps"` — used by Fee Fairness + the
     screener; not the legacy artifact.
2. **Section column contract** — `SECTION_COLUMNS` (around L115-134): remove `"value_offering"`.
3. **GATES dict (around L138-159)**: remove the line `"value_offering": "public"` from the GATES
   dict **if present** — note it may already be removed in the working tree (an uncommitted edit has
   deleted it), in which case this is a no-op. Anchor on the **content** (`"value_offering": "public"`),
   not on a line number. **Do not delete a line by position** — in the current tree L140 is
   `"value_offering_reframed": "public"` (the hero gate), which **must be kept**. The section the
   `value_offering` gate covered no longer ships.
4. **Row build** (around L1316-1340): remove the three scalar assignments
   (`"value_offering_score": _iso((vo or {}).get("value_offering_score"))`,
   `"value_offering_label": (vo or {}).get("value_offering_label")`,
   `"fee_gap_bps": _iso((fee or {}).get("gap_bps"))`) and the `"value_offering": value_offering`
   section assignment. Remove the now-orphaned `value_offering = _value_offering(vo)` call (L1297).
5. **Helper** — delete the `_value_offering(vo)` function (L936-959; anchor on the function name
   `def _value_offering(`); confirm no remaining caller.
6. **Provenance** (`src/fundscore/serving/load.py` `_SOURCE_PANELS`, L26): leave the
   `("value_offering_payload", fa.VALUE_OFFERING, "spec #7 (v0.1 legacy)")` entry — the panel is
   still an input to other pipelines, and the manifest should record that it was read. (If the
   reviewer prefers, retag its role string to note it is no longer surfaced, but do not drop the
   row — that would understate provenance.)

## Output (schema changes the loader writes)
Drop the columns from the Postgres `fund_profile_facts` table and the DDL that creates it:
- `/Users/alexfrey/Projects/fund_score/scripts/pipeline/apply_serving_schema.py` `DDL` (L27-67):
  remove `value_offering_score integer`, `value_offering_label tier_label`, `fee_gap_bps real`, and
  `value_offering jsonb` from the `CREATE TABLE`. Add idempotent drops so existing tables converge:
  `ALTER TABLE fund_profile_facts DROP COLUMN IF EXISTS value_offering_score`, `... value_offering_label`,
  `... fee_gap_bps`, `... value_offering` (place alongside the existing additive ALTERs, L68-74).
- The staging parquet `data/product/fund_profiles/serving_facts_staging.parquet` is regenerated from
  `ALL_COLUMNS` (`write_staging_parquet`), so it loses the columns automatically once `SCALAR_COLUMNS`
  / `SECTION_COLUMNS` are edited. No separate change.
- The Postgres COPY in `load.py::load_to_postgres` builds `cols_sql` from `ALL_COLUMNS`, so it stops
  writing the dropped columns automatically. Run order: apply the DDL drop (or the new ALTERs) **before**
  the next `load_to_postgres`, since COPY targets only the listed columns and a leftover NOT-NULL/extra
  column would not block (these are nullable), but the column must not be in the COPY list while present
  is fine — converge by applying schema first.

## Downstream consumer to update (same repo)
`/Users/alexfrey/Projects/fund_score/src/fundscore/product/screener_base.py` (L110-112) projects
`vo_score` (= `value_offering_score`), `vo_label` (= `value_offering_label`), and
`vo_confidence_state` (= `confidence_state`) from the staging row into `screener_funds.parquet`.
- Remove the `"vo_score"` and `"vo_label"` projections (their source scalars are gone). Verified:
  nothing in the screener engine / query specs ranks or filters on `vo_score` / `vo_label`
  (`grep -rn "vo_score\|vo_label" src/fundscore/product/` returns only these projection lines), so no
  ranked query breaks.
- `fee_gap_bps` is **also projected** in `screener_base.py` (L131) from the top-level scalar
  (`r.get("fee_gap_bps")`). Confirm via grep that no query spec ranks/filters on `fee_gap_bps` before
  deciding (`grep -rn "fee_gap_bps" src/fundscore/product/` shows only the projection + the unrelated
  portfolio solver — verified). **Recommendation: DROP the projection** (simpler, lower-risk, nothing
  consumes it). If a near-term query does need the fee gap, re-source it from the already-parsed `fees`
  section instead — note the access pattern **changes from a flat scalar to nested-JSON**: the `fees`
  section is already loaded into a local `fees` var at `screener_base.py` L86 (`fees = _loads(r.get("fees"))`),
  so use `_g(fees, "fair_fee", "gap_bps")` (the same `_g(...)` nested accessor used for the reframed
  sub-fields at L113-129), **not** `r.get("fee_gap_bps")`. Keep `vo_status`/`vo_confidence_state`
  (their source scalars remain).
- Rebuild the screener base after the change (`make build-screener-base`) and confirm row count and
  ranked output are unchanged for the 15 canonical queries.

### Test fixtures carrying now-dead references (same repo)
Two screener tests build fixture rows with the dropped fields. Neither hard-breaks after the change
(the screener engine never reads `vo_score`/`vo_label` — verified — so the fixture fields just become
unused), but leave them and the dead references invite the projection being silently reintroduced
(exactly what the Risks section warns against for `fee_gap_bps`). Clean both:
- `/Users/alexfrey/Projects/fund_score/tests/test_screener_base.py` (L42-44): the `_facts_row` fixture
  sets `value_offering_score=79, value_offering_label="Strong"` and `fee_gap_bps=None`. After dropping
  the `vo_score`/`vo_label` projections, remove the now-unused `value_offering_score` /
  `value_offering_label` fixture fields (and `fee_gap_bps` if the projection is dropped). Keep
  `value_offering_status` / `confidence_state` / `fee_fairness_label` (their columns survive).
- `/Users/alexfrey/Projects/fund_score/tests/test_screener_engine.py` (L93): the column-fill list
  contains `("vo_score", None), ("vo_label", None)` (and `("fee_gap_bps", None)` at L97). Remove the
  `vo_score`/`vo_label` entries (and `fee_gap_bps` if its projection is dropped) so the test frame
  matches the new screener_base column set. Keep `("vo_status", None)`/`("vo_confidence_state", None)`.
- Run `uv run pytest tests/test_screener_base.py tests/test_screener_engine.py` and confirm green.

## Validation report to update (same repo — REQUIRED, blocks the build)
`/Users/alexfrey/Projects/fund_score/scripts/reports/build_serving_facts_report.py` is the **second
command of the `build-serving-facts` Make target** (Makefile L366-368: `build_serving_facts.py` then
`build_serving_facts_report.py`) — the exact entrypoint the Serving-integration step below tells the
implementer to run. Its atomic-spot-check loop reads the four dropped columns directly off the rebuilt
staging row and will raise `KeyError` once they are gone:
- L107: `a = json.loads(r["value_offering"]) if r["value_offering"] else None` (legacy section)
- L114: `a["value_offering_score"] == v["value_offering_score"]` (legs cross-check)
- L116: `gap = r["fee_gap_bps"]`
- L118-120: per-row dump `f"{r['value_offering_score']}/{r['value_offering_label']} … {gap_s}"`

Rework the atomic-spot-check block (L106-120) so it no longer reads `value_offering`,
`value_offering_score`, `value_offering_label`, or `fee_gap_bps`:
- Drop the legacy-leg cross-check against the `value_offering` section (the `a = json.loads(...)`
  read at L107 and the `legs_match` compare at L109-115). The reframed panel reconciliation already
  lives in the "Reconciliation vs spec #7 panel" block (L82-89, which uses the surviving
  `value_offering_status` column) — keep that.
- Replace the per-row dump (L116-120) with the surviving fields the report should now show:
  `value_offering_reframed.value_index` (parse the `value_offering_reframed` JSON section, as the
  Phase 2/3 block at L122-130 already does), `value_offering_status`, `fee_fairness_label`, the gated
  `fees.fair_fee.gap_bps` (parse the `fees` JSON section), and `data_completeness_state`.
- The exact new table layout is the report author's call; the hard requirement is that it stops reading
  the four dropped columns so the documented `build-serving-facts` target completes.
The "Reconciliation vs spec #7 panel" block (L82-89) and the Phase 2/3 section-coverage block
(L122-130) already read only surviving columns (`value_offering_status`, `value_offering_reframed`,
etc.) — leave them.

## Serving integration
The change is entirely within the serving layer (`fact_assembler.py` + `load.py` + DDL). No new gold
panel, no `fact_assembler` *additions*. Rebuild + reload sequence for the data-scientist:
1. Apply the schema drop: `uv run python scripts/pipeline/apply_serving_schema.py` (idempotent ALTERs).
2. Re-assemble + reload facts via the existing build entrypoint (`make build-serving-facts` — runs
   `build_serving_facts.py` then `build_serving_facts_report.py`; the report **must already be
   reworked per the section above** or this step fails) so staging parquet + Postgres both lose the
   columns.
3. Rebuild the screener base (above).

## EDA question
Before editing: confirm the blast radius. Plot/print, over the full EQ fact universe (all rows in
`serving_facts_staging.parquet`): (a) count of rows where top-level `value_offering_score` is non-null
vs where `value_offering_reframed.value_index` is non-null — to quantify how many funds carried the
contradicting pair; (b) for the rows with both present, the distribution of
`value_offering_score − value_index` (signed), to document the magnitude of the contradiction being
removed (FCNTX is +41). This is for the change log, not a gate.

## Verification plan
- **Sample size**: 10-15 funds spanning the seed set (`FCNTX, DODGX, FBGRX, VDIGX, SEQUX, FXAIX, VOO`)
  plus a passive fund (`VOO`/`FXAIX`) and a `status='building'`/unsupported fund.
- **Atomic spot checks** (5+ records): for each, dump the rebuilt staging row and confirm:
  (1) `value_offering_score`, `value_offering_label`, `fee_gap_bps` keys are **absent** from the row;
  (2) the `value_offering` section key is **absent**; (3) `value_offering_reframed` is unchanged
  byte-for-byte vs the pre-change build (diff the JSON — capture a **fresh** pre-change build from the
  current code to use as this baseline; do **not** diff against the stale FCNTX capture, which predates
  the current `fact_assembler.py`); (4) `value_offering_status`,
  `confidence_state`, `fee_fairness_label`, `net_expense_ratio_bps` are **unchanged**; (5) the `fees`
  section still carries the gated `gap_bps` inside `fair_fee` (the gap value is not lost, only the
  top-level un-gated copy).
- **Aggregate sanity** (compare to prior build / baseline): fact row count unchanged (no rows dropped);
  `value_offering_reframed.value_index` non-null count unchanged; `screener_funds.parquet` row count and
  the ranked output of all 15 canonical queries unchanged head-to-head vs the prior screener build.
- **No-leakage / coherence note**: this removal *reduces* what ships; assert that no fact-row field that
  remains was *derived from* the dropped legacy score (it was not — reframed/fees are independent
  panels). The DDL drop must run before the next load so the COPY column list matches the table.
- Statistical coherence: N/A (deletion, no new statistic).

## Files to touch
- `/Users/alexfrey/Projects/fund_score/src/fundscore/serving/fact_assembler.py` (column contracts, row
  build, `_value_offering` helper)
- `/Users/alexfrey/Projects/fund_score/scripts/pipeline/apply_serving_schema.py` (DDL + idempotent drops)
- `/Users/alexfrey/Projects/fund_score/src/fundscore/product/screener_base.py` (drop `vo_score`/`vo_label`
  projections; drop or re-source `fee_gap_bps`)
- `/Users/alexfrey/Projects/fund_score/scripts/reports/build_serving_facts_report.py` (rework the
  atomic-spot-check block L106-120 so it stops reading the four dropped columns — REQUIRED, it runs as
  the second command of `make build-serving-facts`)
- `/Users/alexfrey/Projects/fund_score/tests/test_screener_base.py` (remove dead
  `value_offering_score`/`value_offering_label` fixture fields)
- `/Users/alexfrey/Projects/fund_score/tests/test_screener_engine.py` (remove dead `vo_score`/`vo_label`
  column-fill entries)
- (regenerated, not hand-edited) `data/product/fund_profiles/serving_facts_staging.parquet`,
  `data/product/query/screener_funds.parquet`

## Acceptance criteria
- Rebuilt `serving_facts_staging.parquet` rows have no `value_offering_score`, `value_offering_label`,
  `fee_gap_bps` scalar keys and no `value_offering` section key; everything else (including
  `value_offering_reframed`, `fees`, `value_offering_status`, `confidence_state`) is byte-identical to
  the prior build for the verification sample.
- `apply_serving_schema.py` run leaves a `fund_profile_facts` table with those four columns absent
  (`\d fund_profile_facts` shows no `value_offering_score` / `value_offering_label` / `fee_gap_bps` /
  `value_offering`); `value_offering_status` / `confidence_state` columns + `fpf_vo_status_idx` index
  remain.
- `load_to_postgres` completes (COPY column list == surviving columns) and the served row for FCNTX
  carries `value_offering_reframed.value_index = 30` and **no** top-level `value_offering_score`.
- `make build-serving-facts` completes end-to-end (both `build_serving_facts.py` **and** the reworked
  `build_serving_facts_report.py`) with no `KeyError` on the dropped columns; the generated report no
  longer references `value_offering`/`value_offering_score`/`value_offering_label`/`fee_gap_bps`.
- The emitted `gates` JSONB on a **freshly built** served row (not the stale FCNTX capture, which
  predates the current code) contains no `value_offering` key — already satisfied by the current GATES
  dict, so this must **remain absent** — and still carries the surviving gated sections incl.
  `value_offering_reframed`.
- `uv run pytest tests/test_screener_base.py tests/test_screener_engine.py` is green after the fixture
  cleanup.
- `make build-screener-base` produces an unchanged row count and unchanged ranked output for the 15
  canonical queries.
- `/check-data` passes on the rebuilt `serving_facts_staging.parquet` (no new FAILs vs the prior build).
- Served value == gold: the surviving `value_offering_reframed.value_index` equals the value in
  `data/gold/value_offering_reframed_panel.parquet` for the sample (unchanged by this work).

## Out of scope
- Removing `value_offering_status` / `confidence_state` (states, not the score; NOT NULL + indexed).
- Removing or modifying `value_offering_payload.parquet` (live pipeline input).
- The frontend type/gating/golden-test changes (the linked frontend spec).
- Any change to the reframed `value_index` computation or the Fee Fairness `gap_bps` value itself.

## Risks
- **Ordering**: the Postgres column drop must be applied before the next `load_to_postgres`; otherwise
  the table has columns the COPY list no longer fills (harmless for nullable columns, but apply DDL
  first to keep table and loader in sync). Document the run order in the build runbook.
- **Drizzle drift**: the frontend Drizzle schema also declares these columns; the *frontend* spec drops
  them there. If the backend DDL drops the Postgres column while the frontend schema still selects it,
  `select()` would error — this is exactly why the frontend `depends_on` this spec and removes the
  Drizzle column in the same change-set merge window. Coordinate the merge so the column is dropped in
  Postgres and in the Drizzle schema together (frontend spec handles the Drizzle side).
- **Screener `fee_gap_bps` re-source**: if any future query needs the fee gap, it must read it from the
  `fees` section, not the dropped scalar — call this out in the screener change so it is not silently
  reintroduced at the top level.
