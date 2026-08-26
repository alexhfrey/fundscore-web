---
id: eodhd-international-prices
title: EODHD international price layer — foreign-ordinary daily prices + ISIN→EODHD-code bridge (consolidation stage 1, receipts-priority slice)
status: queued
track: backend
repo: fund_score
lane: reviewed
depends_on: ""
source_proposal: owner ruling 2026-08-26 (receipts pricing, beta-execution-plan.md § Decision register) + owner ruling 2026-08-21 (CONSOLIDATE TO EODHD)
created: 2026-08-26
scope: global
model: opus
effort: high
---

## Owner summary
Today we cannot price the foreign stocks that international funds actually hold, so their
"receipts" cards — the line-by-line proof of what the manager's picks earned — either fall back to
US-listed stand-ins or stay blank. This build brings in daily price history for those foreign
stocks from EODHD, the vendor you already chose, so international funds get priced on the real
thing, with an honest per-stock record of what we could and could not get.

**Model note (opus, effort high):** the fetch plumbing is mechanical, but three parts carry real
judgment where plausible-but-wrong survives a green build: adjudicating which listing an ISIN maps
to (a stable-but-wrong winner froze bad bindings before — [[deterministic-wrong-worse-than-
nondeterministic]]), currency normalization (GBX vs GBP is a silent 100×), and the USD-basis
construction the validation gate depends on. The fable data-reviewer gates backstop each segment.

## Goal
Land, as canonical fund_score artifacts, the stage-1 slice of the EODHD consolidation that the
per-stock receipts build needs:
1. **`data/reference/eodhd_isin_bridge.parquet`** — deterministic ISIN → EODHD `{Code}.{Exchange}`
   identity bridge with full resolution provenance, honest exclusion on ambiguity.
2. **`data/bronze/stock_prices/eodhd_daily/`** (+ `data/bronze/eodhd/{search_responses,forex_daily}/`)
   — raw daily adjusted price history for the foreign ordinaries held by served funds, plus the FX
   pairs needed to express them in USD; incremental, resumable, rate-limited.
3. **`data/gold/foreign_stock_daily.parquet`** — the consolidated consumer panel (local + USD basis,
   minor-unit currencies normalized, hygiene quarantine separate and visible).
4. **`data/gold/foreign_price_coverage.parquet`** — the per-ISIN census the receipts consumer reads
   to set `pricing_basis`: every needed ISIN in exactly one status, so "use EODHD, fall back to
   us_line/adr_proxy" is a lookup, never a scan and never a fail-open.

## Authority & sequencing (read first)
- **Owner ruling 2026-08-26 (receipts pricing):** *"we have foreign stocks from EODHD, try to use
  that and fallback to US if not available."* Recorded in `feature-pipeline/beta-execution-plan.md`
  § Decision register (midday batch). The same entry records the measured fact this spec exists to
  fix: **no EODHD data exists in the repo today** — the 2026-07-16 spike was API-sampling
  validation only; `data/bronze/` has no eodhd layer and no ingestion script exists (verified again
  2026-08-26: `find -iname '*eodhd*'` returns only the two spike reports + the licensing email
  draft).
- **Owner ruling 2026-08-21 (CONSOLIDATE TO EODHD):** staged order (1) international layer first ·
  (2) US sector+identity · (3) US prices · (4) fund NAV last. **This spec is stage 1's
  receipts-priority slice: foreign PRICES + the identity bridge.** Foreign SECTOR (also stage 1 in
  the spike) is explicitly out of scope here — but the bridge schema must carry what the sector
  migration will need to key on later (code/exchange/currency/vendor-name provenance), so it is
  built once.
- **Owner refinement 2026-08-21 — do NOT delete FMP data; retire the CALLS.** This build makes NO
  FMP API calls and modifies NO FMP artifact (`data/reference/fmp_*` stay byte-identical; the
  `attach_sector` FMP-snapshot fallback keeps working). The new bridge is a NEW file — it never
  overwrites `fmp_isin_us_ticker_bridge.parquet`.
- **Downstream consumer:** `feature-pipeline/specs/queue/per-stock-receipts-backend.md`
  § ADDENDUM 2026-08-26 names this spec a PREREQUISITE of its Segment 1 and defines the served
  per-row enum `pricing_basis ∈ {eodhd_ordinary, us_line, adr_proxy}`. The census artifact (output
  4) is the surface that decision reads.
