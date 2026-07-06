---
id: serve-full-holdings-backend
title: Serve the filed full-holdings list per fund (backend)
status: done
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/prds/serve-full-holdings.md
created: 2026-07-05
completed: 2026-07-05
scope: global
---

# Serve the filed full-holdings list per fund — backend

PRD: `feature-pipeline/prds/serve-full-holdings.md` (owner-resolved 2026-07-05: basis (c) —
filed list, filed % of net assets). Read it first; the acceptance numbers below come from it.

## Problem

The profile's "View all N holdings" drawer needs the complete position list per fund. The
answer is the fund's **filed N-PORT list** (FCNTX: 428 positions at 2026-03-31), NOT
`holdings_complete.parquet` — the gold classified book drops the private/preferred book
(FCNTX: SpaceX ~5.05% across 4 lines, OpenAI, Anthropic, …) and the cash sweep (85 rows).
Nothing serves this today; serving has no long-format (many-rows-per-fund) table at all yet.

## What to build

1. **A new long serving table** (working name `fund_holdings_full`; final name per serving
   conventions) staged as a parquet next to `serving_facts_staging.parquet` and loaded to
   Postgres alongside `fund_profile_facts`:
   - Grain: one row per (series, position line) at the fund's **latest canonical filing**
     within the serving recency scope. As-filed: multi-line issuers stay multiple rows.
   - Columns (final naming per conventions): `series_id`, `canonical_ticker`, `as_of`
     (report_period_end), `position_rank` (weight-desc order), `security_name`,
     `security_ticker` (resolved US ticker, nullable), `cusip`/`isin` (for the stable row key),
     `weight_pct` = filed `pctVal` **exactly as filed** (it is already a percent), `value_usd` =
     `valUSD`, `country` = `invCountry`, `sector` (cusip_reference join where it resolves,
     else null), `asset_cat` (filed `assetCat`, raw code — display labeling is frontend).
   - Source: raw `data/nport/holding/` partitions via the **recent-2yr glob**
     (`src/fundscore/nport/paths.py`) with the **canonical lexmax `acc_no` dedup per
     (series, period)** — the NPORT-refresh double-count fix. Reuse the existing helpers; do
     not re-derive. Do NOT source from `holdings_complete`.
   - Ticker/sector enrichment: reuse the same resolution the holdings builders use
     (security_id/ticker resolution, `cusip_reference` join). Enrichment is display metadata
     only — it must never drop or reweight a row. No imputation; nulls stay null.
   - Universe: `source_inventory` serving scope (the same ~5,799). Funds with no filed
     holdings are absent — honest, no placeholder rows.
2. **Gate + teaser metadata on the facts row**: `gates.holdings_full = "paid"` in
   `fact_assembler`, plus teaser fields (filed row count `n_positions`, `as_of`) exposed
   free — put them where the existing `holdings` section conventions dictate and document the
   choice. Teaser N MUST equal the served table's row count for the fund (never metadata
   `total_holdings`, never the tickered snapshot count). Emit teaser metadata ONLY for funds
   that actually have rows in the new table.
3. **Load path**: extend `apply_serving_schema.py` (idempotent DDL — note the open backlog item
   on its fresh-DB/upgrade robustness; make the NEW table's DDL correct on both paths) and
   `serving/load.py` so the new table TRUNCATE+COPYs **in the same transaction/build** as
   `fund_profile_facts` (teaser count and rows can never diverge mid-deploy). STAGING only —
   the Postgres push stays sign-off-gated per house rules.
4. **Checks** (a `check_*` script per house pattern + invariants wired into the build):
   - Grain: zero duplicate (series_id, position line) beyond legitimate as-filed duplicate
     lines from ONE canonical accession; exactly one accession per (series, period) serves.
   - Copy fidelity: `weight_pct`/`value_usd` byte-equal f64 vs the raw filed values for
     sampled funds; per-fund sum(weight_pct) equals the filed sum (do NOT normalize to 100).
   - External spot checks: FCNTX 428 rows @ 2026-03-31 accession 0000035402-26-003312, META
     10.2875%, SpaceX 4 lines ≈5.05% combined, Revere Street cash sweep present; plus 2+ other
     funds vs their raw filings.
   - **Coverage headline**: % of the served universe populated; remainder split honest-missing
     vs recoverable with spot checks on misses (report per house coverage rules).
   - Gate coherence: `gates.holdings_full` and teaser fields present ⇔ rows exist.

## Out of scope

Rebasing the top-10 `holdings` section (cross-panel incoherence backlog item — do not widen
it: leave `holdings_snapshots`/top-10 untouched); per-holding themes; historical quarters;
any Postgres push.

## Acceptance

The PRD's backend-visible acceptance: FCNTX row set + weights as above; same-transaction load;
coverage headline; all checks green. Assembly-line gates apply (data-reviewer checkpoint after
every step, /check-data, codex sign-off before done).

## Notes for the implementer

- This is the FIRST long-format serving table — keep the pattern minimal and consistent with
  the facts table (TRUNCATE+COPY, staging parquet, same build stamp), since
  attribution-factor-path-serving will follow it.
- pctVal semantics: filed percent of net assets; sums per fund cluster near 100 but are NOT
  exactly 100 (FCNTX 100.24) and can legitimately deviate — preserve, never rescale.
- Worst case is >15k rows for one fund; total staged size est. O(600k–800k) rows — trivial for
  COPY, but keep an index on (canonical_ticker) for the per-fund fetch.
