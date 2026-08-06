---
id: profile-v2-production-cutover
title: Ship the V4 fund profile to production /funds/[ticker] — movement-by-movement build over served data, then route cutover
status: queued
track: frontend
repo: fundscore-web
lane: reviewed
depends_on: recent-changes-te-ranked
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-02
revised: 2026-08-06
scope: page
model: opus
effort: xhigh
---

## Owner summary
This is the master plan for replacing today's fund page with the V4 design — the seven-movement
"verdict first, receipts behind it" page the three adversarial panels signed off on. The data layer
is nearly all real: most movements run on served data the moment the pending serving reload lands;
what remains is one queued backend spec (recent portfolio changes), one owner call on the per-stock
receipts section, and the final route swap with its launch-hygiene checks. Owner scope decision
2026-08-06: this is a **full-experience beta blocker** — the beta ships this page, not the old one.

## History (supersessions — the trail that got us here)

- **2026-07-02 (created):** spec targeted promoting the *eight-section v2 preview*
  (`/preview/funds/[ticker]`, spec `profile-v2-preview-route`) to production.
- **2026-07-11 (owner):** AI Summary de-scoped from V1 to a fast-follow — and subsequently dropped
  entirely (V4 has no AI-summary section; the fixture dies at cutover).
- **2026-07-22 (re-grounding banner):** the Crescent five-block redesign (web branch
  `feature/crescent-profile-v2`) superseded the eight-section list; `ai-summary-generation` and
  `attribution-quarter-blocks` proposals REJECTED.
- **2026-07-30 (owner, supersession banner):** **V4 is the target** —
  `fund_score/docs/product/strategy/mockup_fund_profile_v4_2026-07-28.html`, canon in
  `crescent_v3_iteration_2026-07-27.md` + `crescent_signature_artifacts.md`. Key rulings carried
  forward: **no headline 0-100 hero** (Value Score demoted to an ID-row catalog chip; two-figure
  money hero instead; past-tense badge); **stock picking merged into the manager movement** (the
  receipts table); **the neighbourhood uses the twin's FULL life** (the old since-2017 start was
  effectively cherry-picked); **do not cut over onto mixed bases** (the 2026-07-29 pool refit
  published a new twin next to attribution computed against the old one — backlog bug, line 51).
  The web branch `feature/crescent-profile-v2` (last 2026-07-28) is **NOT to be merged as-is** — it
  stays as the running preview and the component donor until this cutover executes against V4,
  then is archived. NOTE: that banner's section numbering ("02 performance / 03 the bets / …
  07 key stats") matched a pre-panel-R3 draft; the shipped mockup's numbering is below.
- **2026-08-06 (owner, this revision):** body re-grounded on the V4 file as shipped. Facts as of
  today: unify-te-decomposition segments 0-3 SHIPPED in fund_score gold (`te_decomp_v0.2_global`,
  `vo_reframe_v0.5`, one idio source); the owner-gated LOCAL serving reload is imminent (terminal
  cascade running — rebuilds `factor_attribution` + `profile_nav_series`, closing the mixed-basis
  defect); `serve-l2-passive-candidate-fit` backend done (candidates + fit floor in staging);
  `recent-changes-te-ranked` is the only queued backend spec dependency and is now unblocked;
  the per-stock receipts backend was filed to the backlog today (owner decision below).

### v2-preview-era flip log (preserved — this serving work IS the V4 data layer)
The section numbers below refer to the retired v2 preview layout; the *served sections* they
landed (with their critic verdicts) are exactly what V4 renders. Kept verbatim as the audit trail.

- **2026-07-12 — attribution window summary FLIPPED to served** (protocol steps 1–4 + flip-3/-4
  critic fast-follows): fixture DELETED; the summary is built verbatim from the served
  `riskAttribution.active_return_attribution` (exposure_path_v0.2, 2,479 funds) via
  `buildAttributionWindowSummary` + the quarter grid read lazily from `fund_attribution_blocks`
  behind a fail-closed `sectionEntitled` gate. Honesty upgrades: identity-exact "Smaller factor
  bets (not listed)" waterfall line; sign-derived takeaways; the prototype (β−1)×return beta-tilt
  bar retired with nothing estimated in its place. Gates: lint/build/golden ALL PASS + codex high
  pass 0 P0/P1. **Step 5 VERDICT: flip sound, no P0/P1** (FCNTX/DODGX/FCNTX-free/VOO): every
  rendered number byte-identical Postgres==staging==gold; identities exact to full float precision;
  free-tier zero-leak; VOO honest-absent.
