# PRD: Fee-fairness peer band on the profile page

Backlog origin: `(story)` "Fee-fairness peer band — show where a fund's fee-over-passive sits vs
its category peers (percentile), not just the raw bps. [web profile]" (Open, 2026-07). Drafted
2026-07-10 (overnight run). Status: awaiting red-team + owner resolution of open questions.

## Problem

The Fee Fairness section shows the fund's fee figures as absolute bps (net ER, passive fee,
fee-over-passive, fair-fee ruler). A retail reader has no way to judge whether e.g. "62 bps over
passive" is cheap or expensive *for this kind of fund*. A percentile against comparable funds is
the number that makes the bps legible — the same legibility argument the (already-specced)
positioning-context percentiles make for beta/TE.

## Who & why

Retail investor on `/funds/[ticker]` (v2 profile, Fee Fairness section). Trust feature: context
converts a raw figure into a judgment the reader can act on, using only evidence we already serve.

## What it does (behavior)

- The Fee Fairness section adds one comparative read: the fund's **fee-over-passive percentile
  within a NAMED peer cohort**, with cohort size — e.g. "FCNTX's 62 bps over passive is higher than
  71% of the 158 funds benchmarked to IWF." Copy names the cohort and n; never a percentile against
  an unnamed population.
- Optionally rendered as a small band/strip (distribution with the fund's marker) consistent with
  the existing fee-ruler visual language; the number + cohort sentence is the contract, the band is
  presentation.
- Funds without the underlying figure (null canonical fee-over-passive, passive funds, cohort below
  the minimum size) show NOTHING new — honest absence, no fallback percentile.

## In scope

- One new served figure set per fund: `fee_over_passive_percentile`, cohort {kind, label, n},
  convention + as-of metadata, computed in fund_score and served through the fact row's `fees`
  section; frontend rendering in FeeFairnessV2.

## Out of scope

- Any change to the fee figures themselves (canonical fee-over-passive is owned by the shipped
  canonical-fee work); percentiles on other metrics (positioning-context owns beta/TE); fee
  time-series or peer-fee tables.

## Acceptance (testable)

- For 5 spot-check funds, the served percentile recomputes exactly from a direct query over the
  source panel using the documented convention (strictly-below, documented tie handling).
- Every served row carries cohort kind + label + n; no row with n below the minimum cohort size.
- Passive funds and funds with null fee-over-passive serve no percentile (honest null).
- Coverage headline reported: % of scored funds with a served percentile, split honest-missing vs
  recoverable.
- Frontend: percentile sentence renders only when served; build+lint+golden green; no paid leak
  (gating decision below).

## Resolved by red-team round (2026-07-10 — clarifications, not product calls)

- **As-of row selection (pinned — the #1 red-team blocker).** `fee_efficiency_score.parquet` is a
  dense (series_id, eval_date) grid; a naive `.last()` per series yields NULL
  `active_fee_over_passive_bps` for 99.5% of series (the exact bug class the canonical-fee spec
  root-caused). Convention: **latest eval_date row where `active_fee_over_passive_bps` is
  non-null**, mirroring what `fact_assembler` already does for `fair_fee`. Stated here as THE rule.
- **Cross-panel join (in scope, explicit).** The fee figure lives in `fee_efficiency_score.parquet`;
  cohort labels (`passive_alt_label`, `peer_group`) live in `value_score.parquet` (one row per
  series, no eval_date). Two steps: collapse the fee panel to one row/series via the as-of rule
  above, then join value_score on `series_id` alone. Measured coverage: 2,607/2,622 fee-eligible
  series (99.4%) carry a cohort label.
- **N_MIN is a spec constant, not a vibe.** The minimum cohort size must be locked as a number in
  the spec (default 20 unless the owner overrides in Q1/Q5); acceptance tests against that number.
- **No shipped percentile precedent exists.** positioning-context-percentiles is queued, unbuilt;
  `value_offering.cluster_percentile` uses a different formula (Hazen) and is not in any live build.
  Whatever convention Q1 picks must be BUILT as a shared utility, not "reused" — see Q5.

## OWNER DECISIONS (2026-07-10 — all five questions answered; build to these)

1. **Cohort basis: same passive alternative — blend-weighted for combination baselines.** For a
   fund whose passive alternative is a single ETF, the cohort = scored funds sharing that passive
   alternative. For a fund whose passive alternative is a COMBINATION (blend), the percentile is a
   **weighted average of the fund's percentile within each constituent-ETF cohort, weighted by the
   blend weights** (owner's words: "if the passive alternative is a combination use a weighted
   average of funds sharing the constituent passive alternatives with appropriate weights").
   Mechanics to pin in EDA: what counts as "sharing a constituent" (selected blend includes that
   ETF), N_MIN applies per constituent cohort, and weight renormalization when a constituent
   cohort is below N_MIN (drop + renormalize over qualifying constituents; if none qualify →
   honest null).
2. **Figure: canonical `active_fee_over_passive_bps`.**
3. **Gating: FREE** (trust feature).
4. **Placement: one sentence + marker inside the existing fee ruler** (FeeFairnessV2).
5. **Sequencing: shared percentile/cohort utility, one convention page-wide.**
   `positioning-context-percentiles` (already queued) ships the shared utility first; this
   feature `depends_on` it and reuses the same cohort-naming + percentile convention. The
   blend-weighted cohort rule above DEFINES the shared convention for blend-baseline funds in
   both features.

## Open questions (owner)

1. **Cohort basis.** The story says "category peers" (⇒ `peer_group`), but the owner-approved
   positioning-context convention uses **same `passive_alt_label` primary, `peer_group` fallback
   below N_MIN (~20), cohort named in the payload**. Same convention here (recommended — one
   percentile convention page-wide), or strictly category (`peer_group`) as the story literally
   says?
2. **Which figure.** Percentile of the canonical `active_fee_over_passive_bps` (recommended — it is
   THE product figure), or of net ER? (Net-ER percentile exists in some competitors; over-passive
   percentile is the differentiated read.)
3. **Gating.** Fee Fairness is currently FREE. Does the percentile ride free (trust feature,
   recommended) or become a paid detail?
4. **Placement/visual.** One sentence + marker inside the existing fee ruler (recommended), or a
   separate band graphic?
5. **Sequencing vs positioning-context-percentiles (red-team addition).** Both specs want "one
   percentile convention page-wide" but NEITHER is built. Sequence them (one ships a shared
   percentile/cohort-naming utility, the other `depends_on` it — recommended), or build
   independently and risk two divergent "Xth percentile of N funds" implementations under
   identical UI language?

(Note: the title's "peer band" uses "peer" loosely pending Q1 — the recommended cohort is
same-passive-alternative primary, `peer_group` fallback, not strictly category.)
