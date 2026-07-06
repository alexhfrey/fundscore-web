# PRD: Serve the full holdings list per fund

- **Slug:** serve-full-holdings
- **Source:** backlog (story), owner request 2026-07-01 (profile-redesign mock item 4)
- **Date:** 2026-07-05 (revision 2 — owner decision folded in)
- **Status:** RESOLVED — owner decided basis (c) on 2026-07-05; specs queued
  (`specs/queue/serve-full-holdings-backend.md`, `specs/queue/serve-full-holdings-web.md`)

## Problem

The redesigned profile's positioning section has a "View all N holdings" drawer
(`HoldingsFullDrawer.tsx`), but it is fixture-backed for FCNTX only. Production serves only a
top-10 `holdings` JSONB per fund. A retail investor who asks "what does this fund actually own?"
cannot see the answer — and the gold classified panel (`holdings_complete.parquet`) is NOT the
answer either: for FCNTX it keeps 343 of the **428 filed positions**, silently dropping exactly
the rows a user would open the drawer for (SpaceX 5.100% of the fund across 5 share lines
(EDGAR-verified), OpenAI, Anthropic, Cerebras, Canva, Fanatics, Douyin — the private/preferred
book — plus the cash sweep).

## Who & why

Retail investors and RIAs verifying what they own — the natural follow-through on the product
promise ("what are you getting for your fees?"). Incumbents typically paywall the full list
(rationale color only — not verified, do not use in UI copy); a paid-gated full list is a
concrete upgrade trigger.

## Decision: weight basis & row set (owner, 2026-07-05)

Serve the list **as filed** — every position in the fund's canonical N-PORT filing, with the
**filed `pctVal` (% of net assets)** as the weight. Measured on FCNTX 2026-03-31 (accession
0000035402-26-003312):

| Basis | META weight | Denominator |
|---|---|---|
| (b) tickered book (top-10 basis) | 11.75% | $138.1B (273 US-tickered rows) |
| (a) gold classified book | 10.88% | $149.1B (343 gold rows) |
| **(c) filed % of net assets — CHOSEN** | **10.29%** | **$157.8B netAssets (428 filed rows)** |

Rationale: (c) matches the fund's own filings (externally verifiable — `valUSD ÷ netAssets`
cross-checks exactly), sums to ~100% (FCNTX filed sum 100.24%), and is the only basis that
naturally serves the truly complete list including private positions. `pctVal` and `assetCat`
are already parsed in `data/nport/holding/` — the work is carrying them to serving, not new
ingestion. Known accepted consequence: the top-10 panel (tickered basis, META 11.75%) shows a
different number for the same stock until the cross-panel weight-incoherence backlog item
rebases it; the drawer carries an explicit basis footnote meanwhile.

## What it does (behavior)

1. **Surface.** The v2 profile (today `/preview/funds/[ticker]`; reaches `/funds/[ticker]` via
   the separate `profile-v2-production-cutover` spec). This feature wires the existing drawer to
   real served data.
2. **Full filed list per fund.** Every position of the fund's latest canonical filing, as
   filed — no row filtering, no aggregation of multi-line issuers (SpaceX's 5 share lines show
   as 5 rows). Columns: security name; ticker where resolvable (many rows — private placements,
   cash instruments — have none and still appear, keyed and searchable by name); weight = filed
   % of net assets; value (USD); country (N-PORT `invCountry`); sector (where the
   cusip_reference join resolves); asset category (filed `assetCat`, displayed as a plain
   label). Missing classification shows an em-dash — no imputation, no dropped rows.
   **The existing `HoldingsFull` type contract and drawer UI are extended** (today ticker+weight
   only): row key = stable position id (not ticker), filter matches name OR ticker. Dust weights
   display as "<0.01%" (display floor only).
3. **Sorted by weight desc**, headed by the as-of date (a fiscal month-end — copy must not imply
   a common calendar quarter), the position count, and a basis footnote ("% of net assets, as
   filed in the fund's N-PORT report").
4. **Lazy-loaded, one-shot.** Rows live in a separate long serving table, never on the profile
   fact row; one request per fund when the drawer opens. The client keeps the full list so the
   filter searches all rows; rendering is incremental/virtualized (worst case >15k positions).
5. **Gated paid.** Gate key `holdings_full` in the fact row's `gates` JSONB; a pure gate
   function on the fetch path enforces it server-side (zero rows in any response below paid),
   exercised by gating-golden. Free/anonymous keep the top-10 plus a locked "View all N
   holdings" affordance; the count and as-of date are the free teaser. **N = the served filed
   row count.** Deliberate deviation from the house preview-projector pattern (no free
   proof-point rows): the free top-10 already is the proof point. Paid per the owner's
   delegation in the story.
6. **Honest coverage & asymmetry rules.** Universe = the existing serving recency scope with the
   canonical-accession dedup (the NPORT-refresh double-count fix) — never `holdings_complete`.
   A fund with no filed holdings gets no drawer and no locked teaser (never tease rows that
   don't exist), even if it has a top-10; a fund with a filed list but no top-10 may still serve
   the drawer. The table loads in the same build/transaction as the facts table so teaser count
   and rows cannot diverge mid-deploy. Build reports coverage up front: % of served funds
   populated, misses split honest-missing vs recoverable.

## In / out of scope

In: fund_score staging + serving of the filed list (separate long table, same load
transaction), `holdings_full` gate; web Drizzle schema, gated lazy fetch, extended
contract/drawer/gating-golden; coordination with the in-flight profile-simple work.

Out: per-holding theme classification (not in source); asset-class rollup rows (resolved: no);
historical quarters; rebasing the top-10 panel (stays with the cross-panel incoherence backlog
item — but this feature must not *widen* it); the v2→production cutover.

## Acceptance (testable)

- FCNTX, paid session: **428 rows** at 2026-03-31 (canonical accession 0000035402-26-003312);
  META weight renders 10.29% (staged value = filed pctVal exactly, f64; rendered within
  ±0.005pp); SpaceX's 5 lines present totaling 5.100%; per-fund sum of served weights equals
  the filed sum (FCNTX 100.24%) — NOT forced to 100.
- Free/anonymous: teaser (count + as-of) and lock only where a filed list exists; zero
  full-holdings rows in any network response, proven by the extended gating-golden test.
- Coverage headline: X% of served funds populated; remainder split honest vs recoverable with
  spot checks on misses.
- Initial profile page payload: < 1 KB gzip delta (rows are lazy).
- Worst-case fund renders: drawer interactive < 200 ms after data arrives; filter over full set.

## History

- Rev 1 (2026-07-05): one red-team round (spec-reviewer stance) — 9 blockers, 3 owner-question
  candidates, 5 nits; 8 blockers + nits folded in; gating (paid) and rollup (no) resolved from
  the owner's delegation.
- Rev 2 (2026-07-05): weight-basis question escalated with measured numbers; owner chose (c)
  filed list / filed %. Discovery during measurement: gold's classified book drops the private
  book (85 FCNTX rows incl. SpaceX/OpenAI/Anthropic) — source must be the raw filed holdings.