- **2026-07-12 — fund_family_panel FLIPPED to served** (flip-2): fixture DELETED; fail-closed
  `defaultGate: "free"`; served 3Y columns with the explicit two-bases note (SI = shrunk Value
  Score; 3Y = realized β-adj after-fee excess — never added); unranked families render honestly
  (ranking needs ≥5); AUM as-of RANGE disclosed. Coverage 2,070 funds (1,549 ranked). **Step 5
  VERDICT: flip sound** (FCNTX/DREVX/ICWIX/VOO): render==DB==staging==gold; aggregates + rank
  4/115 + leaderboard recompute exactly. Escalation: P1 upstream N-CEN first-adviser pick
  misassigns DREVX's family (filed).
- **2026-07-12 — nav_series FLIPPED to served** (flip-1): fixture DELETED; applyGates field-gate is
  the single owner of the public/paid split; HONESTY FIX: "Since inception" relabeled everywhere to
  the COMMON PAIRED WINDOW start (FCNTX 2008-05, inception 1967). Coverage 3,190 funds. **Step 5
  VERDICT: PASS — ship-quality** (FCNTX/DODGX/VOO): all 16 period cells + chart endpoints
  byte-exact capture→Postgres→staging→gold AND reproduced from the raw daily parquets; free tier
  stripped at the PAYLOAD level.
- **2026-07-12 — positioning_context FLIPPED to served**: fixture DELETED; `applyGates` owns the
  section (fail-closed); shared `cohortPhrase`; blend-aware baseline chips; split freshness stamp.
  Coverage 1,961 funds. **Step 5 VERDICT: PASS** (FCNTX/DTEYX/GGHCX/IENAX): byte-exact chain +
  every percentile independently recomputed, honest-null IENAX end-to-end.
- **2026-07-12 — riskExplainers retired to DERIVED copy + 3Y risk expander wired to served
  riskBehavior**: `buildRiskExplainers` templates ⓘ copy from the SAME numbers the gauges display;
  `RiskDetail3Y` renders served `risk_behavior` (5,450 funds). **Step 5 VERDICT: PASS**
  (FCNTX/DODGX/VOO): chain byte-identical, per-fund stale stamps correct.
- **2026-07-12 — te_decomposition FLIPPED to served**: paid payload-gate (fail-closed), free proof
  point = grouped rollup + top bet (`pickTeProofPoint`), fixture DELETED, BetsTable joins served
  exposureXray weights. Coverage 2,043 funds; VOO degrades honestly.
- **2026-07-30 — direction-badge contract (unify web part a) SHIPPED on the donor branch**:
  `directionWords` one-vocabulary badges (OVER/UNDER vs LONG/AGAINST), `betDirection()` in
  gating.ts (served `bet_direction` else FWL beta sign), projector ranks by |te_alloc_bps| and
  honours `top_bet_confident` (no "biggest bet" superlative on a near-tie), `other_bets` rollup row
  renders, `bet_type` union widened to v0.2 kinds. Verified against real v0.2 AND v0.1 payloads;
  build+lint clean.

---

## Goal
Make the **V4 design** the real `/funds/[ticker]` page
(`src/app/(site)/funds/[ticker]/page.tsx`). The v2 preview
(`src/app/(site)/preview/funds/[ticker]/page.tsx`, branch `feature/crescent-profile-v2`) is the
**component and serving-contract donor**, not the layout. The build executes **incrementally per
movement** on the preview route (each movement flips to served data under the protocol below), with
one final route cutover at the end. Nothing ships on a fixture; nothing ships against a mixed twin
basis.

## The V4 target (read the file, not summaries of it)
`/Users/alexfrey/Projects/fund_score/docs/product/strategy/mockup_fund_profile_v4_2026-07-28.html`
(chip: "V4 · REAL TRNEX DATA · NEW TWIN + 35-FACTOR BASIS · 2026-07-30"). **Rendered movement
numbering** (the HTML comments and older banners carry a stale pre-R3 numbering — the on-page
eyebrows are the truth):

| # | id | Movement |
|---|----|----------|
| 00 | `#exec` | the verdict — claim `<h2>` + two-figure money hero + five-row case + conclusion/badge |
| 01 | `#whatis` | what is it — composition bigbar/unroll + "holds differently" + "moves differently" (the bets live HERE, not in a section of their own) |
| 02 | `#record` | the record — growth of $10k fund vs β-scaled twin (+ raw faint) + "where the gap came from" |
| 03 | `#twin` | the neighbourhood — twin FULL life vs world/US/bonds, capture triple, drawdown table, year-by-year |
| 04 | `#manager` | the manager and their names — who runs it, THE RECEIPTS, the skill read |
| 05 | `#family` | the fund family — leaderboard + the family's largest scored funds |
| 06 | `#stats` | key stats & details — the plain facts |
| — | `#sources` | sources & bases footer |

