---
id: exposure-screener
title: Search by the bet, not the label — screen ETFs and mutual funds on exposure criteria across all 169 dimensions
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
Every fund screener on the market starts from the same four things: category, star rating, fee and
past return. None of them let you ask the question an investor actually has — "which funds give me
*this exposure* without *that* baggage?" This makes exposure the primary search key. It is the
sharpest differentiator we have, and the homepage line "search by the bet, not the label" is a promise
we currently cannot keep.

## Goal
Let a user find funds by the **exposure they want**, across the full 169-dimension surface, over both
ETFs and mutual funds — instead of by category, rating, fee or trailing return.

Target queries (all from the homepage copy — treat as the acceptance set):
- "Funds positioned for falling real rates."
- "AI exposure **without** leaning on the same mega-cap stocks."
- "Inflation sensitivity." / "Reshoring." / "Quality." / "Small-cap value."

That second one is the money query and the hardest: it is a *two-sided* screen — high theme exposure,
**low** overlap with a named stock basket. It is also precisely what our data can answer and a star
rating cannot.

## Context — what exists today, honestly
- `/q/[slug]` serves a **published, canonical query set** (~15 slugs, e.g.
  `funds-ai-infrastructure-exposure-above-passive-blend`), statically generated. Real, but a fixed
  menu, not a screener.
- `/search` exists as a query surface; **free-text ranking is deferred**
  (`pipeline_status.md` § pre-public-launch gaps).
- `/lens` lets a signed-in user save a query. The Lens machinery is the natural home for a saved
  screen — reuse it, do not build a parallel concept.
- There is **no criteria-based exposure screen** today. The homepage promise ("search across ETFs and
  mutual funds using criteria you choose") is currently unbuilt.

## Depends on
`serve-full-exposure-panel`. A screener over a **top-N** panel is worse than no screener: a fund with
real AI-Infrastructure exposure that ranks 7th in its own served list would be **invisible** to a
search for AI exposure. Silent false negatives are the worst possible failure for a discovery
surface, because the user cannot see what they were not shown. Do not start this before the panel
lands.

## Computation / design

### Criteria model
A screen is a conjunction of predicates over `fund_exposure_panel`:

```
{ exposure_type, exposure_id, basis, op, threshold }

basis:  absolute            -- the fund's own weight/beta
        vs_passive_blend    -- fund − its own L2 passive alternative   (the differentiated one)
op:     >= | <= | between
```

`vs_passive_blend` is the one competitors structurally cannot copy — it asks "is this an *active bet*,
or is the fund just holding what the index already holds?" Make it the default basis, and say so in
the UI.

The "AI without the mega-caps" query is then expressible directly:
```
theme::ai_infrastructure   vs_passive_blend  >= +5pp
theme::mag_7               absolute          <= 15%
```

### Ranking
Rank by **relevance to the stated criteria** — how strongly a fund satisfies the predicates — and
show the parsed interpretation, exactly as `/q` already does. Never rank by a quality score and never
present the top row as a pick.

### Surfacing
Extend `/search` rather than adding a route. A completed screen is saveable as a **Lens**
(`/lens`), which already has save/share/change-tracking.

## Copy charter (binding — `prd.md` § Trust/Legal/Data Rules)
- Never "best", "winner", "top pick", "recommended", "will outperform". The screener **finds**; it
  does not **advise**.
- Always show the number; no adjectives where a figure works.
- Show the interpretation of the query back to the user, and the coverage of the result.

## Data-integrity guardrails (binding)
- **A fund with no exposure row for a screened dimension is `unknown`, not `0`.** It must be
  excluded from the result set with a stated count ("312 funds could not be screened on this
  dimension"), never silently ranked last. This is the single most important rule in the spec.
- Report result coverage up front: how many of the N funds in scope could actually be screened.
- No silent caps. If the result is truncated, say so.

## Acceptance criteria (relational)
- Every query in the target set above returns a result set, or an honest "we cannot screen this yet".
- **Recall check (non-degenerate):** for a chosen theme, the screener's result set must equal an
  independent Polars query over the gold panel at the same threshold. Any fund in gold-but-not-served
  is a **defect**, not a coverage caveat — this is the top-N false-negative regression, asserted.
- "AI exposure without the mega-caps" returns funds that genuinely satisfy both legs; spot-check 10
  by hand against their as-filed holdings.
- Screening a dimension a fund has no data for excludes it *with a count*, and never scores it 0.

## Out of scope
- Natural-language parsing of a free-text query. Ship structured criteria first; NL is a layer on top
  and should not gate the underlying capability.
- Backtesting a screen.

## Risks
- 169 dimensions × two bases is a large UI surface. Start from the exposures people actually ask for
  (the target set), not from an exhaustive dimension picker.
- Foreign-holdings sector/theme classification is weak (international funds classify foreign holdings'
  sector at ~11.7% vs 95% for US). Screening on sector/theme will systematically under-return
  international funds until that is fixed. **Surface this as a coverage caveat on the result set**,
  and file the classification gap as its own blocker.
