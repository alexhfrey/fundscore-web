---
id: screener-rebuild-fund-profile-facts
title: "F7 — rebuild /screener on fund_profile_facts; retire the fabricated 25-row demo table"
status: done
track: frontend
repo: fundscore-web
lane: standard
depends_on: ""
source_proposal: feature-pipeline/beta-execution-plan.md   # § P2 (ANSWERED 2026-08-08) + F7 queue row (line 280); no proposals/ file exists for this item
created: 2026-08-26
scope: page
model: opus
effort: high
---

## Owner summary
The "Screener" link in our top navigation still opens a demo page with 25 hand-written fund rows —
including invented ratings, invented returns, and an invented analyst write-up under real tickers
like FCNTX. This replaces it with a real screener over all 5,722 routable funds we actually serve,
showing only verified figures (our verdict, the fee, fund size), and permanently deletes the
fabricated demo data so it can never render again.

## Authorization (do not re-litigate)
`feature-pipeline/beta-execution-plan.md`:
- § P2 — **ANSWERED 2026-08-08: BUILD the screener for the demo** (owner rejected removing the nav
  link; "we can flesh after this"). Rebuild on `fund_profile_facts` **around the Value Score
  verdict**.
- Line default (decision register, `beta-execution-plan.md:118`): "screener port defaults to a
  Postgres-served query surface (same pattern as profiles) unless the worker's EDA finds a hard
  blocker." EDA below found **no blocker** — direct Postgres over `fund_profile_facts` is the pick.
- § P4 — ANSWERED 2026-08-08 (`beta-execution-plan.md` § `P4 — ANSWERED 2026-08-08`, line 438 at time of writing — cite the HEADING, not the line: that file is the live run-state doc and its line numbers move nightly): per-fund `value_bps_3y` gates to PAID
  on every surface; aggregates free only if they cannot reconstruct a single fund's figure. The
  column set below is chosen to be coherent with this ruling.

## Goal
`/screener` (linked from `src/components/layout/Header.tsx:21`) becomes a server-rendered,
filterable, paginated table over the served fund universe, keyed on the Value Score verdict —
every figure traceable to a `fund_profile_facts` column, zero fabricated values — and the entire
legacy demo surface (`funds` table, `src/lib/data/`, demo components) is provably retired.

## Context — grounded in main @ `4c43717`

**What's wrong today.** `src/app/(site)/screener/page.tsx:1,10` calls `getFundSummaries()`
(`src/lib/data/index.ts:39-41`), which reads `schema.funds` (`src/lib/db/schema/funds.ts`) — the
pre-pivot demo table: **25 rows** vs **5,819** in `fund_profile_facts` (active serving manifest 58,
built 2026-08-25). The demo rows carry fabricated `fund_score`, `score_label` ("Strong Buy"),
fabricated trailing returns, and a fabricated `analyst_note` with invented trade attributions and
an investment recommendation — under real tickers. `FundTable.tsx:151` renders the fabricated
score as a badge on every row. This is the exact class the data-integrity rule forbids.

**Consumer audit of the legacy surface (accessor-name grep, not literal-path — per the
consumer-audit lesson).** Verified on main:
- `getFundSummaries` / `getFundByTicker` / `searchFunds` / `autocompleteFunds` — sole importer of
  any of them is `src/app/(site)/screener/page.tsx:1`. No script, no API route, no other page.
- `schema.funds` — referenced only inside `src/lib/data/index.ts`.
- Legacy UI chain (each with zero consumers outside the chain + barrels):
  `FundScreener.tsx` → `FilterPanel.tsx` + `FundTable.tsx` → `ScoreBadge.tsx`, `ReturnValue.tsx`,
  `useFundSearch.ts`, `useSortableData.ts`, `src/lib/utils/{search,format,colors}.ts`,
  `src/lib/types/fund.ts`. `ScoreRing.tsx` is already orphaned (barrel-only). The whole chain is
  deletable; nothing else imports `@/lib/types`, `@/lib/utils`, or `@/lib/data`.
