---
id: portfolio-exposure-parity
title: Give the Portfolio X-Ray the same exposure surface as a single fund — companies, sectors, geography, themes, style factors and macro — for the whole book
status: queued
track: full-stack
repo: fundscore-web + fund_score
depends_on: serve-full-exposure-panel
source_proposal: feature-pipeline/proposals/approved/homepage-promise.md
created: 2026-07-14
scope: global
model: fable
---

## Owner summary
Right now you can see far more about a single fund than about your own portfolio, which is backwards —
the portfolio is the thing you actually own. This closes that gap: the Portfolio X-Ray comes to read
your whole book on exactly the same terms we read one fund, so "what am I really exposed to?" gets a
complete answer instead of a partial one. It is the feature the homepage promise rests on.

## Goal
The Portfolio X-Ray answers, for the entered book, every question a fund page answers for one fund:

| Dimension | Status today | This spec |
|---|---|---|
| Companies (look-through) | **shipped** 2026-07-13 | keep |
| Geography (country) | **shipped** 2026-07-14 | keep |
| Sectors | shipped (solver's own row) | move onto the reference map |
| Themes | ✗ | **add** |
| Style factors (FF6) | ✗ | **add** |
| Macro (rates, inflation, growth, dollar, commodities, credit) | ✗ | **add** |
| Concentration | ✗ | **add** |
| Fee vs the passive blend | **shipped** | keep |

Every dimension is shown **against the solved passive blend**, on the same basis — so "concentrated"
always means concentrated *relative to the alternative you could have bought*, never in the abstract.

## Context
- `src/lib/serving/portfolio-lookthrough.ts` (shipped) already resolves each holding to its
  `series_id`, reads `fund_holdings_full`, and aggregates to stock level + country. It computes the
  same look-through for the solved blend and diffs them. **Extend this module; do not start a new one.**
- It is deliberately computed **outside** the blend's suppress branch — a book with 30% SPY kills the
  blend solve but the holdings are still perfectly readable. Preserve that property: exposure must
  survive a failed blend.
- `src/app/api/portfolio/solve/route.ts` attaches `look_through` to the solve response and degrades
  to `null` on error rather than taking the solve down. Same contract for the new blocks.
- The solver (`run_portfolio_passive_solver.py`) **already builds a portfolio return series** to fit
  the blend. That series is the input for the returns-based half of this spec — it does not need to
  be rebuilt.

## Computation — two paths, chosen deliberately

### Path A — holdings-based (companies, themes, sectors, geography, concentration)
Compute directly from the look-through stock weights, intersected with the reference maps from
`serve-full-exposure-panel`:

```
portfolio_theme_exposure(t) = Σ_s  lookthrough_weight(s) × theme_membership(t, s)
```

No per-fund aggregation, therefore **no top-N truncation risk**. Do the same for the blend and diff.

### Path B — returns-based (style factors + macro)
Build the book's return series (weighted constituent fund returns, the solver's existing series) and
**regress it on the factor set** — FF6 for style, the macro basis for macro:

```
r_portfolio,t = α + Σ_k β_k · f_k,t + ε_t
```

These are **absolute betas of the portfolio**. This is the only correct construction.

> **Why not sum the per-fund betas?** Because the served TE-decomposition betas are measured against
> *each fund's own* passive alternative. Fund A's oil beta is "vs A's benchmark", fund B's is "vs B's
> benchmark" — different baselines. Adding them is a commensurability violation and yields a number
> that means nothing. Do not do it, however tempting the shortcut looks. (This was checked: FCNTX
> carries exactly one macro bet, t = 0.8.)

Report each β with a t-stat, and **suppress the row** when the basis is too weak (insufficient
overlapping history, |t| below threshold) rather than printing noise as signal.

## Output
Extend `LookThrough` (`portfolio-lookthrough.ts`) with:

```ts
themes:        { id, name, portfolio_pct, blend_pct, difference }[]
sectors:       { id, name, portfolio_pct, blend_pct, difference, unclassified_pct }[]
concentration: { top10_pct, hhi, effective_n, blend_top10_pct }
factors:       { id, name, beta, t_stat, blend_beta, difference }[]   // FF6
macro:         { id, name, beta, t_stat, blend_beta, difference }[]   // rates/inflation/growth/…
coverage:      { covered_weight_pct, equity_weight_pct, excluded[], regression_n_obs, window }
```

## Data-integrity guardrails (binding)
- **Never renormalize.** Weights are a share of the **entered** portfolio. If we can see through 70%
  of the book, the numbers sum to 70% and the UI says so. (The shipped look-through already does
  this — it names SPY as excluded rather than quietly rescaling. Keep it.)
- **A fund that resolves but has no positions is named, never dropped.**
- **Never treat a NULL sector as 0** — surface `unclassified_pct` (43% of served equity rows today).
- **Never aggregate the served top-N panels** (see `serve-full-exposure-panel` § the trap).
- Blend legs we cannot see through (SPY files as a UIT — no served positions) must be excluded from
  the blend basis and rescaled across the legs we *can* see, not treated as 0% exposure. The shipped
  `blendLookThrough()` already does this; extend, don't re-derive.

## Acceptance criteria (relational)
- Every portfolio-level figure reconciles against an **independent SQL/Polars recomputation** — not a
  re-run of the app's own code path. (This is how the shipped look-through was verified: all 12
  per-stock weights, the distinct-stock count and the top-10 total matched exactly.)
- The reconciliation must be **non-degenerate**: it has to be possible to fail. Equity weight summing
  to something *other* than 100% (65.15% in the shipped check) is the tell that it is not holding by
  construction.
- A book whose blend **suppresses** still returns complete exposure blocks.
- A theme present in a fund but *outside* that fund's served top-6 still contributes its true weight
  to the portfolio total — the specific regression this spec exists to prevent. Assert it with a
  fixture.
- `/check-data` passes; adversarial `data-reviewer` on semantics.

## Out of scope
- The screener (→ `exposure-screener`).
- Solver latency. **But note:** the blend solve currently runs **170–220s** locally against a
  documented ~80s, and `SPY` returns `unsupported` (30% of it suppresses the whole solve). Both are
  filed separately and both hurt this feature's UX badly. The holdings-based blocks (Path A) do not
  need the solver and should render **immediately**, without waiting on the blend.

## Risks
- Path B needs enough overlapping return history; short-history books must fail honestly.
- Rendering 169 dimensions is a UI problem, not just a data one. Lead with what is *different from
  the blend*, not with an exhaustive dump.
