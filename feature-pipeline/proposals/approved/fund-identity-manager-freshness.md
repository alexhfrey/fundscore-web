---
id: fund-identity-manager-freshness
title: Fix fund identity and freshness — true inception, named manager + succession, inline as-of stamps
status: approved
created: 2026-06-24
audience: both
impact: high
effort: L
scope: global
source_pages: [FCNTX]
source_critiques: [data-quality, narrative]
---

## Pitch
The page stamps INCEPTION 2008-05-09 on Fidelity Contrafund — a fund running since 1967 under Will
Danoff since 1990 — truncating its record to 17 years and making the 209-month skill window look like
the fund's whole life. Meanwhile the single biggest real-world fact is absent: Danoff (unnamed; the
page credits only the firm) is expected to retire around Dec 31 2026, ~6 months out. And freshness is
buried — the expense ratio is carried/stale to 2024-03-31 (`is_filed` false) and holdings are 267 days
stale (2025-09-30), with both warnings stranded in the footer rather than inline where they're used.
We'd (a) label 2008 as share-class/series inception and resolve or caption true strategy inception,
framing 209 months as a data-availability window; (b) surface named PM, tenure, and any filed
manager-change/retirement event as a first-class fact with a transition flag; and (c) move freshness
stamps inline onto the holdings- and fee-dependent readouts. These are the highest-stakes, most
checkable facts on the page — a skeptical reader who spots the 2008 date or the missing star manager
dismisses the whole analysis.

## Problem
Data-quality and narrative converge. Served `identity.inception_date` 2008-05-09 (L32), `t_years`
17.38 (L228) vs web/filings: launched 1967, Danoff PM since 1990. `manager_names` =
['Fidelity Management and Research Company LLC'] (L223) — no named PM, no change event, despite Danoff's
expected ~2026-12-31 retirement (co-PMs added 2025-04-11). `series_expense_ratio_history` `is_filed`
false, ER stale to 2024-03-31. Holdings 2025-09-30 = 267 days stale; staleness warnings only in footer
(text.txt L126-127), not inline.

## Why it fits
Trust in the verdict rests on trust in the basic facts. A wrong inception date and a missing star
manager are the first things a skeptical reader checks, and a stale fee/holdings figure used silently
undercuts the fee-vs-passive claim. Note: named-PM and manager-change data is currently a placeholder
(`manager_assignments` all `unavailable`, zero fabricated names) — this proposal needs a real PM/manager
source before names can ship; do not fabricate. The inception relabel and inline freshness stamps can
ship immediately from existing fields.