- The `analyst_note` no longer renders anywhere (the serving-backed profile replaced the old
  detail page), but the data **exists in the local DB** and `score_label`/`fund_score` still
  render via `FundTable.tsx:151`. Retirement must remove both the render path and the data.
- Prod Supabase (`henxcsknsjfadetomjeu`) holds only `waitlist_signups` + `early_access` — the
  fabricated table never reached prod. The drop below is local-dev + code.

**What already exists to build on.**
- `src/lib/serving/screener.ts` — the Postgres query-results reader (screener-beta-port,
  2026-08-07). Its verdict-select pattern (`screener.ts:172-178`) reads the PUBLIC verdict from
  the fund's own served row: `value_coverage_state` scalar + `CASE WHEN scored THEN
  value_score->>'breakeven_state' / 'confidence' / 'passive_alt_label' END`. The precise paid
  figures are **never selected**. Reuse this pattern verbatim.
- **Verdict single-source invariant (preserve, by name):** the breakeven state is read from the
  served `value_score.breakeven_state` field — the same field the profile hero renders — so the
  screener and the fund page can never disagree on a verdict (`screener.ts:146-152`; chip
  helpers `breakevenState`/`breakevenStateChipLabel`/`breakevenStateChip`/`coverageStateLabel` at
  `src/lib/serving/format.ts:81,101,116,126`; chip fallback precedent
  `src/components/query/ResultCard.tsx:107-125`). The web layer must never re-derive a verdict
  from a numeric score client-side.
- `src/lib/db/schema/serving.ts:82-170` — typed mirror of `fund_profile_facts` with all columns
  this spec needs already present (no mirror change, no fund_score change).
- `src/lib/serving/gating.ts` — `applyGates` strips `value_score` precise figures + the
  denormalized `valueScoreBps`/`valueScore100` scalars below paid (`gating.ts:960-983`). The
  screener does not go through `applyGates` (list read, not a fact-row read), so its safety comes
  from a **select-list whitelist** — see Tier safety.
- `scripts/test/gating-golden.ts` — db-free golden-test precedent (run:
  `node --experimental-strip-types …`). The new select-whitelist tripwire follows this shape.

**Redesign-collision check (queue + approved proposals scanned on main, 2026-08-26).**
- `profile-v2-production-cutover.md` declares screener surfaces **orthogonal** (its "Out of
  scope": "the X-Ray/screener surfaces (`exposure-screener`, `portfolio-exposure-parity` queue
  items are orthogonal)"). No queued or approved item retires `/screener`, `Header.tsx`, or any
  component this spec touches. No `at_risk` marker needed.
- **Overlap ruling on `feature-pipeline/specs/queue/exposure-screener.md` (settled):** F7 is
  **orthogonal** — it neither subsumes nor depends on it, and `exposure-screener` stays queued
  unchanged. Boundary: F7 owns the `/screener` route = the fund-universe table over served
  verdict/fee/identity columns. `exposure-screener` extends `/search` + Lens with
  exposure-criteria predicates over the 169-dimension panel and remains **blocked** on
  `serve-full-exposure-panel` (a screener over a top-N panel would silently drop true positives —
  its own spec forbids starting early). One design constraint so the two compose later: F7 keeps
  **all filter/sort/page state in URL searchParams**, so exposure facets can be added to
  `/screener` as another param family without rework. `/implement-next` should treat
  `exposure-screener` as untouched by this spec.

## Coverage — measured 2026-08-26 against the live local serving DB (manifest 58, era-stamped; all figures are diff references, re-verify at build time)

| Field (source) | Populated | % of 5,819 | Screener use |
|---|---|---|---|
| `canonical_ticker` | 5,722 | 98.3% | **row key / routing — WHERE `canonical_ticker IS NOT NULL`** |
| `fund_name` | 5,817 | 99.97% | column |
| `vehicle_type` | 5,819 (MF 3,397 / ETF 2,069 / Index MF 353) | 100% | filter + column |
| `management_style` | 5,819 (active 4,091 / passive 1,728) | 100% | filter + column |
| `asset_class` | 5,819 — **all `EQ`** | 100% | **degenerate: do NOT build an asset-class filter** (single value); render a static "US equity funds" caption instead |
| `peer_group` | 5,602 | 96.3% | column (em-dash when null) |
| `fund_family` | 5,741 | 98.7% | text-search field |
| `net_expense_ratio_bps` | 5,768 (5,671 of routable 5,722 = 99.1%) | 99.1% | column + max-fee filter + sort (NULLS LAST). p5/p50/p95 = 9/79/164 bps |
| `identity->>'aum_usd'` | 5,441 (5,344 routable) | 93.5% | column + default sort desc, NULLS LAST |
| `value_coverage_state` | scored 2,233 / unavailable 1,944 / too_new 1,238 / not_comparable 372 / fee_at_other_level 30 / fee_unavailable 2 | 100% | verdict filter + chip |
| `value_score->>'breakeven_state'` (scored only) | below 1,768 / above 303 / near 162 | 38.4% scored | the verdict chip |
| `value_score->>'passive_alt_label'` (scored) | 2,233/2,233 | 100% of scored | "vs SPY" caption |

**Missingness split (per the coverage-first rule):** every gap above is **honest-missing at the
serving layer** — the null is what the pipeline serves (unscored funds, fee at another share-class
level, no AUM figure), not a web-side extraction failure; the web layer must render each as
em-dash / an honest state label and may not impute. The 61.6% unscored fraction is the known
scoring-universe boundary (owned by fund_score, tracked there), not a defect this spec can or
should recover. **The implementer re-runs these counts at build time** and reports them in the PR;
a deviation is explained by a manifest/universe change (compare `serving_manifest.id`) or it is a
defect.

**The 97 NULL-`canonical_ticker` rows:** all are variable-insurance-trust-style series (spot-
checked: "Invesco V.I. …" / "JNL/…" families), all `value_coverage_state='unavailable'`, 0 scored.
They cannot be routed to `/funds/[ticker]` at all. **Settled: exclude them from the table** and
disclose the exclusion in the universe caption with a live-computed count ("97 insurance-trust
series without a public ticker are not listed"). Never silently shrink the denominator.

## Solution

### Scope questions — settled
1. **Data source: direct Drizzle query on `fund_profile_facts`.** The `query_canonical_*` surface
   (15 catalog / 140 result rows, verified live) is a fixed pre-ranked menu for `/q/[slug]` — it
   cannot serve a 5,722-fund filterable universe and stays untouched. Direct Postgres satisfies
   the line default; 5,819 rows with existing indexes (`fpf_ticker_idx`, `fpf_asset_class_idx`)
   need no new index — a seq scan at this size is milliseconds. No fund_score work, no mirror
   change, no schema change.
2. **Tier columns: the v1 payload is tier-invariant and public-only.** Columns: ticker, name,
   vehicle type, management style, peer group, verdict chip (+ "vs {passive_alt_label}",
   confidence), net ER (bps), AUM. The paid figures (`value_score_bps`, `value_score_100`,
   `value_bps_3y`, gross/fee receipt, nav series) are **never selected** by the screener reader —
   not stripped later, never fetched. No sort by any paid or paid-derived figure (sort whitelist:
   ticker, name, fee, AUM), so no ordinal reconstruction of a paid per-fund figure is possible —
   coherent with P4. Consequence: no new `GATED_SECTIONS` entry is introduced, so the
   fail-open-on-missing-`defaultGate` class (the defect found on the `positioning_changes` entry)
   cannot arise here; the tripwire below guards the whitelist instead.
3. **Legacy retirement: full delete + local drop** (sole-consumer chain verified above; file list
   below). This is the fabricated surface's provable end, as an acceptance criterion.
4. **Coverage:** table above; live-computed universe caption on the page.
5. **Unscored & unroutable funds:** funds stay **visible** with an honest state chip — `scored` →
   breakeven chip via `format.ts:101,116`; `too_new`/`not_comparable`/`fee_unavailable` → their
   labels via `coverageStateLabel` (`format.ts:126`); `unavailable`/`fee_at_other_level`/any
   future state → the default "Not scored" (fail-safe honest; note: `unavailable` (1,944) and
   `fee_at_other_level` (30) are live states beyond the four the `ValueScore` comment documents —
   both correctly fall through). Fee/AUM columns still render for them (1,934 of the 1,944
   `unavailable` rows have a served ER). The 97 NULL-ticker rows are excluded + disclosed (above).
   Keying is on `value_coverage_state` (the Value Score verdict axis), **not** the legacy
   `value_offering_status` enum — the owner decision says "around the Value Score verdict".

### Architecture (RSC, URL-driven — same serving pattern as profiles)
- **New reader `src/lib/serving/screener-universe.ts`** (do not grow `screener.ts`; that module is
  the canonical-query reader with an intentionally frozen API). Exports:
  - `SCREENER_SELECT` — the exported select map (public whitelist only): `canonicalTicker`,
    `fundName`, `fundFamily`, `vehicleType`, `managementStyle`, `peerGroup`,
    `netExpenseRatioBps`, `aumUsd: sql\`(identity->>'aum_usd')::double precision\``,
    `value_coverage_state`, and the three `CASE WHEN scored` verdict fields copied from
    `screener.ts:172-178`. Exported so the golden tripwire can assert on it.
  - `getScreenerPage(params): Promise<{ rows, total, universe }>` where `params` =
    `{ q?, vehicle?, style?, verdict?, maxFeeBps?, sort?, page? }`. Base predicate
    `canonical_ticker IS NOT NULL`; `q` → `ilike` over ticker/name/family (Drizzle-parameterized,
    never interpolated); `verdict` maps to state predicates (`above|near|below` ⇒ scored ∧
    `breakeven_state`; `not_scored` ⇒ `value_coverage_state <> 'scored'`); `sort` resolves
    through a **closed whitelist map** (`ticker|name|fee|aum` × `asc|desc`, NULLS LAST,
    deterministic tiebreak `series_id`); page size 50, `LIMIT/OFFSET`; `total` from a count query
    with the same predicates; `universe` = live counts for the caption (total served, routable,
    excluded-null-ticker, scored). Default sort: AUM desc.
