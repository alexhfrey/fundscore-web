---
id: canonical-fee-over-passive-figure
title: Ship one canonical fee-over-passive figure and block impossible expense pairs
status: approved
created: 2026-06-24
audience: both
impact: high
effort: M
scope: global
source_pages: [FCNTX]
source_critiques: [marketing, design, engineering, data-quality, narrative]
---

## Pitch
Our entire thesis is "what do you pay above passive" — yet on FCNTX that one idea shows up as 36, 32,
and 18 bps within a single scroll, on top of an expense table that is mathematically impossible. We'd
define ONE canonical active-fee-over-passive number (sourced from `active_fee_bps`) and reuse it
verbatim across the hero, Fee Fairness, and the dollar-gap example. Then we'd add a fee-coherence
invariant at the data layer that hard-fails any fund where gross ER < net ER or net ER < management
fee, and root-cause the corrupted MFRR net ER for series S000006037. This is the credibility of our
core differentiator: a reader who sees three numbers for one concept — and an impossible expense
table — cannot trust anything else on the page.

## Problem
Five critics flag the same contradiction. The hero says "you pay 36 bps more" (net ER); Fee Fairness
shows True Active Fee +32 bps (`active_fee_bps` 32.28); the dollar gap implies 18 bps (net 35.5 −
passive 18). Separately, data-quality found gross ER 0.0032 equals `net_min` (impossible: gross < net)
and net ER 35.5 sits below the 63 bps management fee public filings confirm (0.63%), so net is
understated by roughly half. `the_take.py:178` renders net ER instead of `active_fee_bps`;
`FeeFairness.tsx` and the served facts disagree on the figure; `fund_metadata` has gross == net_min.

## Why it fits
Fee-vs-passive is the product. The number that expresses it must be single, correct, and reproducible
on every page. Picking one canonical source figure and adding a hard data invariant directly protects
the mission and prevents the same impossible expense pairs from shipping on other funds. Needs a
root-cause fix to the upstream MFRR net ER for the affected series; do not paper over with a default.
