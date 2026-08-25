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

---

## ADDENDUM — 2026-08-25 dispatcher pre-check (landed BEFORE dispatch; no round was in flight)

A 10-minute read-only pre-check replayed the resolution ladder on all seven cases before any
implementation round opened. It **refutes** the hypothesis it was sent to test, corrects two defects
in the text above, and re-bases the headline number. Treat this section as authoritative where it
conflicts with anything above it.

### R-1 — The hypothesis is REFUTED. This is NOT the `_prefix_match` / `_names_match` root cause.

Backlog item ~line 29 records a proven wrong-company root cause in `reference/cusip_mapping.py`: the
**step-4 6-char prefix fallback** plus a `_gate_ticker_bindings` whose `_names_match` cannot reject a
same-sponsor collision (the `72202L`→MFUS and `885216`→TFGZ blocks). **None of the seven cases here
touches that code path.** Every candidate CUSIP (`79970Y105`, `292766102`, `369604301`, `G8068L108`,
`G9503X103`, `G1820C102`, `Y62132108`, `776696106`) is its own prefix winner, and the exact join hits
first, so step 4 is never reached and the gate never runs.

**So: fix per class — three fixes, not one upstream fix.** `cusip_reference.parquet` records no
`match_method`/`source` column, so the step was re-derived by replaying the ladder; if a provenance
column is cheap to add while in this module, add it — the absence is what made this pre-check cost
10 minutes instead of one groupby.

| class | securities | mechanism | where |
|---|---|---|---|
| **wrong filed CUSIP** | SharkNinja, Shift4, **Genie Energy** | **step-3 exact join, which is UNGATED BY DESIGN** (`cusip_mapping.py:85`, docstring `:39` — "vendor-authoritative, no gate"). The filer wrote a CUSIP that legitimately belongs to another company, so the vendor key resolves correctly to the wrong issuer | `cusip_mapping.py:85` |
| **`'N/A'` sentinel** | Navigator, Cango, Waldencast | join MISS, not a filter leak | `sector_attach.py:89-116` |
| **ticker-side** | ROP | neither — see R-5 | unresolved |

### R-2 — CORRECTION: the spec names five securities but says six. The sixth is **Genie Energy**.

`US3722842081` Genie Energy, filed cusip `369604301` → resolves to **`GE` / GE AEROSPACE / Industrials**
(correct cusip is `372284208` → `GNE` / Utilities). 2 rows / $4.727M. It is the **wrong-filed-CUSIP**
class. S7-4b membership reproduces name-for-name at `reports/l14_domicile_routing.md:122` — dispatcher
re-read that line directly, it is not taken on the pre-check's word. **A worker implementing § Why this
exists literally would fix five and report "six resolved."**

### R-3 — CORRECTION: the cited accession numbers are misattributed. Do not use them as-is.

- `0001478482-26-000182` is series `S000050079` (a REIT fund, 2026-03-31) and contains the **SharkNinja**
  `79970Y105` row ($3,789,102) — it has **no Navigator line at all**, though § Why this exists cites it
  for Navigator.
- `0002000324-26-002810` returns **0 rows** for any of the target names in the 2026 book.
- The Shift4 evidence that does hold: acc_no `0001004726-26-005678`, series `S000070906`, 2026-04-30,
  `SHIFT4 PAYMENTS INC / 292766102 / US82452J1097 / $3,075,246`.

Re-derive each case's evidence from the book; do not inherit these accessions.

### R-4 — RE-BASE the headline number, and always state its basis.

`$8.199B` is **the total filed value of the 20 multi-sector ISINs, both sides of every contradiction** —
it is a *footprint*, not dollars-mislabelled. Reported without that basis it overstates the exposure by
roughly 500×. All three figures are legitimate; each must travel with its basis, and a coverage
denominator must match its numerator's basis:

| figure | basis | value |
|---|---|---|
| the 20 multi-sector ISINs | total filed value, both sides | $8,198,940,258 / 2,580 rows |
| the six (S7-4b) | full footprint of those six securities | $4,350.4M / 776 rows — **53.06%** |
| **the six — actually-defective rows** | the minority rows carrying the wrong label | **$15.871M / 27 rows — 0.194%** |

Sources: `reports/l14_domicile_routing.md:249` and `:184`.

**Line ruling (triage tier (b) — decided, recorded, and the next data-reviewer checkpoint reviews this
call).** The re-base does **not** lower this spec's priority and does not reach the owner mid-run: a
wrong-company binding is the confidently-wrong class this project ranks above an honest gap regardless
of dollars, the fix is bounded, and nothing about the remedy changes. What it changes is the *claim we
are allowed to make* — no artifact, report or commit message may say "recovers $8.2B of contradicted
value". Correct § Why this exists and `reports/l14_segment4.md` §1 accordingly.

