---
id: v4-serving-riders-skill-strip-effective-positions
title: V4 serving riders — P(skill) population strip + effective-positions stat
status: queued
track: backend
repo: fund_score
lane: reviewed
depends_on: []
created: 2026-08-07
scope: >
  Two serving-fact additions in fund_score that movements 04 and 06 of the V4 profile need:
  (1) a population-distribution block served alongside the existing per-fund skill triple, so the
  "where this fund sits" strip renders from served data instead of a hard-coded constant; and
  (2) a concentration block on the FILED pctVal holdings basis carrying effective positions plus the
  top-10 weight from the same frame, replacing a served effective-positions figure that today is
  computed on a different, narrower position set. Backend only — the render lives in
  `profile-v2-production-cutover.md` movements 04 and 06.
model: opus
effort: high
---

> **SUPERSEDED IN PART — 2026-08-26.** Rider B (effective positions / `holdings.concentration` /
> the `concentration::effective_positions` retirement, §2.2, §3.3–3.5, §4.2, and acceptance
> A4–A8) is replaced by `specs/queue/effective-positions-segment1.md`, which carries the four
> owner rulings of 2026-08-26 (EC-long position set, union validity gate, degenerate-book
> disclosure field, peer-baseline recompute) and the Segment-0 corrections (A8 grep scope,
> `positioning_changes` emitter, as-of mislabel already fixed at source). Do NOT implement
> Rider B from this file. **Rider A (the P(skill) population strip, §2.1, §3.1–3.2, §4.1,
> A1–A3) remains live in this spec and is unchanged.**

## Owner summary
The new fund page wants to say two things it can't say honestly yet: "here's where this manager's
skill evidence sits versus every other fund we grade," and "this fund says it holds 127 names, but
it really behaves like N." Both numbers have to be computed in the data pipeline, not the website.
The second one turned out not to be a new number at all — we already serve an "effective positions"
figure, but it is computed over a 57-name slice of a 127-name fund, on a different weight basis than
the weights shown next to it, and it exists for fewer than half the funds. This spec replaces it with
one computed on the same filed holdings the page actually displays.

---

## 1. Why this is `lane: reviewed`, not `lean`

The backlog item said "lean lane". It is not. Both riders change **serving-fact semantics**:

- Rider B **replaces the meaning of a number that is already served and already rendered**
  (`exposure_xray.rows[] @ exposure_id == "concentration::effective_positions"`, consumed at
  `WEBROOT/src/components/fund/profile/v2/CurrentPositioning.tsx:422` and
  `WEBROOT/src/lib/serving/format.ts:441`). The story's premise — and
  `profile-v2-production-cutover.md` §06's "Effective positions: **not served** — omit" — are both
  wrong. This is a basis change on a live figure, which is exactly the class of change the reviewed
  lane exists for.
- Rider A publishes a **population denominator**. A percentile served against the wrong population
  is a wrong number that looks right; on the measured data the two candidate populations move the
  page's own sentence from "53% of funds sit below this one" to "34% of funds sit below this one"
  for the same fund (§3.2).

Neither rider needs a Postgres DDL change (both land inside existing JSONB sections), which is the
only sense in which they are small.

---

## 2. Grounding — what exists today (verified, not assumed)

All paths relative to `FUNDSCORE = /Users/alexfrey/Projects/fund_score` unless prefixed `WEBROOT`.

### 2.1 The skill triple (rider A's attach point)
- Assembled in `src/fundscore/serving/fact_assembler.py::_skill_evidence` (L2338–2398), nested by
  `_manager_parent` (L2401–2434) under the `manager_parent` section (`SECTION_COLUMNS` L185).
- **Exact served field path:** `manager_parent.skill_evidence.{p_skill, p_null, p_negative_skill,
  label, alpha_ir, se_alpha_ir, ir_is_gross, basis, beta, t_years, peer_group, method_version}`.
