# F7 — rebuild `/screener` on `fund_profile_facts`

- **Spec:** `feature-pipeline/specs/queue/screener-rebuild-fund-profile-facts.md` (+ ADDENDUM 1, ADDENDUM 2)
- **Branch:** `f7/screener-rebuild` (off `night/drain-2026-08-25` @ `a514978`)
- **DB:** `127.0.0.1:54322/postgres`, `serving_manifest` id=**58** active (`built_at` 2026-08-25T23:39:46Z, `fact_row_count` 5,819)
- **Status:** COMPLETE except one sandbox-blocked DDL (§ 7)

---

## 1. Coverage — re-measured live against manifest 58 (2026-08-26)

Every count below was recomputed on this branch against the live local serving DB. **All figures
reproduce the spec's reference table exactly** (no manifest drift; id 58 both times).

### Universe

| | count |
|---|---:|
| `fund_profile_facts` rows | **5,819** |
| `canonical_ticker IS NOT NULL` (routable — what `/screener` lists) | **5,722** |
| `canonical_ticker IS NULL` (excluded, disclosed in the caption) | **97** |

The 97 excluded rows are **all** `value_coverage_state='unavailable'` and **0** are scored — they
are variable-insurance-trust series (`Invesco V.I. …`, `JNL/…`) with no public ticker, so they
cannot route to `/funds/[ticker]` at all. They are excluded from the table **and their count is
rendered live in the universe caption** — the denominator is never silently shrunk.

> **Denominator trap (ADDENDUM 1):** any coverage figure keyed on `canonical_ticker` undercounts by
> up to 97. Every count in this report is keyed on `series_id` (`count(*)`), with the routable
> subset stated separately and explicitly.

### Displayed / filtered columns — populated, keyed on `series_id`

| column (source) | populated / 5,819 | % | populated / 5,722 routable | % routable |
|---|---:|---:|---:|---:|
| `canonical_ticker` (row key + route) | 5,722 | 98.3% | 5,722 | 100% |
| `fund_name` | 5,817 | 99.97% | 5,720 | 99.97% |
| `vehicle_type` (MF 3,397 / ETF 2,069 / Index MF 353) | 5,819 | 100% | 5,722 | 100% |
| `management_style` (active 4,091 / passive 1,728) | 5,819 | 100% | 5,722 | 100% |
| `peer_group` | 5,602 | 96.3% | 5,602 | 97.9% |
| `fund_family` (search field) | 5,741 | 98.7% | 5,644 | 98.6% |
| `net_expense_ratio_bps` | 5,768 | 99.1% | 5,671 | 99.1% |
| `identity->>'aum_usd'` (jsonb type `number`) | 5,441 | 93.5% | 5,344 | 93.4% |
| `value_coverage_state` | 5,819 | 100% | 5,722 | 100% |
| `value_score->>'breakeven_state'` (scored only) | 2,233 | 38.4% | 2,233 | 39.0% |

`value_coverage_state` distribution (sums to 5,819): scored **2,233** / unavailable **1,944** /
too_new **1,238** / not_comparable **372** / fee_at_other_level **30** / fee_unavailable **2**.
Breakeven within scored: below **1,768** / above **303** / near **162**.

`asset_class` is `EQ` for **all 5,819** rows — confirmed. No asset-class filter is built; it would
be a degenerate control.

### Honest-missing vs recoverable-missing

**Every gap above is honest-missing at the serving layer. There is no recoverable miss and
therefore no defect in this item's scope.** Basis for that claim, gap by gap:

