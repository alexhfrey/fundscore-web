---
id: fund-family-panel
title: Serve fund-family (adviser-level) value aggregation — avg + AUM-weighted bps, family rank
status: queued
track: backend
repo: fund_score
depends_on: profile-nav-series
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-01
scope: global
model: opus
---

## Goal
Serve the Fund Family section: the fund's family with its other scored funds, the family's **average
and AUM-weighted** net value (bps/yr vs each fund's own passive alternative) on since-inception and
3-year bases, and a family rank — "Fidelity ranks 4 of 116 fund families on AUM-weighted after-fee
value." Answers "is this fund an outlier in its family, and is the family itself any good?"

## Context — the grouping key finding (important)
- `fund_metadata.fund_family` is the **SEC trust/registrant**, NOT the consumer brand: Fidelity
  spans ~45 trusts ("Fidelity Contrafund" is its own single-fund trust; "Fidelity Securities Fund"
  has 8 scored funds). A trust-level "family" table would be meaningless to a retail reader.
- **Group by `fund_metadata.adviser_name` instead** (N-CEN adviser). Verified (2026-07-01, mock-data
  prep, real queries): "Fidelity Management & Research Company LLC" = one clean adviser string
  covering 115 scored funds, $698.6B scored AUM; adviser-level panel with ≥5 scored funds = 116
  families; Fidelity = rank 4 by AUM-weighted value (+37.0 bps) vs simple avg +8.5 bps; leaders:
  PRIMECAP (+95.7), Fuller & Thaler (+61.2), Thornburg (+45.3). Already shipped as labeled-real
  mock data (`_mock_data_v5.json → fund_family`).
- EDA must confirm adviser-name hygiene across the universe (duplicate spellings/abbreviations,
  e.g. "FMR" variants, sub-adviser vs adviser) before trusting the groupby globally; a small
  manual alias map is acceptable, fabricating a brand taxonomy is not.

## Computation
Over scored funds (`value_score.value_bps IS NOT NULL`) joined to `fund_metadata` on series_id:
1. Family = cleaned `adviser_name` (alias map where EDA finds variants). AUM =
   `mnthly_avg_net_assets` (as-of stamped).
2. Per family with ≥ N_MIN (5) scored funds: `n_funds`, `avg_value_bps`,
   `aum_weighted_value_bps`, `total_scored_aum`.
3. 3-year variants (`avg_value_bps_3y`, `aum_weighted_value_bps_3y`): per-fund 3Y after-fee active
   return from the `profile-nav-series` period table (`diff_bps`, 3Y row) — hence the dependency.
   Funds lacking a 3Y matched window are excluded from the 3Y aggregates (count reported), not
   imputed.
4. `family_rank` + `n_families_ranked` on the AUM-weighted SI figure (document the rank basis in
   the payload); per-fund member list (ticker, name, value_bps, aum, passive_alt_label) capped to
   top-N by AUM with an "and X more" count.

## Output
- `data/gold/fund_family_panel.parquet` (one row per family + a member-list table or nested list).
- Serving: new `fund_family` JSONB section per fund in `fact_assembler.py` (the fund's own family
  card: rank, aggregates, member top-list with the fund's own row flagged); `fundFamily` column in
  `fundscore-web/src/lib/db/schema/serving.ts`. Proposed gate: free (drives cross-fund navigation).

## Data-integrity guardrails
- Every fund's `value_bps` is vs its OWN passive alternative — the family aggregate is an average
  of per-fund reads, and the payload copy must say so (not "vs one benchmark").
- Families below N_MIN are excluded from ranking (never ranked over a handful); the fund's card
  then says "family too small to rank" honestly.
- AUM weights carry the metadata as-of; a fund's own row always appears in its family list (even
  outside the top-N cap).
- SI and 3Y aggregates are separate columns with separate coverage counts — never blended.

## EDA questions
1. Adviser-name hygiene: distinct-count vs fuzzy-cluster count; list the top-20 families' name
   variants; size the alias map.
2. Sub-advised funds: group by adviser or sub-adviser? (Recommend adviser = who sells the family;
   document the choice and the `has_sub_adviser` share.)
3. Family-size distribution: how many scored funds live in ranked families (coverage of the
   section).

## Acceptance criteria (relational)
- Family aggregates recompute from member rows exactly (avg and AUM-weighted); rank denominator ==
  count of qualifying families; every fund's own row present in its served family list.
- Fidelity spot-check reproduces the verified numbers on the same as-of (115 funds, rank/aggregates
  consistent with the mock-prep query or a documented data refresh).
- Served == gold (5 fund spot-check across 3 families); `/check-data` passes (entity = family,
  date = as_of).
- 3Y aggregates only include funds with a 3Y matched window; exclusion counts reported.

## Out of scope
- A family PAGE (this serves the per-fund card); family narratives; manager-count enrichment
  (arrives via `fund-named-manager-source`'s family summary).

## Risks
- Adviser-name fragmentation silently splitting a family (EDA #1 + alias map + a "top families by
  AUM" eyeball check in the validation report).
- Survivorship framing: scored funds only — the payload should carry `n_funds_scored` (not claim
  "all Fidelity funds").
