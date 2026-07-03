---
id: profile-v2-preview-route
title: Build the eight-section profile redesign as a React preview route against the codex-approved dossier mock
status: done
track: frontend
repo: fundscore-web
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-02
scope: page
---

## Goal
Implement `/preview/funds/[ticker]` — the owner-approved eight-section "refined honesty" profile —
as a working React page: **real served data where it exists, clearly-labeled fixtures for unserved
sections**. Production `/funds/[ticker]` stays byte-identical. The **visual/content reference is the
codex-approved mock** (5 adversarial gate rounds): `public/_reviews/design-mocks/v5-dossier-v2.html`
— dossier architecture (long scroll, sticky scroll-spy nav, takeaway-led sections). Translate its
architecture and content decisions into the app's component system (Tailwind + primitives) — do NOT
pixel-copy its bespoke CSS.

## Already built (use as-is, extend where noted)
- **Types**: `src/lib/serving/profile-v2.ts` — NavSeries (+hover_copy/beta), PositioningContext,
  TeDecomposition, RecentChangesTe, FundFamilyPanel, AiSummary, AttributionWindowSummary
  (+beta_tilt), FactRowV2, `isSample()`, `overlayV2Fixtures()`. **Extend** with types for the newer
  mock content: `HoldingsFull` (280 rows: ticker, weight_pct), `Top10VsIwf` (rows: ticker, fund_pct,
  iwf_pct, diff_pp, note?), `PositioningBetBridges`, `RiskExplainers` (beta/tracking_error/
  beta_tilt_plain strings) — shapes exactly as in the fixture JSON.
- **Fixtures**: `src/lib/fixtures/profile-v2-fcntx.ts` + `profile-v2-fcntx.json` (just synced with
  holdings_full, top10_vs_iwf, positioning_bet_bridges, risk_explainers, attribution_explorer incl.
  beta_tilt + basis_migration_note + residual_explainer). Extend the TS module to export the new
  keys through `getV2Fixtures()`. Every export keeps `__sample: true`; non-FCNTX tickers → null.
- **Serving/gating**: `getFundFactRow` + `applyGates` + `PREVIEW_PROJECTORS` + `isLocked`/
  `getPreview` in `src/lib/serving/profile.ts`; beta helpers `factorBetaHeadline`/
  `divergenceHeadlineBeta` (ALWAYS use these for any beta display). Primitives in
  `src/components/fund/profile/primitives.tsx`; format helpers + calm palettes in
  `src/lib/serving/format.ts`. Recharts ^3.7 installed.

## Page composition (mirror the mock, order fixed)
`src/app/preview/funds/[ticker]/page.tsx` — RSC, `dynamic="force-dynamic"`,
`metadata.robots={index:false}`. Data flow: `getFundFactRow(ticker)` → `applyGates(row, tier)` →
`overlayV2Fixtures(gated, ticker)`. Preview-only `?tier=anonymous|free|paid|pro` searchParam
overrides the session tier (guarded to this route only). New components in
`src/components/fund/profile/v2/` (own index.ts):
1. **PreviewBanner** (server) — amber, "Design preview — sections marked 'sample' are not served yet".
2. **SectionNav** (client) — sticky top, scroll-spy over the 8 section ids.
3. **ProfileHero** (server) — identity grid (name/family/asset class/fee/passive alt + its fee/
   inception) + the value verdict top-right: "+X bps/yr vs <passive> — ≈ breakeven" via the served
   `valueScore` (breakeven chip, median −80 anchor line). **NO 0-100 gauge** (owner removed it).
   Score as-of + "score refresh pending" caveat line exactly as the mock words it.
4. **AISummary** (server) — fixture paragraphs, "Sample content — automated summaries are in
   development" chip, "AI-generated from FundScore's data" disclosure.
5. **HistoricalPerformance** (server shell) + **GrowthChart** (client, Recharts LineChart):
   3 lines — fund, passive (dashed/secondary), beta-adjusted passive (visually primary comparison);
   period toggle 1Y/3Y/5Y/10Y/SI rebasing to window start (SI uses raw series). Period table:
   Fund | IWF | IWF (β-adj) | Excess | Alpha with the fixture `hover_copy` explainers (hover + tap).
