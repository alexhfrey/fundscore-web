# Night run 2026-07-16 → 17 — morning report

Loop ran 23:05 → 02:10 with the credit-limit backstop cron armed (never needed — no usage
gap occurred). Full operational log: `feature-pipeline/night-run-20260716.md`.

## Shipped (6 items + the branch cleanup you asked for mid-run)

| # | Item | Where | What landed |
|---|------|-------|-------------|
| 1 | Solver-HTTP-service story (deploy blocker) | web `5a788c2` (PRD) | PRD written, red-teamed, revised — **AWAITING YOUR ANSWERS** (4 questions below). Facts corrected: service needs ~690 MB / nine files (not 2.2 GB), solves ~1–4 s ⇒ no job queue, compaction no longer a prerequisite. |
| 2 | X-Ray default example demos a failure | web `2e8a419` | First-click example is now the landing page's FXAIX 40 / FCNTX 35 / VWIGX 25 book — verified live: IWF+VEU, 23 bps gap. (Old book no longer reproduces the failure on the fixed solver; swap done per your "do (a) regardless".) |
| 3 | Methodology page stale as-of dates | web `729cb32` | 10 of 17 sections re-derived from gold (value_score → v0.3 / 2026-07-11, skill → v1 / 2026-07-05, frontier → per-product "up to 2026-04-30"…). Data-reviewer 12/12 exact, zero fabrication; stale-β state now *disclosed* where the copy claimed the opposite. Follow-up story filed: generate these from the pipeline so they can't drift a third time. |
| 4 | Fresher-β invariant violation (top Open item) | fund_score `d96098b` on `fix/fresher-beta-rebuild` | factor_exposure re-evaled at the ff6 frontier 2026-05-22 (root cause: refresh path never rebuilt it); fail-honest guard + falsification test; ticker→series dedup rewritten after the data-reviewer **correctly blocked** my first deterministic rule (it froze CHGX/EGRAX onto wrong registrations). Both red tests green; 41/41. |
| 5 | L2-cadence hardening (2 codex P2s) | fund_score `f011953` on `fix/l2-cadence-hardening` | benchmark-NAV ETF reads → canonical panel (gold rebuild deferred, see below); both served-L2 resolvers now share a fail-closed partial-partition guard + tests. |
| 6 | SPY unsupported as X-Ray input — half (a) | fund_score `ec6b064` on `fix/xray-spy-input-resolution` | SPY-class inputs resolve via the blend universe; {VTSAX, AGTHX, SPY} solves **available** (was: whole solve suppressed), exposure includes SPY's look-through, fee honestly partial pending half (b). |

**Branch cleanup (your mid-run request):** web — night-run work merged to main, 4 dead branches deleted; fund_score — checkout switched back to `main` (local X-Ray now runs the fast solver), 11 merged branches deleted, 2 merged worktrees removed (artifacts rescued: EODHD licensing draft + validation spikes). Kept: `fix/te-decomp-build-gate` worktree (real unfinished work) + 6 unmerged research/wip branches.

## Merge these (in order, soon)

fund_score, all gated + committed, none pushed:
1. `fix/fresher-beta-rebuild` (`d96098b`) — **merge promptly**: the shared gold already reflects this branch's code; a rebuild from main would regress the artifacts.
2. `fix/l2-cadence-hardening` (`f011953`)
3. `fix/xray-spy-input-resolution` (`ec6b064`) — note: the exposure-side P2 fold-in postdates its codex run (verified by 14 integration tests + live solves); worth your reviewer's glance at merge.

Web main is **3 commits ahead of origin — pushing deploys prod** (gated site). Your call.
Worktrees for the three fund_score branches are still up (`fund_score-wt-fresher-beta`, `-l2-hardening`, `-spy-input`); remove after merging.

## Waiting on you (owner decisions)

1. **Solver-service PRD** (`feature-pipeline/prds/solver-http-service.md`): hosting vendor + budget; Sharadar/Tiingo license-into-container check; confirm compaction de-scope; between-refit freshness stance.
2. **Jul-5 payload contraction** (new backlog item, OWNER DECISION): that rebuild silently dropped 71 funds (49 live-priced, TRP intl cluster) from the factor-β universe — manifest 45 still serves them off the old artifact; **any serving reload makes it visible**. Confirm intended or restore before the launch reload.
3. **SPY half (b)**: pick a UIT expense-ratio source (SPY files no SEC ER) so its fee gap can render.
4. **value_score northstars drift** (new backlog item): 2022 cohort median −80 vs ~−60 band, started with the 07-16 L2 value_score rebuild — re-baseline or investigate.

## Deferred with reason (next session's queue head)

- **Price-quarantine tightening + pricing-store compaction** — both rebuild/rewrite the canonical price basis everything else sits on; doing that mid-night would have stacked a second basis change under the unadjudicated northstars drift. First items once merges + adjudication land.
- **Foreign-holdings classification gap** (systemic, ~1/3 of catalog) — multi-hour reviewed-lane build; wrong thing to half-start at 02:00.

## Process notes

- The data-reviewer lane earned its keep twice: it blocked a plausible-but-wrong dedup rule codex passed, and its conftest finding (worktree tests silently importing another checkout's code) bit me again within the hour — fixed on the fresher-β branch.
- Fence lesson recorded: I inferred concurrent sessions from transcript mtimes + a live `--resume` process and fenced fund_score for the first hour; your "there is no other session" was the correction. Idle-open terminals ≠ working sessions.
- The backstop cron (`e2093cc6`) fired on schedule and no-opped every time — the wakeup chain never died, so the restart path is untested in anger but the heartbeat protocol worked.