Mockup-internal stale line (non-binding, do not reproduce): movement 06's "Twin IXC 55% + VT 45% ·
Twin fee 0.25%" contradicts the page's own verdict (68% IGE + 32% VT · 0.28%) — a pre-refit draft
leftover. All TRNEX figures in the mockup are **era-stamped 2026-07-30 diff references**, not
acceptance values: recompute every number from live serving at build time; a deviation is
acceptable only when explained by a documented basis/universe change (e.g. a twin refit).

## V4 movement map — serving source · status today · donors · net-new

Status vocabulary: **served-in-staging** (real now, pre-reload) · **served-after-reload** (real
once the owner-gated serving reload lands — the terminal cascade rebuilds `factor_attribution` +
`profile_nav_series`; `te_decomposition`/`vo_reframe` v0.2 are already in gold) · **backend
queued** (spec in queue) · **no backend** (no spec — owner decision or new spec required) ·
**fixture** (dies at cutover).

### 00 · The verdict (`#exec`)
- **ID row + catalog chip**: `identity` section (public) + `value_score.score100` chip
  ("VALUE SCORE N / 100 · 50 = BREAKEVEN") + `value_score.breakeven_state` — served-in-staging.
  **No archetype chip in V4** (classifier never left fixtures; `crescent-archetypes.ts` dies).
- **Money hero**: cost leg = `fees.fair_fee.active_fee_over_passive_bps` (canonical figure; 1 bps
  = $1/yr per $10,000) — served-in-staging. Delivered leg = `nav_series.period_table` β-adjusted
  after-fee diff for the paired window (`beta_adj_diff_bps`) — **served-after-reload** (rebuilt by
  the cascade against the current twin). One window, both figures labeled with it.
- **Row "closest passive alternative"**: `value_score.passive_alt_label` + `.replica_r2` +
  `passive_baseline.{display_name, etf_weights, match_status}` + mini crescent — served-in-staging.
- **Row "what it costs"**: `fees.net_expense_ratio_bps` + `fees.fair_fee.passive_fee_bps` +
  the canonical over-passive figure — served-in-staging. Canon: the after-fee bar is ZERO and the
  cost row itself says so (the fee is already inside every after-fee figure).
- **Row "current positioning"**: `te_decomposition.rollup` kind split + top bet
  (`top_bet_confident` guard) — served-after-reload. The mockup's "biggest single difference from
  the twin is basic materials 19% vs 2%" is a HOLDINGS-vs-twin claim that needs the receipts
  backend; until that decision, this row's "biggest difference" line derives from the served
  te_decomposition top bet (behavior basis, labeled), never a fabricated holdings diff.
