---
id: recent-changes-te-ranked
title: Rank recent positioning changes by estimated tracking-error impact, classified by bet type
status: done
track: backend
repo: fund_score
depends_on: te-decomposition-by-bet   # unify-* was a REBUILD-ORDERING constraint, not a design blocker — see ADDENDUM 2026-08-25
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-01
scope: global
model: opus
effort: xhigh
---

## Owner summary
Upgrades the "what changed recently in this portfolio" section from a list of trades to a ranked story — ordering each change by how much it moves the fund's risk, so customers see which moves actually matter. This is the last backend piece needed before the redesigned page can fully replace the old one.

**Sequencing (2026-07-22):** now also depends on `unify-te-decomposition-global-basis` — the TE
impact ranking must be computed on the unified 35-factor global basis that spec establishes, not on
the per-fund `te-decomposition-by-bet` basis it retires. Do not implement this spec first.

## Goal
Serve the Recent Changes section: "what has the manager actually been doing lately" — the most
significant holdings changes from consecutive N-PORT filings, classified (stock / sector / theme /
concentration / cash) and **ranked by estimated tracking-error impact**, not raw pp magnitude. A
−5.5pp Healthcare cut and a +0.4pp Cybersecurity add differ in how much they change the fund's
benchmark-relative risk; TE impact is the ranking a sophisticated reader wants.

## Context
- The changes panel exists: `data/gold/positioning_changes_panel.parquet` (~158K rows;
  `change_type ∈ {position, sector, theme, concentration, cash, style}`, prior/current values,
  magnitude, z-score, surfacing flags, dual holdings as-of stamps). FCNTX (eval 2025-10-31,
  2024-09-30 → 2025-09-30): cut Healthcare −5.5pp, added Comm Services +2.3pp and Semis +2.3pp,
  cut GLP-1 −2.0pp and Large-Cap Biotech −1.8pp — real rows already shipped as labeled mock data.
- Note the FCNTX case: the SERVED `positioning_changes` section says "none available" while the
  gold panel has 25 available rows with `is_surfaced = false`. EDA must root-cause the surfacing
  rule (threshold? window? bug?) — if significant real changes are being suppressed, that is a
  recoverable-miss defect to fix here, not accept.
- TE machinery comes from `te-decomposition-by-bet` (factor Σ + vol lookups) — same factor return
  series, same window conventions.

## Computation
Per surfaced-candidate change row:
1. **Sector/theme/macro shifts**: `te_impact_bps ≈ |Δexposure| × σ_factor` (annualized factor vol
   from the shared Σ; Δexposure in weight terms mapped through the holdings-beta convention used by
   the exposure path). This is an ESTIMATE — label it (`te_impact_basis: 'delta_weight_x_factor_vol'`).