- **Page `src/app/(site)/screener/page.tsx`** (rewrite): RSC, `force-dynamic` (keep the existing
  build-host comment rationale), reads `searchParams`, calls `getScreenerPage`, renders header +
  universe caption + controls + table + pagination. No session read needed (payload is
  tier-invariant) — do not import `resolveSession`.
- **Components `src/components/screener/`**: `ScreenerControls.tsx` (client; search input reusing
  `src/components/ui/SearchInput.tsx`, vehicle/style/verdict selects, max-fee input — writes URL
  params via `router.replace`, resetting `page`), `ScreenerTable.tsx` (server; row → link to
  `/funds/{canonical_ticker}`; verdict chip per the `ResultCard.tsx:107-125` fallback logic using
  `format.ts` helpers; em-dash for every null via `fmtBps`/`fmtAum`/`EM_DASH` from
  `src/lib/serving/format.ts` — do not resurrect `src/lib/utils/format.ts`), `Pagination.tsx`
  (prev/next + count line "Showing 51–100 of 2,233"). Add `loading.tsx` with a table skeleton.
- **Copy charter:** no "best/top pick/recommended/Strong Buy/winner"; verdict chips use the calm
  styles (`format.ts:116-124` — deliberately no celebratory green); the page subtitle keeps the
  existing fee-vs-passive framing; a small link to `/search` for question-style queries. The
  screener finds; it never advises.

