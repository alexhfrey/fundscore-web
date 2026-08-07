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

## What changed under this spec (grounded 2026-07-30 — read before segment 0)

**(a) The TE anchor moved, and unify now SUBSUMES a live defect.** The 2026-07-29 pool refit
rebuilt `value_score` (as_of now **2026-07-11**) with new twins for 877 funds, so
te_decomposition's `y` (fund − passive) changes for those funds *independent of basis*. Backlog
item "LIVE mixed-basis" calls this rebuild "partly throwaway" — that is **wrong in our favour**:
doing unify now rebuilds te_decomposition exactly once, on the new twins AND the new basis.
**Owner decision 2026-07-30: fold the te_decomposition arm of the mixed-basis fix into this
spec** (one rebuild, no duplicated work; the ~302-fund violation persists until unify ships).
`factor_attribution` (405 funds) and `profile_nav_series` are basis-independent and stay a
separate fix.

**(b) Branch base — owner-gated.** `main` and `home/value-prop-refresh` have diverged (+10 / +6).
The pool refit and the new `value_score` live on `home/value-prop-refresh`; `main` carries the
refresh-campaign work (mfrr item 9, book-basis T5 serving wiring). Building on either alone
reproduces the documented "branch missing another feature's emitters" failure.
**Owner decision 2026-07-30: the owner performs the merge; the unify worktree branches off the
merged tip. Do not start segment 1 before that lands.**

**(c) HARD CONSTRAINT — the basis has a structural freshness ceiling, and today's gates are blind
to it.** Measured 2026-07-30 by running the real builder on a 34-fund sample against the current
value_score (scratch `--out`, no shared mutation):

| panel | last date |
|---|---|
| `value_score` (the TE anchor) | 2026-07-11 |
| `ff6_weekly.parquet` (vendor, level 1) | 2026-05-22 |
| `target_return_series` | 2026-06-12 |
| `global_basis_returns` (the 35 factors) | 2026-04-24 |

Rebuild result: anchor `as_of` 2026-07-11, fit `window_end` **2026-05-22** — a **50-day / 7.1-week
gap** — with `max te anchor dev 0.00e+00` and **all 11 invariants PASS**. The anchor gate only
recomputes TE from NAV; `build_te_decomposition.py:196-206` then silently intersects dates, so
`te_current` (through 07-10) scales shares fit through 05-22 and *nothing catches it*. Classic
"green gate ≠ sufficient".

The ceiling is **structural, not stale data**. Verified by actually running
`fetch_factor_data.py` on 2026-07-30: the refetch returned **byte-identical** data — zero new
weeks, zero historical revisions. Ken French's daily file reaches 2026-05-29, but the weekly
resample labels each bar by the Friday that STARTS its return week, so the last COMPLETE bar is
2026-05-22 (covering Fri 05-22 → Thu 05-28); the 05-29 window holds one day and is correctly
dropped by the `n_days >= 3` guard. **A fresh fetch buys nothing until French publishes more
daily data.** FF6 is level 1 and everything residualises against it, so the whole 35-factor basis
inherits the ~7-week publication lag permanently.