- Source panel: `HIERARCHICAL_SKILL = data/gold/hierarchical_skill_posteriors.parquet`
  (`fact_assembler.py` L82), read by `_skill_by_series` (L748–773). Columns:
  `fund, series_id, peer_group, asset_class, ir, sigma_ir, T_years, mnthly_avg_net_assets, beta,
  ir_is_gross, p_positive_skill, p_negative_skill, p_null`. 8,150 rows, one per series, zero nulls
  in `p_positive_skill`.
- Section gate: `GATES["manager_parent"] = "free"` (`fact_assembler.py` L217). The only field-level
  strip on this section in `WEBROOT/src/lib/serving/gating.ts` (L974–992) is
  `skill_evidence.manager_moves.impact_bps_*`. **A new sibling sub-object inherits `free` and needs
  no `gating.ts` edit** — a population distribution is context, not a paid precision figure.

### 2.2 The concentration stats (rider B's attach point)
- **Already served today**, via `src/fundscore/product/exposure_xray.py::build_concentration_rows`
  (L776–809), which emits `concentration::{active_share, hhi, effective_positions, top10_weight,
  sector_active_share}` rows into the `exposure_xray` section.
- `effective_positions` = `diversification_panel.eff_n_raw`, built by
  `src/fundscore/fee_efficiency/diversification.py`. That module reads
  `data/gold/holdings_snapshots.parquet` on its **`weight`** column — the US-ticker-resolved,
  equity-book-renormalised basis — not `pct_nav`.
- The product-displayed weight basis is the opposite one. `fact_assembler.py::_top_holdings_by_series`
  (L590–637) serves `holdings.top_holdings[].weight` from **`pct_nav`**, with the docstring:
  *"served on the pct_nav basis (filed % of overall fund NAV) so it is coherent with every other
  holding-weight surface … never the US-ticker-renormalised book weight."* That is the standing owner
  decision ([[holding-weight-basis-pctval-nav]], 2026-07-08).