- **Row "the history"**: `nav_series.period_table` (since-paired-start + 5Y) — served-after-reload.
- **Conclusion + badge**: derived copy off `value_score.breakeven_state` (past-tense "Has not
  cleared its fee"), twin-fit confidence chip off `passive_baseline` fit floor
  (`match_status`/candidate fit), `SAME MARKET RISK · β` chip off `value_score.beta` — served.
- **Donors**: `ProfileHero` (identity masthead), `crescent/CrescentMark` (mini crescent),
  `crescent/VerdictBlock` (claim/badge logic — restructure), `v2/format.ts`, `InfoTip`,
  `crescent/BlockHeader`. **Net-new**: the money-hero two-figure card, the five-exrow ledger grid,
  the conclusion block. `DistributionStrip` (fill population strip) has no V4 home in 00.

### 01 · What is it (`#whatis`) — includes THE BETS
- **Card 1 "what moves this fund"** (bigbar twin vs own + active-layer unroll + per-kind legend
  with drill-down to named bets): `te_decomposition` v0.2 (`rollup`, `bets[]` grouped by
  `bet_type`, `other_bets`, `idio_risk_share`, `replicable_risk_share`, `window_start/end`,
  `anchor_as_of`, `anchor_lag_weeks`) + `value_offering_reframed.replicability` (same panel by
  construction, vo_reframe_v0.5) — **served-after-reload**. Direction badges + `top_bet_confident`
  handling already shipped on the donor branch. Required window disclosure (unify spec
  "Remaining"): quiet "bet mix measured through ⟨fit_window_end⟩" affordance; the ~7-week factor
  lag is disclosed, not hidden. Funds with `no_named_bets`/suppression render the honest
  missing-reason path.
- **Card 2 "what the manager holds differently"** (sector/company/country diff vs the twin's
  same-day look-through + "see every position" + private-companies posline): fund side =
  `fund_holdings_full` long table + `holdings.top_holdings` — served-in-staging (mockup TRNEX
  as-of 2026-03-31 is the served store; `HoldingsFullDrawer` is the donor for the show-all). Twin
  look-through side = **no backend** — same data product as the receipts (backlog item
  "Per-stock receipts backend for V4 movement 05", filed 2026-08-06, which explicitly covers the
  fixture-only `top10VsIwf` this card replaces). Blocked on the batch-3 owner decision below; if
  receipts are descoped for beta, this card ships fund-side-only cuts (filed book by
  sector/country off `fund_holdings_full.{sector,country}`) with NO twin column — never a
  fabricated look-through.
- **Card 3 "what moves it differently"** (per-factor swing table, "moves with/against", holdings
  agree/disagree notes): rows = `te_decomposition.bets[]` + `other_bets` — served-after-reload.
  **Gap**: the "can swing a year by ±$N" column is the bet's STANDALONE risk (|β|·σ_factor);
  `TeBet` serves `beta`/`var_share`/`te_alloc_bps` but not σ_factor — a small mechanical serving
  addition (per-bet `standalone_te_bps` in the te_decomposition builder + `fact_assembler`
  `_te_decomposition`; rider on the fund_score side, listed under Dependencies). Do NOT render
  `te_alloc_bps` under standalone-swing copy — different quantity. The holdings agree/disagree
  sublines depend on the receipts backend (holdings-vs-twin); without it the rows carry the
  behavior figures only.
- **Poslines**: "How concentrated": `value_offering_reframed.replicability.active_share` —
  served-in-staging, **verify the basis label before captioning it "differs from the twin"** (the
  panel's generic-benchmark vs twin-relative basis distinction is exactly the trap
  `crescent_signature_artifacts.md` § Honesty locks flags). "Biggest recent move": top TE-ranked
  change — **backend queued** (`recent-changes-te-ranked`); until it ships the posline is absent
  (not magnitude-ranked prose pretending to be significance-ranked).
- **Donors**: `AnatomySection` (chrome), `BetsTable` (direction badges, other_bets row,
  attributedFactorIds cross-ref), `CurrentPositioning` (weight joins), `HoldingsFullDrawer`.
  **Net-new**: bigbar/unroll strip, diff table, swing-table presentation, drill-down rows.
  **Fixture deaths**: `top10VsIwf`, `positioningBetBridges` (superseded; the "where it comes from"
  held-names line is unify web part (b) — a fast-follow, not a cutover blocker).

### 02 · The record (`#record`)
- **Growth of $10k** (fund net / twin β-scaled net / raw faint) + the compounding gap sentence:
  `nav_series.{points, series_start, period_table}` — **served-after-reload** (the cascade rebuilds
  `profile_nav_series` against the current twin). Donor: `GrowthChart` (window-aware range buttons,
  "Max" not "since inception") + `HistoricalPerformance` (period table) + `HurdleHeadline`. The raw
  (unscaled) third line: confirm the served points carry the raw passive leg; if only the β-adj leg
  is served, drop the faint line rather than deriving it client-side. Canon: hypothetical qualifier
  touches the first backcast figure; the window start is "as far back as we hold a daily price for
  this fund", never "the twin's history".
- **"Where the gap came from"**: `risk_attribution.active_return_attribution` +
  `fund_attribution_blocks.payload` via `buildAttributionWindowSummary` — **served-after-reload**
  (the cascade rebuilds `factor_attribution`; the mockup's honest WITHHELD card is the PRE-reload
  state only — post-reload the drill-down serves real numbers again). Donors:
  `AttributionSection`, `AttributionExplorer`, `RiskDetail3Y` (3Y risk expander stays a drill-down
  here). Never render attribution while `serving_manifest` shows the attribution panels older than
  the twin refit — that is the exact mixed-basis defect this sequencing exists to prevent.

### 03 · The neighbourhood (`#twin`)
- **All four cards** (full-life log growth vs VT/IVV/BND, capture triple, drawdown/recovery table,
  year-by-year bars): **no backend** — no serving source and no queued spec. The mockup computed
  these from daily adjusted closes (twin constituents, IVV, VT, BND, Jun 2008 →; note: SPY has
  ZERO rows in `fund_daily_adj_close.parquet`, IVV is the S&P line). This is a small, deterministic
  gold panel + serving section (per-twin, not per-fund: keyed by the served blend), but it is
  backend work in `fund_score` and must be specced there. **Batch-3 owner decision (b): file that
  backend spec pre-cutover, or descope movement 03 for beta.** Never compute return series in the
  web tier. Donor: `GrowthChart` mechanics only. Canon: window doctrine — this movement is an
  asset-class question and uses the twin's full life; state the distinction from the graded window
  once.

### 04 · The manager and their names (`#manager`)
- **"Who runs it"**: `manager_parent.managers[]` (`{name, role, start_date, tenure_years,
  confidence_state}`, lead-first ordering, real N-CEN-derived roster) — **served-in-staging**
  (`fund-named-manager-source` + `-ui` are done; the mockup's "sample — identity fields ship with
  the manager data product" chip is STALE — names/roles/tenure are served; only "prior funds and
  track record" links are not). Manager-era tick marks on the 02 chart: derivable from served
  `start_date` (nice-to-have). Coverage honesty: PM coverage ~94% with known multi-fund sibling
  attribution weakness — render only served rows, no firm fallback.
- **"The receipts"** (every position vs the twin, avg weight / twin weight / return / impact):
  **no backend** — the mockup's impact column is draft-computed and SAMPLE-chipped; production
  gates the per-stock panel on foreign-holdings coverage. Backlog item "Per-stock receipts backend
  for V4 movement 05" (filed 2026-08-06). **Batch-3 owner decision (a)** below.
- **"The skill read"**: per-fund triple `manager_parent.skill_evidence.{p_skill, p_null,
  p_negative_skill}` + `alpha_ir`/`t_years` (the "for the pros" line) — served-in-staging
  (hierarchical_skill_v2, β-adjusted basis). **Gap**: the population strip (band shares across
  graded funds + "N% of funds sit below this one") is not served — small serving addition (a
  population-summary block + per-fund percentile off `hierarchical_skill_posteriors.parquet`), or
  ship the triple without the strip for beta (movement-level sub-descope, batch-3 (b)). Donor:
  `DistributionStrip` rendering machinery. Canon: P(skill) framing = "could luck alone explain it";
  a manager can have skill and still not earn the fee — the verdict's question, not this one.

### 05 · The fund family (`#family`)
- **Leaderboard + largest scored funds**: `fund_family_panel` (rank, n_ranked families,
  AUM-weighted + simple-avg $/yr per $10k, member rows with `value_bps_3y`, AUM as-of range,
  unranked honesty) — **served-in-staging** (flipped + critic-passed 2026-07-12). Donor:
  `FundFamily.tsx` near-verbatim (both tables exist); restyle to V4 chrome. Canon: two bases, two
  columns, never added (SI shrunk Value Score vs 3Y realized); the single-ETF-alt basis difference
  vs the two-ETF verdict stays stated in the caption.

### 06 · Key stats & details (`#stats`)
- **Grid**: NAV `identity.latest_nav` · AUM `identity.aum_usd` · net ER `net_expense_ratio_bps` ·
  inception `identity.inception_date` · managers `manager_parent.managers` (+ as-of) · holdings
  `identity.holdings_count` + `holdings.as_of_date` · top-10 concentration = Σ served
  `holdings.top_holdings[].weight` (top-N teaser; only if N≥10, else omit) · active share
  `value_offering_reframed.replicability.active_share` (basis-labeled) · category
  `identity.peer_group` · family rank `fund_family_panel` · twin + twin fee
  `passive_baseline.etf_weights` + `fees.fair_fee.passive_fee_bps` — all served-in-staging.
  "Effective positions": **not served** — omit (or batch-3 add). Drill-downs referenced by the
  caption: fee history + fee-vs-peers ruler (`FeeFairnessV2` + `fees.peer_percentile`),
  alternatives (`Alternatives`), methodology. Donors: `FeeFairnessV2`, `Alternatives`,
  `RecentChangesTable` (the ranked-changes drill-down once its backend ships).

### Sources & bases footer (`#sources`)
- `source_inventory.{source_stamps, data_quality_warnings, profile_build_version}` +
  methodology-registry anchors (`src/lib/methodology/registry.ts`) — served-in-staging. Donor:
  `SourceFooter`. Every movement's method_version + as-of stamps come from the served payloads,
  never hardcoded. The footer's fill-figure disclosure depends on batch-3 decision (c).

### Cross-cutting donors and deaths
- **Carry over**: `format.ts`, `InfoTip`, `SectionNav` (rebuild for 7 movements), `AccentToggle`,
  `crescent/BlockHeader`, `crescent/CrescentMark`, `crescent/TwinPanel` (candidates evidence
  drill-down for 00), `crescent/FeeReceipt` (fee figures for 00's cost row), `crescent/HurdlePanel`
  (claim derivations for 00/02).
- **Die at cutover**: `PreviewBanner` (+ `?tier=` override), `AISummary.tsx` + `aiSummary` fixture,
  `ArchetypeChip` + `crescent-archetypes.ts`, `top10VsIwf` + `positioningBetBridges` +
  `recentChangesTe` fixtures (each under protocol step 4), the v2 numbered-section layout.

## Per-movement build & flip protocol (unchanged discipline, V4 target)
A movement renders served data ONLY when ALL of:
1. **Backend done + column populated**: its backend spec is in `specs/done/` (or the reload has
   landed, for reload-gated panels) and the serving column/table is populated —
   Postgres == `serving_facts_staging.parquet` == gold for the spot-checked funds. Never build a
   movement against a panel the `serving_manifest` shows as pre-refit (mixed basis).
2. **Gates + proof point**: the section's `gates` entry exists and `applyGates`
   (`src/lib/serving/gating.ts` `GATED_SECTIONS`, fail-closed `defaultGate`) OWNS it — a missing
   entry is fail-open and has bitten before; NEW sections (neighbourhood, receipts) add their
   entry + `PREVIEW_PROJECTORS` free proof point in the same change, per the tier map in
   `profile-v2-preview-route.md`.
3. **Methodology-registry artifact** exists in `src/lib/methodology/registry.ts` (anchor,
   method_version, sources, notMeaning, limitations — copied from the real shipped artifact, never
   invented). No live movement without its `/methodology#anchor`.
4. **Fixture deleted**: the section's export is removed from `src/lib/fixtures/profile-v2-fcntx.ts`
   (types stay). A fixture never coexists with a served section; production never shows sample data.
5. **Critic pass**: `/critique-funds` capture + data-quality-critic on the newly live movement
   (served == gold spot-check on ≥3 funds, tier-leak grep on the payload).

## Dependencies & sequencing

```
[1] LOCAL serving reload (owner-gated; terminal cascade 2026-08-06 rebuilds
    factor_attribution + profile_nav_series; per-panel deltas → owner review →
    TRUNCATE+COPY). Closes the mixed-basis bug (backlog line 51).
       │
       ├── [2] recent-changes-te-ranked (queued backend, fund_score) — UNBLOCKED
       │       (its unify dependency shipped; build on te_decomp_v0.2_global)
       ├── [2b] small serving riders (fund_score): per-bet standalone_te_bps;
       │       skill population strip block (if 04's strip stays in scope)
       │
       ├── [3] OWNER DECISIONS — batch 3 (below): receipts in/out; movement-03
       │       backend spec vs descope; fill-figure basis
       ▼
[4] Build movements 00–06 + sources on /preview (per-movement protocol)
       ▼
[5] Critic panel: /critique-funds against the built page, data-quality P0/P1 clean
       ▼
[6] Route cutover (final steps below) — full-experience beta blocker path
```

- **Reload note**: the reload must run from a branch carrying EVERY shipped serving emitter
  (serve-l2 lesson — loading from a stale branch NULLs newer sections / flips `no_good_match`
  funds back to matched).
- **recent-changes-te-ranked freshness re-grounding**: that spec's "holdings frozen at 2025-10-31"
  operational-prerequisite note is **STALE** — the N-PORT holdings store spans to
  `report_period_end` 2026-05-31 (verified 2026-08-06 against
  `fund_score/data/nport/holding/year=2026/`). Its remaining freshness work is confirming
  `positioning_changes_panel` is rebuilt on the refreshed store; the dual as-of stamps stay
  mandatory on every row regardless.
- **Receipts backend** (backlog, filed 2026-08-06, no spec id yet): covers movement 04's receipts
  table AND movement 01's holdings-vs-twin diff card (the item text names `top10VsIwf`/
  `positioningBetBridges` as the fixture-only sub-blocks it replaces). If the owner picks "build",
  it becomes a `depends_on` here once specced.
- **Interactions, not blockers**: `holdings-book-basis-disclosure` (its web deliverables should
  land on the V4 page, not the retired v2 layout); `look-through-coverage-honesty` (foreign
  coverage gating — the same rule that gates TRNEX's receipts); the passive-fit coverage
  investigation (filed 2026-07-31 — may legitimately grow the matched universe; watch, don't wait).

## Canon that must not regress (locked by the V3/V4 panels — regression = P0)
- **The after-fee hurdle bar is ZERO** — an after-fee gap already contains the fee; any "+N to
  cover the fee" framing double-charges the surcharge (this bug shipped and was re-fixed twice).
- **Headlines are claims** a reader could disagree with, never descriptions of the interface.
- **Every coined term ("twin") is defined at first use**; coined-name budget ≈7; jargon behind
  affordances.
- **No green/positive chips on a below-breakeven fund**; fee fairness is "the going rate / CHEAP VS
  PEERS", never "justified".
- **No "biggest bet" superlative when `top_bet_confident` is false** (the projector + BetsTable
  already honour this — keep it in every new surface, incl. 00's positioning row).
- Plus (same canon docs, same force): gold does ONE job / the twin is grey everywhere; fill basis
  words are behavior-share, never capital-share; β-adjusted default with raw as labeled secondary;
  badge is past-tense; window doctrine stated once (asset-class = full twin life, manager = graded
  window); identity (risk composition) and attribution (payoffs) are different axes — never size
  composition by payoff; displayed chains state their own rounding/tie-out conventions;
  `timing`/`SHIFT` figures are never labeled timing *skill*.

## OWNER DECISIONS — batch 3 ANSWERED 2026-08-06 (all five; details on each item below)
**(a) BUILD the receipts backend before cutover** — the complete persuasion story ships at beta;
sequence the build AFTER the foreign-holdings enrichment lands (else it gates weak for exactly the
foreign-heavy funds where it matters; building first = building twice). Spec-writer dispatched
2026-08-06. **(b) ALL THREE extras are IN**: the neighbourhood movement gets its small backend
panel (spec-writer dispatched 2026-08-06), the P(skill) population strip and the effective-positions
stat ship as serving riders (lean backlog item filed). Beta = the full SEVEN movements. **(c)
CURRENT-TWIN FIT** headlines the crescent + the "X% a two-ETF mix" claim (present-tense identity on
the current twin — basis-coherent with the twin named beside it); the record movement stays on the
graded-history basis. **(d) settled inline at build review** with the critic panel (owner default
accepted). **(e) KEEP `force-dynamic`** per-request tier-gated rendering; PPR/ISR revisited only
with real beta latency data.

### Original decision framing (kept for context)
- **(a) Per-stock receipts: in or out for beta.** Build the "Per-stock receipts backend for V4
  movement 05" (per-stock holding-period receipts + twin look-through, honest foreign-coverage
  gating) BEFORE cutover — it also unlocks movement 01's holds-differently twin column and the
  holdings agree/disagree sublines — **or** descope the receipts sub-block for beta: movement 04
  ships who-runs-it + skill read only, movement 01 card 2 ships fund-side cuts without a twin
  column. Trade-off: the receipts card is V4's most persuasive artifact (the Exxon finding), but
  it is the largest unbuilt backend and gates exactly the foreign-heavy funds (TRNEX included)
  where honesty is hardest.
- **(b) Movement-level descopes.** (i) Movement 03 (neighbourhood): no backend exists — file and
  build the small twin-full-life panel pre-cutover, or beta ships 6 movements without the
  neighbourhood. (ii) Movement 04's P(skill) population strip: small serving addition vs
  triple-only for beta. (iii) Key-stats "effective positions": not served — omit vs add.
- **(c) The fill-figure basis for the 01 headline + crescent.** Two legitimate numbers exist and
  the mockup's own sources footer flags the choice as open: the served piecewise-historical
  `value_score.replica_r2` (each era vs the twin served at the time; TRNEX 90.6%) vs the
  current-twin fit (`te_decomposition.replicable_risk_share` basis; TRNEX ~94.3%). One page must
  show ONE fill (the one-TE-per-page rule's sibling); which one headlines is a product call.
- **(d) Minor open design calls carried from panel R3** (may be settled inline at build review):
  receipts default sort weight-vs-impact (RIA flagged, owner previously asked impact); design's
  4-row verdict fold; badge beside the ticker; terminology sprawl (twin / the mix / twin mix).
- **(e) Production rendering strategy** (promoted from the route-cutover steps by the 2026-08-06
  review): keep `force-dynamic` per-user gated rendering (today's intentional architecture —
  session-read tier gating server-side; zero re-architecture cost, TTFB stays as today), or scope
  a PPR/ISR redesign for faster loads (real engineering: the tier-gated sections must move to a
  client-fetched shell or equivalent, else cached pages leak gated content across users). Default
  if undecided: keep `force-dynamic`.

## Operational launch gates (re-grounded 2026-08-06)
- **SATISFIED — N-PORT ingest refresh**: the old "holdings frozen 2025-10-31" gate is closed (store
  spans to 2026-05-31; served TRNEX book as-of 2026-03-31). Residual: downstream
  `positioning_changes_panel` rebuild rides `recent-changes-te-ranked`.
- **SATISFIED — manager full build sign-off**: `fund-named-manager-source` done; roster served.
  (The original rationale — the AI summary's manager sentence — is dead; V4 has no AI summary.)
- **SUPERSEDED — fee-correction ripple sweep**: absorbed by the 2026-07-29 pool refit + refresh
  campaign; the live gate is now the reload itself.
- **STILL REAL**: (1) the owner-gated serving reload with per-panel delta review (sequencing step
  1 — nothing reload-gated flips before it); (2) reload-branch completeness (every shipped
  emitter present); (3) production DB parity at beta launch — prod currently has only
  waitlist/early_access tables; the production serving load + `LAUNCHED` flip are launch ops
  outside this spec but ON the beta path this spec feeds.

## Final route cutover (after the in-scope movements are live on /preview)
1. Rebuild `src/app/(site)/funds/[ticker]/page.tsx` as the V4 movement tree (components move out
   of `/v2/` naming or are re-exported); the preview route becomes a redirect or is removed; the
   `?tier=` override does NOT survive into production.
2. Production rendering STAYS `force-dynamic` per-user gated rendering — the current production
   architecture (the page reads the Supabase session server-side to gate sections by tier;
   `src/app/(site)/funds/[ticker]/page.tsx` documents this as intended). CORRECTED 2026-08-06
   (review finding): there is no prior ISR state to "restore" and no `SEED_TICKERS` in the repo;
   naive ISR would risk caching tier-gated content across users. Any rendering change (PPR/ISR
   redesign for TTFB) is owner decision (e) — out of scope unless decided. Restore metadata/SEO
   (preview is noindex).
3. Retire superseded components after an import audit (`ValueScoreHero` shell, `Performance`,
   standalone `ExposureXray` placement, `AISummary`, `ArchetypeChip`, v2 layout scaffolding);
   surviving legacy drill-downs (`Alternatives`, `SourceFooter`) keep working.
4. `PreviewBanner` and every sample affordance unreachable in production — grep-verified: no
   `__sample`, no `fixtures/` import in the production dependency graph (context-checked greps,
   per the section-flip lessons).

## Acceptance criteria
- Production `/funds/FCNTX` and `/funds/TRNEX` render every in-scope movement entirely from served
  data; zero fixture imports in the production graph; every movement has its methodology anchor.
- Tier matrix leak-free in page source (anon/free/paid): payload-level greps clean for gated
  numbers; new sections owned fail-closed by `applyGates` with golden-test assertions.
- Every displayed number is recomputable from the served row (spot-check == staging == gold on 3+
  funds per movement); mockup-era TRNEX figures are treated as 2026-07-30 diff references only.
- Canon list above holds on every captured page (the critic panel checks it explicitly).
- No movement renders attribution/nav/te content whose `serving_manifest` panel predates the
  active twin refit (mixed-basis guard).
- `npm run build` + `npm run lint` green; golden gating tests pass; page-load performance
  (Lighthouse) at parity with the current production page under the SAME force-dynamic rendering;
  `/critique-funds` against the LIVE page: no data-quality P0/P1.

## Test plan (capture set)
FCNTX (active, full-data, near-tie history on bets), TRNEX (foreign-heavy — receipts gating,
`top_bet_confident=false` path, the mockup's own reference fund), DODGX (two-beta cross-basis
note), VOO (passive — honest degradation everywhere, index-fund benchmark one-liner), one
`no_good_match` fit-floor fund (twin-dependent movements degrade honestly), DREVX (unranked
family). Walk anon/free/paid on each; diff rendered values against staging parquet and gold.

## Out of scope
Billing/auth changes (tier model exists via `resolveSession`); marketing/launch comms; the
production DB provisioning + `LAUNCHED` flip (launch ops); unify web part (b) held-names line
(fast-follow); the X-Ray/screener surfaces (`exposure-screener`, `portfolio-exposure-parity`
queue items are orthogonal).

## Risks
- **Scope torque at batch 3**: two of eight blocks (03, receipts) have no backend — if both go
  "build", the critical path runs through fund_score, not this repo. Surface early, don't absorb.
- **Basis mistakes are the page's biggest honesty risk**: standalone-vs-allocation TE, fill
  piecewise-vs-current, active-share basis, raw-vs-β-adjusted — every figure ships with its basis
  label and the reviewer recomputes it (reviewed lane; data-reviewer gates on the fund_score
  riders).
- **Mockup-number anchoring**: implementers copying TRNEX values from the mockup instead of
  serving — prevented by the era-stamp rule + acceptance recompute clause.
- **Coverage optics**: the matched-twin universe bounds several movements; the passive-fit
  coverage investigation may move it — report movement-level coverage in the critic pass, don't
  chase a greener number here.
