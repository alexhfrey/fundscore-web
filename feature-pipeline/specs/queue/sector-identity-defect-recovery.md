---
id: sector-identity-defect-recovery
title: Recover the 6 unresolved sector contradictions — they are identity defects, not genuine disagreements
status: queued
track: backend
repo: fund_score
depends_on: sector-consensus-canonical-write
source_proposal: EDA finding on sector-consensus-canonical-write (2026-08-21), dispatcher ruling 3
created: 2026-08-21
priority: 2
scope: global
model: opus
effort: high
lane: reviewed
---

## Owner summary
Six companies still show two different sector labels at once, including the two biggest cases in the
whole book. They were previously written up as "the filings genuinely disagree" — that turned out to be
wrong. All six are plumbing defects: a missing identifier, or an identifier pointing at the wrong
company. This fixes the plumbing so those six resolve too.

## Why this exists
`sector-consensus-canonical-write` resolved 14 of 20 contradictory securities — **70% by count but only
47.0% of contradicted filed value** ($3.856B of $8.199B), because the two largest contradictions in the
book are both unresolved: **SharkNinja ($3.19B)** and **Shift4 ($0.99B)**.

Its EDA read every US-filed row of all six declines and checked the raw N-PORT filings. **Not one is a
genuine two-opinion disagreement.** All six are identity defects on a small minority of rows:

| class | securities | evidence |
|---|---|---|
| `cusip='N/A'` sentinel → falls through the US arm into the FMP-by-ISIN fallback, which merely re-states the foreign label the rule is overriding | Navigator (10 rows / $5.21M), Waldencast (1 / $11.1k), Cango (3 / $782k) | acc_no 0001478482-26-000182; Navigator month 2/3/4 cusip census |
| **wrong filed CUSIP binds a different company** | SharkNinja (3 rows / $4.017M → SNECQ Sanchez Energy), Shift4 (11 rows / $4.377M) | acc_no 0001004726-26-005678, 0002000324-26-002810 |

Per the standing rule, a **100% recoverable-missing remainder is a DEFECT**, not acceptable partial
coverage. This spec closes it at source.

## What to build
Resolve identity before sector attach, so the US arm sees the rows it should:
1. **The `'N/A'` cusip sentinel** — a *string*, not a null. Any `!= sentinel` filter or sentinel-derived
   boolean fails OPEN silently; audit them rather than assuming a null check covers it.
2. **Wrong-CUSIP bindings** — a filed CUSIP resolving to a different company than the ISIN/name. Adjudicate
   from the join surface; where claimants tie, **exclude honestly** rather than pick a stable-but-wrong
   winner.

## Verify
- Re-derive the four counts: contradictory securities, resolved, declined, lacking US rows.
- **Lead with value-weighted coverage**, not count coverage — the count figure is what hid this.
- Any residual decline must be **proven** honest by reading its raw N-PORT rows, not assumed.
- Every check that returns 0 must be shown able to return non-zero.
- Per-fund diff vs backup; `/check-data`; `data-reviewer` checkpoint.

## Also in scope
Correct `reports/l14_segment4.md` §1 if `sector-consensus-canonical-write` has not already — it presents
these six as genuine US-side disagreement, the framing that let a 47% value coverage read as acceptable.

## Added by `passive-book-sector-basis-parity` (L16, 2026-08-21) — a THIRD binding surface

L16 put the passive book on the fund book's sector basis and drove cross-basis disagreement to **0 on
the consensus scope**. Its residual analysis surfaced one case that belongs here, not there, because it
is the same **wrong-company-binding** class as SharkNinja / Shift4 — just reached through a different
identifier.

**`ROP` in `S000015906`** — 0.081pp of that fund's passive NAV. The passive book carries
`security_id='ROP'`, `inv_country='US'`, sector **Technology**. The fund book carries the same ticker
`ROP` bound to `isin='CH1499059983'`, `inv_country='CH'`, sector **Healthcare** — a Swiss line collapsed
onto Roper Technologies' US ticker, with the sector read off the Swiss ISIN.

Measured in-run on the post-write canonical book: the whole-book identity bridge finds `ROP` claiming
**two** ISINs — `CH1499059983` and `US7766961061` (real Roper) — as **both** a `security_id` and a
`security_ticker`. The honest-exclusion tie rule therefore **drops the key**, so `l16_cross_basis_parity`
declines to measure the pair rather than reporting it clean. That is the correct behaviour for L16's
ISIN-keyed rule and the reason this defect is invisible to it: the two books never share a
`(series_id, ISIN)` pair.

Scope note for whoever picks this up: `ROP` is **one of 360 excluded tie keys** in the whole-book bridge
(180 `security_id` + 180 `security_ticker`). That set is the census of ticker-level wrong-company-binding
candidates and should be triaged here, value-weighted, alongside the six CUSIP-side cases above. The
existing rule "adjudicate from the join surface, tie → exclude honestly" already covers it; what is
missing is the *recovery* step that resolves the tie from filed evidence.

Do **not** treat this as widening L16 — the dispatcher ruled it out of that spec's scope on 2026-08-21.