- **Fences:** F2 — one lakehouse-writing session at a time, dedicated worktree, per-item commits,
  owner merges ([[shared-worktree-contamination]]). A worktree isolates CODE not DATA — symlink
  `data/`, run the main venv python ([[fund-score-worktree-shared-lakehouse]]). Segment 0 writes
  nothing canonical.

## Ground truth (checkable references; verified 2026-08-26)
- **API key exists already:** `EOD_API_KEY` in `/Users/alexfrey/Projects/fund_score/.env` (file
  mtime 2026-07-16 — the spike day). The spike ran on a **$100/mo plan, 100k calls/day**; the
  owner's known target tier is **$399/mo Internal Use**. Segment 0 must check what plan the live
  key is on (EODHD `user` endpoint) and confirm daily quota covers the build (~2× the needed-ISIN
  count in calls; see § Computation) — do not assume the tier.
- **Universe scale (era-stamped, NON-BINDING diff references — Segment 0 recomputes):** the spike
  (2026-07-16, per-fund latest N-PORT snapshot cut) counted **19,554 foreign ISINs / $14.6T
  held**; `holdings_complete.parquet` today (2026-08-26, all quarters) has **753,070 non-US-ticker
  rows, 18,975 distinct non-null foreign ISINs, 5,719 non-US rows with NULL isin**. Deviations
  between these cuts are expected (different snapshots/windows); acceptance recomputes from live
  holdings, with deviations explained by a documented basis/universe change.
- **Resolve-rate prior (era-stamped 2026-07-16):** `search/{ISIN}` → `Code.Exchange` resolved
  **~96.8%** of sampled foreign ISINs. Segment 0 re-measures on the actual needed set.
- **The suffix bug (must engineer around):** `ASML.AS` mangled to `ASML-AS` returns NOTHING — this
  zeroed a first Gate-6 run in the spike. The fetch layer passes `{Code}.{Exchange}` VERBATIM;
  a unit test pins it (§ Acceptance).
- **EODHD `adjusted_close` is total-return adjusted** (dividends + splits; spike edge-case battery
  PASS) in LOCAL currency, with minor-unit listings (SHEL.LSE = 3160 **GBX/pence**) labeled.
- **EODHD's `CUSIP` field is STALE — never key on it.** ISIN is current (99.24% value-weighted
  embeds the held CUSIP). All identity resolution keys on ISIN (spike § 3.1).
- **Bronze fetch precedents:** `scripts/pipeline/fetch_sharadar_sep.py` (checkpointed batch files,
  resume-by-skip, universe from `holdings_snapshots` + `holdings_complete`, `.env` key fallback
  chain) and `scripts/pipeline/fetch_tiingo_pricing.py` (httpx client, throttle sleep, `fetched_at`
  column, incremental plan with restatement/corporate-action detection). Mirror these patterns.
- **Gold consolidation precedent:** `scripts/pipeline/build_fund_daily_adj_close.py` (source
  priority, keep-latest by `fetched_at`, hygiene QUARANTINE_PATH separate from output, regime/
  outlier detection). Mirror the quarantine-not-drop discipline.
- **Bridge-builder precedent:** `src/fundscore/reference/fmp.py::build_fmp_isin_us_ticker_bridge`
  + `ReferenceConfig` path properties (`src/fundscore/reference/config.py`). New module
  `src/fundscore/reference/eodhd.py` follows that shape; add the path properties to
  `ReferenceConfig`.
- **The consumer chokepoint:** `fund_score-wt-l9/reports/l9_per_stock_receipts.md` § S2-D4 — the
  receipts pricing path binds ISIN → price via a bridge (`fmp_isin_us_ticker_bridge` precedent,
  bind rule "ISIN → bridge → ticker, never name or ticker matching"), and its F-S2.10 measured
  **3,416 lines where two identity routes DISAGREE** (cusip_reference returns the ordinary/OTC
  line, the bridge returns the ADR — Alibaba "9988 HK" vs BABA). The same discipline binds here:
  deterministic adjudication, tied/ambiguous ⇒ honest exclusion.
- **The stale-quote trap (do not inherit):** L9 F-S2.8 — the shipped `priced_set` takes the last
  price on or before a grid date with NO freshness bound, fabricating 0% returns off years-stale
  quotes. The census carries `last_date` so the consumer can enforce a freshness bound; this spec's
  gold panel never forward-fills.