### R-5 — ROP stays in scope, but it is NOT on any CUSIP path. Here is the trace to run.

`CH1499059983` is **Roche Holding AG** (~600 rows in the 2026 book, `invCountry='CH'`), filing CUSIPs
`N/A`, `000000000`, `H69293266`. Ruled out, each checked: `H69293266` is absent from `cusip_sector_map`,
its `cusip_reference` row is all-null, and no `H69293` prefix winner exists; `isin_reference` for
`CH1499059983` carries `ticker = null`; `fmp_isin_us_ticker_bridge` maps it to **`RHHBF`, not ROP**, and
the only bridge row with `us_ticker='ROP'` is `US7766961061` (real Roper).

So the `ROP` binding is produced by **none** of `cusip_mapping.py`, `_names_match`, the gate, or the FMP
ISIN bridge. **Open the ROP work with this trace**: where `security_id` / `security_ticker` is assigned
on the fund book for `S000015906` — the `holdings_complete` / `exposure_xray` security-id construction,
or an upstream ticker-alias path (`sharadar_ticker_alias.parquet`, `nport_cusip_ticker_map.parquet`) — on
the specific as-of L16 measured. Budget it as its own ~20-minute trace on a different module; do not let
it block the six.

### R-6 — The `'N/A'` audit instruction in § What to build is hunting the wrong thing.

There is **no sentinel filter in `sector_attach.py`** to audit (`N/A` / `NA'` / `sentinel` / `000000000`
/ `999999999` all return zero hits across its 454 lines). The mechanism is a join miss:

```python
h = h.join(us, on=cusip_col, how="left")                  # 'N/A' misses -> _sec_us NULL
pl.when(_us).then(pl.coalesce(["_sec_us", "_sec_fr"]))    # falls through to FMP-by-ISIN
```

**A null check would not have caught it.** The sentinel never reaches one — it fails the join and yields
a `_sec_us` null that is *indistinguishable* from "US line whose real CUSIP we cannot classify". The
coalesce is correct by design (a US line with a non-US ISIN). **The defect is that "identity unknown" and
"US label unavailable" collapse into the same null**, so a by-design fallback fires on a row that should
have been marked unidentified. Fix that distinction; do not add a sentinel blocklist and call it done.

### R-7 — IN SCOPE, found in-run: `999999999` resolves to a REAL security.

`cusip_reference` serves `999999999 → BAPG0TF0 / "MOUNTAIN PARENT INC. REVOLVER"`, and WALDENCAST PLC
Revolver files `999999999` — **5 rows / $4.12M in the 2026 book**. `000000000` and `N/A` are correctly
absent from `cusip_reference`; `999999999` is not. This is the same confidently-wrong class on the same
fix surface at near-zero marginal cost, so it is **added to scope** (triage tier (b): decided, recorded,
reviewed at the next checkpoint). It does **not** open the door to the wider `N-6` list or the 360 tie
keys — those remain MEASURE-AND-FILE per the scope pin.

### R-8 — The one shared lever, and the measurement that must precede adopting it.

The wrong-CUSIP class (**81.1% of defect value**) would be caught by **extending `_gate_ticker_bindings`
to step 3** — gating the branch deliberately left ungated. "SharkNinja Inc." vs "SANCHEZ ENERGY CORP" and
"SHIFT4 PAYMENTS INC" vs "ENERPLUS CORP" are clean rejects. **Genie Energy vs GE AEROSPACE is the hard
case** — `_names_match` on the `GE`/`GENIE` tokens may not separate them, and that is exactly the
same-sponsor-token weakness recorded in the backlog item, so it needs the fund-aware shortening test, not
the issuer predicate.

`reports/l14_domicile_routing.md:433` already names this trust surface and `:613` (N-6) lists three more
live instances beyond the six (Patrizia→Celator, İş Bankası, Mitsui Fudosan), so the lever has reach well
past this spec — **which is why it must be sized before it is adopted, not after.**

**Required before adopting:** measure the blast radius **value-weighted** — how many existing step-3
bindings the gate would reject, and what they are worth. Rejections beyond the specced cases are the
*desired* direction (more wrong bindings caught), but a large or false-positive-heavy rejection set is a
**checkpoint question**, not a thing to ship on the line's own authority. **Every rejection must resolve
to an honest null, never to a stable-but-wrong second choice** ([[deterministic-wrong-worse-than-nondeterministic]]).