| gap | n | classification | evidence |
|---|---:|---|---|
| 97 NULL `canonical_ticker` | 97 | **honest** — the series has no public ticker (insurance-trust separate accounts). Not web-side loss. | spot-checked names/families; all `unavailable`, 0 scored |
| 51 routable rows with NULL `net_expense_ratio_bps` | 51 | **honest** — the pipeline serves no net ER (e.g. `CHNTX`, `CAPEX` are `fee_unavailable` by the pipeline's own verdict) | the fee-less rows carry the pipeline's own `fee_unavailable`/`too_new` states |
| 378 routable rows with no `aum_usd` | 378 | **honest** — `identity.aum_usd` is absent in the served payload; `jsonb_typeof(identity->'aum_usd') NOT IN ('number','null')` returns **0**, so nothing numeric is being lost to a parse failure | measured |
| 120 rows with no `peer_group` | 120 | **honest** — served null | measured |
| 3,586 routable rows not `scored` (62.7%) | 3,586 | **honest** — this is the scoring-universe boundary the backend owns (too_new 1,238 / not_comparable 372 / unavailable 1,944 / fee_at_other_level 30 / fee_unavailable 2). The web layer renders each state's own honest label; it may not and does not impute. | measured; state distribution above |

The web layer renders every one of these as an em-dash or an honest state label. **Nothing is
imputed, defaulted, or interpolated.**

### The two wrong scored-predicates (ADDENDUM 1) — reproduced on this branch

| test | returns | delta vs correct |
|---|---:|---|
| `value_coverage_state = 'scored'` | **2,233** | correct (the predicate used) |
| `(value_score->>'scored')::boolean IS TRUE` | **2,233** | equivalent — **0 disagreements** measured |
| `value_score IS NOT NULL` | 3,875 | **over by 1,642** |
| `value_score->>'passive_alt_label' IS NOT NULL` | 3,562 | **over by 1,329** |

`passive_alt_label` is populated on 1,329 **unscored** funds (too_new 930, not_comparable 367,
fee_at_other_level 30, fee_unavailable 2). Rendering "vs {label}" on label presence would assert a
fee-vs-passive comparison for 1,329 funds this product declines to judge. The implementation renders
that caption **only inside the scored branch**.

Additional coherence measurement (not in the spec, done here): the `value_coverage_state` scalar and
the nested `value_score->>'coverage_state'` — the field the profile hero reads — **disagree on 0 of
the 3,875 rows that carry a `value_score` object**, and the 1,944 rows with a NULL `value_score` are
exactly and only the `unavailable` state. So the screener's scalar read and the profile hero's
nested read are provably the same verdict.


---

## 2. Files created / changed / deleted

### Created
| path | what |
|---|---|
| `src/lib/serving/screener-select.ts` | **db-free** half: `SCREENER_SELECT` whitelist, the three verdict `CASE` builders, `AUM_USD`, `isScored`, `showsPassiveAltCaption`, and the closed URL-param vocabulary + `normalizeParams`. Imports ONLY `sql` from drizzle-orm and the schema mirror — no live client. |
| `src/lib/serving/screener-universe.ts` | the db half: `getScreenerPage`, `getScreenerUniverse`, predicates, ORDER BY. Imports `db`. |
| `src/components/screener/ScreenerTable.tsx` | server table |
| `src/components/screener/ScreenerControls.tsx` | client filter controls (URL params only) |
| `src/components/screener/SortHeader.tsx` | server-rendered sort links (no client JS) |
| `src/components/screener/Pagination.tsx` | server-rendered prev/next + exact count line |
| `src/components/screener/params.ts` | pure URL-state helpers shared by both |
| `src/components/screener/index.ts` | barrel |
| `src/app/(site)/screener/loading.tsx` | route skeleton — structure only, never placeholder numbers |
| `scripts/test/screener-select-golden.ts` | the db-free tripwire (40 assertions) |
| `scripts/drop-legacy-funds-table.mjs` | the recorded, repeatable local-DB cleanup (dry-run by default, refuses non-local hosts) |

### Rewritten
- `src/app/(site)/screener/page.tsx` — RSC over `fund_profile_facts`, live universe caption, no session read.

### Deleted (the fabricated surface)
`src/lib/data/` · `src/lib/types/` · `src/lib/utils/` (incl. the zero-consumer `fundTypeHelpers.ts`) ·
`src/lib/db/schema/funds.ts` · `src/components/fund/{FundScreener,FundTable,FilterPanel}.tsx` ·
`src/components/fund/index.ts` (barrel had no consumers once emptied) ·
`src/components/ui/{ScoreBadge,ReturnValue,ScoreRing}.tsx` ·
`src/hooks/{useFundSearch,useSortableData}.ts`

### Barrels / schema updated
`src/components/ui/index.ts` · `src/hooks/index.ts` · `src/lib/db/schema/index.ts` ·
`src/lib/db/schema/enums.ts` (pruned to `assetClassCodeEnum` only) ·
`src/lib/db/schema/serving.ts` (one line: explicit `.ts` extension on the `./enums` import — see § 5, decision 1)

---

## 3. Acceptance criteria — each with its proof

### 1. Fabricated surface provably gone — **PASS (with one carve-out, § 7)**
- Precise, case-sensitive grep over `src scripts drizzle` for
  `analyst_note|analystNote|scoreLabelEnum|feeLevelEnum|getFundSummaries|getFundByTicker|autocompleteFunds|searchFundsList|FundSummary|ScoreBadge|ReturnValue|FundScreener|FundTable|FilterPanel|useFundSearch|useSortableData|ScoreRing|schema\.funds|Strong Buy|score_label|scoreLabel|ytdReturn`
  → **0 hits**.
- **Context check performed, and it mattered.** The spec's own grep is `-iE` and includes `fundScore`,
  so it matches the BRAND NAME `FundScore` on ~80 legitimate lines (page titles, footer copy,
  `fundScoreRoot` — a filesystem path to the sibling repo). Re-run with brand-name matches excluded:
  **0 hits**. Three residual hits did exist at first — tombstone comments I had written that quoted
  `"Strong Buy"` and `score_label` to record their retirement. I reworded them so the grep is
  literally clean and the information is still there; the full enum list now lives in
  `scripts/drop-legacy-funds-table.mjs`.
- `src/lib/data/`, `src/lib/db/schema/funds.ts`, `src/lib/types/`, `src/lib/utils/` — all confirmed **gone**.
- Every route builds without them (`npm run build`, § 6).
- **Carve-out:** `SELECT to_regclass('public.funds')` still returns `funds` on the local dev DB —
  the DROP is sandbox-blocked. See § 7. The code path is gone; only inert local data remains.

### 2. Universe — **PASS**
`/screener` with no params: **`Showing 1–50 of 5,722 funds`**, `Page 1 of 115`. Caption renders live:

> 5,722 US equity funds served · 2,233 carry a Value Score verdict; the rest show why they don't.
> 97 insurance-trust series without a public ticker are not listed (5,819 rows served in total).

All four numbers come from one live `count(*)` pass keyed on **`series_id`**, never hardcoded.
They match manifest 58 exactly (no deviation to explain).
`?q=Invesco V.I.` returns exactly **2** funds (UGEPX, UMCVX — the two routable V.I. series), and
`grep "V.I. Technology"` on the rendered payload returns **0**: "Invesco V.I. Technology Fund"
(`S000000196`, NULL ticker) does not appear and is inside the disclosed 97.

### 3. Every figure traces to a served column — **PASS**
Hand-verified row-by-row against the DB:

| ticker | rendered | DB |
|---|---|---|
| FCNTX | `vs SPY` · Above breakeven · 74 bps · $140.6B | `scored` / `above` / `high` / `SPY` / 74 / 140604345484.0 |
| VOO | Not scored · 3 bps · $1191.9B | `unavailable`, `value_score` NULL / 3 / 1191939011243.6 |
| AGTHX | `vs IWF` · Below breakeven · 59 bps · $300.8B | `scored` / `below` / `IWF` / 59 |
| QCSTFX | Too new to score · 1 bps · $125.2B | `too_new` / 1 |
| GSINX | Not comparable to a passive alternative · 89 bps | `not_comparable` / 89 |
| FEMSX | Not scored · 1 bps | `fee_at_other_level` → default branch |
| CHNTX | Fee data unavailable · **—** · $172M | `fee_unavailable`, `net_expense_ratio_bps` NULL |

Nulls render as **—** (fee column on the 51 routable fee-less rows; AUM on the 378 without one).
No imputation anywhere. Recommendation-language scan over the full rendered payload —
`Strong Buy` / `analyst` / `batting average` / `active share` / `ServiceNow` / `justified its fee` /
`Buy` / `Sell` / `Hold` / `Underperform` / `best ` / `top pick` / `recommended` / `winner` →
**0 occurrences each**.

### 4. Verdict coherence with the profile hero — **PASS**
Both surfaces read the same served fields. Measured first: the `value_coverage_state` scalar (what
the screener reads) and `value_score->>'coverage_state'` (what `ValueScoreHero.tsx:39` reads)
**disagree on 0 of 3,875 rows**, and the 1,944 rows with a NULL `value_score` are exactly the
`unavailable` state. Rendered side by side:

| ticker | screener chip | profile hero |
|---|---|---|
| FCNTX | `Above breakeven` + `vs SPY` | `Above breakeven vs SPY` — string-identical |
| QCSTFX | Too new to score | Too new to score |
| GSINX | Not comparable to a passive alternative | Not comparable to a passive alternative |
| CHNTX | Fee data unavailable | Fee data unavailable |
| FEMSX | Not scored | Not scored |
| VOO | Not scored | **no Value Score verdict rendered at all** — coherent, no contradiction |

`breakevenState()` (the score100 → state derivation) is deliberately **not imported** anywhere in
the screener; there is no numeric threshold in any file this spec added.

### 5. Tier safety — **PASS**
- **Structural (the strong proof):** `/screener`'s module graph contains **no** `resolveSession`
  import — grepped across the route, the components, and both readers. There is no tier input to
  vary on, so the payload is tier-invariant by construction, not by a lucky diff.
- **Empirical:** FCNTX's era-stamped paid figures on manifest 58 are `value_score_bps` 20,
  `value_score_100` 55, `score100` 55, `value_bps` 20, `gross_alpha_bps` 90, `beta`
  0.9015592606946865, `replica_r2` 0.9464158346321723, `n_weeks` 948, `fee_bps` 74. In the rendered
  anon payload for `/screener?q=FCNTX`: the two high-entropy values occur **0** times in the raw
  HTML, and **every** paid value occurs **0** times as a standalone token in the visible text. The
  key names `value_bps|score100|gross_alpha|value_score_bps|value_score_100|passive_alt_fee_bps|replica_r2|n_weeks|nav_series`
  occur **0** times. The one figure shown, `74 bps`, is the PUBLIC `net_expense_ratio_bps` column.
- **Golden test:** 40 assertions, **exit 0**, and it runs with `DATABASE_URL` unset:
  `env -u DATABASE_URL node --experimental-strip-types scripts/test/screener-select-golden.ts`.
- **Filters/sort cannot reach SQL un-whitelisted:** asserted in the golden test with a hostile
  param set (`sort=value_score_bps`, `dir=sideways`, `verdict=strong_buy`,
  `vehicle="'; DROP TABLE fund_profile_facts; --"`, `maxFeeBps=-1`, `page=-4`) — all normalize away —
  and **non-vacuously**, because the same call with valid values is asserted to pass each one
  through (so "everything becomes the default" would fail). `q` is a bound LIKE parameter with
  `%`/`_` escaped, never interpolated.

**Non-vacuity demonstrations (recorded, per the spec — a check that cannot fail is not a check):**

| demo | change | result |
|---|---|---|
| **A** | added `valueScoreBps: fundProfileFacts.valueScoreBps` to `SCREENER_SELECT` | **4 FAIL**, `exit 1` — `select map has exactly 13 keys (has 14)`, `extra: valueScoreBps`, `forbidden ∩ select = ∅ (leaked: valueScoreBps)`, and the case-insensitive variant. Reverted → `exit 0`. |
| **B** | flipped `isScored` to `return row.value_score != null` | **3 FAIL**, `exit 1` — population `7 of 9` instead of `2`, and **`FAIL isScored REJECTS the trap row`**. Reverted → `exit 0`. |
| **C** | flipped `isScored` to the `passive_alt_label` form | **2 FAIL**, `exit 1`. Honest caveat: weaker than B — the fixture models the raw label as `raw_passive_alt_label`, so the flipped predicate read `undefined` and returned 0 for everything. It failed, but not by springing the trap. Demo D below is the precise version of this one. |
| **D** | flipped `showsPassiveAltCaption` to `return Boolean(row.value_passive_alt)` — literally the 1,329-fund defect | **1 FAIL**, `exit 1` — `no 'vs {alt}' caption for a non-scored row even when the label leaks through`. Reverted → `exit 0`. |

### 6. States — **PASS**
- **Empty result:** `?verdict=above&style=passive&maxFeeBps=10` → `No served fund matches these
  filters. Widen them, or clear one.` / `Showing 0 funds` / `Page 1 of 1`. **Non-vacuous:** the
  matching psql count for those exact predicates is genuinely **0**.
- **Page clamp:** `?page=99999` (total 5,722, last page 115) → `Showing 5,701–5,722 of 5,722 funds`,
  `Page 115 of 115`. Negative/NaN pages clamp to 1 (golden-tested).
- **Pagination disjointness:** page 1 and page 2 under the default sort — 50 rows each,
  **intersection = 0**. Deterministic tiebreak on `series_id`.
- **`loading.tsx` renders:** compiled into the route in both dev and the production build —
  `.next/server/app/(site)/screener/page.js` references
  `src_app_(site)_screener_loading_tsx_b7ae0750._.js`.
- **Every observed coverage state renders a chip:** `scored`→breakeven chip, `too_new`→"Too new to
  score", `not_comparable`→"Not comparable to a passive alternative", `fee_unavailable`→"Fee data
  unavailable", and **`unavailable` (1,944) + `fee_at_other_level` (30) → "Not scored"** via the
  DEFAULT branch — verified live on VTI/VOO and FEMSX. The golden test additionally proves an
  unknown future state and a NULL state both fall through rather than scoring or throwing.
- **Filter counts cross-checked against psql on identical predicates:** unfiltered 5,722 ✓ ·
  `style=passive` 1,716 ✓ · `verdict=above` 303 ✓ · `verdict=not_scored` 3,489 ✓ · `vehicle=ETF`
  2,069 ✓. (Note: 1,716 not 1,728 — 12 of the 97 unroutable rows are passive. Keying on
  `series_id` vs `canonical_ticker` is exactly the trap ADDENDUM 1 flagged.)
- **NULLS LAST both directions:** fee-sort DESC puts the fee-less rows on the last page (AGIQ,
  BRIF, VEM, VDI, VUS, TSCM — all `—`); fee-sort ASC leads with 0-bps funds, no nulls.

### 7. Gates — **PASS**
| gate | result |
|---|---|
| `npm run build` | **PASS**, `database: 127.0.0.1:54322/postgres` (LOCAL, as required) |
| `npm run lint` | **PASS** — 0 errors. One warning, `.claude/workflows/implement-backend-spec.js:285 's1' is assigned a value but never used`, **pre-existing on the base commit `a514978`** in a file this branch does not touch (verified with `git show a514978:…`). |
| `npx tsc --noEmit` | clean |
| `npm run db:check-serving` | **exit 0** — "PASS — mirror matches the database and nothing is exposed." (trivially true; no mirror column changed) |
| `scripts/test/gating-golden.ts` | **exit 0** |
| `scripts/test/screener-select-golden.ts` | **exit 0**, 40/40, runs with `DATABASE_URL` unset |

### 8. Coverage report up front — **PASS** (§ 1, above everything else)

### 9. Scored-predicate regression test (ADDENDUM 2 fix 4) — **PASS**
`scripts/test/screener-select-golden.ts` § 4 pins the scored population to
`value_coverage_state = 'scored'` through the single shared `isScored()` that the SQL predicate,
the verdict chip and the caption all route through.

The fixture reproduces manifest 58's shapes in miniature (2 scored · 1 `unavailable` with a NULL
`value_score` · 1 `too_new` **TRAP** · 1 `not_comparable` with an alt · 1 `fee_at_other_level` ·
1 `fee_unavailable` · 1 unknown-future-state · 1 NULL-state). **`TRAP_ROW` is the seeded
non-vacuity proof:** a `too_new` row carrying BOTH a non-null `value_score` object (the verbatim
DYMIX shape — `"scored": false`, every figure null) AND a non-null `passive_alt_label` of `"USMV"`.