## Data source (real inputs, as-of)
- **Needed-ISIN universe:** `data/gold/holdings_complete.parquet`
  (`series_id, quarter_end, security_id, security_ticker, isin, cusip, security_name, inv_country,
  is_us_ticker, lei, valUSD, weight, pct_nav, sector`) filtered to the receipts scope: equity lines
  of the #10 universe (5,395 series per L9 F1.2; reproduce via `load_universe`, do not hardcode)
  with `quarter_end` inside the receipts window (2021→latest). Primary cut = `is_us_ticker = false`
  AND `isin` non-null; Segment 0 also measures the complementary cut "not priceable by the US
  store" (bronze sharadar_sep ∪ tiingo tickers) and reconciles the two, because `is_us_ticker` is
  partially tautological with priceability (L9 F2.2 basis note).
- **EODHD API** (`https://eodhd.com/api/…`, auth `api_token=$EOD_API_KEY`):
  - `search/{ISIN}` → candidate listings (`Code, Exchange, Name, Type, ISIN, Currency, Country,
    previousClose…`) — the resolution surface (spike § 3.2).
  - `eod/{Code}.{Exchange}?from=…&fmt=json` → daily OHLCV + `adjusted_close` (local ccy).
  - forex: `eod/{CCY}USD.FOREX` (or the documented pair orientation — implementer verifies against
    EODHD docs and RECORDS the orientation in the parquet metadata) for every currency present.
  - `user` → plan/quota (Segment 0).
  - Requests carry an identified User-Agent per vendor ToS (e.g.
    `FundScore.ai data ingestion (alex.h.frey@gmail.com)`). sec.gov UA rules don't apply here, but
    the same identify-yourself discipline does.
- **Validation truth source:** the funds' OWN filed marks — `valUSD/balance` per position per
  quarter from holdings (the L9 F-S2.9 method: filed USD price-per-share is the number the fund's
  NAV is actually built from; no FX argument needed).

## Output (schemas; column names = what is computed)
1. **`data/reference/eodhd_isin_bridge.parquet`** — one row per needed ISIN that RESOLVED:
   `isin · code · exchange · vendor_name · vendor_type · currency · country ·
   resolution_method ("exact_isin_unique" | "exact_isin_adjudicated") · n_candidates ·
   adjudication_note · resolved_at (UTC) · source ("eodhd_search_v1")`.
   Excluded/unresolved ISINs are NOT silently absent — they appear in the census (output 4) with a
   reason. Raw search responses persist to `data/bronze/eodhd/search_responses/` so adjudication is
   re-checkable without refetching.
2. **`data/bronze/stock_prices/eodhd_daily/`** — checkpointed batch parquets
   (`eodhd_batch_NNNN_YYYYMMDD_HHMMSS.parquet`):
   `isin · code · exchange · date · close · adjusted_close · volume · currency · fetched_at`.
   `data/bronze/eodhd/forex_daily/`: `pair · date · close · fetched_at`.
3. **`data/gold/foreign_stock_daily.parquet`**:
   `isin · date · code · exchange · currency (MAJOR unit after normalization) ·
   adj_close_local (major unit) · fx_usd (rate applied, orientation documented in file metadata) ·
   adj_close_usd · source ("eodhd") · fetched_at`.
   Quarantine: `data/gold/foreign_stock_daily_quarantine.parquet` (same columns + `reason`).
   Parquet metadata records: build timestamp (real clock, RECORDED — never a frozen `--today`,
   [[build-clock-recorded-not-frozen]]), input file census, FX orientation, minor-unit table
   applied.
4. **`data/gold/foreign_price_coverage.parquet`** — EXACTLY one row per needed ISIN:
   `isin · status ∈ {priced, resolved_no_history, us_primary_listing, unresolved_ambiguous,
   unresolved_no_match, null_isin_line, fx_unavailable} · code · exchange · currency ·
   first_date · last_date · n_obs · held_valusd_latest · n_funds_latest`.
   Contract: `needed_universe ⊆ census` with zero silent absences (a missing entry = fail-open =
   build failure, per the section-flip lesson and L9 F1.3's 1,387-fund hole). `priced` is the ONLY
   status the receipts consumer may map to `pricing_basis = eodhd_ordinary`;
   `us_primary_listing` routes to `us_line`; everything else falls back per the receipts spec.

## Computation (precise)
- **Resolution (bridge):** for each needed ISIN call `search/{ISIN}`; keep only candidates whose
  returned `ISIN` field EXACTLY equals the query (search fuzz-matches names — a non-ISIN match is
  never a resolution). Then:
  - 0 exact candidates → `unresolved_no_match`.
  - 1 exact candidate → resolve (`exact_isin_unique`).
  - N>1 exact candidates (multi-listed ordinary): deterministic adjudication — prefer the listing
    on the security's home market (`Country`/`Currency` consistent with the ISIN prefix and the
    filed `inv_country`), then the primary exchange over OTC/secondary lines. The exact preference
    order is the implementer's ONE judgment call; it must be written down in
    `src/fundscore/reference/eodhd.py`'s docstring, be a pure function of the candidate rows
    (rebuild-twice byte-identical), and any tie the rule cannot break ⇒ `unresolved_ambiguous`
    (honest exclusion, NEVER shortest-code/first-row arbitrary winners).
  - Exact candidate resolves to a **US exchange** → `us_primary_listing` (the Ra class: LIN, SPOT,
    ACN — the US line IS the security; the US store prices it; do not duplicate its history here).
