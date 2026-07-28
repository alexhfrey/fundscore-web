---
id: unify-te-decomposition-global-basis
title: Repoint the TE decomposition onto the 35-factor global basis; unify to ONE idio machine
status: queued
track: backend
repo: fund_score
depends_on: te-decomposition-by-bet
created: 2026-07-22
scope: global
model: opus
effort: xhigh
---

## Owner summary
One risk vocabulary for the whole page and one idiosyncratic-share number everywhere. The bets
table stops being sector-crowded by construction (the fixed 35-factor vocabulary guarantees
macro/geo representation), the "two idio siblings on two bases" risk disappears, and the
promoted-but-half-wired global basis finally powers the surface customers actually read. Owner
decision 2026-07-22: **unify — end state is one decomposition machine.**

## Context (what the 2026-07-22 investigation established)
- The 35-factor global basis (`global_basis_v0.2_nothemes`: FF6 + 15 geo_macro + 11 sector +
  3 commodity) IS merged and partially promoted: commit `3120e05` (2026-06-25, ancestor of main)
  made its idio risk share the production headline skill measure feeding `vo_reframe_v0.4`.
  What never happened is the deferred follow-up: rewiring `te_decomposition` (and exposure-path /
  fund-identity — still out of scope here) onto it.
- `te_decomposition` (te_decomp_v0.1, Jul 11) instead fits per-fund selected sector/theme/macro
  series (`standardized_basis_map`, cap 12 by |β|, floor 0.03). Consequence: FCNTX = 11 sector
  rows + 1 macro, zero themes; sector dominance is half real (R²=0.54), half vocabulary artifact.
- **Sibling risk today:** anatomy hatch idio (te_decomposition, per-fund basis) vs VO badge idio
  (`global_decomposition`, global basis) are two machines for one concept (FCNTX 0.459 vs 0.46 —
  agreement is luck, not an invariant).
- **Staleness:** the global chain is weeks behind (`target_return_series` 2026-06-20 →
  `global_basis_*` 06-25 → `global_decomposition` 06-30) while `value_score` is Jul 17.
  te_decomposition hard-anchors to `value_score.te_current` at 1e-9, so the chain rebuild is a
  hard prerequisite, not hygiene.
- Evaluation record (do not relitigate): global basis is the best *explanation/idio* machine
  (idio 3Y IR persistence 0.123 best-of-basis; ridge-CV fixed the fully-idio inflation
  24.8%→6.8%); it does NOT improve *prediction* on the β-adjusted Value Score target — scoring
  basis stays untouched (see `docs/research/global_clustered_basis_spec.md` +
  `reports/feature_experiments/global_vs_perfund_decomp.md`).

## Plan (assembly-line segments; data-reviewer checkpoint after each)

### 0 — EDA gate (data-scientist; OWNER REVIEWS before implementation)
Rebuild inputs fresh (`make build-target-return-series build-global-basis`; verify max
return_date covers the current value_score window). Prototype `decompose_one` on the 35-factor
basis for a reference set spanning the archetypes (FCNTX, DODGX, VPMCX, JEPSX, VSMIX
sector-rotator, FBGRX theme-heavy, an EM fund, a macro-tilted fund). Deliverables:
1. Old-vs-new bets tables side by side; idio-share shift distribution across the full EQ panel.
2. **Display rule decision:** 35 fixed loadings ⇒ many near-zero bets. Propose top-N by
   |var_share| + an explicit labeled rollup row ("N smaller bets · X% of factor variance",
   never silently dropped); pick N/thresholds from the data.
   **Display-contract input (owner, 2026-07-27, from the Crescent V3 design review):** each
   displayed bet must carry (a) a plain-English direction badge (OVER/UNDER for weight-basis
   sectors; LONG/AGAINST for returns-basis themes/macros — never a bare signed β), and (b) a
   one-line "where it comes from" with real held names where they exist (holdings ∩ basket
   membership, e.g. "holds 7 of the majors — XOM, CVX, COP…"; else "exposure from returns — no
   single holding"). Reference rendering: `fund_score
   docs/product/strategy/mockup_fund_profile_crescent_v3.html` — see **"the Book"** card: the
   fused one-row-per-bet artifact (NOW dir+risk · 21-quarter exposure-path sparkline · PAID
   held/moved) that collapsing positioning+attribution onto one basis enables. Note the Book's
   path column needs the exposure-path β-path on the SAME basis — currently a deferred non-goal
   here; either ship Book v1 with the path labeled as current-basis, or pull the exposure-path
   rewire forward. Brand bar:
   "no-nonsense elegant simplicity" (crescent spec § Brand principle) — jargon behind
   affordances, t-stats/var-shares never inline.
3. **Theme handling decision:** the 35-basis excludes themes (right for the skill measure, but
   FBGRX-class funds lose their story). Evaluate: (a) labeled theme overlay rows sourced from the
   existing theme panels, visually separate, never summed into the factor sleeve; (b) a
   with-themes display variant of the basis; (c) themes live only in Exposure X-Ray/archetype.
   Recommend one with evidence.
4. **theme_ride provenance trace:** vo_reframe's `theme_ride` may read `global_decomposition` —
   census ALL consumers of `global_decomposition` before any retirement. Anything found blocks
   step 3 until migrated.

### 1 — Repoint the builder
`build_te_decomposition.py`: swap `standardized_basis_map` → the 35 fixed series
(`global_basis_returns.parquet`, labels from `global_basis_factor.parquet`). Keep: the
`te_current` 1e-9 anchor gate, FWL per-bet betas, Σ var-share allocation, quadrature invariant,
negative shares kept unclamped. Add: display-selection fields per the EDA rule (rank,
is_displayed, rollup aggregates). Version: `te_decomp_v0.2_global`. Never overwrite the v0.1
parquet (label + separate file per feedback_label_model_versions).

### 2 — Unify the idio consumer
`value_offering_reframed` reads `idio_risk_share` from the repointed te_decomposition
(→ `vo_reframe_v0.5`), retiring its `global_decomposition` read. Report the old-vs-new idio
delta distribution (expected small — same basis family — but measured, not assumed).

### 3 — Retire global_decomposition (gated on step 0.4 census clean)
Remove from the default build path; archive module + last parquet (never delete). Migrate or
retire its checks in `scripts/checks/run_checks.py`.

### 4 — Gates (fail closed)
`make check FEATURE=te_decomposition` (existing invariants + new: display-rule coverage — the
rollup row must reconcile the dropped mass); NEW sibling-coherence check: post-unify there is
exactly ONE served idio_risk_share source (grep-level assertion + value identity across panels);
/check-data on the rebuilt panel; data-reviewer checkpoints per segment; codex sign-off; final
combined served==gold gate. Serving rebuild + Postgres reload stays owner-gated.

## Web follow-up (small, after backend ships)
Bets table renders the rollup row; anatomy hatch + VO badge need no change (served fields).
Verify FCNTX/FBGRX anatomy + bets coherence end-to-end on the preview page.

## Non-goals
Scoring/Value Score basis (unchanged — the global basis does not improve prediction on the
β-adjusted target); exposure-path and fund-identity rewires (separate follow-ups); per-stock TE
contributions (needs a stock-residual covariance model — separate decision, see the Crescent
productionization backlog item).