### Tier-safety tripwire (non-vacuous, required)
New db-free golden test `scripts/test/screener-select-golden.ts` (pattern of
`gating-golden.ts`, run with `node --experimental-strip-types`):
1. asserts `Object.keys(SCREENER_SELECT)` **exactly equals** the whitelist (set equality both
   directions — any added or renamed key fails);
2. asserts a non-empty forbidden list (`valueScoreBps`, `valueScore100`, `value_bps`, `score100`,
   `gross_alpha_bps`, `fee_bps`, `passive_alt_fee_bps`, `beta`, `n_weeks`, `navSeries`,
   `fundFamilyPanel`) is disjoint from the select keys **and** that the SQL text of the three
   verdict `CASE` expressions projects only `breakeven_state|confidence|passive_alt_label`;
3. **non-vacuity is demonstrated, not assumed**: the implementer temporarily adds one forbidden
   key, shows the test FAIL, reverts, and records both runs in the PR (a check that cannot fail
   proves nothing — vacuous-check lesson).

### Legacy retirement (the fabricated surface, provably gone)
Delete, updating each barrel (`src/components/fund/index.ts`, `src/components/ui/index.ts`,
`src/hooks/index.ts`, `src/lib/db/schema/index.ts`):
- `src/lib/data/` (entire dir) · `src/lib/db/schema/funds.ts` · `src/lib/types/` (entire dir) ·
  `src/lib/utils/` (entire dir: `search.ts`, `format.ts`, `colors.ts` — consumers all die here;
  keep `src/lib/serving/format.ts`, a different module)