- **Price fetch:** `eod/{code}.{exchange}` with the suffix VERBATIM; `from=` 2020-06-30 (six months
  of run-in before the receipts window) or the listing's start; incremental mode refetches from
  each code's last stored date. Throttle + checkpoint batches + resume-by-skip (sharadar_sep
  pattern); per-batch fetch log parquet (url-less: code, rows, status, fetched_at). Long runs are
  owned directly per [[own-long-llm-extraction-runs]] discipline (background bash, full log
  redirection), not via an orphaning subagent.
- **Currency normalization:** explicit minor-unit table (`GBX → GBP ÷100`, plus whatever EODHD's
  docs enumerate — implementer verifies, e.g. ZAC/ILA analogues, and records the table in the gold
  metadata). A currency NOT in the table and NOT having a fetched FX pair → the ISIN's rows go to
  quarantine and its census status is `fx_unavailable`. Never guess a divisor; never pass an
  unknown unit through silently.
- **USD basis:** `adj_close_usd = adj_close_local × fx_usd` joined on date (no forward-fill beyond
  the standard FX weekend/holiday convention — implementer states the convention chosen in the
  metadata; the validation gate will expose a wrong one).
- **Hygiene:** apply the house outlier discipline (step-jump/sub-penny detection per
  `build_fund_daily_adj_close.py`) but QUARANTINE with reasons, never silently drop, and never
  clamp. Audit every `!=`/negation filter added — new row types must not fail open
  ([[negation-filters-absorb-new-row-types]]).
- **Determinism:** bridge and gold builds are pure functions of bronze inputs; rebuild twice and
  diff (sorted) — a no-op check is a free determinism test ([[rebuild-twice-proves-determinism]]).

## Coverage doctrine (headline metric, up front)
Coverage of the NEEDED set — value-weighted first, count second — is the number this spec is
judged on, computed in Segment 0 BEFORE the build and re-measured at the end:
- `% of needed foreign held value (and ISINs) with status=priced over the receipts window`,
- the remainder split **honest-missing** (EODHD genuinely lacks it — proven by spot-checking the
  raw source: manual search by name/ticker on a sample of misses, not assumed) vs
  **recoverable-missing** (search/adjudication/fetch failed but the data exists — a DEFECT to
  iterate on, not "partial coverage"),
