---
id: serve-full-exposure-panel
title: Serve the COMPLETE per-fund exposure panel (not top-N) plus the stock→theme/sector reference, so portfolio-level and screener consumers can aggregate honestly
status: queued
track: backend
repo: fund_score
depends_on: ""
source_proposal: feature-pipeline/proposals/approved/homepage-promise.md
created: 2026-07-14
scope: global
model: fable
---

## Owner summary
Today we only serve each fund's *top few* exposures — enough to render a fund page, but not enough to
add anything up. That single limitation is what blocks both the portfolio-level X-Ray and the
exposure screener: you cannot honestly total exposures you can only partially see. This ships the
full picture per fund, plus the stock→theme map, and it is the keystone both of those features sit on.

## Goal
Serve, for every fund we cover, the **complete** exposure panel — all dimensions, not a truncated
top-N — and the **reference maps** (stock → theme basket, stock → sector) that let a consumer compute
exposure for an arbitrary *portfolio* by looking through to positions.

This is a serving/plumbing spec. The gold panels already contain the numbers; the serving layer
throws most of them away.

## Context — why this is blocking (verified 2026-07-13/14)

`fund_profile_facts.exposure_xray` is served as a **top-N list per exposure type**, sized for the fund
page. Verified against the live serving DB:

```
FCNTX exposure_xray rows by type:
  {"sector":8,"theme":6,"country_region":10,"stock":6,"concentration":10}
```

Six theme rows — against a gold panel that carries **28 themes**. Likewise
`fund_profile_facts.te_decomposition` serves only the **top ~12 bets** of a 46-bet basis; FCNTX
carries exactly **one** macro bet (`Short Treasuries`, β 0.195, t = 0.8 — not even significant).

**The trap:** a consumer that aggregates these served rows across a portfolio silently reads
"not in this fund's top N" as **zero exposure**. A fund with 9% AI-Infrastructure exposure that
happens to rank 7th in its own list contributes 0 to the portfolio total. That is silent
under-reporting — a DEFECT, not "partial coverage" — and it is exactly the failure the project's
coverage rules exist to prevent.

Gold has what we need (`gold/exposure_xray_panel.parquet`): 116 country_region, 28 theme, 11 sector,
6 style (FF6), 5 concentration, 3 asset_class = **169 dimensions**, over 5,249 funds.

## Computation / what to serve

### 1. `fund_exposure_panel` (long-format serving table)
One row per `(series_id, exposure_type, exposure_id)` — **every** dimension, no top-N trim.

```
series_id, exposure_type, exposure_id, exposure_name,
fund_exposure,            -- the fund's own weight/beta
passive_blend_exposure,   -- same dimension on its L2 passive alternative
difference,               -- fund − blend
unit,                     -- decimal_weight | beta
coverage_state,           -- available | insufficient | not_applicable
as_of, method_version
```

Follow the **long-format serving pattern** already proven by `fund_holdings_full`
(see `feature-pipeline/specs/done/serve-full-holdings-backend.md`): staging parquet next to the
facts, TRUNCATE + COPY in one transaction, per-fund gate presence ⇔ rows, in-transaction FULL-JOIN
coherence check.

Keep `fund_profile_facts.exposure_xray` as-is (the fund page's top-N read is a legitimate,
cheap hot path). This table is additive.

### 2. `theme_membership` (reference)
`theme_id, theme_name, security_ticker, weight_in_basket, as_of, method_version`

The 28 themes are **stock baskets**. Serving membership is what makes portfolio-level themes a
*direct* computation from the look-through — no per-fund aggregation at all, and therefore no
truncation risk:

> portfolio theme exposure = Σ over the portfolio's look-through stock weights ∩ the theme basket

`src/lib/serving/portfolio-lookthrough.ts` (shipped 2026-07-13) already produces the look-through
stock weights this joins against.

### 3. Fix `security_sector` coverage — or serve a reference map
`fund_holdings_full.sector` is **43% NULL** (560,501 of 1,307,263 served equity rows). This is the
known foreign-holdings classification gap (see backlog: *"1,836 EQ funds >30% foreign; international
funds classify foreign holdings' sector at 11.7% vs 95% for US"*). Any holdings-derived sector split
built on it today would quietly under-report every non-US name.

Either raise sector coverage at the source, or serve a `security_sector` reference map keyed by
ticker/CUSIP with an explicit `unclassified` bucket that consumers must display. **Do not** let a
consumer treat NULL as 0.

### 4. Add the two missing macro factors
The shipped macro basis has **8** factors, verified by querying the served bets:

```
macro::rates_long   Long Treasuries       macro::gold       Gold
macro::rates_short  Short Treasuries      macro::oil        WTI Crude Oil
macro::credit_ig    Investment-Grade       macro::commodity  Broad Commodities
macro::credit_hy    High-Yield Credit      macro::dollar     US Dollar (broad)
```

There is **no inflation factor and no growth factor**. The homepage promise names both, so this spec
adds them:
- `macro::inflation` — TIPS breakeven series (or an inflation-linked vs nominal Treasury spread).
- `macro::growth` — a cyclicals-vs-defensives long/short return series (a growth-surprise proxy).

Both must be documented in `/methodology` with an honest statement of what they proxy and what they
do not.

## Data-integrity guardrails (binding)
- **No top-N in this table.** If a dimension is not applicable to a fund, emit a row with
  `coverage_state='not_applicable'` — never omit it silently. Missing ≠ zero is the entire point.
- **Never sum per-fund active betas across funds.** The TE-decomposition betas are measured against
  *each fund's own* passive alternative. They are not commensurable across funds; summing them
  produces a number with no meaning. Absolute portfolio factor/macro exposure is a **returns
  regression on the book** (see `portfolio-exposure-parity`), not a weighted sum of relative bets.
- Coverage is reported, never renormalized away.
- Every row carries `as_of` + `method_version`.

## Acceptance criteria (relational)
- For any fund, `count(fund_exposure_panel rows WHERE exposure_type='theme')` equals the gold theme
  count for that fund — **not 6**.
- A random sample of 20 funds reconciles row-for-row against `gold/exposure_xray_panel.parquet`.
- `theme_membership` reproduces each fund's served theme exposure when applied to that fund's own
  as-filed holdings, within tolerance — a **non-degenerate** check (it must be possible to fail).
- Sector: report classified vs unclassified weight. No consumer can reach a NULL sector as 0.
- `/check-data` protocol passes; adversarial `data-reviewer` checkpoint on semantics, not just bounds.

## Out of scope
- The portfolio-level aggregation itself (→ `portfolio-exposure-parity`).
- The screener UI (→ `exposure-screener`).

## Risks
- Table size: 5,249 funds × 169 dimensions ≈ 890K rows. Trivial next to `fund_holdings_full` (1.4M).
- The two new macro factors are new modelling, not plumbing; they need their own EDA + review, and
  should not block the rest of the panel. Ship the panel first if they slip.
