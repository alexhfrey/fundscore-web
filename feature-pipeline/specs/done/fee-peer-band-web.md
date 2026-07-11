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

## Implementation Result (2026-07-11, lean lane, main session)

Shipped in `FeeFairnessV2.tsx`: typed `fees.peer_percentile` contract, one cohort sentence under
the ruler (bold quotes the SAME `active_fee_over_passive_bps` the ruler center shows), and a
percentile marker line on the fund's existing ruler mark (`{ordinal} percentile of {n}` via the
shared v2 `ordinal()` — one percentile convention page-wide, matching CurrentPositioning). Absent
or incomplete payload → nothing new renders (verified: VOO).

- Re-grounding: payload verified LIVE in Postgres (manifest 32) before coding — FCNTX
  `fee_percentile 36.875`, cohort `{label IWF, n_funds 160, is_blend false}`; blend case DTEYX
  `IXN 50% / FDN 50%`.
- Rendered acceptance (dev server, SSR HTML): FCNTX free+paid → "56 bps over passive is higher
  than 37% of the 160 funds benchmarked to IWF." + "37th percentile of 160" marker; DTEYX →
  "…of the 20 funds sharing its blended passive alternative (weighted across IXN 50% / FDN 50%).";
  VOO → zero new strings. Free tier confirmed (section already gated FREE; no gating change).
- Gates: lint 0 errors; production build clean; gating-golden ALL PASS (unchanged-green).
- Codex: `CODEX_GATE: pass`, 0 P0/P1. Two P2 advisories (double-prefix label; `kind` vs
  `is_blend`) are contradicted by the live served payload and the curl-verified rendered copy —
  documented here, no change needed.
