---
id: profile-v2-production-cutover
title: Promote the v2 profile from /preview to production /funds/[ticker] — section-by-section fixture retirement
status: queued
track: frontend
repo: fundscore-web
depends_on: profile-nav-series, positioning-context-percentiles, fund-family-panel, attribution-factor-path-serving, te-decomposition-by-bet, recent-changes-te-ranked
source_proposal: feature-pipeline/proposals/approved/profile-redesign-eight-sections.md
created: 2026-07-02
scope: page
model: opus
effort: xhigh
---

## Goal
Make the eight-section redesign the REAL `/funds/[ticker]` page. The preview route
(`src/app/preview/funds/[ticker]/`, spec `profile-v2-preview-route` done 2026-07-02) is the
implementation; this spec is the promotion path. It can execute **incrementally** — a section flips
from fixture to live as its backend spec ships — with one final cutover at the end.

## Per-section flip protocol (repeat as each backend spec lands)
A v2 section may switch from fixture to served data ONLY when ALL of:
1. Its backend spec is in `specs/done/` and the serving column/table is populated (the
   `overlayV2Fixtures` design already prefers real data automatically — `row.x ?? fixture.x`);
2. Its `gates` entry + `PREVIEW_PROJECTORS` free proof point are wired in `profile.ts` per the tier
   map in `profile-v2-preview-route.md`;
3. **A methodology-registry artifact exists** (`src/lib/methodology/registry.ts`) for the data
   product — anchor, method_version, sources, notMeaning, limitations — copied from the real
   shipped artifact (never invented). Only then does the section gain its `/methodology#anchor`
   link and lose its "sample" chip. The registry is a trust surface: NO live section without its
   artifact. (This requirement binds every backend section promoted in V1 — treating it as part of
   each flip rather than each backend spec keeps it in one place.)
4. The fixture export for that section is DELETED from `src/lib/fixtures/profile-v2-fcntx.ts`
   (the types stay). A fixture never coexists with a served section.
5. `/critique-funds` capture + data-quality-critic pass on the newly live section (served == gold
   spot-check on 3 funds).

## Known frontend work at flip time (from the preview build's honest-gap list)
- Bets table: join served `exposureXray` rows for per-bet held/active weights (the preview shows
  em-dashes; the served X-ray has them) + t-stats/ETF proxies from the te-decomposition payload.
- Attribution member drill-down: keep the existing fixed `1Y` / `3Y` / `5Y` Brinson rows at cutover.
  Custom quarter-window Brinson member drill-downs are V2 (`attribution-quarter-blocks`), not a
  production-cutover blocker.
- Skill histograms return only after the beta-adjusted Bayesian rerun (backlog) restores the
  P(skill) headline.
- "Why IWF" candidate table lands with `serve-l2-passive-candidate-fit`.
- 3Y risk expander wires the already-served `riskBehavior` section (no backend dependency — may
  flip first).