- `null_isin_line` mass reported separately (an identity gap upstream of this spec — file it,
  don't paper over it).
The receipts consumer's fallback split (eodhd_ordinary vs us_line vs adr_proxy projected shares)
is reported alongside, since that is what the owner's ruling actually buys.

## EDA gate — Segment 0 (data-scientist; NO canonical writes; blocks the build)
Deliverable: a report + a STOP at the data-reviewer checkpoint. Questions to answer with plots and
tables, on the live lakehouse + live API:
1. **The needed set, exactly:** distinct foreign ISINs (and their held valUSD / fund counts) in the
   receipts scope; reconcile the `is_us_ticker=false` cut vs the not-in-US-store cut; the null-ISIN
   mass. Rank by value; plot the cumulative-value curve (how many ISINs cover 80/95/99% of foreign
   held value — the fetch can be value-prioritized).
2. **Resolve rate, live:** run `search/{ISIN}` on a stratified sample (~300–500: top-value +
   random tail), measure exact-ISIN resolve rate value-weighted and by count vs the era-stamped
   96.8%; classify the misses (honest vs recoverable) by manual inspection of ≥15 of them; measure
   the multi-candidate rate (how often adjudication will fire) and eyeball 10 multi-candidate
   cases to draft the preference order for Segment 1.
3. **History depth + freshness:** for ~50 resolved codes across exchanges, fetch history and plot
   first-date/last-date distributions (does EODHD cover 2021→now for the held set? which exchanges
   are stale?) — the freshness read that keeps F-S2.8's trap out.
4. **Quota/cost:** `user` endpoint — plan, daily limit; projected total calls (needed ISINs ×
   [search + eod] + FX pairs + incremental steady-state); confirm feasibility or surface the tier
   upgrade to the owner ($399/mo Internal Use is the known target; display rights already confirmed
   by owner 2026-08-21).
5. **Currency census:** the currency mix of the resolved sample; which minor-unit currencies
   appear; which FX pairs will be needed.
Checkpoint 0 (data-reviewer): coverage projection with the honest/recoverable split leads the
report; sample sizes as above; any resolve-rate materially below the value-weighted prior must be
explained before the build proceeds.

## Build segments (assembly line; a data-reviewer checkpoint closes each)
- **Segment 1 — the bridge.** `src/fundscore/reference/eodhd.py` +
  `scripts/pipeline/build_eodhd_isin_bridge.py`; raw search responses to bronze; deterministic
  adjudication per § Computation; `ReferenceConfig` path property.
  *Checkpoint 1:* atomic — 20–30 hand-checked resolutions including the trap cases (ASML →
  `ASML.AS` suffix intact; an Alibaba-class HK/ADR multi-listing; a GBX LSE name; a `us_primary`
  Ra name; ≥5 `unresolved_*`), each verified against the raw search response; aggregate — resolve
  rate vs Segment 0's projection; rebuild-twice determinism; zero rows keyed on EODHD's CUSIP
  field.
- **Segment 2 — price + FX ingestion.** `scripts/pipeline/fetch_eodhd_prices.py` (+ `--incremental`);
  forex fetch for the census'd currencies; throttle/checkpoint/resume; fetch logs.
  *Checkpoint 2:* atomic — 10 codes' latest rows vs the EODHD web UI/API re-pull; the ASML.AS
  regression test green; aggregate — per-exchange row counts and date spans vs Segment 0's depth
  read; quota consumption vs projection.
- **Segment 3 — gold consolidation + census.** `scripts/pipeline/build_foreign_stock_daily.py` →
  gold panel + quarantine + `foreign_price_coverage.parquet`.
  *Checkpoint 3:* atomic — 10 ISINs traced bronze→gold (currency normalization shown, incl. one
  GBX name at exactly ÷100, one FX join); aggregate — census completeness (needed ⊆ census, zero
  silent absences; every status shown able to be non-empty or proven empty for a stated reason —
  a check returning 0 must be shown able to return non-zero); quarantine mass + reasons reported;
  `/check-data` run (protocol below).
- **Segment 4 — validation vs filed marks (the gate that makes this fit for receipts).** Re-run the
  L9 F-S2.9 method with a NEW leg: for consecutive-quarter position pairs of needed foreign lines,
  compare the EODHD-ordinary **USD** return against the fund's own filed `valUSD/balance` USD
  return, alongside the existing control (US lines) and Rb (ADR) legs. Apply the same disclosed
  >50pp screen; run the (security × quarter) cross-holder median disagreement detector (the
  ready-made corporate-action screen) and hand-inspect the top ~15 firings.
  *Checkpoint 4 (data-reviewer, adversarial):* era-stamped baselines (2026-08-17, NON-BINDING diff
  references): control median +0.22pp / 97.7% within 2pp; Rb ADR +0.37pp / 76.2% within 2pp /
  95.3% within 5pp. The eodhd_ordinary leg must recompute live and land **at least as tight as the
  Rb ADR wedge** (it prices the actual security in its actual market; if it is WORSE than the ADR
  proxy, the owner's precedence order is empirically wrong for that cohort — STOP and brief, do
  not ship the panel as receipts-fit). Deviations from baselines are acceptable only with a
  documented basis/universe explanation. Statistical-coherence concerns: no leakage of filed marks
  into the price series (they are independent sources — verify the join uses only isin+date); FX
  spot-checked vs a second source (e.g. FRED H.10) on ~10 dates.

## Verification plan (summary for the gates)
- Sample sizes: Segment 0 resolve sample 300–500 ISINs (≥15 misses adjudicated by hand); bridge
  atomic 20–30; gold trace 10; corporate-action firings ~15; FX cross-source 10 dates. Wedge legs
  run on ALL available pairs (frame join — cheap; L9 ran 7.9M).
- Priors/baselines: 96.8% resolve (2026-07-16); F-S2.9 wedge table (2026-08-17); holdings census
  (2026-08-26). All era-stamped, all recomputed, deviations explained not excused.
- No-leakage / independence: filed marks never feed price construction; the census never reads the
  bridge THROUGH another frame that would couple coverage
  ([[join-through-aux-frame-couples-coverage]]) — build it directly off the needed-ISIN frame.

## Acceptance criteria
1. Segment-0 report exists with the value-weighted coverage projection UP FRONT and the
   honest/recoverable split; data-reviewer checkpoint 0 passed before any canonical write.
2. Bridge: rebuild-twice byte-identical (sorted); zero resolutions keyed on EODHD `CUSIP`; every
   ambiguous tie excluded with a recorded reason, none adjudicated by arbitrary order.
3. A unit test proves the fetch layer passes `{Code}.{Exchange}` verbatim (the `ASML.AS` ≠
   `ASML-AS` regression) and it is green in the run log.
4. `data/gold/foreign_stock_daily.parquet` + quarantine + `foreign_price_coverage.parquet` exist;
   census covers the needed universe with EXACTLY one row per ISIN (fail-open impossible); build
   metadata records real build clock, FX orientation, minor-unit table.
5. `/check-data` passes on the gold panel (FAIL blocks; WARNs reported to the owner).
6. Segment-4 wedge table recomputed live; eodhd_ordinary leg ≥ Rb-ADR tightness or an owner STOP
   is on record; corporate-action detector firings inspected and reported.
7. Final coverage headline reported: % of needed foreign held value priced `eodhd_ordinary`-ready,
   remainder split honest/recoverable/null-ISIN, plus the projected receipts `pricing_basis` mix.
8. FMP untouched: `git status` clean of `fmp_*` paths and `data/reference/fmp_*.parquet` checksums
   unchanged; no FMP API call added.
9. Docs updated (per the standing documentation-maintenance agreement): `docs/agent_context_map.md` row for the EODHD
   layer, `docs/status/pipeline_status.md`, and a short `docs/pipelines/eodhd_prices.md` (layout,
   incremental usage, minor-unit table, FX orientation).
10. All work in a dedicated worktree branch, scoped commits (never `git add -A`), owner merges
    (F2/F3 fences).

## /check-data protocol (Segment-3 gate inputs)
- feature name: `foreign_stock_daily (EODHD international price layer, stage-1 receipts slice)`
- data path: `data/gold/foreign_stock_daily.parquet` · format: parquet
- entity column: `isin` · date column: `date` · universe type: foreign ISINs held by served funds
  (needed set from Segment 0)
- report output: `reports/product/eodhd_international_prices_checkdata.md`

## Out of scope (explicit)
- Consolidation stages 2–4 (US sector+identity migration, US stock/ETF prices, fund NAV) — the
  backlog EODHD story stays OPEN for those; do not annotate it from this spec.
- Foreign SECTOR fields (stage-1's other half) — the bridge is built to be reusable for it, but no
  sector fetch/attach here.
- The receipts computation itself, `pricing_basis` serving, and the Ra/us_line recovery — all live
  in `per-stock-receipts-backend.md`.
- Any UI/serving exposure of EODHD data (internal-use consumption by the receipts build only at
  this stage).
- FMP call retirement work beyond "this build adds none."

## Risks
- **Resolution wrong-winner risk** — the highest-severity failure (a wrong listing prices the
  wrong security confidently). Mitigated by exact-ISIN-only candidates, written adjudication rule,
  honest exclusion on ties, checkpoint-1 trap set.
- **Currency/minor-unit silent 100×** — mitigated by the explicit table + quarantine-on-unknown +
  the Segment-4 wedge gate (a 100× error cannot pass a filed-marks comparison).
- **Quota/plan mismatch** — the live key may still be the $100 spike plan; Segment 0 checks before
  the bulk fetch; owner already knows the $399 target.
- **EODHD raw tail artifacts** (spike: SONG 100,000× class) exist in foreign small caps too —
  quarantine + the value-weighted coverage lens keep them from distorting the build.
- **Freshness** — an exchange EODHD stops updating would recreate F-S2.8's stale-quote trap;
  `last_date` in the census + the consumer's freshness bound are the guard; Segment 0's depth read
  measures it before we depend on it.
