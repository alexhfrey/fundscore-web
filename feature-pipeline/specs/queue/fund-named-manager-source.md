---
id: fund-named-manager-source
title: Source real named portfolio managers, tenure, and manager-change events (replace placeholder)
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/fund-identity-manager-freshness.md
created: 2026-06-24
scope: global
---

## Goal
Replace the all-`unavailable` placeholder manager panel with **real, source-backed** named
portfolio managers, tenure start dates, and manager-change events (additions, departures, and
filed retirements/successions), so the profile page can name the PM and flag an imminent
transition. Today the page credits only the adviser *firm* ("Fidelity Management & Research Company
LLC") because `manager_assignments` is a placeholder; the single most-checkable real-world fact —
e.g. Will Danoff running Contrafund since 1990 with a co-PM added 2025-04-11 and a filed retirement
~2026-12-31 — is absent. **Do not fabricate names or dates.** This is the data prerequisite that
unblocks the named-PM UI.

## Context (critic evidence)
- Proposal `source_critiques: [data-quality, narrative]`. Served
  `manager_parent.manager_names = ['Fidelity Management & Research Company LLC']` — the firm, not
  the person. Root cause: `src/fundscore/serving/fact_assembler.py::_manager_parent` builds
  `manager_names` from `meta['adviser_name']` (the adviser firm), and the dedicated panel
  `data/gold/manager_assignments.parquet` is the v0 placeholder.
- Verified placeholder: all 8,656 rows of `manager_assignments.parquet` have
  `manager_name = null`, `confidence_state = 'unavailable'`, `missing_reason =
  'new_data_requirement'`, `method_version = 'manager_people_v0.1'`;
  `manager_change_events.parquet` has **0 rows**. The schema is correct and stable — see
  `src/fundscore/product/manager_people.py` and `docs/product/data_products/05_manager_people.md`
  (spec #5). Per the 2026-05-15 readiness audit, **zero portfolio-manager fields exist anywhere in
  the parsed gold/bronze layer** — only the adviser firm. So this requires a genuinely new source,
  not a join over existing data.

## Data source (real inputs + as-of)
The PM is named in regulated filings already reachable via EDGAR; pick the lowest-effort reliable
source and stamp provenance honestly (the closed `MANAGER_SOURCE_SYSTEMS` enum allows `mfrr`,
`n_csr_text`, `n_cen`, `llm_extraction`, `vendor`, `manual_curation`, plus `fundscore_method`
(priority 7) which is reserved for the builder-generated placeholder rows that stay `unavailable`):
1. **MFRR / N-1A XBRL prospectus layer** — `src/fundscore/mfrr/`, `data/mfrr/`. Already the
   structured source for inception/expenses/benchmarks. EDA must confirm whether it carries a
   portfolio-manager tag/field; if it does, this is the cleanest structured source (`source_system
   = 'mfrr'`).
2. **N-CSR / N-CSRS / prospectus narrative text** — the "Management" / "Portfolio Manager" section
   names the PM, their title, and "has managed the fund since YYYY". This is the canonical source
   for **tenure** and **change/retirement** language (`source_system = 'n_csr_text'`, or
   `'llm_extraction'` if an LLM parses the narrative). Note `data/nq/` holds N-Q/N-CSR *holdings*
   work; the *narrative* extraction is a new pass — scope it explicitly and stamp the accession.
3. **Vendor manager feed** if one is licensed (`source_system = 'vendor'`).

Pick ONE primary source for v1 (recommend N-CSR/prospectus narrative via LLM extraction, since it
carries names + tenure + change language together) and leave the multi-source merge/conflict policy
(`confidence_state = 'conflict'`) as the contract already specifies. As-of = the source filing's
period-end / accession date (`filing_date`, `as_of_date` per the existing schema).

## Computation (the metric, precisely)
Extend `src/fundscore/product/manager_people.py` (today the placeholder writer) to emit real rows.
Column names = exactly the existing `ASSIGNMENT_SCHEMA` / change-event schema (do not rename):
- `manager_assignments`: one row per `(series_id, manager_name, start_date, source_record_id)`.
  Populate `manager_name` (canonicalized) + `manager_name_raw` (verbatim), `role` ∈ the existing
  enum {`lead`,`co_manager`,`assistant`,`advisor`,`sub_advisor`,`unknown`}, `start_date` (tenure
  start), `end_date` (null = active; set on departure), `tenure_years` (computed from `start_date`
  to as-of), `source_system`, `source_accession`, `filing_date`, `as_of_date`, `method_version`,
  `confidence_state` ∈ {`high`,`medium`,`low`,`conflict`,`unavailable`}, `missing_reason`.
- `manager_change_events`: one row per `(series_id, manager_name, event_date, event_type)` with
  `event_type` ∈ {`added`,`departed`,`promoted`,`role_changed`,`unknown`}; `evidence` = the source
  snippet/accession that supports it. **A filed retirement/succession is an `added`/`departed`
  pair** carrying the announced effective date in `event_date` — surfaced so the UI can flag an
  imminent transition. Never infer a change from inception or marketing text.
- `fund_family_people_summary`: replace the placeholder `manager_count = 0` with the real per-family
  count once assignments are populated (already real for structural series counts).

Funds with no PM found in the chosen source keep the placeholder row (`manager_name = null`,
`confidence_state = 'unavailable'`, `source_system = 'fundscore_method'` [priority 7],
`missing_reason = 'new_data_requirement'`) — partial coverage is honest; do NOT backfill from the
adviser firm. Preserve the existing placeholder `source_system = 'fundscore_method'` on those rows
(do not clobber it) so the validator's invariant 12 (`source_system in MANAGER_SOURCE_SYSTEMS`) keeps
passing across the mixed placeholder/real output.

## Output (parquet path + schema)
- `data/gold/manager_assignments.parquet` — unchanged schema (`ASSIGNMENT_SCHEMA`), now with real
  rows where sourced. Bump `method_version` (e.g. `manager_people_v1.0`).
- `data/gold/manager_change_events.parquet` — unchanged schema, now non-empty.
- `data/gold/fund_family_people_summary.parquet` — real `manager_count` / `median_tenure_years`.
- Validation report `reports/product/manager_people_metadata_validation.md` (existing path).
- Build entry point: `scripts/pipeline/build_manager_people_metadata.py` (`make build-manager-people`).

## Serving integration (fact_assembler + schema changes)
- `src/fundscore/serving/fact_assembler.py::_manager_parent` — STOP synthesizing `manager_names`
  from `adviser_name`. Read the real assignment rows for the series and emit:
  - `manager_names`: list of active (`end_date is null`) `manager_name` ordered lead-first; empty
    list (not the firm) when none is sourced.
  - `managers`: per-manager object array `{name, role, start_date, tenure_years, confidence_state}`.
    **This array MUST be served under the JSONB key `manager_parent.managers[]`** — that exact key is
    the cross-spec contract this backend spec owns; the frontend spec `fund-named-manager-ui` reads
    `managers[]` for the named-PM line. Do not rename it (`manager_details`/etc) without amending both
    specs.
  - keep `adviser_name` / `fund_family` / `has_sub_adviser` as the firm-level context (the UI shows
    "Adviser: …" separately — do not conflate firm with PM).
  - a `manager_transition` block when a `manager_change_events` row has a **future or recent**
    `event_date` (filed retirement/succession): `{has_pending_transition: bool, event_type,
    effective_date, departing_manager, incoming_managers[], evidence}`.
  - a `manager_as_of` stamp (source filing period-end) so the UI can show inline freshness.
- The serving schema's `manager_parent` JSONB section already exists — **no Drizzle column change**;
  all of the above (`manager_names`, `managers[]`, `manager_transition`, `manager_as_of`) enriches the
  existing JSONB blob. The section gate stays `free`; the `manager_transition` block is `free` too (it
  is a public-interest fact, not paid analytics). Freshness is carried inline by the `manager_as_of`
  stamp above — that is the freshness affordance this spec ships.
- **Out of this spec's scope (separate Track 1A sub-task):** adding a `manager` row to the
  `source_inventory` footer ledger is NOT a fact_assembler edit. `source_inventory.parquet` is built by
  `src/fundscore/product/source_inventory.py` + `scripts/pipeline/build_profile_source_inventory.py`
  (`make build-profile-source-inventory`), and its validator enforces a HARD count-exact invariant:
  `rows == n_series × len(DOMAINS)` and "every series has all DOMAINS exactly once"
  (`scripts/reports/build_profile_source_inventory_report.py`). The `DOMAINS` tuple
  (`source_inventory.py:78-89`) has 10 entries today (no `manager`). Adding `manager` requires entries
  in all six per-domain dicts (`DOMAIN_SOURCE_SYSTEM`, `DOMAIN_SOURCE_PATH`, `DOMAIN_METHOD_VERSION`,
  `DOMAIN_FRESHNESS_DAYS`, `DOMAIN_MISSING_REASON`, `DOMAIN_LABEL_TEMPLATE`), wiring a per-series
  snapshot in `build_source_inventory` (`source_inventory.py:612`), and a full rebuild — taking the
  ledger from 86,560 rows (10×8,656) to 95,216 (11×8,656). Do this only as its own sub-task with an
  acceptance criterion that the "every series has all DOMAINS exactly once" invariant still passes at
  the new domain count; do NOT smuggle it into this fact_assembler change, where it would silently
  break the Track 1A validator.
- Rebuild `data/product/fund_profiles/serving_facts_staging.parquet` via `scripts/pipeline/build_serving_facts.py` (`make build-serving-facts`) and re-run the Postgres load (`load_to_postgres`, Track 1B loader).

## EDA question
Before building: (1) Does the MFRR/N-1A XBRL layer expose any portfolio-manager tag? Grep
`data/mfrr/` parsed fields for manager/PM. (2) Sample 20 N-CSR/prospectus filings across families
and plot: does the "Portfolio Manager" / "Management" section reliably name the PM + a "managed
since YYYY" tenure phrase? What fraction carries a change/retirement statement? (3) What is the
realistic coverage ceiling (fraction of the 8,656 EQ active universe with at least one named PM)?
Report it honestly — partial coverage is expected and acceptable.

## Verification plan
Per the project extraction gate — verify on a small sample BEFORE batch:
- **Sample size**: 100–400 filings for the extraction-rate read; PLUS 5+ atomic spot checks.
- **Atomic spot checks**: for 5+ funds (include FCNTX, DODGX, FBGRX, VDIGX), open the actual N-CSR /
  prospectus and confirm the extracted PM name(s), role, and tenure start match the document
  exactly — correct spelling, correct "managed since" year, no truncation, nothing material missed
  (co-PMs not dropped). For FCNTX specifically, confirm Will Danoff + the 2025 co-PM addition + any
  filed retirement language are captured with the right effective dates.
- **Aggregate sanity**: parse success rate, % of sampled filings yielding ≥1 named PM, distribution
  of managers-per-fund and tenure-years (a median tenure in low single-digit to ~10 years is
  plausible; flag if the distribution is implausibly uniform or all-recent, which would signal a
  parse artifact). Compare counts against `fund_family_people_summary` structural series counts.
- **No-leakage / coherence**: tenure_years must be derived from the SAME source filing's stated
  start_date and as_of (don't mix a vendor start with an N-CSR as-of). A `manager_transition`
  effective date must come from filed text, never inferred.
- If either check fails, diagnose and fix before the full run.

## Acceptance criteria
- `/check-data` passes on `manager_assignments.parquet` (entity = `series_id`, date =
  `as_of_date`).
- The existing `manager_people` validator (`scripts/reports/build_manager_people_metadata_report.py`)
  and the spec's invariants pass; `manager_change_events.parquet` is non-empty.
- Served `manager_parent.manager_names` for FCNTX is the real PM(s) (NOT the adviser firm), with a
  populated `manager_transition` block reflecting the filed succession; served value == gold panel
  row (spot-check 5 funds: served == parquet).
- Funds with no sourced PM keep an honest empty `manager_names` (no firm fallback,
  no fabrication); coverage % is reported in the validation report.
- Provenance is honest: every real row carries the correct `source_system` + `source_accession`;
  no row claims a source that didn't produce it.

## Out of scope
- The UI that renders the named PM / transition flag (separate frontend spec
  `fund-named-manager-ui`, `depends_on` this slug).
- Multi-source conflict resolution beyond the existing `confidence_state='conflict'` contract (v1
  may use a single primary source).
- Resolving true strategy inception (a different field/source).

## Risks
- **Fabrication risk is the top risk.** If the chosen source is sparse, ship partial coverage with
  honest `unavailable` placeholders — never infer a PM from the adviser firm, inception date, or
  marketing copy.
- LLM extraction hallucination: gate behind the atomic spot-check (read the real filing) before
  batch; require `source_accession` + verbatim `manager_name_raw` for traceability.
- Staleness: a "managed since 1990 / retiring 2026" fact is only as good as the latest filing —
  carry the `manager_as_of` stamp so the UI shows the as-of and the serving layer flags staleness.