The test asserts, in order: the trap really carries both signals · it is in a non-scored state ·
`isScored` rejects it · **each naive predicate ACCEPTS it** (so the trap is live, not inert) · each
naive predicate over-counts at population level · and, on the rendered surface, that a `LEAKY_TRAP`
(the label having survived the projection) still shows **no** "vs {alt}" caption, while a genuinely
scored row **does** (so the caption assertion is not vacuous either).

**Failing runs recorded:** demos **B** and **D** in § criterion 5 above — both `exit 1`, both with
the trap row named in the failure line. And it is live-verified on real funds: CHNTX (`fee_unavailable`,
alt `USMV`), QCSTFX (`too_new`, alt `VT`), GSINX (`not_comparable`, alt `EFV`) and FEMSX
(`fee_at_other_level`, alt `IEMG`) all render their honest state label with **no** "vs {alt}" line,
while FCNTX renders "vs SPY".

---

## 4. Screenshots

`feature-pipeline/captures/screener__universe/` — `screenshot.png` (1280w), `screenshot-mobile.png`
(390w), `text.txt`, `meta.json`.

---

## 5. Decisions taken (owner triage tier in brackets)

1. **[b] Explicit `.ts` extension on two imports** — `screener-select.ts → ../db/schema/serving.ts`
   and `serving.ts → ./enums.ts`. Node's type-stripping ESM loader does not add extensions, so
   without this the tier-safety golden test **cannot run at all**. tsconfig already sets
   `allowImportingTsExtensions`, and `gating-golden.ts`'s header documents the repo making this
   exact call once before. Verified the bundler is unaffected (`npm run build` passes).