- `src/components/fund/FundScreener.tsx`, `FundTable.tsx`, `FilterPanel.tsx`
- `src/components/ui/ScoreBadge.tsx`, `ReturnValue.tsx`, `ScoreRing.tsx` (orphan)
- `src/hooks/useFundSearch.ts`, `useSortableData.ts`
- Prune `src/lib/db/schema/enums.ts` to only `assetClassCodeEnum` (the one enum `serving.ts:19`
  imports); the demo enums (`scoreLabelEnum`, `feeLevelEnum`, `attributionTypeEnum`,
  `tradeActionEnum`, `tradeOutcomeEnum`) go with `funds.ts`.
- Local dev DB: `DROP TABLE IF EXISTS public.funds;` (+ `DROP TYPE IF EXISTS score_label,
  fee_level, attribution_type, trade_action, trade_outcome;`) — one-shot psql, recorded in the PR.
  `funds` is not a serving table (not in `apply_serving_schema.py`), so no fund_score change and
  `db:check-serving` is unaffected. Prod never held it; the D1 runbook needs no change.

## Files to touch
Rewrite: `src/app/(site)/screener/page.tsx`.
Create: `src/lib/serving/screener-universe.ts` · `src/components/screener/{ScreenerControls,ScreenerTable,Pagination}.tsx` · `src/app/(site)/screener/loading.tsx` · `scripts/test/screener-select-golden.ts`.
Delete + barrel updates: the retirement list above.
Untouched (by design): `src/lib/serving/{screener,gating,profile,lens,session}.ts`, `src/lib/db/schema/serving.ts`, `Header.tsx`, fund_score.

## Data dependencies (all exist — verified in `serving.ts:82-170` + live DB, manifest 58)
`fund_profile_facts`: `series_id`, `canonical_ticker`, `fund_name`, `fund_family`, `vehicle_type`,
`management_style`, `peer_group`, `asset_class`, `net_expense_ratio_bps`, `value_coverage_state`,
`value_score` JSONB (`breakeven_state`, `confidence`, `passive_alt_label` — public verdict fields
only), `identity` JSONB (`aum_usd`). **No missing fields; no backend prerequisite; depends_on
empty.**

