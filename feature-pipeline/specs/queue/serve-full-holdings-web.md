---
id: serve-full-holdings-web
title: Wire the full-holdings drawer to served data, paid-gated (web)
status: queued
track: frontend
repo: fundscore-web
depends_on: serve-full-holdings-backend
source_proposal: feature-pipeline/prds/serve-full-holdings.md
created: 2026-07-05
scope: global
---

# Full-holdings drawer: real data + paid gate — web

PRD: `feature-pipeline/prds/serve-full-holdings.md` (owner-resolved: filed list, filed % of
net assets). Blocked on `serve-full-holdings-backend` (the `fund_holdings_full` serving table +
`gates.holdings_full` + teaser fields must exist in staging/Postgres first).

## Problem

`HoldingsFullDrawer.tsx` ("View all N holdings") is fixture-backed for FCNTX only, renders
ticker+weight, and has no gate. The backend now serves the filed list per fund in a separate
long table; wire it up, paid-gated, on the v2 profile surface (`/preview/funds/[ticker]` today;
production arrives via `profile-v2-production-cutover`, not this spec).

## What to build

1. **Drizzle schema** for the new long table in `src/lib/db/schema/serving.ts` (match the
   backend's final DDL; one row per position line, keyed by canonical_ticker + rank/stable id).
2. **Lazy fetch path**: one request per fund when the drawer opens (server action or route
   handler per house conventions — the drawer is a client `<details>` inside a server page).
   The gate is enforced **server-side in this fetch path** via a pure gate helper keyed off the
   fact row's `gates.holdings_full` and the session tier — zero rows in any response below
   paid. Add the helper next to `applyGates` in `src/lib/serving/gating.ts` so
   `scripts/test/gating-golden.ts` can exercise it directly (extend the golden: below-paid ⇒
   empty; paid ⇒ rows; fund without a list ⇒ empty + no teaser).
3. **Extend the `HoldingsFull` contract** in `src/lib/serving/profile-v2.ts` (today
   `{stock_ticker, weight_pct}` only): rows carry name, nullable ticker, weight_pct (filed),
   value_usd, country, sector (nullable), asset_cat; metadata carries n_positions, as_of,
   basis label. Remove/retire the FCNTX fixture overlay for this section once real data flows.
4. **Extend `HoldingsFullDrawer`**:
   - Row key = stable position id (NOT ticker — ~43% of rows universe-wide have none); filter
     matches name OR ticker; ticker-less rows render name-first.
   - Columns: name/ticker, weight, value, country, sector (em-dash when null), asset-category
     label (map filed codes EC/EP/STIV/DBT… to plain words; unknown codes render the raw code —
     no guessing).
   - Weight display: two decimals with a "<0.01%" floor (display only — never drop rows);
     multi-line issuers stay separate rows as filed.
   - Header: position count (the served N), as-of date (fiscal month-end — copy must not say
     "quarter"), and the basis footnote: "% of net assets, as filed in the fund's N-PORT
     report".
   - Incremental/virtualized rendering: worst case >15k rows; drawer interactive < 200 ms after
     data arrives; filter still searches the full row set.
5. **Free/anonymous teaser**: locked "View all N holdings" with count + as-of, rendered ONLY
   when the fund actually has a served list (never tease rows that don't exist — even if the
   fund has a top-10). Funds with a list but no top-10 still get the drawer.

## Out of scope

The top-10 table itself (different weight basis — 11.75% vs 10.29% for FCNTX META is KNOWN and
accepted until the cross-panel rebase item; do not "fix" it here); production cutover; theme
columns; rollup rows.

## Acceptance

- Paid session, FCNTX: drawer lists 428 rows @ 2026-03-31, META renders 10.29% (±0.005pp of the
  served f64), SpaceX's 5 lines visible (5.100% combined), cash sweep visible, name-filter finds
  "OpenAI".
- gating-golden extended and green: below-paid fetch returns zero rows; teaser only where a
  list exists.
- Initial profile payload < 1 KB gzip delta (rows only ship on drawer open, paid).
- Worst-case fund meets the render budget; `npm run build` + lint green.

## Coordination

The drawer/preview files are part of in-flight uncommitted profile-simple work on
`feat/profile-simple` (CurrentPositioning.tsx, HoldingsFullDrawer.tsx, profile-v2.ts,
gating.ts, gating-golden.ts, preview page). **Before starting, inspect the working tree**; if
that work is still uncommitted, continue on top of it — do not revert or blindly overwrite.