*Resample alignment audited at the same time (don't re-litigate):* the FF6 fetch and the shared
`fundscore.alpha._common.resample_to_weekly` (fund NAV + all ETF proxies) both use
`group_by_dynamic(every="1w", start_by="friday")` and resolve to the SAME five trading days — the
fund's `.last()`-price change across windows `[D-7,D-1]→[D,D+6]` spans Thu D-1→Thu D+6, and FF6's
daily sum over `[D,D+6]` covers dates D, D+3, D+4, D+5, D+6. **No misalignment, no lookahead.**
Holiday weeks are not dropped either: 572 short weeks are present and only 2 Friday bars are
missing in 63 years (2001-09-07, the 9/11 week; and the incomplete trailing window).

**Partly pre-existing, made universal by the rebuild.** In the served v0.1 panel (2,054 funds)
95.2% fit within 2 weeks of their anchor, but a tail of **94 funds (4.6%) is decomposed on windows
ending 13–53 weeks before their TE anchor** (worst: SSVSX/RSCYX/GAGVX/THBVX at 53 weeks, all
sitting exactly on the `MIN_OBS_FIT=104` floor) and is served today. After the rebuild the
7.1-week gap applies to every fund. The alignment gate below fixes both.

**Owner decision 2026-07-30 — window policy: keep the fresh anchor, gate the lag, measure the
drift.** Bets continue to scale to the displayed `te_current` (so "bets add up to the TE you see"
survives), but the shares are honestly *the bet MIX as of the factor frontier*. This rests on an
assumption — that the mix is slow-moving relative to the level — which segment 0 must MEASURE, not
assert. **If measured 6-week mix drift is large, fall back to re-stating TE on the aligned window
(two dated numbers).** De-lagging the basis by replacing FF6 with low-lag ETF style proxies is the
elegant end state but invalidates the evaluation record above — file as a separate research
follow-up, out of scope here.

## Plan (assembly-line segments; data-reviewer checkpoint after each)

### 0 — EDA gate (data-scientist; OWNER REVIEWS before implementation)
Refresh FF6 (`scripts/pipeline/fetch_factor_data.py`) then rebuild inputs
(`make build-target-return-series build-global-basis`). Do NOT gate on "max return_date covers the
current value_score window" — per (c) above that is unachievable; record the residual lag instead
and confirm it lands near the ~6-week structural floor rather than the 11-week stale-artifact
value. NOTE `data/` is a shared lakehouse across worktrees: rebuilding `target_return_series`
in place also moves `factor_exposure`/`exposure_divergence`/`exposure_path` inputs — stage to a
scratch path and get owner sign-off before promoting, or accept and sequence the ripple
explicitly. FRED macro (`data/vendors/fred/`, fetched 2026-06-16) needs `make fetch-fred-macro`
first (network + `FRED_API_KEY`).

Prototype `decompose_one` on the 35-factor basis for a reference set spanning the archetypes
(FCNTX, DODGX, VPMCX, JEPSX, VSMIX sector-rotator, FBGRX theme-heavy, an EM fund, a macro-tilted
fund). Deliverables:

0. **Mix-drift measurement (decides the window policy — do this FIRST, it can force a re-plan).**
   For a representative panel (not just the dossier), decompose each fund twice on identical
   inputs: full aligned window vs the same window truncated by 6 weeks. Report the distribution
   of (i) L1 distance between `var_share` vectors, (ii) top-5 bet rank overlap, (iii)
   `idio_risk_share` delta, (iv) worst-case displayed `te_alloc_bps` movement. Also propose the
   fail-closed `anchor_lag_weeks` threshold from this distribution — it must suppress the 94 funds
   currently served at 13–53 weeks.

   **BASELINE ALREADY MEASURED 2026-07-30 on the CURRENT (v0.1, per-fund) basis** — 251 funds,
   6-week shift (2026-05-22 → 2026-04-10), production builder, identical inputs:

   | statistic | p50 | p90 | max |
   |---|---|---|---|
   | L1 distance between `var_share` vectors | 0.218 | 0.666 | 1.667 |
   | worst displayed `te_alloc_bps` move | 18.4 | 52.8 | 185.7 |
   | …as % of that fund's largest displayed bet | 19.2% | 56.2% | — |
   | `idio_risk_share` delta | 0.014 | 0.039 | 0.144 |

   Top-5 bets exactly preserved on only **42.6%** of funds (≥4/5 on 88.4%); the **rank-1 bet
   changes on 19.1%** of funds; 35.1% of funds have a bet move >25% of their largest displayed
   bet. **Read: the idio/selection split — the thing unify actually unifies — is robust
   (p90 0.039). The per-bet MIX is not, on this basis.**

   **RESOLVED 2026-07-30 — v0.2 measured, window policy CONFIRMED.** Same 251 funds, same 6-week
   shift, run on the rebuilt 35-factor basis (29 non-FF6 bets/fund):

   | statistic (p50 / p90) | v0.1 per-fund | **v0.2 global** |
   |---|---|---|
   | L1 `var_share` distance | 0.218 / 0.666 | **0.186 / 0.455** |
   | worst displayed `te_alloc_bps` move | 18.4 / 52.8 | **7.9 / 21.9** |
   | …as % of fund's largest bet | 19.2% / 56.2% | **16.2% / 35.9%** |
   | top-5 exactly preserved | 42.6% | 37.5% |
   | rank-1 bet unchanged | 80.9% | 76.1% |

   **The displayed numbers roughly HALVE in volatility** (p90 worst move 52.8 → 21.9 bps). The
   de-correlated basis delivers what was hoped. Rank stability looks slightly worse only because
   29 factors produce more near-zero bets whose ordering churns freely — **verified: rank-1 held
   53.2% on near-ties (<10% gap between #1 and #2), 81.7% close, 93.0% clear, 100.0% dominant.**
   Rank churn is entirely a near-tie artifact; whenever a fund has a materially dominant top bet
   it never moves. **Owner's window policy (fresh anchor + alignment gate) stands — no fallback
   needed.** Feed the near-tie structure into the display rule (0.2): gate on MATERIALITY, and
   never present near-ties as a confident ordered ranking.
1. Old-vs-new bets tables side by side; idio-share shift distribution across the full EQ panel.
   **Partial result 2026-07-30 (251 funds) — the spec's core premise CONFIRMED.** Composition of
   the top-5 displayed bets: **v0.1 = sector 63% / macro 19% / theme 19% → v0.2 = country 36% /
   sector 35% / macro 18% / gbf 11%.** Sector crowding drops 63% → 35% and geography enters at
   ~47%; the fixed vocabulary does guarantee macro/geo representation as claimed. Note themes
   vanish entirely (excluded from the production basis) — that is decision 3, not a defect.
   **Archetype spot-check — the qualitative gain is larger than the percentages suggest:**

   | fund | v0.1 top bets (per-fund basis) | v0.2 top bets (global basis) |
   |---|---|---|
   | **TRNEX** (natural resources) | `theme::mag_7` **+105 bps (rank 1)**, basic_materials +103, gold +76 | country::CA +60, gold +60, basic_materials +51, commodity +42, country::GB +38 |
   | **FBGRX** (blue-chip growth; NVDA/AAPL/MSFT) | financial_services +87, real_estate +55, healthcare +46, consumer_defensive +39 | country::KR +38, country::TW +38, country::JP +30, healthcare +27 |

   v0.1 leads a natural-resources fund with Magnificent-7 and a mega-cap growth fund with
   financial services and real estate — the same collinearity artifact as the RYLSX backlog item.
   v0.2 returns Canadian miners + gold + commodities + the London majors for TRNEX, and the
   Korea/Taiwan/Japan semiconductor complex for FBGRX.

   **RYLSX tested directly (the backlog item's own example) — improved, not proven fixed.**
   Served today: `Financial Services +318.7 bps` at **rank 1, "high" confidence**, plus
   `US Mega Banks +258.6 bps` — on a leisure fund holding NFLX/PM/MCD and zero financials.
   Under v0.2: Japan +105, Germany +73, China +72, **consumer_cyclical +64**, dollar +60.
   **The absurd financials pair is gone entirely and consumer_cyclical (where leisure actually
   lives) surfaces** — but only at rank 4, behind three geographies. Treat the backlog item as
   *materially mitigated*, and re-check it on the full rebuild before closing it.

   **Segment-1 note surfaced here: the global-basis labels are NOT display-ready.**
   `global_basis_factor.label` yields `country::JP`, `country::DE +1`, `sector::consumer_cyclical`
   — raw ids, and the `+1` suffix encodes cluster membership (e.g. DE merged with
   `region::developed_ex_us`). Segment 1 needs a human-readable label map, and merged clusters
   need an honest customer-facing name, not a `+N` suffix.
   Still owed at full-panel scale: the side-by-side per-fund tables for the rest of the dossier.
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
   **RESOLVED 2026-07-30 — display rule, derived from the data (251 funds, 29 bets each).**
   The global basis genuinely SPREADS variance: top-3 holds only p50 0.33 of the |var| mass,
   top-5 0.48, top-10 0.75, top-12 0.81. **There is no small set of bets that explains most of a
   fund's factor risk** — so a table that implies "here are your bets" misleads. The rule:

   a. **Lead with the KIND split, not individual bets.** Measured over the same 6-week shift the
      kind mix (geography / sector / macro) is ~3× more stable than individual bets — L1 p50/p90
      **0.063 / 0.168** vs 0.186 / 0.455 — and the **dominant kind holds 92.4%** vs 76.1% for the
      rank-1 individual bet. This is exactly the altitude V4's exec verdict already uses; the
      evidence supports that design. Individual bets become the drill-down.
   b. **Materiality floor for a NAMED bet: `|te_alloc_bps| >= 22`** — the measured p90 6-week
      drift (21.9). Below it a bet cannot be distinguished from window noise, so it must not be
      named. Yields p10 2 / p50 6 / p90 12 named bets per fund. A low-TE fund honestly showing
      2 bets is correct, not a coverage failure.
   c. **Cap `N_MAX = 12`** (p90 of the floor-passing count; bounds table length).
   d. **Rollup row is mandatory and is NOT a tidy-up line.** At a 22-bps floor it carries ~45% of
      the |var| mass at median (top-6 = 0.55) — often the largest single row. Label it honestly
      ("N smaller bets · X% of factor variance"), never drop it silently, and gate that it
      reconciles the dropped mass.
   e. **Rank-confidence suppression.** Never assert a "biggest bet" — in the exec verdict, the
      Book card, or the table's ordering emphasis — when the #1-vs-#2 relative gap is <10%:
      measured rank-1 stability there is **53.2%**, a coin flip (81.7% at 10-25%, 93.0% at
      25-50%, 100% above). **This directly constrains V4:** naming a specific top bet in the
      verdict (e.g. "Big Oil, Onshoring") is only safe above the gap threshold.

3. **Theme handling decision:** the 35-basis excludes themes (right for the skill measure, but
   FBGRX-class funds lose their story). Evaluate: (a) labeled theme overlay rows sourced from the
   existing theme panels, visually separate, never summed into the factor sleeve; (b) a
   with-themes display variant of the basis; (c) themes live only in Exposure X-Ray/archetype.
   **New dependency (owner, 2026-07-28): the V4 profile draft hangs its verdict taxonomy on this
   call.** `fund_score/docs/product/strategy/mockup_fund_profile_v4_2026-07-28.html` — the
   executive verdict + "What is it" split the active layer as picks / themes / sectors / macro
   (TRNEX: 44/24/22/10) and name theme bets (Big Oil, Onshoring) in the verdict itself. Option
   (c) — no overlay — recuts that taxonomy to picks / sectors / countries / macro and folds the
   theme stories into sectors, rippling through the exec summary, section 01, and the bets
   drill-downs.

   **RESOLVED 2026-07-30 — theme handling: OPTION (a), labeled overlay rows.** Themes render as
   visually-separate labeled rows sourced from the existing `theme_bet_attribution` panels (already
   live and maintained — it is what `theme_ride` reads), **never summed into the 35-factor sleeve**.
   Rationale: preserves the clean 35-factor fit and V4's picks/themes/sectors/macro verdict
   taxonomy unchanged. Option (b) (57-factor with-themes basis) was rejected on arithmetic — it
   takes k from 36 to ~58 on a median 150 obs (92 residual df, adj-R² correction factor 1.62),
   making the idio estimator materially worse, i.e. the opposite of this spec's purpose. Evidence
   also weakened the "theme-heavy funds lose their story" premise: FBGRX had NO themes in its
   v0.1 top-5, and TRNEX's single theme bet was the spurious `theme::mag_7` (+105 bps, rank 1, on
   a natural-resources fund).

4. **theme_ride provenance trace / `global_decomposition` consumer census.**
   **Pre-resolved 2026-07-30 (confirm, don't redo from scratch):** `theme_ride` does NOT read
   `global_decomposition` — it comes from `theme_bet_attribution.theme_bet_rollup.theme_ride_bps`
   (`value_offering_reframed.py:16,92,239`). The **only** production reader of
   `global_decomposition.parquet` is `build_value_offering_reframed.py:53` — exactly the read
   segment 2 retires. Everything else is reports / experiments / diagnostics / tests / the
   Makefile target. `full_model_idio` IS served (`serving/load.py:33`) and is a basis-family
   sibling, but it reads `target_return_series`, not the panel. `fact_assembler.py:1988-1993`
   confirms `idio_alpha_bps` stays in the parquet and is not served.
   **So step 3 is unblocked at code level.** Re-verify per the "consumer audit ≠ literal-path
   grep" rule — check `load_*` helpers and variable-built paths, not just the literal string —
   and treat any new hit as a step-3 blocker.

### 1 — Repoint the builder
`build_te_decomposition.py`: swap `standardized_basis_map` → the 35 fixed series
(`global_basis_returns.parquet`, labels from `global_basis_factor.parquet`). Keep: the
`te_current` 1e-9 anchor gate, FWL per-bet betas, Σ var-share allocation, quadrature invariant,
negative shares kept unclamped. Add: display-selection fields per the EDA rule (rank,
is_displayed, rollup aggregates). **Add the window-provenance fields the alignment gate and the
serving label need: `anchor_as_of` (= value_score as_of), `fit_window_end` (already emitted as
`window_end`), and derived `anchor_lag_weeks`.** Version: `te_decomp_v0.2_global`. Never overwrite
the v0.1 parquet (label + separate file per feedback_label_model_versions).

**MANDATORY — `idio_risk_share` must switch to an inflation-corrected R² (measured 2026-07-30).**
te_decomposition computes idio from the **raw** joint R². That is survivable on 12 bets and NOT on
29: k goes 19 → 36 parameters on a median 150 obs, so raw R² inflates and idio deflates. Measured
on 251 funds:

| idio_risk_share (median) | raw R² | adj-R² | served `global_decomposition` |
|---|---|---|---|
| v0.1 (12 bets, k=19) | 0.641 | 0.729 | 0.691 |
| **v0.2 (29 bets, k=36)** | **0.518** | **0.677** | 0.691 |

Raw R² on the global basis moves the median idio **17 points** below the number the VO badge
serves today, and pushes **42/251 funds (16.7%) across `REPLICABLE_DOMINATED = 0.40` — 36 of them
newly labelled "Mostly a sector/theme bet"** (~290 funds at panel scale) for a purely mechanical
reason. Adj-R² collapses that to **16 funds (6.4%)**, in line with v0.1-on-adj (6.0%) — i.e. the
residual is the genuine machine difference, not an artifact. **Use adj-R² at minimum; prefer
matching `global_decomposition`'s estimator (adj-R² + CV-R²/ridge) so segment 2 is a true
unification rather than a silent re-levelling.** Report the badge-flip count before/after as a
gate output, not a footnote.

---

### ✅ SEGMENT 1 SHIPPED 2026-07-30 (fund_score `feature/unify-te-decomposition-global-basis`)

`te_decomp_v0.2_global` built and gated. Gold `data/gold/te_decomposition.parquet`
(60,419 rows / 1,949 funds, as-of 2026-07-11); v0.1 preserved at
`te_decomposition.parquet.v0_1-pre-unify-bak`. Serving reload NOT run (owner-gated).

**Coverage 1,949/2,071 scored (94.1%); all 122 misses PROVEN honest** — every suppressed
fund's OWN NAV ends ≥15 weeks (median 43w) before the anchor, spot-checked against the raw
weekly panel. Recoverable-missing = **0**. The drop from v0.1's 2,054 is the alignment gate
correctly refusing funds v0.1 served on 13–53-week-stale windows, plus two further months of
NAV staleness at the newer anchor.

Measured against the three non-negotiables:
1. **adj-R² in.** Median idio raw 0.512 → **adj 0.669** (15.7 pts). Badge cut at 0.40: raw
   441/1,949 (22.6%) vs adj **153/1,949 (7.9%)** — **288 funds spared a mechanical relabel**
   (spec predicted ~290). `replicable_risk_share` + `idio_risk_share_cv` (ridge nested CV)
   ship alongside so segment 2 can move the VO consumer wholesale. The ridge estimator was
   extracted verbatim to `risk_model/ridge_cv.py` (proven bit-identical over 30 trials) so
   segment 3 can retire `global_decomposition` without orphaning it.
2. **Window provenance + fail-closed gate in.** `anchor_as_of` / `anchor_lag_weeks` emitted
   (`window_end` already WAS `fit_window_end`, so no duplicate column). `MAX_ANCHOR_LAG_WEEKS
   = 13.0` — per-fund skip-and-count, panel invariant #12 in `ted.validate`, plus a build
   abort with a "refresh the factor chain" diagnostic above 25% suppression. Measured lag
   p10/p50/p90 all **7.14w**, max 11.14w — the structural FF6 floor, nothing near the ceiling.
3. **Display-ready labels in.** New `risk_model/basis_labels.py` is the single label/kind
   source: "China & Emerging Markets", "Germany & Developed Markets ex-US" — merged clusters
   spelled out, never `+N`; unknown ids raise rather than leak a raw id. Invariant #17 fails
   the panel on any `::` or `+N` label.

Premise confirmed at panel scale — FCNTX led with `Financial Services +94` and now leads with
`Technology +55`; FBGRX's financial-services/real-estate leaders → the Korea/Taiwan/Japan
semiconductor complex; TRNEX's spurious `theme::mag_7` gone (Canada/Gold/Basic Materials);
RYLSX's `Financial Services +318.7 rank-1 high` → rank 6 at +47.

**Also closed: the folded-in mixed-basis defect (a) — and it was far larger than the backlog
item estimated.** The v0.1 panel disagreed with the currently-served `te_current` on
**1,972/2,043 funds** and carried a stale `passive_alt_label` on **509**. v0.2: **0 mismatches**
on `as_of`, `te_total_bps` (≤1e-9) and `passive_alt_label`.

**Gates:** 18/18 build invariants · `make check FEATURE=te_decomposition` PASS ·
`/check-data` PASS · 75/75 tests in the affected suites · independent from-raw-inputs
recompute of FCNTX matches the panel at machine precision on TE anchor, n_obs, raw R², adj R²,
idio and the FWL beta · 4 serving-payload additivity contracts verified with 0 violations
across all 1,949 funds · codex cross-vendor gate.

**Three things the owner should know (details in the segment-1 report):**
- **51.7% of named bets are UNDERWEIGHTS** (negative beta, positive `te_alloc_bps`), and
  50.9% of funds' rank-1 bet is one. A bare "Japan +98 bps" reads as a bet ON Japan when the
  fund is positioned away from it. This makes the spec's direction-badge contract a
  CORRECTNESS requirement, not polish. Mitigated in-panel by a new `bet_direction`
  ("over"/"under") field; the web must never render the allocation without it.
- **376 funds (19.3%) have ZERO named bets** at the 22-bps floor — more than segment 0's
  251-fund sample implied (it predicted p10 = 2). They are low-TE/high-idio funds (median TE
  316 bps, idio 0.81) whose sleeve genuinely holds nothing above window noise. Honest, and
  the KIND split + selection sleeve still tell their story — but it is 1-in-5 funds with an
  empty named-bet table. Recommend keeping the floor; flagging because the rate is the
  owner's call.
- **`fact_assembler` was updated in lockstep** (out of segment-1's literal scope) because the
  v0.2 rollup row would otherwise have been double-counted against the per-bet rows and
  `no_named_bets` would have been permanently false (`n_bets` is now 29 for every fund).
  The codex gate then caught a second instance of the same class — `bets` still shipped all
  29 rows, so a consumer rendering `bets` would show exactly the sub-floor bets the display
  rule forbids AND double-count them against `other_bets`. **Now only NAMED bets are served**;
  sub-floor rows stay gold-only as reviewer provenance (the treatment `raw_factor_te_bps` and
  `fe_*` already get), and the kind rollup is still computed over the whole basis so it keeps
  summing to the sleeve. The web `bet_type` union (`"sector"|"theme"|"macro"`) still needs the
  v0.2 kinds — unchanged web follow-up.

### 2 — Unify the idio consumer
`value_offering_reframed` reads `idio_risk_share` from the repointed te_decomposition
(→ `vo_reframe_v0.5`), retiring its `global_decomposition` read. Report the old-vs-new idio
delta distribution (expected small — same basis family — but measured, not assumed).

**Segment-1 handoff (measured 2026-07-30, do not re-derive):**
- The delta is **already measured** on the built panel — te_decomposition v0.2 idio vs the
  `global_decomposition` idio the VO badge serves today, on the **1,945 shared funds**:
  p10 **−0.223** / p50 **−0.013** / p90 **+0.164**, median |delta| **0.099**. The medians
  agree (−0.013) — the two are the same estimator (1 − adj R²) on the same basis family, so
  this is a true unification. The SPREAD is the genuine machine difference and is NOT noise:
  te_decomposition fits the winsorized beta-adjusted L2-active return over the recent ~150-week
  window, `global_decomposition` fits the raw active return over full history at MIN_OBS=200.
  Segment 2 must decide whether that window difference is acceptable for the badge, and report
  the badge-flip count across `REPLICABLE_DOMINATED = 0.40` — not just the delta quantiles.
- **Coverage shrinks and that is the blocking design question.** `global_decomposition` covers
  more funds than the alignment-gated te_decomposition (1,949). Funds that te_decomposition
  suppresses would lose their VO badge input entirely unless segment 2 chooses a fallback.
  Options: serve `idio_risk_share` null + an honest missing-reason, or keep
  `global_decomposition` as a documented fallback for the gap (which weakens the "exactly ONE
  served idio source" invariant in segment 4). **Measure the gap first, then decide.**
- te_decomposition already emits everything the consumer reads: `idio_risk_share`,
  `replicable_risk_share`, `idio_risk_share_cv`. The one field it does NOT carry is
  `idio_alpha_bps` (`build_value_offering_reframed.py:170` selects it). It is NOT served
  (`fact_assembler.py:1988-1993` confirms) — check whether the VO build actually uses it before
  either porting it or dropping it.
- The ridge nested-CV estimator now lives in `risk_model/ridge_cv.py` (shared, bit-identical),
  so segment 3 can archive `global_decomposition` without orphaning it.

---

### ✅ SEGMENT 2 SHIPPED 2026-07-30 (fund_score `feature/unify-te-decomp-seg2`)

`vo_reframe_v0.5`. The VO badge's replicability axis now reads `te_decomposition` — the last
production read of `global_decomposition` is retired, so **step 3 is unblocked at code level**.
Gold `value_offering_reframed_panel.parquet` rebuilt (5,937 rows); v0.4 preserved at
`.v0_4-pre-unify-bak`. Serving reload NOT run (owner-gated).

**The defect this actually closes — measured, not asserted.** On the 1,930 funds that show
BOTH numbers today, the badge idio and the anatomy-hatch idio disagreed on **1,930 of 1,930**
(max gap **0.808**). Under v0.5: **0 disagreements, max gap 0.00e+00** across 1,944 funds.
The two-machines-one-page risk is gone by construction, not by luck. It was live on the
page: `AnatomySection` read te_decomposition while `InvestorFit` (0.35 cut) and the badge
(0.40 cut) read global_decomposition.

**Impact vs the live v0.4 panel** (both arms run through the real `vo.assemble` on
byte-identical prepared inputs): **217/4,202 scored badges change (5.2%)** — "Mostly a
sector/theme bet" 250 → 163, i.e. the mechanical over-labelling drops by a third.
`value_index` median |Δ| 1.0 (p10 −5 / p90 +4, max 26); **0 funds lose a `value_index`**.
Idio delta on the shared set: p10 −0.223 / p50 **−0.013** / p90 +0.164 — medians agree
because it is the same estimator on the same basis family; the spread is the window
difference (recent winsorized ~150wk vs full history at MIN_OBS=200).

**OWNER DECISION 2026-07-30 — the coverage gap: honest null + missing reason, no fallback.**
The gap is **545 funds (13.0% of scored)**, and it is two cohorts, not one:

| cohort | n | replica_r2 p50 | `low_replica_flag` |
|---|---|---|---|
| (A) no TE anchor exists | **429 (79%)** | **0.676** | **375 (87%)** |
| (B) anchor exists, decomposition gate suppressed it | 116 (21%) | 0.920 | 0 |
| covered by te_decomposition | 1,930 | 0.908 | 0 |

Bucket (A) is not a gap we created — it is the cohort whose passive twin
`l2_passive_candidate_fit_v1.0` already refuses to name (372 are `not_comparable`). A
global_decomposition fallback would have served "active risk vs a blend we won't show you."
Rejected. New field `idio_risk_share_missing_reason` ∈ {`no_passive_anchor` (2,138 scored),
`decomposition_unavailable` (120)} — both **proven against the sources**, 0 violations on all
three directional checks. Served in the `replicability` block; web type added.

**Also fixed — a latent defect the swap would have amplified.** `theme_ride_bps` was joined
*through* the risk frame, so it silently vanished for every fund the risk panel missed: 140
funds today, and **366 more** under the narrower v0.5 source. That would have disabled
`is_bet_dominated`'s RETURN route without a trace. It now joins to `funds` independently;
the entire staged-vs-measured delta (3 funds: FEDMX, FTZCX, ARKX) is explained by newly-present
theme rides of 221 / 319 / 736 bps.

**Dropped:** `idio_alpha_bps` — a pure pass-through never read by the verdict math, removed
from serving 2026-06-25 for sign-disagreement with the holdings-path idio. Its only reader
(the v0.3 explorer report) reads `risk_decomposition.parquet`, not this panel. Verified.

**Gates:** all invariants PASS incl. **new #10** (`idio_risk_share` null ⇔ missing_reason set,
fails closed on unexplained nulls / off-enum reasons — the shape a silent fallback would
take) · `run_checks --feature value_offering_reframed` **0 FAIL, 1 WARN** · **115/115** tests
across the 6 affected suites · `tsc --noEmit` clean · codex cross-vendor gate.

**Two things the owner should know:**
- **The WARN is the owner's own decision surfacing.** Axis-B coverage 1,944/4,202 = **46%**,
  below the check's 50% PASS bar (v0.4 sat at 58.9%). It is honest suppression, not a
  regression — but it will WARN on every run until the threshold is re-based or coverage
  grows. Re-basing is an owner call, not something to quietly edit.
- **PRE-EXISTING, NOT MINE — `l2_blend_etfs` is non-deterministic across rebuilds.** Two
  identical runs differed on **117 funds** (PABBX served `USMV` on one run, `SPY` on the
  next) — and the ETF *sets* differ, not just their order. Cause: `blend.join(tmap).unique(
  subset="series_id")` where **6,654 series_ids map to >1 ticker** (share classes), so an
  arbitrary share class's L2 blend wins. My diff does not touch that code. Per
  `deterministic-wrong-worse-than-nondeterministic`, the fix is to **adjudicate** which class
  is authoritative — not to sort-then-unique, which would just freeze one arbitrary winner.
  Filed as its own item; NOT fixed here.

### 3 — Retire global_decomposition (gated on step 0.4 census clean)
Remove from the default build path; archive module + last parquet (never delete). Migrate or
retire its checks in `scripts/checks/run_checks.py`.

---

### ✅ SEGMENT 3 SHIPPED 2026-07-31 (fund_score `feature/unify-te-decomp-seg3`)

`global_decomposition` is retired. **The product now has exactly ONE served idio source** —
segment 4's central invariant is satisfied structurally, not by assertion.

**Census — and the spec's own census was incomplete in two ways, both caught:**
1. **`build_global_decomposition` emits TWO panels, not one.** `fund_factor_loading.parquet`
   (4.1 MB) is a second output the step-0.4 census never mentions. Censused separately:
   consumers are reports/experiments/docs only — **zero production readers**.
2. **A live read survived my own first pass** because I truncated the grep at `head -30`:
   `scripts/feature_experiments/global_decomp_cv_stress.py:58` reads the panel. Re-run
   untruncated and archived. Final state: **0 live reads, 0 live imports** of either panel or
   the module across `src/ scripts/ tests/`.

`run_checks.py` had **no** global_decomposition entry, so there was nothing to migrate —
the spec's "migrate or retire its checks" is a no-op, recorded so it isn't re-litigated.

**What moved** — archived, never deleted. Code → `archive/retired/global_decomposition/`
(module, builder, 3 report/experiment scripts, the cv-stress script, the two `decompose_one`
tests, plus a README with the resurrection procedure). Panels → `data/gold/_retired/`. The
Makefile target and its `.PHONY` entry are gone, replaced by a retirement note.

**The one judgement call worth recording — what did NOT get archived.** `ridge_nested_cv_r2`
is still production (te_decomposition's `idio_risk_share_cv`), and its guarantee — "never
generalises worse than OLS" — is only testable against the OLS baseline that lived in the
retiring module. Archiving that baseline would have **silently dropped coverage of a live
estimator**. So `_wls_full` / `_cv_r2` / `_r2` moved into `risk_model/ridge_cv.py` (verbatim;
**proven bit-identical vs git HEAD over 40 randomised trials × 3 estimators, 0 mismatches**),
their tests stayed live as the new `tests/test_ridge_cv.py` (6 tests), and only the two
`decompose_one` tests — whose subject really is retired — went to the archive. The archived
module still imports those names, so it is resurrectable unchanged.

**Also removed:** the obsolete segment-2 preview in `build_te_decomposition.py` that compared
the unified idio against `global_decomposition`. It was guarded by `.exists()`, so retiring the
panel would have made it **silently no-op** rather than fail — the fail-open shape this project
keeps getting bitten by.

**Gates.** The decisive one: rebuilding the VO panel with both retired panels *gone* reproduces
the served panel **bit-identically on every column except `l2_blend_etfs`** (the pre-existing
non-determinism already filed) — the retirement provably changed nothing downstream.
Plus `run_checks`: te_decomposition **PASS**, value_offering_reframed **0 FAIL / 1 WARN**
(the same owner-approved coverage WARN as segment 2, unchanged). Full suite **1,229 passed /
4 failed** — all 4 proven **pre-existing** by stashing the entire segment-3 diff and
reproducing them identically on segment 2's tree (`test_manager_people` stale
source_inventory, `test_openfigi` batch splitting, `test_the_take` ×2 panel invariants; none
reference any module in the diff). Codex cross-vendor gate.

**Docs de-staled:** `pipeline_status.md` Axis-B block and `07_value_offering.md` now lead with
v0.5 + the retirement, with the v0.3/v0.4 text kept and marked superseded rather than rewritten.

### 4 — Gates (fail closed)
`make check FEATURE=te_decomposition` (existing invariants + new: display-rule coverage — the
rollup row must reconcile the dropped mass); NEW sibling-coherence check: post-unify there is
exactly ONE served idio_risk_share source (grep-level assertion + value identity across panels);
/check-data on the rebuilt panel; data-reviewer checkpoints per segment; codex sign-off; final
combined served==gold gate. Serving rebuild + Postgres reload stays owner-gated.

**NEW — anchor-alignment gate (the defect measured in (c); fail closed, per-fund).** The existing
`te_current` 1e-9 gate is NAV-only and cannot see a truncated fit window: the 34-fund probe passed
all 11 invariants with a 7.1-week gap. Add a per-fund assertion that `anchor_lag_weeks =
(anchor_as_of − fit_window_end)` is within the EDA-chosen threshold; funds beyond it are **skipped
and counted** (same fail-honest posture as `te_anchor_mismatch`), never decomposed against a
window the anchor doesn't cover. Log the lag distribution every build. Two things this must catch:
(i) the universal ~7-week FF6 floor drifting wider if a vendor refresh is missed, and (ii) the 94
funds (4.6%) currently served at 13–53 weeks. **A panel-level invariant on the max/percentile lag
belongs in `ted.validate` so `make check` fails, not just the builder log.** Expect a coverage
drop from (ii) — report it as honest suppression, with the before/after fund count.

## Web follow-up

### ✅ DIRECTION-BADGE CONTRACT (a) SHIPPED 2026-07-30 (web `feature/crescent-profile-v2`)
Part (a) of the display contract is live in the components. **Not polish — a
correctness fix**: 51.7% of named bets are underweights whose displayed figure is
POSITIVE, so the previous rendering showed half the table backwards.

- `format.ts` owns ONE vocabulary (`directionWords`): weight-like kinds
  (geography / sector / stock / theme) read **OVER/UNDER**, pure return exposures
  (macro / commodity) read **LONG/AGAINST** — the owner's 2026-07-27 split, mapped
  onto the v0.2 kinds. Hover carries the plain-English meaning; no jargon inline.
- `gating.ts` gains `betDirection()` — served `bet_direction` (v0.2) else the FWL
  beta sign (v0.1), so ONE derivation serves both payload versions and the badge
  is never inferred from `te_alloc_bps` (those signs disagree for most bets).
- The free proof point was the worst offender and is fixed end-to-end:
  RYLSX `"Japan +98 bps"` → `"Japan · UNDERWEIGHT · 98 bps"`;
  FCNTX `"Technology +55 bps"` → `"Technology · UNDERWEIGHT · 55 bps"`.
  `fmtBpsMagnitude` drops the sign from the headline figure precisely so it cannot
  be read as direction; `diversifying` still carries the rarer reduces-TE case.
- The projector now picks the top bet by **|te_alloc_bps|** (a signed max ranked a
  small additive bet above a larger diversifying one), and honours
  `top_bet_confident`: on a near-tie the label degrades from "Top active bet" to
  "A leading active bet" rather than asserting a coin flip (TRNEX: Canada 58 vs
  Gold 57 → superlative dropped).
- Also landed here because v0.2 data would otherwise break or mislead: the
  `bet_type` union + table filters widened to geography/sector/macro/commodity,
  and the `other_bets` rollup row now renders (it carries more tracking error than
  any named bet on many funds — DGIGX: 165 bps vs a 24-bps leader).

Verified by running the SHIPPED helpers through `applyGates` against real v0.2
payloads (RYLSX, FCNTX, TRNEX, a near-tie fund, a zero-named-bet fund) **and**
against genuine v0.1 payloads rebuilt from the preserved pre-unify panel — the
pre-reload page keeps working and gains direction badges. `npm run build` +
`eslint` clean.

**Still open — part (b) of the same contract:** the one-line "where it comes from"
with real held names (holdings ∩ basket membership). That needs a new backend
join (fund holdings × basis-factor constituents) — feasible for the 23
geography/sector factors off the existing country/sector holdings attributes, and
correctly "exposure from returns — no single holding" for the 6 macro/commodity
ones. Not started; sizing it is a separate call.

### Remaining (after the serving reload)
Bets table renders the rollup row; anatomy hatch + VO badge need no change (served fields).
Verify FCNTX/FBGRX anatomy + bets coherence end-to-end on the preview page.
**Plus the window disclosure the chosen policy requires:** the bets table scales to the fresh
`te_current` but the mix is measured through `fit_window_end`, so the section needs a quiet,
non-jargon "bet mix measured through <date>" affordance (brand bar: jargon behind affordances —
never an inline lag figure). Funds suppressed by the alignment gate must render the honest
missing-reason path, not an empty table.

## Non-goals
Scoring/Value Score basis (unchanged — the global basis does not improve prediction on the
β-adjusted target); exposure-path and fund-identity rewires (separate follow-ups); per-stock TE
contributions (needs a stock-residual covariance model — separate decision, see the Crescent
productionization backlog item).
