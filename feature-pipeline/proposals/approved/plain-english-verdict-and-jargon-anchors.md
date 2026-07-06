---
id: plain-english-verdict-and-jargon-anchors
title: Add a plain-English verdict line and anchor the jargon for retail
status: approved
created: 2026-06-24
audience: retail
impact: medium
effort: S
scope: page
source_pages: [FCNTX]
source_critiques: [marketing, narrative]
---

## Pitch
The free hero hedges to "Selection unproven" and resolves into a locked box, never netting the page's
own favorable fee verdict against its skill verdict — so a free reader gets a contradiction (Strong fee
vs unproven selection) instead of a takeaway. And the terms that carry the verdict are unexplained at
the point of use: "Information ratio −0.12", "50% of its active risk is stock-specific", "recurring
bps" — with no anchor for whether 50% stock-specific is high or low for a stock-picker. We'd add one
free, plain-English verdict sentence that nets fee + skill + exposure ("cheap for an active fund, but a
36 bps premium over indexing that only pays off if the selection does — and the selection is
unproven"), translate each term inline, and anchor the bet profile against the peer/passive references
already in the payload (active share 0.497 vs peer 0.671; effective positions 17.7 vs 29.4). This makes
the hero deliver on sight using data we already serve, no overclaiming.

## Problem
Marketing and narrative flag both halves. The hero resolves to a locked box with a negative tone never
reconciled to Fee Fairness "Strong" (text.txt L33-34, L87-88). Jargon is unexplained at use:
"Information ratio -0.12" (L43), "50% of its active risk is stock-specific" (L38 from `idio_risk_share`
0.5008) with no anchor; `vs_peer` active_share -0.174 and effective_positions -11.7 are already in the
`exposure_xray` rows but unshown.

## Why it fits
Retail-first comprehension is the north star. A free reader should learn the fee-vs-passive trade-off
in one sentence and understand the terms behind it. Every input — the netting, the peer anchors, the
definitions — is already in the served payload, so this is a copy/presentation change with no new data
or overclaiming. (Distinct from the headline-verdict reconciliation proposal, which removes the legacy
score; this one writes the retail-facing sentence and translates the jargon.)