2. **Position (stock) entries/exits/resizes**: `|Δweight| × σ_stock` with the stock's idio vol
   (from the risk model's security panel); same estimate labeling.
3. **Concentration/cash rows**: no TE mapping in v1 — keep them, ranked within their own group by
   magnitude, `te_impact_bps: null` (honest: don't force a fake common scale).
4. Re-rank: `te_rank` over rows with a TE estimate; keep the existing `surfaced_rank` as fallback.
   Enrich rows with `classification` (the UI filter key) mapped from `change_type`
   (`position→stock`).

## Output
- Enriched rows in the existing gold panel build (new columns `te_impact_bps, te_impact_basis,
  te_rank`) — no new parquet needed unless the build separation is cleaner; implementer's call.
- Serving: enrich the existing `positioning_changes` JSONB rows in `fact_assembler.py` (no new
  Drizzle column). Gate unchanged (top shift free via existing `ShiftPreview`; full ranked list
  paid).

## Data-integrity guardrails
- TE impact is an estimate and is labeled as such in the payload — the UI copy says "estimated";
  never presented with the same authority as the measured `te_current`.
- Both holdings as-of stamps (`holdings_as_of_current/prior`) remain mandatory on every row — with
  the N-PORT frontier at 2025-10-31, staleness is the section's biggest honesty risk.
- No cross-type fake commensurability: rows without a defensible TE mapping serve null impact.

## Operational prerequisite
Holdings are frozen at 2025-10-31 (~3 quarters stale at spec time). The section is only
launch-honest after an N-PORT ingest refresh; note the refresh as a launch gate in the rollout, and
the payload must keep serving the dual as-of stamps so the UI shows the lag prominently either way.

## EDA questions
1. Root-cause the FCNTX surfacing suppression (served "none available" vs 25 available gold rows).
2. What Δexposure→beta convention does the exposure path use for sector/theme weights (pp of weight
   vs beta units)? Use the same one.
3. Sanity of the estimate scale: for 10 sample funds, is the top TE-ranked change usually also
   top-3 by magnitude? Where they diverge, is the divergence explainable (high-vol factor)?

## Acceptance criteria (relational)
- For 5 spot-check funds: `te_impact_bps` recomputes from (Δexposure, factor/stock vol) exactly;
  ranking is stable under recomputation.
- FCNTX serves its real changes (Healthcare cut top-3 by magnitude; its TE rank consistent with
  Healthcare's factor vol) — the "none available" defect is gone or explicitly root-caused as
  correct behavior.
- Rows keep dual as-of stamps; `/check-data` passes on the enriched panel.
- Served == gold (spot-check); no row claims a TE impact whose basis column is missing.

## Out of scope
- Multi-quarter change streaks/trend narratives; flow-based (purchase/sale) inference beyond weight
  deltas; the N-PORT ingest refresh itself (operational task, gates launch not implementation).

## Risks
- Estimate abuse: a reader taking "TE impact" as measured risk — mitigated by labeling + copy.
- Surfacing root-cause may reveal a wider suppression bug (then fix via /fix-data conventions —
  sweep for sibling inconsistencies per project memory).

---

## ADDENDUM — 2026-08-25: this shipped ahead of its own spec. Closing the inversion.

**What happened.** This spec's code went LIVE on 2026-08-25 inside the
`recent-changes-no-lookthrough` reload — the two changes share one rebuilt panel, so publishing one
published both. It is what took the section from 8,818 to 20,861 served rows. That left an inversion:
**shipped code, unfinished spec.** This block closes it by verifying the spec's own acceptance
criteria against production rather than by re-running a build.

### The blocking dependency was already satisfied — verified, not assumed

The 2026-07-22 sequencing note said this must wait for `unify-te-decomposition-global-basis` because
"the TE impact ranking must be computed on the unified 35-factor global basis that spec establishes".
Checked at source:

- `data/gold/risk_model/global_basis_returns.parquet` **already carries 35 distinct factors** on
  `global_basis_v0.2_nothemes` (14,490 rows, 2018-06-22..2026-05-22). That IS the target basis.
- The shipped ranking's σ **reproduces `sqrt(diag(Σ))` of that shipped basis to 8.33e-17** across 33
  factors (gate G2), and G2 is non-degenerate: substituting raw `target_return_series` σ turns it RED
  at 1.395e-01. So the ranking is demonstrably on the right basis, not merely claimed to be.
- The ranking never consumes `te_decomposition` for its BASIS. It reads that artifact only to pin its
  σ **window** — deliberately, "never hardcoded, so the two stay pinned together".

**So the dependency was never a design blocker; it is a REBUILD-ORDERING constraint.** Recorded as
such: when `unify-te-decomposition-global-basis` changes `te_decomposition`'s σ window, **rebuild the
positioning panel afterwards** so the ranking re-pins. Until then the live ranking is internally
coherent with the `te_decomposition` that exists today.

### Acceptance criteria, re-tested against LIVE serving (not a scratch build)

| criterion | result |
|---|---|
| ranking stable / no rank-vs-impact inversion | **2,813 funds checked, 0 inversions** |
| no row claims a TE impact whose basis column is missing | **0 of 20,861** — probe proven able to fire on a seeded row |
| dual as-of stamps present | **3,244 / 3,244 funds** carry `eval_date`; single `method_version` |
| FCNTX serves its real changes, "none available" defect gone | **8 real rows served** |

**One honest deviation from the spec's wording.** The spec (written 2026-07-01) expected FCNTX's
top-3 to be led by a Healthcare cut. Live, the top-3 by TE rank are **META −6.01pp (206.6 bps),
AI Infrastructure +4.93pp (113.2 bps), BRK.A −6.21pp (96.6 bps)**. The underlying data moved in the
intervening eight weeks, so the specific example no longer holds; the substantive criterion — the
"none available" defect is gone and the fund serves real, correctly-ranked changes — is met. Note
BRK.A has the LARGER magnitude yet ranks below META: that is the feature working as designed,
ordering by risk impact rather than by size of trade.

### Status
Acceptance met in production. Moved to `done/`. The residual is the rebuild-ordering constraint
above, which belongs to `unify-te-decomposition-global-basis` and is recorded in its spec.
