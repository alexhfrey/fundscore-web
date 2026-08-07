---
id: holdings-book-basis-disclosure
title: Book-basis disclosure — carry the short book through gold, flag leveraged >100% books, name the row-inclusion contract, anchor feeders to the master filing
status: queued
track: full-stack
repo: fund_score + fundscore-web
lane: reviewed
depends_on: ""
source_proposal: ""
origin: owner decisions 2026-07-22/23 on the 2026-07-10 country-coherence investigation (backlog "X-ray >100%-of-NAV and book-basis presentation"); code-grounded 2026-07-27
created: 2026-07-27
scope: global
model: opus
effort: xhigh
---

## Owner summary
For funds that borrow or short, the owner decided: disclose everything exactly as filed — never
renormalize, never suppress. This spec ships the mechanics: short positions carried through the
holdings pipeline and labeled (not just inferable from a minus sign), a plain "uses leverage" flag
for funds whose filed holdings honestly exceed 100% of assets, a written-down and counted rule for
the filed-impossible rows we exclude (today the exclusion is silent), and feeder funds checked
against their master fund's filing instead of being waved past our coherence checks.

## Decisions being implemented (owner, 2026-07-22/23)
Doctrine: **disclose as filed; never renormalize or suppress.**
- **(a)** Serve the honest liability-explained >100% cohort as filed, plus a plain leverage flag.
- **(b)** Show the SHORT book too — carry short legs through gold and display both legs, labeled.
  Until the labeled display lands, the long book is labeled "long positions only" with the filed
  net figure alongside.
- **(c)** Keep dropping filed-incoherent rows, but DOCUMENT the inclusion contract and surface the
  dropped count — no more silent exclusion.
- **(d)** Feeder funds anchor coherence to the master's own filing (today they are exempt).

## Context — code-grounded 2026-07-24/27 (all paths fund_score unless noted)
- **Shorts survive ingest; this is a gold-layer change, not a re-parse.** The raw N-PORT holding
  store (`data/nport/holding/year=*/month=*/*.parquet`; schemas vary — read with
  `union_by_name=true`) carries `payoffProfile` + signed `valUSD`/`pctVal`. July-2025 partition:
  4,988 `Short` rows, 31,391 negative-value rows overall (`payoffProfile='N/A'` = derivative
  MTM legs); ASPCX (S000009190) has 596 short rows ≈ −$3.17B against a $41.5B long book; JAIGX
  (S000010410) shorts ride mostly as `N/A` derivative legs.
- **The long-book restriction is exactly two `valUSD>0` filters:**
  `scripts/pipeline/build_holdings_complete.py:85` (SQL; → `holdings_complete` → exposure_xray)
  and `scripts/pipeline/build_holdings_snapshots.py:93-99` (Polars; → snapshots → positioning /
  top holdings). The snapshots `pct_nav ∈ [0,1.5]` guard (`:199-210`) is about misfiled
  positive rows, not shorts (its own comment says so).
- **The full-holdings serving table ALREADY carries shorts.**
  `scripts/pipeline/build_fund_holdings_full.py:104` applies no value/payoff filter; served
  staging has 13,971 `value_usd<0` rows across 5,628 series (ASPCX: 46 negative legs incl. short
  SPY/DIA). But `FINAL_COLS` (`:134-138`) has NO direction column — a short is only inferable
  from sign. Web side is already sign-preserving by design (fundscore-web
  `src/components/fund/profile/v2/HoldingsFullDrawer.tsx:17`).
- **The row-inclusion contract is emergent, not a named gate:** filed-incoherent rows (~75 funds
  file `valUSD > totAssets`; EDGU canonical) drop as a side effect of `valUSD>0` +
  `security_id IS NOT NULL` (`build_holdings_complete.py:124`) + the pct_nav guard.
  `docs/status/data_gap_analysis.md:598-627` calls this "undocumented, ungated".
- **Coherence gates + cohorts** (`scripts/checks/check_exposure_xray_country_coherence.py`):
  G1 `:216-219` (gold ≤ raw long book + 2pp), G2 `:235-238` (served excess ≤
  `totLiabs/netAssets` + 3pp), `SUM_TRIGGER=1.05` `:75`; cohort `liab_explained` `:239-240`
  (24 funds, RYZAX 178.9%), cohort `served_above_filed` `:222-229` (30 members, ASPCX +8.4pp);
  feeder exemption `:204-210` (`n_rows≤5 ∧ top_pct≥0.90` → `continue` BEFORE the gates).
- **Fund-level Part B figures are raw-only.** `data/nport/snapshot/*` carries `totAssets`,
  `totLiabs`, `netAssets` + itemized liabilities; only `netAssets` is forwarded anywhere
  (`build_asset_allocation_history.py:82,167-213,509`). Nothing fund-level is materialized or
  served: filed net (Σ signed `pctVal`) and gross (Σ|`pctVal`|) are derivable per latest
  canonical accession (`max_by(acc_no)` pattern, check `:150-155`) but exist in no gold panel.
