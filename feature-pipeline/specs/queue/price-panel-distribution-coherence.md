---
id: price-panel-distribution-coherence
title: Detect the fabricated distribution-day moves at source, using the raw close and dividend the builder already has
status: queued
track: backend
repo: fund_score
depends_on:
source_proposal: owner ruling 2026-08-21 (decision 3 — "fix the pipeline")
created: 2026-08-21
priority: 2
scope: global
model: opus
effort: high
lane: reviewed
---

## Owner summary
Some fund charts show a one-day gain or loss that never happened, because our price vendor applies
its dividend adjustment a day before the price actually moves. Every rule we have written to catch
this has been a guess made from the price line alone — and each review has found another case the
guess misread, shrinking the affected set five times over. This work stops guessing: the raw price
and the payout amount are sitting in the vendor file, one line above where our pipeline throws them
away. Using them, the defect becomes directly checkable instead of inferred.

## The owner ruling this implements (2026-08-21)
> "We need to fix the pipeline."

The owner chose to fix the evidence loss rather than ratify a proxy rule onto a population that has
shrunk at every one of five looks (**1,519 → 1,374 → 575 → 537 → 525**).

## ⚠ Do NOT widen the panel — that option was considered and rejected
The obvious reading of "restore the discarded fields" is to carry `close_price` and `dividend`
through `build_fund_daily_adj_close.py` into `data/gold/fund_daily_adj_close.parquet`. **Do not do
this.** Reasons, all verified:

- **~40 files read that panel**, and at least six read it with a bare `read_parquet()` and no column
  selection (`alpha/bootstrap.py:135`, `run_eq_backtest.py:587,795`, `test_prior_adjustments.py:273`,
  `bootstrap_sensitivity.py:32`, `build_skill_decomposition_report.py:310`).
- **The drop was a considered call, not an oversight.** `src/fundscore/distributions.py` states in
  its own header that it reads dividends straight from the raw vendor files and *deliberately* not
  from the consolidated panel, because "carrying it through its source-collision / regime-detector /
  quarantine logic was judged higher-risk than a dedicated reader."
- Widening forces the consolidation to decide **what a dividend means when two vendors disagree on
  the same (ticker, date)** — exactly the risk that judgement avoided.

**The goal is for the panel to be RIGHT, not for forty consumers to be able to re-derive the truth
individually.**

## What to build
`scripts/pipeline/build_fund_daily_adj_close.py` already reads `close_price` and `dividend` — they
are in the scanned frame and are discarded at **line 61**, `.select("ticker","date","adj_close","fetched_at")`.
It also already has the machinery this needs: a quarantine output
(`fund_daily_adj_close_quarantine.parquet`), `_quarantine_nonpositive`, `_quarantine_local_outliers`,
`_extreme_jump_rows` with `REGIME_CHANGE_THRESHOLD = 50.0`, and `_format_quarantine_rows(df, reason=...)`
giving every quarantined row a stable `reason` string.

**Add a distribution-coherence check in exactly that pattern**, with its own `reason`, using the two
columns already in hand. No schema change to the output panel.

**The identity to check.** On a stamped-distribution day `T` with dividend `D` and close `C`, writing
`y = D / C(T)`, `ly = log(1+y)`, `raw` = the log step of `close_price`, and `s` = the log step of
`adj_close`: a coherent vendor adjustment satisfies **`s = raw + ly`**. The defect is the case where
the vendor moved its factor but the price did not: **`s ≈ ly` while `raw ≈ 0`** — the whole of the
displayed move is adjustment, none of it is price.

## ⚠ MEMORY TRAP — this has already killed a process on this machine
`distributions.py` records it: the raw inputs are **~146M rows with ~29M duplicated (ticker, date)
pairs**, and a global `group_by(ticker, date)` creates ~117M groups and thrashes swap — **the process
was killed at 18 CPU-minutes / 460GB VSZ on 2026-06-09.**

**Use the pattern that module already proved works:** collect the distinct *dividend-bearing*
(ticker, date) pairs (**~2M**, not 146M), semi-join the raw scan down to those, and resolve only that
subset. The coherence check only ever needs days that carry a stamped dividend, so it never has to
touch the full frame. Do not write a fresh global dedup.

## What to measure — this is the deliverable, and it may CLOSE the owner's decision
Run the check across the full history and report:

1. **The direct count.** How many (ticker, date) rows are incoherent by the identity above — the
   first number about this defect that is **measured rather than inferred**.
2. **Direct vs proxy.** Compare against the proxy population and its five successive corrections
   (1,519 → 1,374 → 575 → 537 → 525). **If the direct count lands near 525, the proxy had converged
   and the remedy debate is settled on a number. If it does not, say which is wrong and why** —
   that is the single most valuable output of this work.
3. **Product reach.** How many funds serve an affected chart, and how many carry a scored
   fee-vs-passive verdict computed off one. Current understanding is ~151 and 52 respectively;
   re-derive rather than inherit.
4. **Seasonality as a cheap correctness proof.** 56% of proxy-found events fall in December and 12%
   in September, because funds must distribute realised gains annually. **A direct check that does
   NOT reproduce that concentration is wrong** — it is a free, strong falsification test. Use it.
5. **Vendor split.** How many affected rows come from Tiingo vs Yahoo. Yahoo carries a separate
   known defect (its factor over-moves ~2× above roughly 2–3% of NAV), so the two must be reported
   separately, not pooled.

**Measure only. Do not ship a correction in this segment** — the remedy (quarantine, repair, or
re-derive the adjustment from raw close and dividend) is the owner's call once the true number exists.

## Standing constraints
1. Writes confined to `data/_tmp/<slug>/`. **Zero** writes under
   `data/{gold,product,silver,bronze,reference,staging,vendors}` — the panel this touches is read by
   ~40 pipelines, so a canonical write needs its own explicit authorisation.
2. Non-mutation proof: `os.walk(followlinks=True)` with a canary written immediately before the walk,
   **plus a seeded-violation self-test**. A CLEAN that cannot go DIRTY proves nothing.
3. Any new rule / threshold / band / allowlist → **STOP and brief.** Note the identity above is an
   arithmetic identity, not a threshold — if you find yourself needing a tolerance, that tolerance is
   a new constant and must be briefed, not chosen.
4. Never synthesize, impute or default-fill.
5. **A check that returns 0 must be shown capable of returning non-zero before its 0 is quoted.**
   Five vacuous checks were caught in the preceding week, one inside a spec's own acceptance criteria.
6. **A class boundary must be tested against every axis the downstream action branches on.** The
   capital-gain proxy failed this three times — on the round-trip axis, then the verdict axis. Ask
   what axis your own classification has not been tested against before reporting.
7. **A sweep that reports "clean" is itself a check** — vary the pattern or seed a known instance.

## Sequencing consequence
**This may close owner decision 3 outright.** That decision is repair-vs-excise on a proxy-defined
population; a direct measurement either confirms the population or replaces it. Report the
consequence explicitly either way. The capital-gain item is **reload fence #1**, so this is on the
critical path to the serving reload.

## Acceptance
- Coherence check implemented in the builder's existing quarantine pattern, with its own `reason`.
- **No schema change** to `fund_daily_adj_close.parquet`.
- Runs over full history **without a global dedup**, using the dividend-bearing-pairs semi-join.
- The five measurements reported with numbers, Tiingo and Yahoo separated.
- The December/September concentration reproduced, or the discrepancy explained.
- Non-mutation CLEAN with its seeded self-test green.
- Nothing committed by the implementer; the dispatcher owns the commit and the codex gate.
- Stops for a `data-reviewer` checkpoint before any canonical write.