## Acceptance criteria
1. **Fabricated surface provably gone:** `git grep -iE "analyst_note|analystNote|scoreLabel|score_label|fundScore|Strong Buy|getFundSummaries" -- src` returns 0 hits (context-check any residual hit — leak-greps need eyes, not just counts); `src/lib/data/` and `src/lib/db/schema/funds.ts` do not exist; `SELECT to_regclass('public.funds')` on the local dev DB returns NULL. Every rendered route builds without them.
2. **Universe:** `/screener` with no params lists the routable universe (2026-08-26 reference: 5,722 of 5,819; re-computed live, deviations explained by a manifest change or they are a defect); the caption shows live total / scored / excluded-unroutable counts — never hardcoded. "Invesco V.I. Technology Fund" (a NULL-ticker series) does not appear and is inside the excluded count.
3. **Every figure traces to a served column;** no web-derived scores, no imputation: nulls render as em-dash (fee-less rows: 51 routable at reference time) or an honest state label. No recommendation language anywhere on the route.
4. **Verdict coherence:** for each captured ticker (test plan), the screener chip state string-equals the profile hero's `coverage_state`/`breakeven_state` for the same session tier — both read the served `value_score` fields; no numeric re-derivation in screener code.
5. **Tier safety:** the anon RSC payload for a page containing FCNTX contains none of the forbidden figures (spot-check the serialized payload text for `value_bps|score100|gross_alpha` keys and for the era-stamped FCNTX paid values); `screener-select-golden.ts` passes AND its failure mode is demonstrated (criterion-3 of the tripwire). Filter/sort params cannot reach SQL un-whitelisted (sort key outside the map falls back to default; `q` is parameterized).
6. **States:** empty-result filter combo renders the honest empty state; out-of-range `page` clamps; `loading.tsx` renders; every `value_coverage_state` value observed in the DB renders a chip (including `unavailable`/`fee_at_other_level` → "Not scored").
7. **Gates:** `npm run build && npm run lint` pass; `npm run db:check-serving` exits 0 (must be trivially true — this spec changes no mirror); golden gating test still passes (`node --experimental-strip-types scripts/test/gating-golden.ts`).
8. **Coverage report up front:** the PR opens with the re-measured coverage table (populated % per displayed/filtered column, honest-missing framing) before any screenshots.

## Test plan
Capture (per the capture convention, `feature-pipeline/captures/`) and hand-verify against the DB
row: **FCNTX** (scored active; 2026-08-26 reference: ER 74 bps, alt SPY — era-stamped, re-read
live), **VOO** (passive index — verify its actual served `value_coverage_state` first, don't
assume), one `too_new` fund, one `not_comparable` fund, one `unavailable` fund with a served ER
(1,934 exist), one routable fund with NULL ER (em-dash in the fee column + fee-sort places it
last). Walk anon + free + paid on the FCNTX page: payload identical (tier-invariant), chip
identical to the profile hero. Pagination: page 1 ∩ page 2 = ∅ under the default sort; total
equals the count query. Filters: `style=passive` returns 1,728±reload-drift; `verdict=above`
returns 303±; each cross-checked with a psql count using the same predicates.

