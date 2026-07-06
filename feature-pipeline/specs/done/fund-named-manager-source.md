---
id: fund-named-manager-source
title: Source real named portfolio managers, tenure, and manager-change events (replace placeholder)
status: done
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/fund-identity-manager-freshness.md
created: 2026-06-24
scope: global
model: opus
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

## Implementation addendum — validated hybrid (regex fix + qwen3-8b), 2026-06-29
The v1 sample build failed data-review checkpoint-1 (Regents Park: honorific captured as name,
fabricated `lead` role, 3 of 4 co-PMs silently dropped). Two evidence-based validations resolved the
regex-vs-LLM question (read both before implementing):
- `reports/feature_pipeline/manager-extract-regex-validation.md` — regex is **fixable, not too brittle**:
  ~100% recall/precision on prose-singular + clean tables (the dominant classes); failures are an
  enumerable bounded set; fixed-regex ceiling ~95–98% recall / ~100% precision. A genuine long tail
  remains (free-form prose, multi-sub-adviser tables, combined-book attribution).
- `reports/feature_pipeline/manager-extract-qwen-headtohead.md` — **qwen3-8b** recovers the prose long
  tail at 100% recall / 0 fabrications (Potomac "helped manage", Regents Park surname-only plural,
  Cohen&Steers decoy), matches FCNTX incl. the retirement event, and — critically — returns honest-empty
  on the DODGX committee trap where **qwen3-32b fabricated 6 committee members**. Cost ≈ **$1–2** for the
  whole long-tail batch. Use **qwen3-8b** (identical recall to 32b, safer on committee funds).