- The filed full book: `data/product/fund_profiles/fund_holdings_full_staging.parquet`
  (`FUND_HOLDINGS_FULL`, L75), built by `scripts/pipeline/build_fund_holdings_full.py` — `weight_pct`
  is *"the filed `pctVal` copied through EXACTLY … per-fund sums cluster near 100 but are NOT
  rescaled"* (builder docstring L18–21). Columns include `position_direction ∈
  {long, short, derivative_na}`, `asset_cat`, `sector`, `country`, `as_of`, `position_rank`.
  Its free teaser already rides in the same section: `holdings.holdings_full.{n_positions, as_of}`
  (`_holdings_full_teaser_by_series`, L645–685).
- Section gate: `GATES["holdings"] = "public"`.

### 2.3 The percentile convention (reuse, do not re-derive)
`src/fundscore/product/cohort_percentiles.py` is the single source of truth: **strictly-below,
self-in-n**, `pct = 100 · (#strictly below) / n`, ties share a percentile, and a percentile is
*"never served against an unnamed population"* (module docstring). Served precedents to mirror in
shape: `positioning_context.{beta_percentile, te_percentile, cohort:{kind,label,n_funds}, as_of,
method_version}` and `fees.peer_percentile`.

---

## 3. Measured coverage and the findings that drive the design

All figures measured 2026-08-07 against `data/product/fund_profiles/serving_facts_staging.parquet`
(mtime 2026-08-06 23:44, 5,819 served funds, 100% `asset_class == EQ`, 4,091 active / 1,728 passive)
and the gold panels above. **These are era-stamped diff references, not acceptance values** — the
campaign cascade rebuilds `diversification_panel` and `fund_holdings_full_staging`, so acceptance
recomputes them from the live lake and a deviation is acceptable only when explained (§6).

### 3.1 Rider A coverage — 2,714 / 5,819 served funds (46.6%); 66.3% of active funds

| set | n | note |
|---|---|---|
| served funds | 5,819 | |
| served **active** funds | 4,091 | passive suppress the skill read by design (`_skill_evidence` L2343) |
| served funds with a non-null `skill_evidence.p_skill` | **2,714** | 66.3% of active |
| posteriors-panel series that map to a served active fund | 3,175 | |
| of those, serve no `p_skill` | 461 | suppressed by the broad `is_passive` at `fact_assembler.py` L2574, which folds in `is_etf` — active ETFs lose the skill read |
| posteriors-panel series not served at all | 4,975 | 3,731 of them are non-EQ (FI/MA/MU/RE/ALT); FundScore serves only EQ today |

The 461 active-ETF suppression is **pre-existing and out of scope here** — noted so the population
definition is self-consistent regardless of how that rule later changes (§4.1 defines the population
as *"served funds carrying a non-null `p_skill`"*, which tracks the suppression automatically).

Remainder split: the 1,377 active funds with no `p_skill` are **honest-missing** (absent from the
posteriors panel — no estimable track record — or suppressed by the passive/ETF rule), not
recoverable. No imputation anywhere.

### 3.2 Rider A finding — the population choice changes the page's sentence

The V4 mockup's strip is captioned `P(SKILL) ACROSS THE 8,150 FUNDS WE GRADE` with band shares
`67.8 / 23.4 / 4.9 / 3.9` and the caption *"53% of graded funds sit below TRNEX"*. Those numbers
reproduce **exactly** off the raw 8,150-row posteriors panel. But 61% of that panel is funds the site
does not serve, and 46% of it is non-equity. Recomputed over the funds a reader can actually look up:

| population | n | bands `<5% / 5–25% / 25–50% / 50%+` | PRNEX ("TRNEX") strictly-below |
|---|---|---|---|
| raw posteriors panel (the mockup's) | 8,150 | 67.8 / 23.4 / 4.9 / 3.9 | **53.0%** |
| served funds with a served `p_skill` | **2,714** | **51.1 / 34.5 / 9.3 / 5.1** | **34.1%** |

Same fund, same posterior (`p_skill = 0.0203`), two defensible denominators, and the page says
"ordinary — 53% sit below" versus "34% sit below". **Decision (engineering, mine): the served
population.** A percentile whose denominator is 61% funds the reader cannot navigate to is not
checkable, and the project rule is that a percentile is meaningless without a denominator you can
name. The alternative is documented here so the choice is auditable, not silent.

### 3.3 Rider B coverage — 5,436 / 5,819 (93.4%) on the filed basis vs 2,610 / 5,819 (44.9%) today

| source | served funds populated | % | PRNEX value |
|---|---|---|---|
| **today** — `concentration::effective_positions` (= `diversification_panel.eff_n_raw`) | 2,610 | 44.9% | **30.5** |
| **this spec** — `1/Σŵ²` over the filed long book, `weight_pct` (pctVal) | **5,436** | **93.4%** | **59.8** |

Remainder for the new basis: 79 served funds with no filed holdings at all (honest-missing —
absent from `fund_holdings_full_staging`), 2 with no positive long line, 302 dropped by the
validity gate (§4.2), all → honest `null` with a `missing_reason`. Distribution on the new basis
(5,436 funds): p25 24.7, median 40.7, p75 68.9, max 922.

### 3.4 Rider B finding — the served figure is on a different position set than the weights beside it

PRNEX (`S000002105`, the mockup's "TRNEX") files **127** N-PORT position lines at 2026-03-31; the
page's own teaser serves `holdings.holdings_full.n_positions = 127`. `diversification_panel` computed
its `eff_n_raw = 30.48` from `n_positions = 57` — the ticker-resolved equity slice of that book — on
renormalised `weight`. On the filed pctVal book the same fund's effective positions is **59.8**.

Rendering *"Holdings 127 · Effective positions ~30"* in one grid tells a reader that 30 of their 127
names carry the fund, when the 30 was derived from a 57-name subset on a weight basis the page does
not display. Roughly a 2× misstatement, in the direction that makes every fund look more
concentrated than its filed book is. This is the incoherence the standing pctVal decision exists to
prevent, and it is why rider B is a replacement rather than an addition.

### 3.5 Adjacent finding — movement 06's top-10 row has two served answers (NOT fixed here)

Also measured on PRNEX, same as-of:

- `Σ holdings.top_holdings[].weight` (from `holdings_snapshots.pct_nav`) = **27.2%** — the source
  `profile-v2-production-cutover.md` §06 currently names for the "Top-10 concentration" cell.
- `concentration::top10_weight` (exposure engine, `top_n_weight(fund, 10, weight_col="pct_nav")`)
  = **31.0%**, which equals the filed full book's top-10 `weight_pct` sum (30.965) to 3 d.p.

Both claim a pct-of-NAV basis; they differ because `holdings_snapshots` drops untickered / private /
preferred lines that the filed book keeps. This spec does **not** adjudicate that — it is a
pre-existing serving inconsistency that deserves its own item. What this spec does do is make the
grid internally consistent by emitting the top-10 weight **from the same frame as effective
positions** (§4.2), so movement 06 can source both cells from one place.

---

## 4. What to build

### 4.1 Rider A — `manager_parent.skill_evidence.population`

New module (suggested `src/fundscore/product/skill_population.py`) or a private helper in
`fact_assembler.py`; the population is assembled **once per build**, not per fund.

**Population definition (binding):** the set of served funds whose own assembled
`skill_evidence.p_skill` is non-null. Because it is defined on the assembled output, it tracks the
passive/ETF suppression rule automatically and can never contain a fund whose marker could not be
placed on the strip.

**Ordering constraint:** the population is a function of the assembled rows, so it must be computed
in a second pass — assemble `skill_evidence` for every series, collect the non-null `p_skill`
values, then write the `population` block back into each qualifying row. Do not compute it from the
gold panel directly; that is precisely how it would drift from the served set.

Served shape (nested under `skill_evidence`, so `null`-free by construction for funds that carry it;
**absent** for funds with no `p_skill`):

```jsonc
"population": {
  "percentile_below": 34.08,          // strictly-below, self-in-n, cohort_percentiles convention
  "n_funds": 2714,
  "population_kind": "served_funds_with_skill_read",
  "population_label": "funds we grade for manager skill",
  "bands": [                          // ordered, contiguous, exhaustive over [0,1]
    {"lo": 0.00, "hi": 0.05, "share_pct": 51.14},
    {"lo": 0.05, "hi": 0.25, "share_pct": 34.49},
    {"lo": 0.25, "hi": 0.50, "share_pct": 9.25},
    {"lo": 0.50, "hi": 1.00, "share_pct": 5.12}
  ],
  "method_version": "skill_population_v0.1"
}
```

Rules:
- `percentile_below` uses `cohort_percentiles._strictly_below_pct` semantics — reuse the module,
  do not re-implement the tie handling.
- Band cuts `[0, .05, .25, .50, 1.0]` are the V4 design's cuts, kept. They are **served as data**;
  the web must not hard-code them. (`WEBROOT/src/components/fund/profile/v2/crescent/DistributionStrip.tsx`
  hard-codes `BAND_TOTAL_N = 2708` and its band shares — that is the anti-pattern this block exists
  to end. The V4 strip renders from `population`, never from `crescent.ts::FILL_BANDS`.)
- `share_pct` values sum to 100 ± 0.01 and are computed over `n_funds` — the same denominator as
  `percentile_below`. One denominator, one population, one place.
- `n_funds < cohort_percentiles.N_MIN` (20) ⇒ emit **no** `population` block at all (honest absence),
  never a percentile over a handful of funds.
- A fund with no `p_skill` gets no `population` key. The web renders the triple's existing
  missing-reason path; it never shows a strip with an absent marker.

### 4.2 Rider B — `holdings.concentration`

New builder reading **`data/product/fund_profiles/fund_holdings_full_staging.parquet`** — the same
artifact the drawer, the teaser `n_positions`, and the `fund_holdings_full` served table come from,
so the number and the list a user can open are the same book at the same accession.

**Position set (binding):** filed lines with `position_direction == "long"` **and**
`weight_pct > 0`. Rationale: `1/Σŵ²` is only defined on a non-negative weight vector; 1,233 funds
file at least one negative `weight_pct` and 2,045 / 5,740 file at least one non-long line, with
per-fund filed sums measured from −178 to +332. Short and derivative lines are **excluded from the
statistic and disclosed**, never silently folded in and never sign-flipped.

**Formula (binding):** with `w_i` = filed `weight_pct` of the retained lines,

```
S  = Σ w_i
Q  = Σ w_i²
effective_positions = S² / Q          # ≡ 1 / Σ(w_i/S)²  — inverse Herfindahl on the renormalised long book
```

Normalisation is by the retained lines' own sum `S`, not by 100 — filed pctVal sums are not rescaled
upstream and must not be rescaled here.

**Validity gate (honest null, no fallback):** emit `effective_positions` only when
`n_lines_used ≥ 1` **and** `90 ≤ S ≤ 110`. Outside that band the filed long book is not a fair
representation of the fund's NAV (leverage, a dominant short book, a mis-filed pctVal) and the
statistic would be a made-up number about a book we do not hold. 302 funds fail this today.

Served shape, nested in the existing `holdings` section beside `holdings_full`:

```jsonc
"concentration": {
  "effective_positions": 59.83,        // null when the gate fails
  "top10_weight_pct": 30.97,           // same frame, same lines, so the grid has ONE source
  "n_lines_filed": 127,                // all filed lines for the accession (== holdings_full.n_positions)
  "n_lines_used": 125,
  "long_weight_sum_pct": 100.90,       // S
  "nonlong_gross_share_pct": 0.0,      // Σ|w| of non-long lines / Σ|w| of all lines, ×100
  "as_of": "2026-03-31",               // == holdings_full.as_of
  "basis": "filed_pctval_long_book",
  "missing_reason": null,              // "no_filed_holdings" | "no_long_positions" | "weight_sum_out_of_range"
  "method_version": "holdings_concentration_v0.1"
}
```

Rules:
- `top10_weight_pct` is the sum of the 10 largest retained `weight_pct` values **from the same
  retained set**, so a consumer rendering both cells cannot mix bases. It is a new field, not a
  replacement for `concentration::top10_weight`; §3.5 stays open.
- A fund absent from `fund_holdings_full_staging` (79 today) gets **no `concentration` key** —
  same convention as the existing `holdings_full` teaser (presence ⇔ served rows exist).
- A fund present but failing the gate gets the block with `effective_positions: null`,
  `top10_weight_pct: null`, and a populated `missing_reason`, so the page can say *why* rather than
  going quiet.
- **Retire the incoherent figure.** `build_concentration_rows` (`exposure_xray.py` L776–809) must
  stop emitting `concentration::effective_positions`, and its `metrics` list drops the
  `("effective_positions", "eff_n_raw")` entry. `hhi` (`hhi_raw`, the same renormalised basis)
  keeps its current behaviour — out of scope, but note that it is the same basis and will now be the
  only survivor of that pair. `diversification_panel.eff_n_raw` itself is **unchanged**: it is an
  input to the fee-efficiency `diversification` multiplier, where the active/renormalised basis is
  the correct one. This spec removes it from the *serving surface only*.
- Web consumers of the retired row exist and must be updated in the same change-set:
  `WEBROOT/src/lib/serving/format.ts:441` and
  `WEBROOT/src/components/fund/profile/v2/CurrentPositioning.tsx:422`. Both repoint to
  `holdings.concentration.effective_positions`. No `gating.ts` change (`holdings` is `public`).
  No Drizzle/DDL change (both riders are nested keys inside existing JSONB columns).

---

## 5. Out of scope

- The V4 render of either rider — that is `profile-v2-production-cutover.md` movements **04** (skill
  strip) and **06** (key-stats grid), Track-F item F1. This spec ships the data and the consumer
  contract only.
- The `holdings.top_holdings` vs `concentration::top10_weight` 27.2%-vs-31.0% split (§3.5) — file
  separately.
- The 461 active ETFs whose skill read is suppressed by the broad `is_passive` (§3.1).
- `identity.holdings_count` (metadata `total_holdings`, 118 for PRNEX) vs
  `holdings.holdings_full.n_positions` (127). Movement 06 should render the latter next to
  `concentration.*` for commensurability; changing `identity.holdings_count` is not this spec's job.
- `diversification_panel`, the fee-efficiency multiplier, and `concentration::hhi`.

---

## 6. Acceptance

Every check is a command or a column reference. Numbers marked *(era-stamped)* are 2026-08-07
diff references, non-binding — acceptance recomputes from the live lake at build time, and a
deviation passes only with a written explanation naming the cause (cascade rebuild, universe change).

**A1 — riders reach the fact row.** In the rebuilt `serving_facts_staging.parquet`:
`manager_parent.skill_evidence.population` is present on **every** row whose
`skill_evidence.p_skill` is non-null and absent on every row where it is null (count both; the two
sets must partition exactly, zero exceptions). `holdings.concentration` is present on exactly the
set of series present in `fund_holdings_full_staging.parquet` (equality of series sets asserted, not
sampled).

**A2 — the population is the served set, recomputed independently.** A standalone script recomputes
the band shares and `n_funds` from the assembled staging by reading `skill_evidence.p_skill` off
every row, and matches the served `population.bands[].share_pct` / `n_funds` on every row to
1e-6. `n_funds` equals the count of served rows with non-null `p_skill`.
*(era-stamped: n_funds = 2,714; bands 51.14 / 34.49 / 9.25 / 5.12.)*

**A3 — percentile convention.** For 20 randomly sampled funds, served `population.percentile_below`
equals `100 · |{q ∈ population : q < p_fund}| / n_funds` recomputed from the staging, to 1e-6.
At least one tie pair (two funds with identical `p_skill`) is included and both carry the identical
percentile. The population minimum has `percentile_below == 0`.
*(era-stamped: `S000002105` p_skill 0.020272 → 34.08.)*

**A4 — effective positions reproduces from the filed book.** For 20 randomly sampled funds, served
`holdings.concentration.effective_positions` equals `S²/Q` recomputed directly from
`fund_holdings_full_staging.parquet` filtered to `position_direction == 'long' AND weight_pct > 0`,
to 1e-6. `n_lines_filed` equals that fund's total row count in the same parquet **and** equals the
served `holdings.holdings_full.n_positions`. `as_of` equals `holdings.holdings_full.as_of`.
*(era-stamped: `S000002105` → 59.83 over 125 of 127 filed lines, S = 100.90.)*

**A5 — bounded and non-degenerate.** Across all served rows: `1 ≤ effective_positions ≤ n_lines_used`
for every non-null value (zero violations — a Herfindahl inverse cannot exceed its position count;
this is a real invariant, not one that holds by construction of the check). Every fund with
`effective_positions == null` carries a non-null `missing_reason` drawn from the enumerated set, and
every fund with a non-null value carries `missing_reason == null`.

**A6 — basis coherence with what is displayed.** For 20 sampled funds, served
`concentration.top10_weight_pct` equals the sum of the 10 largest `weight_pct` values in the same
retained set, to 1e-6; and `concentration.effective_positions` and `concentration.top10_weight_pct`
are computed from the same `as_of` accession (assert single `as_of` per series in the source, which
`_holdings_full_teaser_by_series` already enforces).

**A7 — coverage, reported not assumed.** The build prints, and the spec's completion note records:
served-fund counts and percentages for (a) `population` present, (b) `concentration` present,
(c) `effective_positions` non-null, plus the remainder split into honest-missing (absent from the
source panel) vs gate-failed (with the `missing_reason` histogram). A **drop** in (c) below the
44.9% the retired figure achieved is a FAIL. *(era-stamped targets: (a) 46.6%, (b) 98.6%,
(c) 93.4%.)*

**A8 — the incoherent figure is gone.** `grep -R "concentration::effective_positions"` over
`FUNDSCORE/src` and `WEBROOT/src` returns zero hits outside tests/changelog. No served
`exposure_xray.rows[]` carries `exposure_id == "concentration::effective_positions"` (asserted over
all 5,819 rows). `WEBROOT`: `npm run build && npm run lint` pass.

**A9 — determinism.** Assemble the staging twice into different output paths and diff the two
`manager_parent` and `holdings` columns byte-for-byte after a stable sort. Any difference is a FAIL
([[rebuild-twice-proves-determinism]] — do not stop at "probably row order").

**A10 — no synthetic values.** No default, imputed, clamped, or back-filled figure anywhere in
either rider. Explicitly: no fund receives a population block by borrowing another fund's, and no
gate-failed fund receives a renormalised-to-100 effective-positions value.

**A11 — gates.** `make check` green in `fund_score`; `/check-data` protocol run on the rebuilt
serving facts with FAIL blocking; adversarial `fundscore-data:data-reviewer` checkpoint on the
semantics (reviewed lane, [[green-gate-not-sufficient]]); `codex --high` pass gating the commit in
both repos.

---

## 7. Sequencing and risks

- **Fence F1.** This is a lakehouse-touching build (it re-assembles `serving_facts_staging.parquet`).
  It is queue item **L10**, blocked on F1 and on the campaign session's S1 reload. Do not run it
  while another session owns the lake; use an isolated worktree with a symlinked `data/`
  ([[fund-score-worktree-shared-lakehouse]]).
- **The staging must be the one D1 loads.** Both riders are `fact_assembler` changes, so they only
  reach prod if the staging that D1 loads was assembled from a lake containing this change. Landing
  this AFTER the S1 reload without a re-assembly ships a page whose two new sections read `undefined`
  ([[serving-db-ahead-of-branches]]). Coordinate with `docs/RUNBOOK-serving-load.md`.
- **Coverage numbers move under the cascade.** `fund_holdings_full_staging` and
  `diversification_panel` both carry `.pre-refresh-campaign-bak` siblings — they are being rebuilt.
  Every figure in §3 must be recomputed at build time; A7 is the gate that forces it.
- **Lane note for the dispatcher:** the beta plan lists L10 as `IN (lean) · opus/med`. Per §1 this
  spec is `lane: reviewed` (`opus/high` implement, session-model gates). The lane in this
  frontmatter governs.
- **Consumer risk:** rider B removes a row two live web files read. The web edits in §4.2 are part
  of this change-set, not a follow-up — shipping the backend alone leaves `CurrentPositioning.tsx`
  rendering an empty effective-positions cell.

## 8. Consumer contract (for `profile-v2-production-cutover.md`)

- **Movement 04 · the skill read:** the strip renders from `manager_parent.skill_evidence.population`
  — band widths from `bands[].share_pct`, marker from the fund's own `p_skill`, the "N% of funds sit
  below this one" sentence from `percentile_below`, and the denominator sentence must name
  `population_label` and `n_funds`. No band constant, no N, and no percentile is computed in the web
  tier. Funds without a `population` block render the triple with no strip. **The mockup's "8,150
  funds we grade" / "53% sit below" copy is superseded** — see §3.2.
- **Movement 06 · key stats:** "Effective positions" reads
  `holdings.concentration.effective_positions` (round for display; never re-derive), captioned with
  the basis — filed positions, long book. Render the "Holdings N" cell from
  `holdings.holdings_full.n_positions` so the two cells describe the same book. If
  `top10_weight_pct` is used for the "Top-10 concentration" cell, use it *instead of* summing
  `holdings.top_holdings[].weight` — never both, and never one of each (§3.5). A null
  `effective_positions` omits the row or states the `missing_reason`; it never falls back to a
  position count.
