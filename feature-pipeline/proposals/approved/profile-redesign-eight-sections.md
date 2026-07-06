---
id: profile-redesign-eight-sections
title: Fund profile redesign — eight-section "refined honesty" page + the data products it needs
status: approved
created: 2026-07-01
audience: both
impact: high
effort: XL
scope: page
source_pages: [FCNTX]
source_critiques: [owner]
---

## Pitch
Owner-driven redesign of `/funds/[ticker]` into an eight-section page sophisticated retail investors
will pay $195/yr for: (1) Hero with the value score as the hero element ("+10 bps/yr vs IWF"), (2) AI
Summary, (3) Historical Performance with a growth-of-$1000 chart and after-fee vs-passive table,
(4) Performance Attribution explorer with user-selectable windows and category→member drill-down,
(5) Current Positioning with beta/TE percentile context and a TE-by-bet decomposition, (6) Recent
Changes ranked by tracking-error impact, (7) Fee Fairness (exists), (8) Fund Family analysis with
average + AUM-weighted outperformance and a family rank ("4 of 116"). Brand: **refined honesty** —
one consistent vs-passive frame, breakeven framed as breakeven, every number served (never computed
at render time), sample/prototype states labeled until real data ships.

## Decisions already made with the owner (2026-07-01)
- Design explored via static mocks first (v5 round on top of `combined-v4.html`); architecture picked
  before React work.
- The new page ships first at a **preview route** (`/preview/funds/[ticker]`) with a visible banner;
  real served data where it exists, clearly-labeled fixtures for unserved sections. Production page
  untouched until real data lands.
- Reuse the serving types / gating / takeaway builders / primitives from `feat/profile-simple`.
- Backend work is specced (this proposal's spec set), implemented later via `/implement-next`.

## The spec set this proposal generates (all track: backend, repo: fund_score)
1. `profile-nav-series` — serve monthly growth-of-$1000 series (fund + passive blend, matched
   windows) + per-period after-fee table + beta-adjusted variant. Computation exists in gold; this is
   serving integration.
2. `attribution-quarter-blocks` — **V2, not a production-cutover blocker**: materialize the quarterly
   Brinson member blocks the engine already computes internally, so the web can compose custom
   windows and drill into members after the first dynamic page ships.
3. `attribution-factor-path-serving` — extend the exposure-path build with per-quarter forward factor
   returns, market beta + effect, idio and fund/passive quarter returns (the beta/sector/macro/
   selection top split for any window).
4. `positioning-context-percentiles` — beta + TE percentile among funds sharing the same passive
   alternative.
5. `te-decomposition-by-bet` — TE² = b′Σb + σ²_idio; per-bet TE contribution, grouped rollup headline.
6. `recent-changes-te-ranked` — re-rank positioning changes by estimated TE impact.
7. `fund-family-panel` — family (adviser-level) aggregation: avg + AUM-weighted value bps, family rank.
8. `ai-summary-generation` — LLM narrative grounded only in the served fact row, in-code fact gate.

Plus the already-queued `fund-named-manager-source` (manager names/tenure), which the AI summary
depends on.

## Why it fits
This is the page the product sells. Each spec turns an existing gold capability into a served,
customer-legible section; nothing here invents new raw data. The riskiest piece (AI summary) is
sequenced last behind its data dependencies and an in-code fact-grounding gate.