## Out of scope
- Exposure-criteria screening (stays `exposure-screener`, blocked on `serve-full-exposure-panel`).
- Trailing-return columns. Settled OUT for v1: no served scalar exists (returns live inside
  `performance`/`nav_series` JSONB with per-field paid gating), the product's thesis is screening
  on value-for-fee rather than past returns, and the owner pre-authorized thin-then-flesh ("we
  can flesh after this"). Candidate fast-follow with its own gating decision; not an open blocker.
- Paid-tier extra columns / paid sorts; saving a screen as a Lens; NL search integration.
- Prod data load (D1 / `prod-serving-data-load-beta-runbook`); Header changes.

## Risks
- **Stale-checkout hazard:** this spec is grounded in main @ `4c43717`; the authoring worktree was
  pinned to a July commit. The implementer MUST branch from current main and re-verify the cited
  line numbers before editing.
- Reload drift: every count here is manifest-58-stamped and non-binding; acceptance recomputes.
- Deleting `src/lib/utils/` and the barrels can break an unnoticed import added after `4c43717` —
  the build gate catches it; re-run the consumer greps on the implementation branch first.
- `(identity->>'aum_usd')::double precision` throws if a non-numeric string ever appears; today
  the field is numeric-typed JSON. Guard with a `CASE WHEN identity->'aum_usd' IS NOT NULL AND
  jsonb_typeof(identity->'aum_usd')='number'` wrapper rather than trusting the cast.
- A future `value_coverage_state` value falls through to "Not scored" — honest by construction,
  but the chip fallback must remain a default branch, never an exhaustive match that throws.

## OPEN — owner decision
None. All five scope questions were settleable from the 2026-08-08 P2/P4 rulings and measured
data; the single product-flavored call (no trailing-return columns in v1) is settled above under
the owner's "flesh after this" delegation and flagged as a fast-follow candidate.

## ADDENDUM 1 — dispatcher, 2026-08-26: the "is this fund scored?" test, and the two ways to get it wrong

Added during the night-drain verification pass. The spec above correctly keys the verdict axis on
`value_coverage_state`, but it never says what the OTHER, more obvious tests return — and both of
them are wrong in the direction that ships a verdict we do not have. Measured on manifest 58:

| test | returns | verdict |
|---|---:|---|
| `value_coverage_state = 'scored'` | **2,233** | ✅ correct |
| `value_score->>'scored' = true` | **2,233** | ✅ correct — **0 disagreements** with the above |
| `value_score IS NOT NULL` | 3,875 | ❌ over by **1,642** |
| `value_score->>'passive_alt_label' IS NOT NULL` | 3,562 | ❌ over by **1,329** |

**Why the naive test fails.** `value_score` is a JSONB object that is **present and non-null for
funds the pipeline explicitly refuses to score** — 1,238 `too_new`, 372 `not_comparable`, 30
`fee_at_other_level`, 2 `fee_unavailable`. The object is internally honest (it carries
`"scored": false` and every figure null), but its mere presence means nothing. `DYMIX`
(`too_new`) is a worked example: `score100`, `value_bps`, `beta`, `confidence`, `replica_r2`,
`breakeven_state` and `above_breakeven` are all `null`, yet the row exists.

**Why the second test fails, and this one is nastier.** `passive_alt_label` IS populated on **1,329
unscored funds** (930 `too_new` + 367 `not_comparable` + 30 + 2). So a "vs SPY" caption rendered on
the presence of a passive-alt label would assert a fee-vs-passive comparison for 1,329 funds where
this product deliberately declines to make one — including 1,238 funds that are simply too new to
judge. That is manufacturing a verdict, not surfacing one, and it is the exact failure this page
exists to avoid.

**Binding on the implementer:**
1. The scored predicate is `value_coverage_state = 'scored'`. `value_score->>'scored'` is an
   acceptable equivalent (proved identical, 0 disagreements) but pick ONE and use it everywhere.
2. **Never** use presence of `value_score` or of `passive_alt_label` as a proxy for scored.
3. The "vs {passive_alt_label}" caption renders **only** in the scored branch, never from label
   presence.
4. Add a golden assertion pinning the scored count to the `value_coverage_state` predicate and
   proving it can fail — seed a row in a non-scored state carrying a `value_score` object and a
   `passive_alt_label`, and show the assertion catches it. A check that cannot fail is not a check
   ([[vacuous-check-and-boundary-axis]]).

**Also confirmed for the spec's own numbers:** `asset_class` really is `EQ` for all **5,819** rows,
so the spec's refusal to build an asset-class filter is right — it would be a degenerate control.
And the 97 NULL-`canonical_ticker` rows reproduce exactly; note that **any coverage figure keyed on
`canonical_ticker` silently undercounts by up to 97**, which is a trap the dispatcher walked into
earlier the same night on a different item.


## ADDENDUM 2 — dispatcher, 2026-08-26: three review fixes, applied to the SPEC before dispatch

`artifact-reviewer` returned **READY WITH FIXES**, no owner decisions. All three are settled here so
the implementer reads one coherent document rather than a spec plus a correction list.

**Fix 1 + 2 (mechanical, applied above).** Two `file:line` pointers were stale from the July worktree
the spec was drafted in — the P4 ruling and the `gating.ts` `value_score` strip block. The underlying
claims were both TRUE; only the pointers were wrong. The P4 pointer is now anchored to its heading,
because `beta-execution-plan.md` is the live run-state document and its line numbers shift nightly.

**Fix 3 (engineering, BINDING — the spec's own "db-free" promise was false as written).** The spec
puts `SCREENER_SELECT` in `src/lib/serving/screener-universe.ts` and then claims
`scripts/test/screener-select-golden.ts` is db-free "following the `gating-golden.ts` precedent".
It would not have been. Verified: **`src/lib/serving/gating.ts` has ZERO imports** — that is deliberate,
and its own header says so ("so the golden test can import `applyGates` without a live Postgres client
or `DATABASE_URL` in its import graph"); the db-touching half lives in `profile.ts`. Meanwhile
`src/lib/db/index.ts` eagerly constructs a `postgres()` client at module scope off
`process.env.DATABASE_URL!`. So `screener-universe.ts` — which must `import { db }` to run
`db.select(...)` — drags a live client into the test's import graph, and the tripwire that is supposed
to guard tier safety would fail to run wherever `DATABASE_URL` is absent. **A tier-safety check that
cannot run in CI is not a check.**

Required: put `SCREENER_SELECT` and the three verdict `CASE` builders in their own module
`src/lib/serving/screener-select.ts`, importing ONLY `fundProfileFacts` from `../db/schema/serving`
(schema references, no live client) and `sql` from `drizzle-orm`. `screener-universe.ts` then imports
`db` and `SCREENER_SELECT` from there. This mirrors the existing `gating.ts` / `profile.ts` split
exactly — do not invent a new pattern.

**Fix 4 (engineering, BINDING).** ADDENDUM 1 item 4 is marked "binding on the implementer" but lives
below the fold, and the numbered Acceptance criteria never reference it — so all eight could go green
without it ever being built. It is hereby **Acceptance criterion 9**:

> **9. Scored-predicate regression test.** A golden assertion pins the scored population to
> `value_coverage_state = 'scored'` (2,233 on manifest 58) and is proved **non-vacuous** by a seeded
> row in a non-scored state that carries BOTH a non-null `value_score` object AND a non-null
> `passive_alt_label` — the assertion must catch it. Record the failing run. This is the specific
> regression that would otherwise surface a fee-vs-passive verdict for 1,329 funds this product
> deliberately declines to judge.

## ADDENDUM 3 — implementer, 2026-08-26: shipped on `f7/screener-rebuild`

Implementation report (coverage first, then every acceptance criterion with its proof, the four
recorded non-vacuity FAIL runs, and the decisions taken):
`feature-pipeline/reports/f7-screener-rebuild.md`.

All nine acceptance criteria PASS with one carve-out on criterion 1: `DROP TABLE public.funds` on
the LOCAL dev DB was refused by the agent sandbox's permission classifier and has **not** run. The
code path is fully retired (mirror entry, accessors and every consuming component deleted), prod
never held the table, and `db:check-serving` is unaffected — but `to_regclass('public.funds')` still
returns non-NULL locally. One command finishes it:

    node scripts/drop-legacy-funds-table.mjs --apply

Two engineering findings worth carrying forward:

1. **ADDENDUM 2 fix 3's failure mode had a SECOND instance the spec did not name.** The production
   build caught `ScreenerControls.tsx` (a client component) importing the facet vocabularies from
   `screener-universe.ts` and thereby pulling `postgres` into the BROWSER bundle. The db-free split
   has to cover everything a client component imports, not just the golden test's entry point.
2. **The criterion-1 grep is over-broad as written.** `-iE …|fundScore|…` matches the brand name
   `FundScore` on ~80 legitimate lines. It needs the context check the spec asks for; a mechanical
   "0 hits" reading of it would be a false negative on this repo.