6. **AttributionExplorer** (client island) — from fixture `AttributionWindowSummary`: category
   waterfall (Sector/Theme/Macro/Stock selection → gross → fees+trading → net) with per-category
   expand: factor rows w/ steady-tilt vs tilt-variation split (sector/theme/macro) and the REAL
   served `returnAttribution` Brinson member tables (1Y/3Y/5Y selector) under Stock selection framed
   as the related lens ("its own window & method — not a decomposition of the −298"). Beta-tilt as a
   separated context panel (never summed; `risk_explainers.beta_tilt_plain`). Quarter-end range
   selects pinned to the default window with the mock's "preview — figures always show the full
   window" honesty note + `basis_migration_note`. Residual line labeled "Fees + trading (not visible
   to holdings-based analysis)".
7. **CurrentPositioning** (server + small client filter) — the mock's consolidated design: two
   gauges (beta + TE w/ percentiles from fixture PositioningContext, ⓘ explainers from
   `risk_explainers`) → ONE bets table (fixture te_decomposition + bridges + bets/top10 data; TE
   em-dash for non-attributed rows; type filters; top-8 default + Show all; single `*` footnote w/
   sleeve split + prototype/basis label) → holdings block (top-10 w/ IWF diff columns + "View all
   280" from holdings_full + one concentration line) → one geography line (full country names, from
   the served exposureXray region rows).
8. **RecentChanges** (server + client filter) — fixture RecentChangesTe: Δpp-first rows, headline
   set + "Show all", type filters, dual as-of stamps prominent, "ranking by TE impact in
   development" note.
9. **FeeFairness v2** — REAL served `fees` (note: the LIVE DB still carries the pre-correction
   values until the staging push lands — render served truthfully, do not hardcode the mock's 74).
   Build the mock's fee ruler (index fee → fair-fee marker → fund fee) from `fees.fair_fee`
   fields when present; fall back to the existing `FeeFairness` component when absent. No invented
   arithmetic — components only as non-summing labeled inputs.
10. **FundFamily** (server) — fixture FundFamilyPanel: rank line ("4 of 116"), avg vs AUM-weighted
    (one-line difference explanation), member table with own-row highlight, honest "3-year columns
    pending" gap.
11. **More detail** (collapsible) — reuse `Alternatives` + `SourceFooter` as-is.

## Gating (proposed map, applied in-page for fixture sections)
Hero verdict public/precision paid (existing valueScore field-gating). AI Summary free (first
sentence public). Performance: fund line public; vs-passive table + beta-adj paid w/ one free proof
point. AttributionExplorer paid (existing DetractorPreview free). Positioning gauges/percentiles
free; full bets table paid (top bet free). RecentChanges top shift free, full list paid. FeeFairness
free. FundFamily free. Sample sections: NO methodology anchors (registry is a trust surface);
visible "sample" chip via `isSample()` on every fixture-backed block.

## Acceptance criteria
- `npm run build` && `npm run lint` clean; `src/app/funds/[ticker]/page.tsx` and all existing
  components byte-identical (purely additive change set).
- `/preview/funds/FCNTX?tier=anonymous|free|paid`: gated states render (proof point + UnlockLine,
  never full data below the gate — verify no gated number in anon page source); every
  fixture-backed section shows its sample chip; no methodology links on sample sections.
- `/preview/funds/VOO` (passive) and `/preview/funds/DODGX` (non-fixture): fixture sections render
  honest `Unavailable`; real sections render; no crashes; DODGX's negative verdict reads honestly.
- Every number rendered from fixtures is traceable to `profile-v2-fcntx.json`; no value computed at
  render time beyond formatting; em-dash for missing (never 0 or a default).
- Mobile: no horizontal overflow at 390px; bets table stacks Type/bridge under the bet name.

## Out of scope
Production page cutover; real serving of the seven new sections (backend specs queued); the
`?tier=` override on any non-preview route.
