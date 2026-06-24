---
id: free-proof-point-per-gated-section
title: Surface one free proof point per gated section instead of paywalling the whole basis
status: approved
created: 2026-06-24
audience: both
impact: high
effort: M
scope: page
source_pages: [FCNTX]
source_critiques: [marketing, design, narrative]
---

## Pitch
The free hero delivers a negative verdict — "Selection unproven" — then hides every section that would
let a reader verify it: Exposure X-Ray, Risk & Attribution, Selection Evidence, Return Attribution, and
Alternatives all collapse to "Create a free account" or "Upgrade to view" (three sign-up CTAs and three
upgrade CTAs in ~1.5 scrolls). We ask the reader to trust a damning call while withholding its basis,
and design notes the four near-identical lavender locked boxes flatten the lower page into one long
paywall with no second focal point. We'd surface one concrete, already-computed proof point per gated
section for free — the headline exposure gap (tech 27.9pp underweight vs IWF), top detractor
(SALESFORCE −359 bps), IR −0.12 over 209 months, P(skill) ~4% — then gate the full breakdown, and
collapse the four locked boxes into one unlock module with a single CTA. Gate depth, not the existence
of evidence.

## Problem
Three critics flag this. text.txt L109/L112/L118 "Create a free account to view"; L119/L123 "Upgrade to
view". The hero resolves to a locked 0-100 box (text.txt L33-34), so the deliverable is withheld.
Design: four near-identical lavender boxes, free-account CTA 3×, upgrade CTA 3× in ~1.5 scrolls
(`primitives.tsx:76-95`); a flat equal-weight list with no focal point after the hero
(`page.tsx:96-137`). Every cited proof point already exists in the served payload.

## Why it fits
Evidence over assertion is the brand. Showing one verifiable fact per section makes a free reader trust
the verdict and want the depth, advancing the fee-vs-passive case rather than hiding it behind a wall.
No new data — these proof points are already in the served payload; this is a presentation/gating
redesign.