## Flip log
- **2026-07-12 — nav_series FLIPPED to served** (protocol steps 1–4 + flip-1 critic fast-follows):
  fixture DELETED; the applyGates field-gate is now the single owner of the public/paid split
  (in-page strip removed — free gets the ONE proof-point row it defines: "3Y · after fees ·
  +230 bps/yr vs IWF"; anon keeps the fund line only). Served-contract type (no hover_copy — now
  DERIVED via buildNavHoverCopy from served β; no β-adj passive column — never served, column
  dropped). HONESTY FIX: "Since inception" relabeled everywhere — series_start is the COMMON PAIRED
  WINDOW start (FCNTX 2008-05, inception 1967): table row "Since 2008-05", chart button "Max",
  chart copy "full paired series (from 2008-05)", header "paired window from 2008-05". Section 03
  loses its sample chip entirely (chart+table+risk expander all served); methodology artifact
  `nav-series` + link. Fast-follows folded in: DODGX two-beta cross-basis note (headlineBetaNote),
  VOO index-fund filed-benchmark one-liner, IR typographic minus, registry per-fund as-of +
  missing-proxy limitation wording. Coverage 3,190 funds; VOO honest-null (risk expander still
  renders). Gates: lint/build/golden ALL PASS + codex high pass 0 P0/P1 ("no discrete introduced
  bugs"; 2 counted advisories are pre-existing comment strings in diff context). Step 5 post-commit.
- **2026-07-12 — positioning_context FLIPPED to served** (protocol steps 1–4 + the TE bets-table
  presentation batch folded in): fixture DELETED; `applyGates` now owns the section
  (`positioningContext` was MISSING from GATED_SECTIONS — added with fail-closed
  `defaultGate: "free"` + golden assertions); type mirrors the served contract (no cohort medians;
  blend constituents carry renormalized-over-qualifying weights and are never presented as the full
  blend unless qualifying_weight === 1). Copy: shared `cohortPhrase` (fee ruler + gauges now import
  ONE convention — single/blend/peer-group), rounded percentiles ("98%", not "98.125%"),
  "2nd percentile of the 160 funds benchmarked to IWF". Presentation batch: blend-aware
  "Active vs blend (pp)" header + baseline-composition chip (DTEYX "IXN 50% + FDN 50%"; IENAX
  names-only "IXC + XOP" — also mitigates the vs_benchmark P1 until the panel fix), split
  freshness stamp "returns through window_end · built as_of" (window_end added to the TE proof
  point). Methodology artifact `positioning-context` (positioning_context_v0.1). Coverage 1,961
  funds (1,904 same-passive-alt / 57 peer-group). Gates: lint/build/golden (+7 assertions incl.
  missing-gate-key fail-closed) + codex high pass 0 P0/P1 (0 advisories). Step 5 post-commit.
- **2026-07-12 — riskExplainers retired to DERIVED copy + 3Y risk expander wired to served
  riskBehavior** (protocol steps 1–4; no backend dep): `buildRiskExplainers` templates the ⓘ
  explainer strings from the SAME numbers the gauges display (fixture strings hardcoded FCNTX's
  0.90/4.8% — deleted; every fund now gets definitions, fund-specific sentences only when the
  number exists). New `RiskDetail3Y` expander in section 03 renders the served `risk_behavior`
  (gate free; 5,450 funds; Sharpe/Sortino/σ 3Y monthly + all-time max drawdown; benchmark-relative
  group only where served — 2,530 funds — labeled vs the STATED prospectus benchmark, explicitly
  not the page's passive alt), stamped off the public `pricing` source stamp incl. its honest
  "stale" state. Methodology artifact `risk-behavior` (honestly "unversioned — fund_metadata risk
  fields"; method verified against build_gold_metadata). Renders for funds without a nav series
  (VOO). Gates: lint/build/golden (+4 risk_behavior assertions) + codex high pass 0 P0/P1/P2.
  **Step 5 VERDICT: PASS** (2026-07-12 data-quality-critic, FCNTX/DODGX/VOO): chain byte-identical
  gold==staging==Postgres==rendered, units clean, nulls honest, per-fund stale stamps correct,
  external sanity consistent (Fidelity/D&C/PortfoliosLab; VOO's odd-looking DJ US TSM benchmark is
  its real filed benchmark). Escalations: P1 SPY/DBC missing from the Tiingo pricing store (1,477
  funds' relative group honestly null but trivially recoverable — filed to backlog); P2 latent
  rf fill_null(0) in build_gold_metadata (filed); P2 fast-follows folded into the nav-series flip
  (DODGX two-beta cross-basis note, VOO index-fund benchmark one-liner, IR minus glyph, registry
  per-fund as-of wording).
- **2026-07-12 — te_decomposition FLIPPED to served** (protocol steps 1–4): payload-gated
  `paid` (fail-closed `defaultGate` if the gates key ever goes missing), free proof point =
  grouped sleeve rollup + top bet (`pickTeProofPoint`; the other bets never leave the server;
  locked state survives a null proof point), methodology artifact `te-decomposition`
  (te_decomp_v0.1) live, fixture export DELETED, BetsTable joins served exposureXray held/active
  weights, copy derives from data (FCNTX top factor = Financial Services). Coverage 2,043 funds;
  VOO degrades honestly. Gates: lint/build/golden (incl. missing-gate-key fail-closed + negative
  te_alloc unclamped assertions) + codex ×2 pass 0 P0/P1. Step 5 (capture + data-quality-critic)
  run post-commit.

## Scope decision 2026-07-11 (owner)
**AI Summary is de-scoped from V1 to a fast-follow.** The cutover ships with seven live
sections; `ai-summary-generation` stays queued and its section flips post-launch under the same
per-section protocol. At cutover the AI Summary section must be ABSENT from production (not a
fixture — production never shows sample data), and its fixture export is removed from the
production dependency graph like every other.

## Final cutover (after the seven in-scope sections are live)
1. Replace the composition of `src/app/funds/[ticker]/page.tsx` with the v2 component tree
   (components move out of `/v2/` naming or are re-exported; preview route becomes a redirect or is
   removed; the `?tier=` override does NOT survive into production).
2. Restore production rendering behavior: ISR + `SEED_TICKERS` pre-render (the preview is
   force-dynamic), metadata/SEO (the preview is noindex).
3. Retire the superseded four-section components (`ValueScoreHero` layout shell, `Performance`,
   standalone `ExposureXray` placement) after confirming nothing else imports them; the legacy
   sections that survive inside "More detail" (Alternatives, SourceFooter, Takeaways, InvestorFit)
   keep working.
4. `PreviewBanner` and every remaining sample affordance must be unreachable in production
   (grep-verified: no `__sample`, no `fixtures/` import in the production dependency graph).

## Operational launch gates (not code, tracked in the backlog)
- NPORT ingest refresh (holdings frozen 2025-10-31) — Recent Changes is only launch-honest after it.
- Fee-correction ripple sweep (value_score rebuild etc.) — the hero's score refresh.
- Manager full build sign-off (`fund-named-manager-source`) — gates the AI summary's manager
  sentence.

## Acceptance criteria
- Production `/funds/FCNTX` renders the eight sections entirely from served data; zero fixture
  imports in the production graph; every section has a methodology anchor; tier matrix leak-free in
  page source (anon/free/paid); VOO + DODGX degrade honestly; build/lint green; Lighthouse/ISR
  behavior at parity with the current production page.
- The critique pipeline (`/critique-funds`) runs against the LIVE page with no data-quality P0/P1.

## Out of scope
Billing/auth changes (tier model already exists via resolveSession); marketing/launch comms.