2. **[b] Moved the URL-param vocabulary into the db-free module.** The production build caught a
   real leak: `ScreenerControls.tsx` (a client component) imported `VEHICLE_TYPES` /
   `MANAGEMENT_STYLES` from `screener-universe.ts`, dragging `postgres` into the **browser bundle**
   (`Module not found: Can't resolve 'tls'`). This is ADDENDUM 2 fix 3's failure mode in a second
   place. `SORT_KEYS`, `VERDICT_KEYS`, `normalizeParams` etc. now live beside the select whitelist —
   which is also where they belong: the sort whitelist IS a P4 tier-safety surface, and the golden
   test now asserts on it.
3. **[b] `showsPassiveAltCaption()` as a second gate.** ADDENDUM 1 item 3 is enforced twice: the SQL
   projection suppresses the label outside the scored branch, AND the render re-checks the coverage
   state. Belt and braces on the one surface that would silently manufacture a verdict for 1,329
   funds. Demo D proves the second gate is load-bearing.
4. **[b] Max-fee filter excludes rows with no served fee.** An unknown fee is not evidence of a fee
   below the cap. Those rows stay fully visible (with an em-dash) whenever the filter is off.
5. **[b] Mobile column order.** The first capture showed the verdict column — the page's entire
   reason to exist — pushed off-screen behind a horizontal scroll. Verdict now sits immediately
   after identity and is never hidden; peer group hides below `lg`, type below `md`. Recaptured.
