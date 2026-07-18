# Day run 2026-07-17 → 18 — closing report (day-plan-20260717.md)

Loop ran ~09:55 → 18:30, then closed out on owner instruction ("commit and merge everything")
after the usage-limit resets. Three of four plan items shipped end-to-end plus one unplanned
defect fix the adjudication surfaced; item 4's remaining sub-items stay in the backlog.

## Shipped (all merged to fund_score main per owner close-out instruction)

| # | Item | Commit | What landed |
|---|------|--------|-------------|
| 1 | Restore the 71 dropped funds | `8456dbd` (`fix/payload-contraction-71`) | Root cause was a TIME BOMB, not the Jul-5 beta-skill code: `last_nport_filing_date` frozen at 2024-12-31 (CTM-derived) × the 548-day recency window crossing that horizon 2026-07-03. Fixed at source: N-PORT recency now reads the live raw holding store (max with the CTM floor) + `--recency-only` splice mode with a fail-closed no-regression guard. Payload 10,435→10,860 (240 of the 315 restored incl. PRIDX/PRASX/PRLAX + **185 live filers dropped by EARLIER builds crossing the same horizon**; 75 stay out EDGAR-verified dead, 0 recoverable-missing). The contraction had propagated Jul-15 into holdings_complete/xray/divergence/attribution — all rebuilt coherently, ZERO series lost anywhere; EGRAX/DFLVX/TBD/ZZZ exclusions preserved. Local serving manifest 47. Gates: data-reviewer PASS (independent 26,155/26,155 re-derivation), codex r2 clean, 5 falsification tests. |
| 2 | ETF/UIT expense ratios (owner Option A) | `d04253c` (`feat/etf-uit-expense-ratios`) | FMP `etf/info` ingestion: 154-ticker solver universe, 100% coverage, per-row provenance, build-failing anchor+bounds gates. SEC-filed stays PRIMARY (anti-join proven over 41,536 filed tickers — 0 changed). Acceptance met: {VTSAX 40, AGTHX 30, SPY 30} fee partial→**available** (gap 16.48 bps); SPY:100 serves its own 9.0 bps (`fmp_etf_info`). Gates: codex clean ×2; data-reviewer PASS (SPY/GLD/DBC — the only serving vendor rows — verified vs issuer/EDGAR). |
| 3 | Northstars drift adjudication | (analysis) | **DEFECT, not drift — check band unchanged.** Controlled decomposition: membership effect ≈0, metadata-restore effect exactly 0; the whole −80 was a value effect from corrupted ETF gap-fill legs in `passive_alt_daily_nav` (raw-glob read with no dedup × the Jul-10 second adjustment vintage; HAINX benchmark Nov-2022 +15.33% vs true IEFA +13.16%). |
| 3b | The deferred f011953 NAV rebuild (unplanned, required by #3) | `fix/benchmark-nav-dedup-rebuild` | Rebuilt passive_alt_daily_nav on the fixed canonical-panel loader (71.45M rows, membership identical) → value_score (474 scores moved ≥10bps, 16 ≥50bps, 3 strict sign flips; MLOIX +10→+80; FCNTX/DODGX anchors byte-stable) → factor_exposure (l2_1f control) → return_attribution → divergence → attribution blocks → serving. **Northstars 10/10 PASS at median −70** (band −75..−45 — no tolerance change). Check suite 7 PASS / 2 WARN (pre-existing) / 1 FAIL (pre-existing rolling_factor_alpha freshness, byte-identical). Codex N/A (zero code delta — the loader fix was gated at f011953). Data-reviewer first returned **FAIL with one blocking catch**: `positioning_context.parquet` (built 8 min after the corrupt NAV on Jul-16) still embedded the corrupt TE basis and sat inside the manifest-48 staging (664 funds' served te_bps ≥10bps off; HAINX TE overstated 2.7×). Fixed per its stated conversion terms: positioning_context rebuilt from the clean panel (verified 2,036/2,036 match clean, 0 corrupt residuals) + staging re-assembled → **local serving manifest 49**. Reviewer also verified the rebuild chain independently (HAINX/MLOIX/ARTIX/AEPGX/PRSNX/VWINX recomputed to ~1e-16; raw-glob dup-vintage forensics confirmed: IEFA 3,421 duplicate dates, canonical 0). |
| 4b | Data-dictionary canonical-price entry | (on 3b's branch) | `fund_daily_adj_close.parquet` documented as THE canonical price read, with the raw-glob duplicate-vintage hazard and the Jul-16 corruption as the cautionary case. |

## Owner should know (surfaced by reviewers, all recorded on backlog items)

1. **Serving diff on manifests 47/48 is not only the restore**: peer-percentile re-ranking over the
   restored universe flipped `value_offering_label` on 54 retained funds (11 Strong→Mixed,
   19 Mixed→Weak); the xray rebuild also picked up the Jul-15/16 diversification+blend refresh.
2. **FMP `expenseRatio` is GROSS-basis under a fee waiver** (falsified on BKLN: 67 vs filed net 65).
   Harmless today (all three serving vendor rows are waiver-free; filed quarantines the rest); rule
   codified: new vendor-only tickers get a waiver hand-check before serving.
3. **QQQ/DIA are still wholly outside the solver universe** (honest absence, not partial fee) — the
   UIT fee fix covers SPY. Extending input support to QQQ/DIA is a small follow-up if wanted.
4. **The "~1-2bp" deferral estimate on the f011953 gold rebuild was off by two orders of magnitude**
   on the affected cohort (~450bp/yr on intl gap-fill legs; 474 served scores; 3 sign flips). The
   northstars gate is what caught it — lesson recorded in memory.
5. 28/185 restored "extra entrants" sit at the stale edge (14–17.5 months N-PORT-silent) and will
   age out naturally; 183/185 serve no score (universe rows, not scored content).

## Residuals filed in the backlog

- N-PORT holding-store ingest can miss a dying fund's final filing (BGHDX case) — completeness check.
- Manager-people gold stale vs source_inventory (dead funds in rosters; test red, pre-existing).
- `build_holdings_complete.py` enrichment dedup nondeterminism (307-series attribute re-binding
  between same-input runs) — appended as live evidence to the existing `unique(keep="first")` sweep.
- Pre-existing reds unchanged: openfigi batch-split unit test, the_take↔takeaways drift (item 4c),
  rolling_factor_alpha freshness row.

## Not done (stay in backlog, in order)

- Item 4a price-quarantine tightening (now cleanly unblocked — drift attribution resolved).
- Item 4c fund_the_take↔takeaways coherent rebuild (should follow the corrected value basis).
- Item 4d metadata-freshness census (N-CEN FY2025 + MFRR refresh planning; the N-PORT recency leg
  is now live, which removes the sharpest edge).

## State at close

- fund_score: three branches merged to main (owner instruction); local serving on manifest 49
  (5,675 facts). Nothing pushed anywhere.
- fundscore-web: doc/backlog updates committed via branch + merge to local main. NOT pushed
  (push = prod deploy — owner only).
- Worktrees removed after merge; `data/` lakehouse untouched by cleanup.