- **Reusable pattern:** `src/fundscore/taxonomy/signals.py:150` already computes `pct_short`
  from `payoffProfile` (not on the serving path).
- **Serving home:** `src/fundscore/serving/fact_assembler.py` `exposure_xray` section dict
  `:853-861` (free-gated `:214`) — sits beside `full_holdings_available`; no new
  `ALL_COLUMNS` entry needed if fields nest there.
- **UNVERIFIED figures (pin in EDA before any display copy cites them):** "JAIGX filed −178%
  net" and "ASPCX +8.4pp" come from `data_gap_analysis.md:50,604-608` (the investigation
  record) and were NOT independently reproduced; JAIGX's latest 2024-partition filing reads
  ~100% long, so −178% is an earlier quarter or a different aggregation basis. First EDA task:
  per-`report_period_end` Σ`pctVal` (latest acc_no) for S000010410 and S000009190.

## Deliverables

### D1 — Short book through gold (decision b)
- Carry signed legs with an explicit direction into the holdings gold layer: add a
  `position_direction` (`long | short | derivative_na`, from `payoffProfile` + sign) so shorts
  are labeled, not sign-inferred. Implementer chooses (EDA-gated): extend `holdings_complete`
  with the column and lift the `valUSD>0` filter behind an explicit `direction='long'`
  predicate for every EXISTING consumer, or emit a parallel short-book panel. Either way:
  **no existing consumer's semantics may change silently** — each downstream aggregation
  (exposure_xray, positioning, return-attribution coverage denominators) keeps longs-only
  behavior in this spec and opts into the gross book deliberately in a future spec.
- `fund_holdings_full`: add the direction column to `FINAL_COLS` (`build_fund_holdings_full.py:134-138`)
  and thread it to the staging/served table; web drawer labels short legs (it already renders
  negative weights — label, don't clamp; negatives are NEVER clamped, house precedent).

### D2 — Fund-level book-basis disclosure fields (decisions a + b-interim)
- New small gold panel (e.g. `fund_book_basis.parquet`), per series × quarter from the latest
  canonical accession: `long_sum_pct`, `short_sum_pct` (signed), `gross_pct`, `net_pct`
  (Σ signed pctVal), filed `net_assets`, `tot_liabs`, `liab_bound`.
- Serve in the `exposure_xray` section dict (`fact_assembler.py:853-861`):
  `gross_exposure_pct`, `net_exposure_pct`, `short_book_pct`, `uses_leverage`
  (gross > 1.05, consistent with `SUM_TRIGGER`), `book_basis_as_of`.
- Web (fundscore-web): leverage chip where holdings totals render (chip pattern:
  `ProfileHero.tsx:179` breakeven chip) — plain copy, e.g. "uses borrowed money — holdings total
  179% of assets"; for short-users until D1 display ships, label the long book
  "long positions only" with filed net alongside.

### D3 — Row-inclusion contract named + counted (decision c)
- Extract the emergent filters into ONE documented, named predicate (shared or mirrored in both
  builders, module-level doc) stating exactly what is excluded and why.
- Register a check reporting per-fund dropped-row count and dropped-value share (the ~75 [B1]
  funds surface in the report, EDGU first). **No data change intended** — any row whose
  classification changes under the named predicate is a defect finding, not a refactor detail.

### D4 — Feeder anchor (decision d)
- Replace the skip-`continue` exemption (`check_…_coherence.py:204-210`): resolve the feeder's
  master and evaluate G1/G2 against the MASTER's filing. Master-linkage source is an open EDA
  question (N-CEN relationships / twin map — the exploration found no existing feeder→master
  map). **If no reliable linkage exists, do NOT fabricate one:** keep the exemption but WARN-list
  each feeder explicitly with "master unresolved" so the exemption is visible, not silent.

## Gates / acceptance
- Reviewed lane: data-reviewer checkpoint after each backend deliverable; `/check-data` after any
  rebuild; codex gate; per-series regression diff vs pre-change staging.
- **No served long-book number moves in D1–D3** (aggregation semantics unchanged) — diff proves it.
- Acceptance spot-checks (EDA-pinned first): ASPCX short legs labeled in the full table; RYZAX
  serves `uses_leverage` with gross ≈ 179%; EDGU's dropped rows counted in the check report;
  DFCSX/ECGIX anchored to master or explicitly WARN-disclosed; JAIGX net/gross pinned to the
  correct quarter before any copy cites −178%.
- Served gross/net must reconcile to an INDEPENDENT Σ over the raw store for the same accession
  (computed fresh, not copied from the coherence check — non-degenerate verification).

## Out of scope
- Re-baselining exposure/attribution/beta aggregations onto the gross book (future spec).
- Renormalization of any kind (owner doctrine).
- Retuning the coherence-check thresholds (G1/G2 tolerances, `SUM_TRIGGER`).

## Sequencing
No hard `depends_on`, but `holdings_complete`/`holdings_snapshots` are also rebuilt by the
backlog's Refresh campaign — land this before the campaign's holdings rebuild or fold the rebuild
into that pass so the full rebuild is paid once.