**Build this hybrid:**
1. **Repair the deterministic regex (`manager_extract.py`) — keep it for prose-singular + clean tables.**
   Bounded fixes, each enumerated in the regex-validation report §4: (a) reject honorific tokens
   (Mr./Ms./Mrs./Messrs./Dr.) as name tokens; (b) delete the `n_pm_in_block==1 → "lead"` inference —
   only label explicitly-stated roles, else `unknown`; (c) match plural shared tenure ("Messrs. X and Y
   **have** managed … since YYYY", "commenced operations in YYYY") and split to each PM; (d) accept
   "Month YYYY" since-cells in `parse_table_block`; (e) strip leading "Since" in table cells;
   (f) whitelist name suffixes (Jr./Sr./II/III/IV); (g) backward name-scan from the tenure verb (not the
   first name-like token in the segment) to kill the lead-in decoy; (h) broaden retirement templates
   ("has announced his intention to retire effective …"). Target ~95–98% recall / ~100% precision.
2. **Add a qwen3-8b LLM leg for the prose long tail.** Reuse `trend-swing/llm_features/providers.py`
   `call_llm(system, user, provider="qwen3-8b")` (OpenRouter; load `OPENROUTER_API_KEY` from
   `trend-swing/.env`) — or vendor a minimal OpenAI-compatible client into fund_score so the build owns
   its dependency. **Route to the LLM** only blocks the regex can't confidently parse: non-standard
   tenure verbs ("helped manage", "is responsible for…"), standalone bios lacking the "the Fund since"
   anchor, surname-only plural where names stay unresolved, and any summary block that yields 0 regex
   rows but contains PM-like content. Prompt = the head-to-head's structured-extraction prompt
   (name without honorific; role only if stated; integer `since_year`; verbatim `evidence`; never emit an
   adviser/sub-adviser FIRM as a person; include EVERY named PM; also retirement/succession events);
   `temperature=0`, strip `<think>…</think>`, parse strict JSON.
3. **Committee hard-guard (MANDATORY, in code — do not trust the model).** Detect committee-managed funds
   (e.g. "Investment Committee" with no individual "managed since" tenure) and force `managers=[]`
   regardless of LLM output. 8b passed DODGX but 32b did not — enforce the honest-0 in code. This is a
   data-integrity invariant, not a model setting.
4. **Provenance for LLM rows.** `source_system = 'llm_extraction'`; carry `source_accession` +
   verbatim `manager_name_raw` + the evidence snippet for traceability. `confidence_state = 'high'` only
   with a verbatim "since YYYY" + clean name, else `'medium'` — do NOT blanket `'high'` (the failed v1
   shipped `high` on a corrupted row). Regex rows keep their existing provenance; placeholder rows keep
   `source_system = 'fundscore_method'` (invariant 12).
5. **Out of v1 scope — honest gap, do NOT fake it.** Multi-manager sub-adviser **sleeve tables**
   (Destinations-class) are NOT closed: qwen3-8b extracted only the 4 overlay PMs and dropped all 16
   sleeve PMs even with the full Item-5 in-window (validated — a comprehension ceiling, not truncation).
   These funds keep honest overlay-only / `unavailable` rows; the validation report MUST state the
   multi-sleeve coverage gap. Follow-up (separate task): structured sleeve-table parsing or prompt
   iteration + re-test before claiming that tail is closed.
6. **Re-clear the gates.** Re-run the atomic spot-checks (FCNTX, DODGX→0, Regents Park→4 real names,
   Potomac→Russo, Cohen&Steers→Yablon) on the sample BEFORE batch, then proceed through the reviewed
   assembly line (data-reviewer checkpoint after each step) + the codex sign-off gate.

## Implementation addendum 2 — extraction engine SHIPPED; remaining scope (2026-07-04)

The hybrid extractor above is **built, certified, independently reviewed, and review-hardened** on
`fund_score` branch `feat/manager-extract-r3` (HEAD `d76cfd8`; r4 fixes + regression in
`reports/feature_pipeline/manager-extract-r4-fixes.md`; certification + honest re-adjudication in
`manager-extract-r3-REVIEW-BRIEF.md` — holdout3 ship precision 96.0% raw / ~98.8% adjudicated,
auto-served 92.2% point estimate, burned-set range 78–87%). A full-universe build (4,048 EQ-active
series) is running to `data/gold/manager_build_20260704/` (assignments + change events + per-series
review verdicts). **Do NOT re-derive extraction logic — consume its output.** What remains of this
spec:

1. **Builder wiring**: map the build output (`manager_assignments_full.parquet`,
   `manager_change_events_full.parquet`) into the canonical `ASSIGNMENT_SCHEMA` /
   change-event outputs at `data/gold/manager_assignments.parquet` + `manager_change_events.parquet`
   via `manager_people.py` (bump `method_version`), preserving placeholder rows for uncovered funds
   exactly as specified above.
2. **Review gate is a serving invariant (NEW, from the r4 review).** The build emits per-series
   `review_status ∈ {confident, needs_review}` + `review_reason`
   (`manager_review_full.parquet`). ONLY `confident` series may serve real rosters; a
   `needs_review` series keeps its honest placeholder row (no names served) until promoted. Never
   ship a queued roster — the queue exists because those rosters are the residual error mass
   (sibling-attribution bleed, silent-empty, sleeve-incomplete).
3. **Web-verify pass before load (NEW).** Run `scripts/pipeline/verify_managers_web.py` (branch r4;
   flag-not-fix, CURRENT-as-of only, ~$0.012/fund) over the build — at minimum the queue, ideally
   all confident funds — and apply its promotions/demotions to the review parquet BEFORE the
   Postgres load. It catches the two residual confident-bucket error classes (sibling bleed,
   partial roster) that the in-filing gates cannot see. Web data must never source a name or touch
   historical as-of extraction.
4. **Serving integration** exactly as the "Serving integration" section above specifies
   (`managers[]`, `manager_transition`, `manager_as_of`, no firm fallback), then staging rebuild +
   Postgres load + the acceptance criteria unchanged.
5. **Open product decision for the UI spec (`fund-named-manager-ui`)**: what a `needs_review` fund
   shows (hide the module vs "manager data under review"). Recommended default: hide, with no
   claim — a wrong roster is worse than a missing module.

## Implementation addendum 3 — SHIPPED (2026-07-05)

Remaining scope delivered on fund_score branch `feat/manager-extract-r3` (HEAD `3f22609`;
worktree ~/Projects/fund_score-mgr-build). Codex SIGN-OFF: yes (re-review after d5d83f3, zero
findings). All data-reviewer checkpoints passed; /check-data PASS
(`reports/feature_pipeline/manager_canonical_20260705_check_data.md`).

- **Web-verify pass (full universe, 4,035 series, ~$50)**: 76 promoted, 736 demoted →
  **2,778/4,035 (68.9%) auto-served confident**, 1,257 queued with evidence. Two lane fixes
  shipped: credential-trademark normalization ('CFA®'), and the **dated-EDGAR evidence guard**
  (sec.gov citations older than the extraction filing are not "current" evidence — downgraded to
  inconclusive fail-closed; 195 spurious demotions + 182 weak promotions prevented). Provenance:
  `scripts/pipeline/prep_manager_web_verify_inputs.py` + `apply_manager_web_verdicts.py`.
- **Canonical panels** (`manager_people_v1.0`): real rows ONLY for post-web-verify confident
  series; placeholders preserved; 25 review-gated change events (FCNTX Danoff 2026-12-31
  survives); validator 24/24; previously-failing universe test passes.
- **Serving**: `_manager_parent` emits `manager_names`/`managers[]`/`manager_transition`/
  `manager_as_of` per contract; firm synthesis removed. Loaded as serving_manifest 26 (5,799
  rows); full-universe served==gold reconciliation passed; immutable snapshot
  `data/product/fund_profiles/serving_facts_manifest26.parquet` (the shared staging path was
  clobbered post-load by concurrent main-checkout work — do NOT re-load it from a branch without
  the manager serving code).
- **Branch note**: `feat/fund-family-panel` was merged in (serving-schema catch-up: the DB had
  already dropped legacy value_offering columns per `retire-legacy-value-offering-serving`);
  `load.py` COPYs the contract∩table intersection.
- **Follow-ups filed** (check-data report, ranked): cross-registrant change disclosures (GFOA
  Blair Frank case), AGTHX ticker keyed to F-2 class, placeholder provenance flattening
  (promotion queue vs never-covered), per-manifest staging snapshots in the loader; plus the
  pre-existing recall items (colon-form tenure, Lord Abbett/Hotchkis, roster-bearing filing
  selection).
