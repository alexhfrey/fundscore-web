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
