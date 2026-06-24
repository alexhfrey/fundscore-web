---
id: single-headline-verdict-retire-legacy-score
title: Pick one headline verdict — retire the legacy 5-leg score and close its gating leak
status: approved
created: 2026-06-24
audience: both
impact: high
effort: M
scope: global
source_pages: [FCNTX]
source_critiques: [narrative, marketing, data-quality, engineering]
---

## Pitch
FCNTX wears three unreconciled verdicts at once: a served `value_offering_score` of 71 / "Strong"
(legacy 5-leg), a reframed `value_index` of 30 with badge "Selection unproven", and a green "Strong"
in Fee Fairness. A reader who pays to unlock the 0-100 index discovers a 30 that flatly contradicts the
"Strong" language elsewhere. We'd retire the legacy 5-leg score from the served payload entirely
(engineering confirms it ships unused), make `value_index` the single canonical headline, and add one
reconciling sentence: the fee badge judges fee fairness, the index nets fee plus unproven selection.
Engineering also found the paid 71 leaks as an un-gated top-level scalar (`applyGates` only nulls it
inside sections) — dropping the legacy score removes both the contradiction and the leak in one move,
backed by a deep-walk golden test asserting no paid scalar survives in an anon payload.

## Problem
Four critics converge here. Served facts: `value_offering_score` 71 / label "Strong" (L11-12) vs
`value_offering_reframed.value_index` 30, badge "Selection unproven" (L2005, L1927) vs Fee Fairness
"Strong" (text.txt L87). Engineering: `applyGates` (`profile.ts:308-317`) nulls only
`out.valueOffering.value_offering_score`, but `getFundFactRow` selects the whole row, so the bare
scalars `value_offering_score` / `fee_gap_bps` stay un-gated — no leak today only because all consumers
are RSCs. The legacy 5-leg section ships unused (served facts L37-103).

## Why it fits
One fund, one verdict, is foundational trust. The reframed `value_index` is the mission-aligned figure
(it nets fee against evidenced skill); the legacy score is a contradicting artifact that also opens a
paywall leak. Removing it sharpens the message and hardens tier integrity in a single change. No new
data needed — this is a deletion plus a gating/golden-test fix.