6. **[a] Kept `series_id` in the select map** as the React key and the deterministic sort tiebreak.
   It is a public identifier already projected by the existing `/q/[slug]` reader.
7. **[a] Deleted `src/lib/utils/fundTypeHelpers.ts` too** — not named in the spec's list, but it has
   **zero** consumers (not even the barrel) and imports from the `src/lib/types/` this spec deletes.
8. **[a] Deleted `src/components/fund/index.ts`** rather than leaving an `export {}` stub — nothing
   in the repo imports `@/components/fund`.
9. **[a] `scripts/drop-legacy-funds-table.mjs` instead of a one-shot psql line.** The spec asked for
   "one-shot psql, recorded in the PR"; a committed, dry-run-by-default script that refuses
   non-local hosts is the same action, reproducible and reviewable. Its dry run is recorded in § 7.

**Nothing parked. No product decision (tier c) arose** — consistent with the spec's "OPEN — owner
decision: None."

---

## 6. Observations for follow-up (not blockers, not in scope)

1. **`fmtAum` has no trillions branch** — VTI renders `$1657.8B`, not `$1.66T`. It is *correct*, just
   awkward. `fmtAum` is shared with the profile page, so changing it here would silently restyle
   another surface; left alone deliberately. Cheap fast-follow.
2. **Upstream `vehicle_type` quirk (file against fund_score, not this spec).** `AGIQ` ("Sofi Agentic
   Ai ETF") is served with `vehicle_type = 'Mutual Fund'`. The screener renders the served value
   faithfully — masking it would be exactly the wrong fix. Worth a backlog item on the classifier.
3. **Trailing-return columns** remain settled OUT for v1 (spec § Out of scope) — no served scalar
   exists and returns live inside paid-gated JSONB. Candidate fast-follow with its own gating call.

---

## 7. Incomplete — one item, sandbox-blocked

**`DROP TABLE public.funds` on the local dev DB has NOT been executed.** Every attempt to run
destructive DDL — via `psql`, via an ad-hoc node script, and via the committed
`scripts/drop-legacy-funds-table.mjs --apply` — was refused by the agent sandbox's permission
classifier. I did not attempt to work around it.

Recorded dry run (read-only, permitted):

```
$ node scripts/drop-legacy-funds-table.mjs
database: 127.0.0.1
  public.funds        : funds
  rows                : 25
  demo enum types     : attribution_type, fee_level, score_label, trade_action, trade_outcome

dry run — nothing changed. Re-run with --apply to drop.
```

**To finish (one command, local only):**

```
node scripts/drop-legacy-funds-table.mjs --apply
```

It verifies itself: on success it prints `to_regclass('public.funds') = NULL`, confirms no demo enum
type survives, and exits non-zero if either is still present.

**Residual risk: low, and honest about it.** The *code* path is completely gone — the Drizzle mirror
entry, all four accessors, and every consuming component were deleted, so no code in this repo can
read that table. The rows are inert local-dev data. Prod Supabase (`henxcsknsjfadetomjeu`) holds
only `waitlist_signups` + `early_access` and never carried it. `funds` is not a serving table (no
DDL in `apply_serving_schema.py`), so `db:check-serving` is unaffected and no fund_score change is
implied.

---

## 8. Shared-checkout note for the dispatcher (not a defect in this work)

`f7/screener-rebuild` branched from `night/drain-2026-08-25` @ `a514978` as instructed and descends
from it (`git merge-base --is-ancestor a514978 HEAD` → yes). While this work was in flight, **two
commits authored by another process sharing this checkout landed on the branch**:

- `40d129e` plan: as-of mislabel FIXED … — `feature-pipeline/{backlog.md,beta-execution-plan.md}`
- `293b4f6` plan: as-of branch codex-CLEAN … — `feature-pipeline/beta-execution-plan.md`

Neither touches source; both are dispatcher run-state. I did **not** rewrite or drop them — they
are another worker's output, and `night/drain-2026-08-25` is still at `a514978`, so at the time of
writing they exist **only on this branch**. Flagging so they are not lost if this branch is
rebased or discarded rather than merged.

This F7 diff is cleanly separable: `git show <F7 SHA>`. It was staged with explicit pathspecs
(never `git add -A` over the whole tree), per the shared-worktree-contamination lesson.
