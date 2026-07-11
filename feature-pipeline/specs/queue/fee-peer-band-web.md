---
id: fee-peer-band-web
title: Render the fee-over-passive peer percentile in the fee ruler (sentence + marker)
status: queued
track: frontend
repo: fundscore-web
lane: lean
depends_on: fee-peer-band-backend
source_proposal: feature-pipeline/prds/fee-fairness-peer-band.md
created: 2026-07-10
scope: page
---

# Fee peer percentile — web flip (lean)

PRD: `feature-pipeline/prds/fee-fairness-peer-band.md` (owner decisions 2026-07-10). Blocked on
`fee-peer-band-backend` (the `fees.peer_percentile` payload must exist in staging/Postgres).

## What to build (owner Q4: sentence + marker inside the existing fee ruler)

1. In `src/components/fund/profile/v2/FeeFairnessV2.tsx`: when `fees.peer_percentile` is served,
   render (a) one plain-language sentence under the ruler — e.g. "62 bps over passive is higher
   than 71% of the 158 funds benchmarked to IWF." — with cohort name + n ALWAYS in the copy; for
   a blend-basis cohort, honest phrasing like "…of funds sharing its blended passive alternative
   (weighted across IWF 70% / AGG 30%)"; (b) a small percentile marker positioned on the existing
   ruler geometry. No new section, no separate band graphic.
2. Absent payload → render nothing new (no placeholder). Free tier (owner Q3): visible at free;
   verify no gating change needed (fees section is already free).
3. The sentence quotes the SAME served bps figure the ruler already shows — never a second number.

## Acceptance

- FCNTX (paid + free) shows sentence + marker with cohort n; a blend-baseline fund shows the
  blend phrasing; a fund with null percentile shows the unchanged current section.
- `npm run build` + lint green; gating-golden unchanged-green (no gate changes expected).

## Lane

Lean: single component + copy, served contract only, no data semantics. If re-grounding finds the
payload shape diverged from this spec, bounce to `/review-specs` rather than improvising.
