# Beta execution plan — the assembly line to invites

**Created 2026-08-06 (owner-directed). This file is the RANK-ORDERED DRAIN QUEUE for the beta
push.** A dispatcher session works it top-down with `/loop`; each item is executed by its listed
worker loop with its listed model/effort; all code review happens INSIDE the worker loops
(data-reviewer checkpoints + `/check-data` + codex gates, already wired); the owner is interrupted
ONLY per the contract below. Item detail lives in `backlog.md` / `specs/queue/` — this file holds
only rank, routing, and status. Update STATUS in place as items complete; this file is the run's
shared state and heartbeat carrier.

`heartbeat: 2026-08-17T12:09-06:00` ← dispatcher re-stamps from `date` output after every unit of
work (never extrapolate — the night-drain lesson).

---

## ⇢ RE-SCOPED 2026-08-07 (owner decision): the target is a CORRECT LOCAL MVP, not invites

**New objective: the product runs on this laptop with data we believe, and `/funds/[ticker]` shows
the V4 page rather than a preview route.** Deployment is explicitly OFF the near path.

This is a re-scope, not a new plan — it is the same critical path with the deploy tail removed, so
Tracks L and F are unchanged in content and Track D goes on ice. Nothing built in the W/H run is
wasted; it stops being urgent.

**What it changes:**
- **Track D → ICED.** Prod load, solver deploy, invites. With it go owner stops **S4** (Sharadar/
  Tiingo licence) and **S5** (go/no-go), plus the open preview-tier spend (+$10/mo, measured). None
  are needed to look at a correct product locally.
- **Track F ends at F6** (route cutover). That is now the finish line.
- **P2 (`/screener`) gets MORE urgent, not less.** The point of a local MVP is that the owner can
  judge the product. A page in the nav rendering invented analyst prose about 25 made-up funds
  actively corrupts that judgement. Decide it before the F-track critic pass (F5), not after.
- Six BETA BLOCKERs are all "user-visible wrongness" and matter identically for a product being
  assessed as for one strangers see. Unchanged in priority.

**Definition of done for this scope:** L1–L11 closed · F1–F6 closed (V4 live at `/funds/[ticker]`
locally) · the three correctness defects this run found are fixed (effective-positions basis, the
27.2/31.0 top-10 split, active-ETF skill suppression) · `/check-data` green · the F5 critic panel
run and its findings triaged.

## The owner contract (the ONLY interrupts)

The owner sets vision and has already answered every known product question (see register below).
The line stops for the owner at exactly these points — everything else is the line's call:

| # | Stop | When |
|---|------|------|
| ~~S1~~ | ~~Per-panel delta review → local serving reload GO~~ — **SATISFIED 2026-08-07**: reload done 05:44 (5,819 rows, `src_inv_v0_20260731`), campaign merged into fund_score main. Verified on disk, not reported. | — |
| S2 | Receipts display-floor sign-off (0.50 priced-NAV floor + 0.50–0.80 sleeve disclosure) | after receipts Segment-0 EDA confirms the numbers |
| S3 | Product review of the built V4 page (critic-panel results in hand) | before route cutover |
| S4 | Sharadar/Tiingo license confirmation — **DEFERRED with Track D** (no image push on the local-MVP path) | before ANY solver image push to a registry |
| S5 | Batch 4: beta go/no-go + invite list — **DEFERRED with Track D** | blocker bar clear + cutover done + prod loaded |

A worker that hits a **genuine product uncertainty** not covered by the decision register does NOT
stall the loop: it parks the item (STATUS → `parked:owner`, one-paragraph CPO-style brief appended
to § Parked decisions below), and the dispatcher moves to the next READY item. The owner drains
parked decisions in batches, never mid-loop.

## Decision register (answered — never re-ask)

2026-08-06, batches 1–3: beta = FULL experience (pages + screener + X-Ray) · blocker bar =
STRICTER (6 tagged items) · solver: cheapest-of-Fly/Railway, license gate pre-push, compaction
de-scoped, fund-page-cadence freshness + automated as-of deploy gate · receipts BUILT pre-cutover,
sequenced after foreign-holdings · all three V4 extras IN (7 movements) · crescent fill =
current-twin fit · minor R3 design calls settle at build review · rendering stays force-dynamic.
Line defaults (engineering, owner-delegated): screener port defaults to a Postgres-served query
surface (same pattern as profiles) unless the worker's EDA finds a hard blocker; hosting = price
both vendors, pick cheaper, report actual.

## Fences (hard)

- **F1 — lakehouse writes** — **LIFTED 2026-08-07, verified not assumed.** Its condition was "until
  the campaign session closes (S1 + finalize/merge)". Both are facts on disk now: `campaign/
  refresh-2026-07` **is an ancestor of `fund_score` main**, and the local serving DB was **reloaded
  2026-08-07 05:44 → 5,819 fact rows on `src_inv_v0_20260731`** (up from 5,675 on the 2026-07-31
  manifest). The campaign worktree has had no writes for hours, no lakehouse builds are running, no
  fund_score processes are live. **Track L is ARMED.** F2 still binds — one lakehouse-writing session
  at a time, in a dedicated worktree. Original text: until the campaign session closes, NO other
  session writes fund_score data or panels; web work and fund_score *service code on a feature
  branch* (no data writes) are exempt.
- **F2 — one lakehouse-writing session at a time**, in a dedicated worktree, per-item commits,
  owner merges ([[shared-worktree-contamination]] / [[fund-score-worktree-shared-lakehouse]]).
- **F3 — branch-guard**: all commits on run/feature branches; NEVER push web `main` (auto-deploy
  = prod). Owner merges.
- **F4 — serving loads**: local reload = S1-gated; preview/prod loads only from the verified
  staging the local reload used ([[serving-db-ahead-of-branches]]).
  **AMENDED 2026-08-07 (W2 finding, dispatcher-verified — the fence's literal form is not
  implementable today):** `build_serving_facts.py` never reads `serving_facts_staging.parquet` back;
  it re-assembles `fund_profile_facts` in-process from CURRENT gold and COPYs from memory (only
  holdings + attribution are true parquet replays). So a prod load is a REBUILD, not a replay, and
  gold moving between S1 and D1 would silently change what prod serves. Until `--from-staging`
  exists (filed as an Open chore), **F4 is satisfied by the runbook's freeze-and-prove protocol**:
  `shasum` the staging artifact before the load, then diff the re-written staging byte-for-byte
  against the frozen copy — divergence = abort ([[rebuild-twice-proves-determinism]]). This DETECTS
  drift rather than preventing it; that is the honest strength of the guard, and D1 must not
  describe it as a replay.

## The queue (rank order; work top-down; skip BLOCKED, take the next READY)

Legend: STATUS ∈ ready / blocked(<on>) / in-progress / parked:owner / done.
Worker loops: `IN` = /implement-next (routes by track/lane, reads spec model/effort frontmatter);
`FD` = /fundscore-data:fix-data; `FB` = /fundscore-data:fix-bug; `SS` = /spec-story (lean spec).

### Track W — web + service code (READY NOW; exempt from F1)
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| W1 | Beta ops minimum (error tracking + feedback + analytics) — backlog Beta-launch group | SS→IN (lean→**standard**) | opus/med impl, session-model gate | **done** |
| W2 | Preview+prod load RUNBOOK (write only; execution is D1) — backlog Beta-launch group | SS→IN (lean) | opus/med | **done** |
| W3 | Screener beta port (default: Postgres-served; see register) — backlog Beta-launch group | SS→IN (standard) | opus/high | **done** (web `feature/crescent-profile-v2`; fund_score `89044fb` on `w3/query-serving-tables` in worktree `fund_score-wt-w3` — **MERGED, verified 2026-08-17**: `git branch --merged main` lists it, 0 commits ahead, both repos). Uncovered **P2**. |
| W4 | Solver HTTP service — `specs/done/solver-http-service.md` (code/container/web-swap/deploy-gate BUILT; snapshot bake + AC3 → D2) | IN (reviewed) | opus/high impl; gates session-model + codex --high | **done** (web `feature/crescent-profile-v2`; fund_score `6dc6dc7` on `w4/solver-http-service`, worktree `fund_score-wt-w4` — **MERGED, verified 2026-08-17**, both repos) |
| W5 | V4 serving riders spec (skill strip + effective-positions) — backlog Beta-launch group; spec now, build in L after F1 | SS | opus/med | **done** → `specs/queue/v4-serving-riders-skill-strip-effective-positions.md` |
| W6 | Pipeline-state hygiene chore (3 rot spots) — backlog Working set (NOT "Hardening sweep"; corrected 2026-08-07) | FB | sonnet/low | **done** |

### Track H — hardening (ADDED 2026-08-07 by owner decision; all UNBLOCKED, all filed by the W1–W6 run)
Owner chose this over idle-watching when Track W drained. Every item is a real defect found tonight,
none needs an owner input, and each de-risks D1 or the fences this plan depends on. Ordered by that.
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| H1 | **done** (fund_score `1f3d91f` on `feat/h1-serving-ddl-authority` — **MERGED, verified 2026-08-17**; web `00db419`) **Serving-table DDL has 3 disagreeing definitions** — loader COPYs `position_direction`, absent from Drizzle + `schema.sql` + `drizzle/serving_layer_additive.sql`; facts 13 cols short, 4 retired cols present. A fresh prod DB created the obvious way = failed or silently-truncated load. **Directly a D1 trap.** | FB (cross-repo) | opus/high | ready |
| H2 | **done** (harness `c386595` on `fix/commit-hook-target-resolution`; committed over a blocked gate by owner decision — 4 shapes filed) **`branch-guard.sh` fail-open** — resolves the target repo from the FIRST `git -C` anywhere in a compound command; mirror case silently APPROVES a `main` commit. **This is F3's own enforcement.** Audit `codex-commit-gate.sh` for the same shape. | FB | opus/high | ready |
| H3 | **done** (web `f7526c0`) **`npm run build` connects to PROD** — `.env.production.local` outranks `.env.local`, so the mandatory build gate opens prod queries on every machine and its prerender output is misleading everywhere. Careful: Vercel runs the same script, so do not "fix" it by forcing local. | FB | opus/high | ready |
| H4 | **done** (web `8f44bc7`; guard-placement follow-up `359cf1a`) **`/api/ops` has no rate limit** — unauthenticated INSERT path on a public site (the one gate exception). Abuse grows a table; no leak, no compute. Needs a throttle before any ungated launch. | FB | sonnet/med | ready |

### Track C — campaign session (NOT this line's work; listed for sequencing only)
| C1 | Flat-tail detector fix → cascade resume → deltas → **S1** → local reload → finalize/merge | campaign session | — | in-progress (other session) |

### Track L — lakehouse (**ARMED 2026-08-07 — F1 lifted.** Drain in this order; F2 binds: ONE lakehouse session at a time, dedicated worktree)
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| L1 | Foreign-holdings enrichment CORE (BETA BLOCKER; unlocks L8) — backlog Working set item 1 | FD (reviewed, multi-segment) | opus/high impl; Fable-session gates | **done 2026-08-09** — four merges (`bad49ad`,`c000de4`,`0674802`,`bd39539`); ~$40B sector coverage recovered + $50T valUSD fix + determinism + one shared sector basis across all three panels; seg 5 re-filed pending P3; follow-ups: L14 + filed chores |
| L2 | Wrong-price-series collisions sweep (BETA BLOCKER) — Working set | FD | opus/high | **ready** |
| L3 | l2_blend_etfs share-class adjudication (BETA BLOCKER; merged item — sort-key fix FORBIDDEN) | FD | opus/high | **ready** |
| L4 | value_score stale ticker fees ~139 funds (BETA BLOCKER) | FD | opus/high | **ready** |
| L5 | Neighbourhood panel backend — `specs/queue/neighbourhood-panel-backend.md` (unblocks F-movement 03) | IN (reviewed) | opus/high | **done 2026-08-09** (`009b872` merged; coverage 52.91%/83.46% with 0 recoverable-missing; 16 injection-proven invariants; found L15 + the H1-literal drift; web mirror handed off in report §12) |
| L6 | recent-changes-te-ranked — `specs/queue/recent-changes-te-ranked.md` (unblocks F-movement on Recent Changes) | IN (reviewed) | opus/xhigh | **ready** |
| L7 | V-spike price corruption 174 funds (BETA BLOCKER; needs ONE off-cycle L2 re-solve — coordinate with L2/L3 so the re-solve runs ONCE, after all price-touching fixes) | FD | opus/high | **ready** |
| L8 | Taxonomy misroutes / ALT classification (BETA BLOCKER) | FD | opus/high | **ready** |
| L9 | Per-stock receipts backend — `specs/queue/per-stock-receipts-backend.md` (contains **S2**; L1 closed 2026-08-09 → blank its `depends_on:` when dispatched) | IN (reviewed) | opus/high | **ready** (L1 closed) |
| L10 | Riders build — `specs/queue/v4-serving-riders-skill-strip-effective-positions.md`. **RE-RATED 2026-08-07 (W5 grounding): lean/opus-med → reviewed/opus-high.** It is NOT two small additions: effective-positions is ALREADY served and rendered on the WRONG book (`holdings_snapshots` US-ticker basis, not filed `pctVal`) — PRNEX used 57 positions to describe a 127-holding fund, serving 30.5 where the filed book gives 59.8, biased so every fund reads ~2× more concentrated than it is. So L10 is a **correctness fix on a live serving fact**, not a rider, and it must land before F6 cutover. Fold in the top-10 27.2/31.0 split (same root cause, filed as its own bug). | IN (**reviewed**) | **opus/high** | **ready** |
| L11 | Superlative-guard check (top_bet_confident consumer check) — Working set | FB | sonnet/med | **done** (fund_score `06ae57a` on `l11/superlative-guard` — **MERGED, verified 2026-08-17**; 2 deferred advisories → Open chore) |
| L12 | Twin-label/basis-metadata fix (record's passive leg is a PIT twin cascade mislabeled as one current ETF; 204/218 blends) — **REQUIRED BEFORE F6**; backlog item filed 2026-08-07 | FD | opus/high | **ready** |
| L13 | Active-share fail-open: propagate `method`+`lookthrough_resolved_weight` to serving + gate (17 funds at 0.5-vs-empty-benchmark, confidence high) — restores the stat F1 gated closed; NOT cutover-blocking | FD | opus/med | **ready** |
| L14 | **Domicile-routing rule (promoted 2026-08-09 from the Segment-1b follow-up — now FIVE symptoms of one root cause**: 2 unrestored 1c pairs · 15-ISIN/$7.4B split cohort · 481 positioning quarters · S7-4 dual-sector contradiction 20 ISINs/$8.2B **served-on-next-reload** · part of the $3.51B recall chore). **MUST LAND BEFORE THE NEXT SERVING RELOAD** (S7-4 is a same-security contradiction that would reach the product) | FD (reviewed) | opus/high | **ready** (after L1 closes) |
| L15 | **D3: `benchmark_nav.py:146` imputes 0% return for unpriced blend sleeves + serves unrenormalized at >50% coverage** (found 2026-08-09 by L5's coherence gate; reviewer re-sized the TRUE blast radius: **51 of 1,449 neighbourhood-served funds >1bp/day, median max 44bps/day, worst SLMCX 304bps/day** — size the fix on `passive_alt_daily_nav`'s FULL universe, not the 41 both-movements funds; SLMCX's 47.4% SOXX sleeve held flat unrenormalized). **PRE-RELOAD, P1**; F2's flip decides whether affected funds gate movement 03 closed until this lands | FD (reviewed) | opus/high | **done 2026-08-17** (`c159f9a` on `l15/benchmark-nav-renorm` — **MERGED to fund_score main `75980a3`**, owner-authorized 2026-08-17; three adjudication rounds. Round 3 caught a v6 REGRESSION its own check surfaced: terminal truncation anchored two served charts ON fabricated prints, MMTMX serving +60.06% vs a +0.80% baseline with four sibling classes at +0.74–0.78%, sign-flipping the headline verdict in all three periods. Fixed by anchoring on evidence via the existing `LOG_BRIDGE_SUSPECT` — no new threshold. All 6 verification items PASS; determinism byte-identical incl. all 10 hygiene ledgers; both `/check-data` 0 blocking; `method_version` → `v3_2026-08-17`. Codex: 2×P1 + 1×P2 fixed, clean pass. Follow-ups filed: thread (c) 32-ticker liquidation class, SPAX run-selection, W3 quarantine-vs-score, ratchet slack 584 vs 563, td-cache absent) |

### Track F — V4 frontend (**the reload S1 gated has HAPPENED — 2026-08-07 05:44.** Movement-by-movement, then cutover = the new finish line)
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| F1 | Movements 00/01/02/05/06(partial) — served-after-reload fields; flip protocol per movement (5 conditions incl. methodology anchor + critic pass) — `specs/queue/profile-v2-production-cutover.md` | IN (reviewed, frontend) | opus/xhigh impl; sonnet craft critics; session-model data critics | **done** (web `6190a96` on `f1/v4-movements-00-06` — **MERGED, verified 2026-08-17**) |
| F2 | Movement 03 (neighbourhood) | IN | opus/high | blocked(web mirror per L5 §12 handoff + local serving reload, which is fenced behind L14+L15) |
| F3 | Recent Changes section flip | IN | opus/high | blocked(L6) |
| F4 | Movement 04 receipts + 01 twin-diff card | IN | opus/high | blocked(L9) |
| F5 | Full-page critic panel `/critique-funds` → fix round → **S3** | critique pipeline | per-agent pins | blocked(F1-F4) |
| F6 | Route cutover (per spec §Final route cutover; force-dynamic stays) | IN | opus/xhigh | blocked(S3) |
| F7 | Screener rebuild on `fund_profile_facts` (owner 2026-08-08, P2 answered: BUILD for the demo) — backlog story; spec must settle overlap with `exposure-screener` + tier columns | SS→IN (standard) | opus/high | **ready** (spec first) |

### Track D — deploy + beta — **ICED 2026-08-07 (owner re-scope).** Not on the local-MVP path. Everything here keeps its blockers AND is deliberately not worked; S4/S5 and the preview-tier spend go with it. Un-ice when the target changes back to invites.
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| D1 | **P1-prod ANSWERED 2026-08-07 (paid tier approved) → now blocked on S1 only.** **⚠ SECURITY PREREQ (H1, 2026-08-07): the serving tables grant `anon` full CRUD+TRUNCATE and two have RLS OFF — D1 MUST apply the fixed `apply_serving_schema.py`, and MUST keep it ordered BEFORE `apply_auth_schema.py` (which used to re-open it). Verify with `npm run db:check-serving` after each target.** Execute preview+prod serving loads — **follow `docs/RUNBOOK-serving-load.md` (W2, 2026-08-07)**; prod stays owner-gated. **SCOPE IS WIDER THAN THE ORIGINAL FOUR TABLES** (W2 finding): `apply_auth_schema.py` is MANDATORY — `resolveSession()` SELECTs `entitlements` on every signed-in render, so a missing table 500s every page for a beta user — and `apply-lens-schema.mjs` is mandatory for the live `/api/lens/quota` route. Plus W1's ops step: `node scripts/apply-ops-schema.mjs` on prod `henxcsknsjfadetomjeu` AND preview `yqyyvhcrmcwarxweusbw`, else the beta records nothing. F4 is met via the freeze-and-prove protocol, NOT a replay (see amended F4). Blocked additionally on **P1** (Supabase paid tier). | FD-style gated run | opus/high | blocked(S1) — P1-prod cleared |
| D2 | Solver snapshot bake + AC1-5 acceptance on preview; **S4** before image push | IN (continuation of W4) | opus/high | blocked(W4,D1) |
| D3 | **S5** go/no-go + invites (grant via scripts/grant-early-access.mjs) | owner | — | blocked(all blockers, F6, D1, D2) |

## ⇢ START HERE — fresh dispatcher session (written 2026-08-07 for the local-MVP re-scope)

**Run the dispatcher on FABLE at effort `high`.** Not a preference — the tiering rule is
*reviewer ≥ implementer*, and the gates (`data-reviewer`, `data-quality-critic`, the final data
gate) inherit the SESSION model while implementers are pinned to opus in spec frontmatter. Track L
is nothing but reviewed-lane data work, so a session below Fable inverts the rule on every item.
The W/H run was dispatched on Opus 5, i.e. reviewer == implementer — it held, but it is the weaker
margin and Track L is where it would actually cost something. Per-item effort is already set in the
queue rows and in spec frontmatter (L6 is xhigh, most are high); the session level only needs to
carry dispatch judgement and the adversarial read of worker reports, for which `high` is right.

**First item is L1** (foreign-holdings enrichment). It is the only blocker that UNLOCKS another —
L9 (per-stock receipts, V4's most persuasive section) is explicitly sequenced behind it, because
building receipts first means building them twice for exactly the foreign-heavy funds where the
proof matters most. It is also the largest, so starting it first surfaces bad news early.

**Two permission rules worth adding before you start** — both were denied mid-run last time and
each cost real capability: `ScheduleWakeup` (without it the loop cannot self-pace; it survives on
task notifications only) and `git merge` (granted verbally last run, but a settings rule makes it
durable). Neither is required; both remove friction.

**Serialize, do not parallelize.** Every item lands uncommitted in a shared working tree and the
codex gate reviews `--uncommitted`, so two concurrent workers entangle each other's diff at the
gate. The one exception is items in genuinely separate repos. F2 binds harder for Track L: ONE
lakehouse-writing session at a time, in a dedicated worktree.

## Run protocol (dispatcher mechanics)

- **Start/resume**: `/loop` with the standing prompt: *"Work feature-pipeline/beta-execution-plan.md
  top-down: take the highest-ranked READY item, dispatch it to its listed worker loop with its
  listed model/effort, update STATUS + heartbeat + a one-line outcome in § Run log, then continue.
  Respect the fences and the owner contract. Park product uncertainties; never stall."* Self-paced
  (ScheduleWakeup); long externally-tracked waits use 1200s+ fallbacks.
- **Usage-limit resilience** (night-drain v2): at run start register the backstop cron
  (`11,41 * * * *`) that reads this file's `heartbeat:`; <50 min old → no-op; stale → verify the
  run is actually dead (agent-transcript mtimes, [[verify-run-dead-before-resuming]]) → resume
  in-flight workers via SendMessage (NEVER relaunch — context survives), re-arm the loop. Limits
  kill in-flight agents: workers write outputs/files EARLY and iterate
  ([[interruption-resilient-agent-runs]]). Long lakehouse builds run as `nohup … & disown`
  background Bash with full log redirection, owned by the session not a subagent
  ([[own-long-llm-extraction-runs]]).
- **Context hygiene**: the dispatcher stays THIN — it reads this file, launches ONE worker per
  item, records structured outcomes only (no file dumps in the dispatcher context). Workers carry
  the heavy context and die when done. One item per worker, always.
- **Gates (inside every worker, non-negotiable)**: data-reviewer checkpoints per the lane;
  `/check-data` after any feature rebuild (FAIL blocks); `make check` for fund_score; codex
  iterate-at-medium, ONE `--high` pass gates each commit; build gate `npm run build && npm run
  lint` for web. Reviewer ≥ implementer always (gates run on the session model — run the
  dispatcher on Fable; if the session is ever weaker than opus, drop implementers to the session
  model rather than inverting).
- **Commits**: per-item, on the run/feature branch for that repo; owner merges. fund_score work
  waits for the campaign branch to merge, then uses a fresh worktree + branch off main.
- **Backlog bookkeeping**: when an item ships, flip it in backlog.md AND relocate the block to
  Done/archive per [[backlog-hygiene-loops-must-archive]]; after S1's reload, run the archive
  sweep for the ~8 reload-resolved items.

## Parked decisions (owner drains in batches)

### P1 — Supabase paid tier — **PROD ANSWERED 2026-08-07: YES. Preview still open.**
**OWNER ANSWER (2026-08-07): "I'm good with a paid supabase tier in prod."** So the prod half of
option (a) is approved and **D1's prod load is no longer blocked on spend** — it remains blocked on
S1 (the campaign delta review + local reload GO), which is the only thing left in front of it.
**Deliberately NOT assumed to extend to preview**, because the brief priced them as one decision and
the answer named prod only. The preview question is live and small: the beta data does not fit
preview's free tier either, and **the solver service's end-to-end acceptance (AC3, item D2) runs
against preview** — that is the whole reason preview was in scope. Three ways to go: pay for preview
too (AC3 tests production-shaped data, which is what it is for); load preview with a sampled subset
(cheaper, but AC3 then passes against data that is not production-shaped, which is most of what AC3
buys you); or skip preview and run AC3 against prod after the load (no second bill, but it means
first-exercising the solver against the real thing). **Recommendation: pay for preview too** — it is
the only option that keeps the solver's acceptance evidence meaningful, and the solver is the
X-Ray, which is a third of the beta. Not blocking anything today: D2 sits behind D1 and S4 regardless.
(Original brief below, kept for the reasoning.)
**Parked 2026-08-07 by the W2 runbook worker; dispatcher concurs it is yours, not the line's.**
The beta's serving data does not fit the Supabase free tier: `fund_holdings_full` alone is ~1.4M
rows, and it has to land in BOTH prod (`henxcsknsjfadetomjeu`) and preview
(`yqyyvhcrmcwarxweusbw`) — preview because the solver service's end-to-end acceptance (AC3, item
D2) runs there. The same decision covers rollback: the runbook's only real restore path for a
FAILED reload is Supabase point-in-time recovery, also paid. First prod load is safe without it
(the target is empty and the load is one atomic transaction, so a failure rolls back to nothing);
the exposure starts at the SECOND load, when a bad load could leave prod worse than before.
**Options:** (a) upgrade both projects to Pro before D1 — simplest, unblocks D1 and D2 together,
recurring cost per project; (b) upgrade prod only and shrink preview to a sampled subset — cheaper,
but then AC3 passes against data that isn't production-shaped, which is most of what AC3 is for;
(c) stay free and cut the beta's holdings depth to fit — a product downgrade, and it contradicts
the FULL-experience beta decision. **Recommendation: (a).** It is the only option that doesn't
either weaken the solver's acceptance evidence or shrink the beta experience you already chose,
and the cost is small next to the campaign work it gates. This is a money question, so the line
will not decide it. Everything else in D1 is ready to run the moment S1 lands and this is answered.

### P2 — ANSWERED 2026-08-08: BUILD the screener for the demo (owner rejected the remove-the-link recommendation). Filed as a backlog story (rebuild on `fund_profile_facts` around the Value Score verdict; spec relationship to `exposure-screener` + tier columns settled at spec time; owner: "we can flesh after this"). Queued as F7 below.
### ~~P2~~ — original brief (kept for the reasoning) — `/screener` is still the pre-pivot demo page, and it is in the beta nav (blocks a full-experience beta)
**Parked 2026-08-07 by the W3 screener-port worker.** The port itself is done, but it uncovered that
the story's premise about `/screener` was wrong: that page never read the analysis files. It reads
the legacy `funds` table — **25 rows of demo seed data** with invented multi-paragraph analyst notes
("FCNTX earns a FundScore of 78, placing it in the **Strong Buy** tier"), invented NAV/AUM/manager
figures, and the retired FundScore/Strong-Buy model the product deliberately replaced with the Value
Score. No serving load populates that table, so on preview and prod the page is simply **empty** —
behind a "Screener" link in the header that every invited user can see. Locally, or on any database
that was ever seeded, it shows the fabricated version instead. Fixing it is a product decision, not a
port: **(a)** rebuild `/screener` on `fund_profile_facts` around the Value Score verdict — real, on
brand, but it is a page design and it overlaps the queued `exposure-screener` spec (which wants
exposure, not fees/returns, to be the primary screen key), so it is a genuine build, not a patch;
**(b)** remove `/screener` from the header for the beta and let `/search` + the published `/q`
questions carry the browse experience — cheap, honest, but the FULL-experience beta ships without a
screener; **(c)** ship it as-is — not viable, it either fabricates or is blank.
**Recommendation: (b) now, (a) as the first post-beta build.** The beta's differentiator is the fund
page and the X-Ray; a generic fee/return screener adds little and a fabricated one costs credibility
with exactly the people whose opinion you are buying with the invite. Retiring the link also lets the
legacy `funds` table go — `/screener` is its only consumer.

### P3 — What should per-sector "confidence" MEAN on the X-Ray? (filed 2026-08-07 by the L1 worker; NOT blocking — L1 segments 1–4 proceed regardless)
The current label answers *"how much of this fund's book did we identify?"* — and it is applied
fund-wide, so one unclassified sleeve downgrades every sector row of the fund (interim by design).
L1 will make it per-sector either way. The open call is whether the per-sector version should
instead answer *"how much do we trust THIS row?"* — comparing the sector's tilt against the fund's
unclassified slack (the `credible_tilt` machinery already computes this): a 17.5pp tech underweight
with 18pp unidentified is genuinely untrustworthy, while the same fund's 0.3pp energy row is fine.
Trade-off: the trust framing is more honest per row, but some funds whose pages read "high
confidence" today will show visible downgrades on their big tilts. Worker + dispatcher
recommendation: adopt the trust semantics AND serialize the raw per-sector bound to serving, so the
web gate's threshold can be re-tuned without a backend rebuild.

### P4 — ANSWERED 2026-08-08 (owner delegated: "figure it out"). Line decision: the `nav_series` PAID gate is the deliberate tier contract, so the family table's per-fund `value_bps_3y` column gates to PAID on both surfaces (v4 M05Family + v2 FundFamily donor); family AGGREGATES stay free only if they can't reconstruct a single fund's figure. Being implemented on the f1 branch pre-merge; golden gating script updated to assert the new contract.
### ~~P4~~ — original brief — Free-tier family table shows the paid 3Y β-adj figure (filed 2026-08-07 by the F1 critic; small, not blocking)
The fund-family section is free-tier by design (v2 donor behavior carried into V4), and its table
renders `value_bps_3y` per family fund — numerically the same figure the paid tier sells as the 3Y
β-adjusted period result (PRNEX −466). Sharper framing after the F1 fix-round: this is a genuine
CONTRADICTION between two shipped contracts — `fund_family_panel` serves the 3Y β-adj excess at
FREE while `nav_series` gates the identical statistic at PAID; one of the two gates is wrong.
Options: keep family free (a taste of the product across the family) and accept that a reader can
find any fund's 3Y figure via its family table, or gate the family column to paid. Behavior
unchanged pending your call; the F1 progress file's leak-check claim was corrected to disclose it.

## Run log
<!-- newest entries appended at the end of this section -->

- 2026-08-06 20:30 — plan created; W1–W6 READY; C1 with campaign session; all L blocked on F1.
- 2026-08-06 23:42 — drain run STARTED (dispatcher session, Opus 5 / high). Backstop cron `11,41 * * * *`
  registered (job 21ba85aa, session-only). W1 dispatched to a SS→IN lean worker on
  branch `feature/crescent-profile-v2`; codex gate + commit stay with the dispatcher
  ([[workflow-finalize-cannot-await-codex]]).
- 2026-08-07 00:20 — **W1 DONE.** Beta ops minimum shipped first-party (no vendor, no secret, no new
  dep): `onRequestError`+2 boundaries → `ops_error_events`; chrome `FeedbackWidget` → `ops_feedback`;
  root-layout beacon → `/api/ops` → `ops_pageviews`; `scripts/ops-report.mjs` readout. Lane
  reclassified lean→standard (15 files, 3 tables). Gates: build pass (`/` still Static), lint pass,
  codex --high PASS ×2. Codex's 2 P2s were FIXED not waived (>4KB error reports were 413'd before
  recording; feedback widget accepted one submission per page load) + dispatcher hardened the
  same-origin fallthrough on the public write path. Residual `/api/ops` rate-limit gap filed as an
  Open chore — NOT a beta blocker (abuse grows a table; no leak, no compute). **Owner action lands in
  D1: `apply-ops-schema.mjs` on prod+preview.** Backlog reconciled, Done trimmed to 3, overflow
  archived. Next: W2.
- 2026-08-07 00:36 — **W2 DONE.** `docs/RUNBOOK-serving-load.md` (695 lines, 11 sections) + DEPLOYMENT
  §4.4 pointer. Docs-only → codex skipped per implement-next §6 (`git diff --check` clean); dispatcher
  spot-verified the three highest-risk claims against real source rather than trusting the inventory,
  since D1 runs this against PROD: `build_serving_facts.py` flags exact (no `--as-of`),
  `position_direction` COPYed but absent from Drizzle, `STAGING` never read back. All three hold.
  Backlog story stays OPEN (only the runbook half shipped; loads are D1). Filed 3 new items: serving
  DDL 3-way drift (bug), `--from-staging` gap (chore), ops-gaps batch G2/G3/G5/G6/G7/G8 (chore).
  **F4 AMENDED** — its literal form is unimplementable; D1 satisfies it by freeze-and-prove, not
  replay. **D1 scope widened**: `apply_auth_schema.py` + `apply-lens-schema.mjs` are mandatory (a
  missing `entitlements` table 500s every signed-in page) — they were absent from the story's
  four-table framing. **P1 PARKED for owner** (Supabase paid tier — a spend call, blocks D1). Next: W3.
- 2026-08-07 00:56 — **W3 DONE (pending codex + commit).** Screener beta port: owner's Postgres default
  held, **no hard blocker**. Up-front EDA: the whole query surface is **155 rows / 30 columns**
  (catalog 15×13, results 140×17 = 14 slugs × 10 + 1 refusal slug with 0) — so DuckDB, R2/httpfs and
  the MotherDuck "v1" plan were retired outright, not ported, and `@duckdb/node-api` (native binary)
  left the bundle. **Coverage identical to the DuckDB path**: 15/15 catalog, 140/140 results, 14/14
  slugs, 110/110 verdicts, 0 orphans — no honest- or recoverable-missing remainder. Two new serving
  tables (`query_canonical_catalog`, `query_canonical_results`), DDL in `apply_serving_schema.py`,
  TRUNCATE+COPY inside the SAME transaction as `fund_profile_facts` plus a standalone
  `load_query_serving.py`. `screener.ts` rewritten over Drizzle with an UNCHANGED exported API, so
  `/q/[slug]`, `/search` and `/lens/[lens_slug]` needed no edits. **One deliberate change:** the value
  verdict now LEFT JOINs `fund_profile_facts` instead of the stale `screener_funds.parquet` — the two
  had drifted, so the screener and a fund's own page could contradict each other; 13 of 140 rendered
  rows change and the contradiction is now impossible. Gates: parity script PASS (0 failures, every
  transported column equal to the DuckDB read), lint pass, build pass, `/q/[slug]` still **● SSG with
  all 14 prerendered paths** against a loaded DB, live `next start` smoke green. Verified against the
  LOCAL db only; F1/F4 respected (no panel emit, no reload of the four existing tables). **D1 riders:**
  `apply_serving_schema.py` must run from a LAKE containing this change (else the load fails on the
  new tables); no extra load command; **redeploy after the load** or `/q/` ships 0 prerendered slugs;
  delete `QUERY_PARQUET_DIR` from Vercel. **NEW BETA BLOCKER FOUND + PARKED (P2):** `/screener` never
  read parquet — it renders the legacy 25-row synthetic `funds` table (fabricated analyst notes +
  retired Strong-Buy model) and is EMPTY on prod, behind a header link. Product call, filed as an Open
  bug and parked for the owner. Next: W4.
- 2026-08-07 01:05 — **W3 DONE.** Canonical query surface ported DuckDB→Postgres. Whole surface is
  155 rows / 30 cols, so DuckDB was RETIRED rather than ported (native `@duckdb/node-api` out of the
  bundle); R2/MotherDuck plans dropped. Parity exact: 15/15 catalog + 140/140 result rows equal the
  DuckDB read, 110/110 verdicts, 0 orphans, no coverage shortfall. `/q/[slug]` still SSG ×14.
  New tables `query_canonical_catalog` + `query_canonical_results`, TRUNCATE+COPY inside the SAME
  transaction as `fund_profile_facts` (so the verdict join can't read a half-swapped table). Local DB
  only — F1 and F4 both intact, nothing near preview/prod. Gates: lint pass, build pass, **codex
  --high PASS on BOTH repos, 0 findings each**. Dispatcher independently verified the one behavioural
  change: the value verdict now LEFT JOINs `fund_profile_facts` (the row the fund page renders)
  instead of a 2026-07-11 parquet the two had drifted from — 13 of 140 rendered rows change, which
  FIXES screener-vs-profile disagreement the old code's own comment called impossible; "verdict free,
  precision paid" preserved. **P2 PARKED** (`/screener` is pre-pivot demo data in the beta nav —
  dispatcher independently confirmed `getFundSummaries()` → legacy `funds` table). Also filed: a
  CONFIRMED fail-open in `branch-guard.sh` (resolves the target repo from the first `git -C` anywhere
  in a compound command; the mirror case silently approves a `main` commit). Next: W4.
- 2026-08-07 03:24 — **W4 DONE (code half; D2 carries the deploy half).** Solver HTTP service built
  across both repos: authenticated `POST /solve` + `/healthz` + `/manifest`, snapshot builder,
  container, automated as-of coherence deploy gate, and the `spawn()`→`fetch()` bridge swap behind an
  UNCHANGED `SolveResponse` union. **AC1 parity 17/17 deep-equal** incl. deterministic run-id hashes;
  boot verification 4/4. **Hosting: Fly $11.83/mo vs Railway $20.01/mo → Fly**, sized from a MEASURED
  767 MB peak RSS; nothing provisioned. **S4 respected — no image pushed anywhere.** F1 intact (scratch
  overlays only). Gates: ruff clean, check registry pass, web lint+build pass, **codex --high PASS both
  repos**, and the reviewed-lane checkpoint ran as an adversarial `data-reviewer`: **FAIL → fix → PASS
  on re-review**. That review was the value of the whole item — it broke the price-coherence gate twice
  (a 90-day-stale panel PASSED the first design; the second was defeated by an aggregate union grid
  masking a per-series regression, because 79/180 universe ETFs are gap-filled from the fund panel) and
  caught a FALSE claim in the implementer's own report (`price_lag_days` documented on `/healthz`,
  absent in fact). Shipped bound is per-series against `max(n_obs)` the lakehouse already records — no
  invented constant; fund side widened 5 probes → all 4,397 fit-panel funds at a MEASURED 3.5 s cost.
  Dispatcher separately confirmed `npm run build` reads the PROD database (filed). Residuals filed, not
  buried: aggregate-vs-per-series in the deploy gate, 53 unchecked never-candidate ETFs, X-Ray
  two-cadence label, SPY ETF-fallback blowing both timeout budgets. Next: W5.
- 2026-08-07 03:40 — **W5 DONE** → `specs/queue/v4-serving-riders-skill-strip-effective-positions.md`.
  The story's "two small serving additions, lean lane" framing **did not survive grounding**, and that
  is the item's value. (1) Effective-positions is NOT an addition — it is ALREADY served and rendered,
  on the WRONG book: `diversification_panel.eff_n_raw` off `holdings_snapshots.weight` (US-ticker,
  equity-renormalised) instead of the filed `pctVal` basis the standing owner decision mandates.
  Measured on PRNEX: **57 positions used to describe a fund that files 127 → 30.5 served vs 59.8
  filed**, biased so every fund reads ~2x more concentrated than it is. Coverage 44.9% -> 93.4%.
  L10 **RE-RATED lean/med -> reviewed/high** accordingly: it is a correctness fix on a live serving
  fact and must land before F6 cutover. (2) The strip's denominator changes the page's own sentence —
  the mockup's "53% sit below" only reproduces off the raw 8,150-row panel, 61% of which is funds we
  don't serve; over the 2,714 a reader can look up it is **34.1%**. Worker took the served population
  (a denominator you can't navigate to isn't checkable) and superseded the mockup copy. Rider A
  coverage 46.6% served / 66.3% active, remainder honest-missing. Two adjacent defects filed, not
  absorbed: top-10 concentration serves **27.2% vs 31.0% on the same claimed basis** (and the cutover
  spec names the understated one), and `fact_assembler.py:2574` folds `is_etf` into `is_passive` so
  **461 served ACTIVE funds lose their manager-skill read** — the section that most applies to them.
  **Queue depth is now 12 specs — past the drain threshold; do not spec more before F1 lifts.** Next: W6.
- 2026-08-07 03:46 — **W6 DONE. TRACK W IS FULLY DRAINED (W1–W6).** Docs-only, codex skipped per
  implement-next §6 (`git diff --check` clean). The worker **refuted the backlog's own guess** rather
  than following it: the broken `source_proposal: proposals/approved/homepage-promise.md` never
  existed — and neither does the suggested replacement `docs/product/page_specs/home.md` (no such
  directory, no git history). Retargeting would have manufactured a confident false provenance. It
  established the real one from evidence instead (all three specs authored in ONE commit `ea98533`
  alongside the homepage rewrite; one quotes live copy at `src/app/page.tsx:343`) and recorded that.
  PRD marked RESOLVED only after verifying both derived specs really shipped. A 4th rot spot it found
  in passing (`specs/done/fee-peer-band-web.md` still `status: queued`) fixed inline by the dispatcher.
  **THE LINE NOW STOPS — everything remaining is gated on the owner or the campaign session:**
  Track L on F1 (campaign holds the lakehouse), Track F on S1, D1 on S1+**P1**, D2 on **S4**, D3 on S5.
  **Owner queue: P1 (Supabase paid tier — blocks D1) and P2 (`/screener` demo data in the beta nav).**
  Four branches await owner merge: web `feature/crescent-profile-v2` (dfcb513, 49a3e21, 8aa108b,
  c57ed1c, b8006ea + this) · fund_score `w3/query-serving-tables` (89044fb) · `w4/solver-http-service`
  (6dc6dc7, 93a3681). Spec queue is 12 deep — drain, don't add.
- 2026-08-07 04:06 — **Loop re-armed by owner; nothing had unblocked** (P1/P2 still unanswered;
  campaign still at `9378de7` with no writes in 60 min; fund_score main still `5973f0c`). Took the one
  remaining in-scope unit: **corrected the CUTOVER SPEC itself**, which W5 proved carries two false
  claims Track F would have built from. (1) §06 said effective-positions is "not served — omit"; it IS
  served and rendered, on the wrong book (30.5 vs 59.8 filed on PRNEX) — spec now says do not omit AND
  do not render the current value; L10 must land first. (2) §06's top-10 cell was sourced from
  `Σ holdings.top_holdings[].weight` = 27.2%, the teaser book that drops untickered/private/preferred
  lines, vs the filed 31.0% — repointed to the same frame as effective-positions. (3) The batch-3(iii)
  decision framing is annotated as having rested on a false premise (owner's "all three IN" answer
  stands; only its framing was wrong). Docs-only, codex skipped, `git diff --check` clean.
  **The line is now genuinely idle: no queue item can advance without S1 (campaign+owner), P1, or S4.**
- 2026-08-07 12:02 — **TRACK H DRAINED (H1–H4 + a follow-up).** H1 `1f3d91f`/`00db419` · H2 `c386595`
  (harness) · H3 `f7526c0` · H4 `8f44bc7` · guard-placement fix `359cf1a`. Biggest find of the track
  was NOT the filed defect: H1's DDL audit turned up that the serving tables grant `anon` full
  CRUD+TRUNCATE with RLS OFF on two of them — **filed BETA BLOCKER, fixed, and it is a D1 prerequisite**
  (dispatcher re-verified against the live local DB; not a live breach only because those tables exist
  on no deployed database yet). **One incident, disclosed:** the H4 worker ran `npx next start`,
  bypassing H3's wrapper, and sent ~290 requests at PROD; zero rows persisted (auth failed AND prod has
  no ops tables) — root cause was H3's guard sitting on the npm script, now moved to `next.config.ts`.
  **The pattern that bit three times today: a guard on the convenience wrapper only guards the
  convenience wrapper** (drizzle-kit push → drizzle.config.ts; the commit hooks' cheap pre-filter that
  could `exit 0` before the parser; next build → next.config.ts). **P1-prod ANSWERED** (paid tier) →
  D1 now blocked on S1 alone. Owner queue: preview tier (+$10/mo, measured), P2, web-merge go/no-go,
  and a `git merge` permission rule (merges are classifier-blocked for this session).
- 2026-08-07 13:29 — **RE-SCOPED to a correct LOCAL MVP (owner decision); no execution this session.**
  **F1 LIFTED — verified on disk, not reported:** `campaign/refresh-2026-07` is an ancestor of
  fund_score main, and the local serving DB was reloaded **05:44 → 5,819 rows on
  `src_inv_v0_20260731`** (from 5,675); campaign worktree idle, no lakehouse builds, no live
  processes. So **S1 is satisfied in fact** and **all of Track L is ARMED** — 11 items including all
  six BETA BLOCKERs. Track F's reload dependency is likewise met. **Track D ICED** (prod load, solver
  deploy, invites) and with it S4, S5 and the preview-tier spend. **New finish line: F6, the route
  cutover — V4 live at `/funds/[ticker]` locally.** P2 (`/screener` demo data) moves UP: it corrupts
  the owner's own product judgement, which is the entire point of this scope. All five branches from
  the W/H run are MERGED (fund_score main `53537b2`, harness master `c386595`, web main `93de547`
  — web NOT pushed; pushing is what deploys). Next session: see § START HERE — Fable/high, begin L1.
- 2026-08-07 13:40 — **DRAIN RUN RESUMED (dispatcher on Fable/high per § START HERE).** Permission
  rules added first (`ScheduleWakeup` allow + `git merge` ask→allow in settings.local.json). Backstop
  cron re-registered (`11,41 * * * *`, job f5d940e7, session-only). F2 preconditions re-verified on
  disk: fund_score main `53537b2` clean, campaign worktree idle at `9378de7`, zero running pipeline
  processes. **L1 DISPATCHED**: dedicated worktree `fund_score-wt-l1` on branch
  `l1/foreign-holdings-enrichment` off main, `data/` symlinked to the shared lakehouse (only
  lakehouse-writing session). Worker = opus/high claude agent driving the FD loop segment-by-segment;
  data-reviewer checkpoints + codex gate + commit stay with the Fable dispatcher. Segment 0 =
  re-measure the four residuals against the CURRENT lakehouse (post-CORE, post-reload numbers, not
  the 2026-07-17 re-grounding), then propose the segment plan.
- 2026-08-07 13:55 — **L1 Segment 0 DONE (EDA, no writes; verified clean tree + untouched lakehouse
  mtimes).** Headline: fund-side sector coverage is **99.36% of USD** (the 2026-07-17 core number
  reproduces post-refresh); the residual **$472.7B decomposes into 5 defects + 2 honest gaps**, and
  the largest single recoverable is OUR OWN spine predicate — `_extract_unique_isins` only harvests
  ISINs from `cusip=='000000000'` rows, proven exhaustively (all 1,707 ISINs in the $25.1B
  FMP-has-it bucket excluded, zero exceptions). ~$133B measured recoverable across 4 build segments
  (spine +$25.1B → vote tie-break +$63.2B → wrapper adjudication ≤$38B → name/LEI crosswalk
  +$45B), **Gulf $41.7B proven HONEST** (159/175 ISINs absent from the raw FMP universe; N-PORT
  files no sector field), per-sector-confidence defect confirmed (all 3,540 served series carry ONE
  fund-wide label), and the web-gate field does not reach serving today (fact_assembler drops the
  per-row bounds). Also surfaced: a frozen FMP snapshot time-bomb (single 2026-07-15 profile
  snapshot, no rebuild target) and two sibling panels still on the US-only classify path. **P3
  parked** (confidence semantics — trust-the-row vs identified-the-fund). Fable data-reviewer
  checkpoint on the EDA is RUNNING; Segment 1 (spine fix) authorized only on its pass.
- 2026-08-07 14:11 — **L1 Segment-0 checkpoint: PASS (Fable data-reviewer), 0 blocking / 5
  warnings.** Reviewer reproduced every load-bearing claim (most bit-for-bit) and STRENGTHENED the
  root-cause proof: the 1,707 never-harvested ISINs appear on `cusip=='000000000'` rows exactly 0
  times across ALL 147.9M raw N-PORT rows. Corrections bounced to the worker (its context) per
  fix-round economics: C1 tie bucket is 139 ISINs/$63.1B under the code's actual tie definition
  (EDA's predicate mis-stated it; bucket rows over-summed by 69), Gulf spine-recoverable is 5 not
  16 ISINs, Segment-4 delta re-bounded ~$38–45B pending a written normalization spec, +$1.58B
  US-filed rows noted on the 148-split. **Segment 1 (ISIN spine harvest fix) AUTHORIZED** with
  strict scope: no new adjudication logic, rebuild through exposure-xray gold ONLY (no
  build-serving-facts, no Postgres), pre-state snapshotted for per-series regression diffs,
  /check-data + make check + provenance spot-checks mandatory before its checkpoint.
- 2026-08-07 14:56 — **F1 DISPATCHED in parallel (separate-repos exception; L1 verified ALIVE
  first** — segment-1 report + make-check logs written 14:50, transcript fresh 14:53). F2 blocks
  L5/L6 (one lakehouse session), so the highest READY item that can run is F1. Dedicated web
  worktree `fundscore-web-wt-f1` on `f1/v4-movements-00-06` off main (node_modules symlinked,
  .env.local copied — worker must verify the build resolves LOCAL, not prod). Worker = opus claude
  agent; movements 00→01→02→05→06-partial per the spec's 5-condition flip protocol, conditions 1–4
  self-served, condition-5 data-quality-critic runs dispatcher-side in pipeline off its per-movement
  reports; L10-tainted fields (eff-positions 30.5-vs-59.8, top-10 27.2-vs-31.0) explicitly gated
  closed, never rendered. Cutover, mvmt 03, Recent Changes, receipts all fenced OUT (F6/L5/L6/L9).
- 2026-08-07 15:09 — **L1 Segment 1 BUILT + swept; sweep surfaced a BLOCKING pre-existing defect.**
  Spine fix in (`cusip_mapping.py` + tests, uncommitted): row coverage 97.10%→97.61% on clean
  series, zero wrong-company binds (22/22 + 13/13 end-to-end), passive_blend + isin_reference
  strictly additive, X-Ray 97 up / 0 down. BUT `/check-data` caught **B1: `lookthrough()` carries
  `valUSD` UNSCALED** (`build_holdings_complete.py:177-197`) — 407 series serve $50.58T vs $1.56T
  filed; **68.4% of panel USD fabricated**; byte-identical in PRE (pre-existing, not introduced).
  Worker also self-retracted an unverified Telefónica provenance claim (instance of B1) and
  isolated **identity nondeterminism**: `.first()` over unordered group_by re-binds 12 rows/$13.13B
  to different companies between identical-code builds. Worker recommends: keep the spine code,
  BLOCK the artifact from serving until B1 is fixed. Fable data-reviewer checkpoint RUNNING with a
  priority question: does fabricated valUSD reach any SERVED column F1 is flipping onto right now?
  Segments 2–4 hold pending the verdict; B1 + nondeterminism to be filed as blocking sub-items.
- 2026-08-07 15:30 — **Segment-1 checkpoint: PASS (Fable reviewer). B1 + nondeterminism both
  CONFIRMED pre-existing — and the priority question answered: ZERO served fields derive from
  `holdings_complete.valUSD`** (top_holdings ← holdings_snapshots; fund_holdings_full ← raw N-PORT,
  Telefónica served at its filed $10,340.47; aum ← fund_metadata; attribution has no USD columns) —
  **the 05:44 serving load and the in-flight F1 worker are SAFE.** Reviewer sharpened both defects:
  B1 has a second copy (`lookthrough_window._regroup`), nondeterminism a second mechanism
  (`any_value()` in _PULL_SQL) + a root aggravator (junk cusip `999999999`→BAPG0TF0 collapsing 13
  companies/$13.5B into one slot), the C2 coherence gate is DEGENERATE for this class (why it
  stayed green), and $11.06B of contamination hides below the series-level cut — row metric
  (+0.5062pp) is the only sound Segment-1 headline until B1 lands. Both defects FILED in backlog
  Working set with owner summaries. **Segment 1b AUTHORIZED** (same worker): fix both B1 sites +
  both nondeterminism mechanisms + sentinel purge, ship a non-degenerate row-identity gate that
  provably FAILS pre-fix / PASSES post-fix, rebuild-twice determinism proof, full re-sweep; still
  no serving/Postgres. Codex gate + commit deferred to after 1b's checkpoint (segments 1+1b gate
  as one diff).
- 2026-08-07 15:32 — **F1 movements ALL BUILT (conditions 1–4): 00/01/02/05/06-partial flipped to
  served on `/preview/funds/[ticker]`**, build+lint+tsc+golden-gating green against the LOCAL db,
  zero fixtures, applyGates owns every read, tier matrix leak-free; mixed-basis check passes on
  manifest 55 (twin refit predates every dependent panel, so mvmt 02 serves REAL attribution). Two
  pre-ship bugs fixed (empty-bold bet name; raw `passive_fund` code as prose on 1,728 funds). Four
  spec corrections claimed — the big one CONTRADICTS W5/L10 grounding: implementer says its
  rendered top-10 traces to filed pctVal and needs NO L10 rider. **Condition-5 data-quality-critic
  (Fable) LAUNCHED** to adjudicate that + run the worker's own twin-coherence settling test
  (PARKED-2, P1-if-real: `nav_series.beta` == single-ETF `value_score.beta` to 6dp while the
  verdict's cost leg is blend-based) + verify eff-positions/active-share gated closed (PARKED-1:
  17 funds serve exactly 0.5 active share vs an EMPTY benchmark at confidence high — file-able).
  F1 stays in-progress until the critic verdict; worker note: worktree needed real `npm ci`
  (symlinked node_modules panics Turbopack).
- 2026-08-07 15:52 — **F1 condition-5 critic: FIT TO STAY LIVE** — ~40 figures across 6 funds trace
  served→staging→gold with ZERO provenance failures; gates fail closed; anon leak-free. All three
  adjudications settled: (1) implementer RIGHT on top-10 (all 5,420 served values reproduce from
  filed pctVal at 1e-9) — **L10's top-10 half is DEAD; L10 = effective-positions fix only** — but
  the "exactly as filed" caption is false for the 208-fund master-feeder look-through cohort (P2,
  bounced to worker); (2) twin puzzle = a THIRD basis: the passive leg is a **walk-forward cascade
  of point-in-time twin refits** (methodologically superior, no hindsight) mislabeled as the lead
  ETF on 204/218 blends — cost leg STANDS; **filed as L12, REQUIRED BEFORE F6**; (3) active-share
  fail-open confirmed in gold (0.5-vs-empty-benchmark at confidence high, tell-tale fields dropped
  pre-serving) — **filed as L13**. DOXGX-over-DODGX canonical-ticker erasure filed to backlog
  (sequence with L3). **P4 parked** (free family table shows the paid 3Y β-adj figure — tier
  contract or leak?). Five localized web fixes bounced to the F1 worker (caption, 3×P3 copy/guard,
  rounding, progress-file corrections); on its return → codex gate + commit.
- 2026-08-07 15:59 — **F1 fix-round DONE, all six fixes verified on the live page** (PRNEX
  regression-checked unchanged); worker went beyond the list correctly: movement-00/02 comparator
  copy rewritten from a hedge to the TRUE basis ("cheapest matching mix as it stood at each point
  in time, refit periodically" — the PIT cascade named, current mix as the current segment), and
  the resolved PARKED-2 superseded rather than left open. Look-through disclosure honestly bounded:
  provable only for n_positions≤10 (121 funds); the `lookthrough_applied` serving flag filed to
  backlog as an L10 rider (637 funds indistinguishable payload-side today). **P4 sharpened into a
  real contradiction**: `fund_family_panel` serves the 3Y β-adj excess FREE while `nav_series`
  gates it PAID — one gate is wrong, owner call. **Codex --high gate now RUNNING in background
  (task b8ywlhsn4)** on the 12-file / +2,718-line uncommitted F1 diff; commit on pass.
- 2026-08-07 16:06 — **F1 codex gate: CODEX_GATE pass, 0 P0/P1, two P2 advisories** — both in
  `derive.ts`, both bounced to the worker to FIX not waive (line precedent): (1) fit-field lookup
  may null `currentFitR2` for a cohort of matched funds (codex says the contract serves
  `replica_r2`, which partially contradicts the critic's PRNEX trace of `selected_blend_r2` —
  worker verifies against the DB and either fixes with a count or refutes with data); (2) at free/
  anon an upstream-missing `beta_adj_diff_bps` renders as a PAID LOCK (teases a value paid users
  won't get) — needs a raw-presence flag through applyGates. Re-gate on the final diff, then commit.
- 2026-08-07 16:10 — **F1 P2 round closed: P2-1 REFUTED WITH DATA** (over the 3,086 matched funds:
  worker's path resolves 3,061, the 25 nulls lack BOTH fields; codex's suggested `replica_r2`
  swap would have dropped the crescent fill for 695 funds AND mixed two fit windows behind one
  number — code deliberately unchanged, reasoning recorded at the lookup site); **P2-2 FIXED**
  (presence-only boolean through applyGates; DOXGX now shows the upstream reason at every tier
  instead of a false paid lock; PRNEX's real lock survives). Build+lint+golden green, PRNEX
  regression-clean. **Codex re-gate RUNNING (task bbxomo30g)** on the final diff; commit on pass.
  Gate-log note for the record: the P2-1 close was a data-backed refusal of the reviewer's fix,
  not compliance — the suggested fix was itself a 695-fund regression.
- 2026-08-07 16:18 — F1 re-gate round 2: **pass**, one distinct P3 (M06 caption promised fee/peers/
  alternatives drill-downs that aren't on the V4 page) — fixed inline by the dispatcher (sentence
  removed), build+lint green. Commit attempt then correctly REFUSED by the codex-commit-gate hook
  (file newer than verdict — the hook doing exactly its H2-hardened job); gate round 3 running
  (task b4c4i4q1p) on the current state, commit on its pass.
- 2026-08-07 19:27 — **F1 DONE — committed `6190a96` on `f1/v4-movements-00-06` (owner merges; NOT
  pushed).** Gate history: codex --high pass ×3, 0 P0/P1 ever; round-3's new P2 ("row_id lookup
  wrong, top-10 renders em-dash for all funds") REFUTED by the dispatcher against the served
  payload (rows carry `row_id`; PRNEX renders 31.0% live — codex pattern today: two of its three
  concrete fixes would themselves have been regressions; both closed with data, not compliance).
  Meanwhile the **L1 worker was killed mid-Segment-1b by the session usage limit** (~16:20, reset
  7pm Boise — it was measuring `covered_value_fraction` post-fix; all state on disk in
  `fund_score-wt-l1/reports/`). Limit has now RESET — resuming the L1 worker via SendMessage
  (never relaunch). Queue state: W drained, H drained, F1 done; F2-F4 blocked (L5/L6/L9); next
  READY after L1 resumes = L2 (but F2 fence: ONE lakehouse session — L1 continues first).
- 2026-08-07 20:11 — L1 Segment 1b ALIVE post-resume (1b report + make-check log written 19:52).
  **L11 DISPATCHED in parallel** — the one READY item that is NOT a lakehouse write (consumer-
  contract check, code-only): sonnet FB worker in fresh worktree `fund_score-wt-l11` off main;
  builds the superlative-guard check in the check registry (must FAIL on a synthetic violation —
  non-degenerate by construction), audits BOTH web checkouts' copy surfaces read-only. Hard
  fences: no data writes, no Postgres, no web edits, no commits.
- 2026-08-07 20:12 — **L1 Segment 1b COMPLETE: B1 fixed at both sites — panel $73.94T→$24.94T,
  period-aligned 0/5,754 series exceed their filed LONG book (max ratio exactly 1.000000; the "55
  above filed" were long/short funds vs NET, a mislabel the worker's own adversarial pass caught
  and corrected).** Identity nondeterminism eliminated (0 diffs on isin/sector/name/cusip/country
  across two identical-code builds; numeric churn ≤4.1e-15 relative — "bit-exact" claim correctly
  downgraded to fp-stable), BAPG0TF0 purged, NAV-identity gate proven FAIL-pre/PASS-post and wired
  into make check. (L11 21:42: check built + registered, `superlative_guard` PASS on 2,086 real
  series, FAIL-proven on 4 synthetic violations; both make-check FAILs adjudicated pre-existing by
  input mtimes; web audit — every live "biggest bet" render correctly gated, V4 stricter than v2;
  4 ungated adjacent superlatives + 1 dormant fail-open FILED to backlog; codex gate running task
  blqeqboia.) Worker self-caught TWO residuals from its own fix: `MIN(inv_country)` re-picked
  domiciles and NULLed 18 pairs' correct sectors (CCL/KGC/BBUC), and the sentinel bar missed the
  `isin` operand (65 rows/$98.7M still collapsed). **Segment 1c AUTHORIZED** (representative-by-
  largest-valUSD picker + isin sentinel bar; targeted re-proof incl. all-18-restored and the
  per-series zero-new-sector-loss diff). Follow-ups 3–5 stay filed. Checkpoint covers 1+1b+1c.
- 2026-08-07 20:57 — **L1 Segment 1c COMPLETE, pre-verified PASS**: dominant-lot picker restored
  16/18 regressed pairs (2 remain honest-null pending domicile routing, $137K), `security_id='N/A'`
  → 0 (one row proven to have merged ELEVEN issuers — every separated row matches raw N-PORT to
  the cent), panel value conserved to the penny 1b→1c, all 33,490 representative-name changes
  scanned for the wrong-company hazard (clean; the one derivative-keyword gain is genuinely the
  dominant lot). **Final Fable data-reviewer checkpoint LAUNCHED on the combined 1+1b+1c diff**
  (focus: 1c claims, per-column representative hazard quantified not sampled, per-series
  no-regress vs the ORIGINAL pre-L1 artifact). On pass → codex --high on the whole diff → commit.
- 2026-08-07 22:00 — **L11 through three codex fix-rounds, each finding a REAL fail-open in the
  guard itself** (null-confidence rows silently dropped by a Polars filter; gap recompute trusting
  the shipped `rank` it claimed independence from; `bet_type` missing from the guarded field set) —
  all fixed with FAIL-proving synthetic tests; real gold clean each time (0 nulls, 0/2,086 rank
  drift). Last two advisories (bet_type set + markdown pipe-escaping) applied INLINE by the
  dispatcher; 14 tests pass, ruff clean, check PASS. Final gating codex round running (bg3fd9twv);
  commit on pass. L1 final checkpoint still reviewing.
- 2026-08-08 01:05 — **Overnight limit window recovered** (second usage-limit hit ~22:20, reset
  00:20; both casualties revived): the killed L11 final codex gate re-launched (task bd6byncic),
  the killed L1 final reviewer resumed via SendMessage mid-recompute (it preserves completed
  verifications; finishing the 6-point brief). No worker lost state — reports and worktrees
  intact.
- 2026-08-08 07:46 — **The machine SLEPT ~02:00–07:40** (not a usage limit): the 01:05 codex gate
  had 0.9s CPU over 6.5h (severed stream — killed, relaunched as task bnxfrd62o) and the L1
  reviewer's two "watchdog stalls" were the lid closing on its API stream. Reviewer re-resumed
  with orders to emit its verdict from already-gathered evidence, no new queries. Both lanes
  otherwise intact.
- 2026-08-08 09:09 — **L1 FINAL CHECKPOINT: PASS — segments 1+1b+1c cleared for codex + commit.**
  Reviewer re-derived at lot level (1.38M lots): conservation to the cent, 16/18 restorations all
  correct + 2 honest foreign-dominant nulls verified at expanded-lot level, S000038923's 11
  separated issuers each match raw to $0.00, per-column representative hazard = exactly 2 benign
  tuples panel-wide (quantified, not sampled), NAV gate falsified against pre-fix (FAIL 320 series
  / worst 10.5M×) and WARN-clean post-fix, rebuild-twice 0 identity diffs, **0 per-series
  classified-count regressions vs pre-L1**. Two wording fixes bounced to the worker (coverage
  headline restates to **+0.2970pp** on the honest larger denominator; the "7 groups" claim is
  within-row-only) + one committed `representative()` unit test. **NEW pre-existing defect FILED**:
  635 served security_id groups span >1 issuer prefix, ≥2 provably cross-company (Eversource+Nu
  Holdings; Meituan+Korean Re) + sentinel literals in served identity columns. On worker's return
  → codex --high on the whole L1 diff → commit. L11 final gate still running (relaunched
  post-sleep).
- 2026-08-08 09:13 — **L11 DONE — committed `06ae57a` on `l11/superlative-guard` (owner merges).**
  Round-4 codex passed with two NEW P2 advisories; per the round cap they were consciously
  DEFERRED, not fixed (filed as an Open chore with the reasoning) — the guard's core invariants
  were already proven non-degenerate through three fix rounds. Backlog: L11 item flipped to Done
  with the archive sweep (W1 overflow moved to backlog-archive.md; Done buffer back to 3). **L1
  fix-round returned**: coverage headline restated (+0.2970pp on the honest denominator, stale
  figure flagged at both sources), both 1c wordings scoped correctly, and a 6-test
  `representative()` suite committed (SQL/polars equivalence, order-independence across shuffles,
  a guard failing the suite if `_PULL_SQL` reverts to `MIN()`). **Codex --high gate on the full L1
  diff RUNNING (task brsx6bwb1)**; commit on pass.
- 2026-08-08 09:18 — **L1 codex gate: BLOCKED — 1 P1 + 3 P2s, all real, all bounced as Segment 1d.**
  The P1 is the find of the round: the B1 fix allocates feeder `valUSD` across only surviving EC
  rows (EC-share-renormalized) while `pct_nav` scales NAV-consistently — masters with <100% EC
  coverage overstate per-row dollars by the uncovered share. Worker must measure blast radius AND
  answer why the NAV-identity gate didn't flag it (possible hole in the gate itself). P2s: sentinel
  identifiers still EMITTED by the representative columns (can re-join the bogus sentinel sector),
  OpenFIGI carry-forward ordering defeats itself on the widened spine, and the new gate can compare
  against a different N-PORT amendment than the builder canonicalized. P1+P2a = one rebuild;
  P2b/P2c code-only. Reviewer delta-check then codex re-gate after.
- 2026-08-08 10:54 — **L1 Segment 1d: all four codex findings fixed and re-proven** (awaiting the
  worker's final gate-verdict relay). P1 measured before coding: 974/5,754 masters below 95% EC
  coverage; fix (`f_valUSD × m_pct_nav`, both sites) moved 416,297 rows, panel → $24.8981T. The
  worker's standout admission: **the NAV gate's own 0.25 tolerance was nearly identical to the
  defect it hunts** (72 fund-quarters sat inflated INSIDE tolerance) — gate hardened with an
  absolute rule (any fund-quarter implying >1.5× filed NAV fails outright); worst served ratio now
  **exactly 1.0** (was 5,856×; ALTICE FRANCE had implied a $407 QUADRILLION NAV, now $57.75M
  honest). P2a closed a latent join hazard (730,832 sentinel cusips → 0; honestly reported as 0
  active sector corruptions). Determinism exact, per-series no-regress PERFECT (0 lose, 0 gain),
  pre-B1 artifact still FAILs the corrected gate. New sibling defect FLAGGED not scope-crept:
  `PULL_WINDOW_SQL` (Positioning Changes path) still has `any_value()` + no sentinel bar — to file.
- 2026-08-08 11:05 — **Owner drained the decision queue (live session): P2 ANSWERED — BUILD the
  screener for the demo** (backlog story filed; queued as F7, SS→IN standard, spec settles the
  exposure-screener overlap + tier columns). **P4 delegated → line decided**: nav_series' paid gate
  is the contract; family per-fund `value_bps_3y` gates to PAID on both surfaces — F1 worker
  implementing on the f1 branch now (golden gating updated; codex + commit follow). **P3 re-briefed
  to the owner in plain product terms** (per-row trust semantics vs identified-the-fund; answer
  pending). **Merges AUTHORIZED once commits land**: `l11/superlative-guard` MERGED into fund_score
  main (ff → `06ae57a`); f1 merges after the P4 commit; l1 after its gate+commit. Web main stays
  UNPUSHED (F3 — pushing deploys). `PULL_WINDOW_SQL` sibling defect filed to backlog.
- 2026-08-08 11:22 — **P4 SHIPPED AND MERGED**: tier gate committed `948231f` on the f1 branch
  (codex final pass CLEAN — zero advisories) and **`f1/v4-movements-00-06` merged into web main
  (ff → 948231f, NOT pushed)**. Worker's diligence note: the aggregates condition FAILED on data
  (167/416 families single-member → aggregate == the paid figure) so both aggregates gated too;
  the presence-marker P2 was the third instance of one root pattern — *stripping a value destroys
  the evidence explaining its absence* — now covered at all three applyGates strip sites, flagged
  as a standing trap for future strips. Verified on all 4 real mixed families. Pipeline-state docs
  commit on main was CLASSIFIER-BLOCKED (SKIP_BRANCH_GUARD env prefix) — plan/backlog changes ride
  uncommitted in the working tree; owner may commit or grant the rule. Remaining in flight: L1
  gate-verdict relay → reviewer delta-check → codex re-gate → commit → merge (authorized).
- 2026-08-08 11:44 — **L1 Segment 1d COMPLETE with the three-way gate proof**: pre-B1 FAIL (worst
  10,485,323×) · 1c FAIL under the HARDENED gate on 26 gross-inflation quarters the old gate
  passed · 1d clean PASS (0 outside band, worst ratio 1.0×). Worker also caught + fixed its own
  20-min gate-runtime regression (→6m34s, matters for make check). **Fable reviewer DELTA-check
  LAUNCHED** (P1 basis exactness on <80%-EC feeders, the three-way demonstration re-derived,
  long/short false-positive path on the new absolute rule, P2a latent-not-active characterization).
  On pass → codex re-gate on the full diff → commit → merge.
- 2026-08-08 12:14 — **Segment-1d delta-check: PASS, 0 blocking.** Reviewer re-proved all three gate
  legs through the REAL control flow, spot-checked sub-80%-EC feeders to the cent, cleared the
  long/short false-positive path, and confirmed P2a latent-not-active. Two 1d report over-claims
  bounced for text fixes (worst ratio is 1.0206× not "1.0×"; ALTICE misattached to the zeroed-rows
  cohort) + the gate-semantics caveat recorded. PULL_WINDOW_SQL backlog item WIDENED with the
  reviewer's facets (stale pre-B1 window artifact = code/artifact divergence; passive_blend
  source_systems list-order nondeterminism). On worker's return → codex re-gate → commit → merge.
- 2026-08-08 12:24 — **L1 SEGMENTS 1–1d COMMITTED `afc76aa` AND MERGED into fund_score main
  `bad49ad`** (run_checks registry union with l11 auto-resolved). Codex re-gate: pass, 0 P0/P1;
  the unweighted-median advisory deferred to the check-hardening chore (same cap doctrine as L11).
  Worker's report over-claims fixed and self-verified (1.020583× restated as its own formatting-
  artifact error; true 4-zero cohort named). **Segment 2 (C1 vote tie-break, $63.07B) AUTHORIZED
  under the dev/holdout protocol**: rule frozen on dev (≤20 inspectable ties), ONE fresh ~30-ISIN
  holdout scored once, ship bar ≥~95% precision, wrong-sector-worse-than-null doctrine — below bar
  → stop for dispatcher call. Milestone means the beta-blocker tail (L2–L13, F-track) now sits on
  a main that already carries the spine+B1+determinism fixes.
- 2026-08-08 12:32 — **Segment 2 STOPPED AT THE BAR — the protocol worked exactly as designed.**
  Holdout 17/21 = 81% (4 confirmed wrong incl. Beijing Enterprises Water→should-be-Utilities);
  the dispatcher's own home-listing proposal was FALSIFIED on dev (flag-of-convenience domiciles —
  FLEX LNG's "home" NYSE row would have served Industrials for an LNG shipper); root cause =
  uncorroborated single FMP primary-listing labels, with **Industrials as FMP's de-facto default
  (43% error rate there vs ~7% elsewhere)** — recorded for every future FMP consumer. Also: C1
  re-denominated on the honest post-1d panel = **$27.12B not $63B** (the old figure was priced in
  fabricated valUSD). **Ruling: A + C-folded-into-Segment-4** — C1 closes honest-null with a
  reason code; its 136 ties become an input cohort to Segment 4's independent name/LEI crosswalk
  (corroboration = exactly option C's machinery), scored under Segment 4's own holdout. Nothing
  shipped at 81%; nothing recoverable forfeited. **Segment 3 authorized** (C2a wrapper census —
  measurement + frozen rule proposal ONLY; Segment-4 sizing must also be re-denominated post-1d).
- 2026-08-08 12:38 — **Segment-3 census DONE, Segment 3b AUTHORIZED.** C2a re-denominated
  $37.95B→$21.95B post-1d (C1's −57% lesson repeated at −42%). The sharp find: `isFund=true` fires
  on the WORD "Trust", not economic fund-ness (Sumitomo Mitsui Trust = bank; Daito Trust = builder;
  HKT Trust = telco) — the real discriminator is FMP `industry` mutually corroborated with sector.
  Measured split: **recoverable 143 ISINs/$12.65B** (REITs + banks/telecom), honest 176/$7.94B
  (genuine money-market vehicles), undecided 19/$1.36B stays NULL. C1 needs NO reason-code churn
  (all 497 non-wrapper nulls are exactly the vote-ties — checked before proposing). Dev/holdout
  frozen BEFORE rule design (20/30, md5 recorded). 3b runs under the same ≥95% bar with a specific
  probe for the named silent-failure mode (REIT-labeled non-REITs).
- 2026-08-08 15:26 — Third session-limit window (13:20–15:20) caught the worker mid-Segment-3b
  closure; RESUMED post-reset. Last verified state before the kill: 3b precision **300/307 =
  97.7%** (above bar), both blocking defects closed, 7 residual FPs with ZERO touching a served
  row; open thread = whether a `0P0*` identifier predicate cleanly closes Deka-ImmobilienEuropa
  ($18.2B pooled property fund holding a sector — doctrine violation even unserved). Instruction:
  prefer an honest per-ISIN exclusion-with-reason over a pattern that pretends generality if the
  predicate doesn't separate cleanly. Then STOP → reviewer checkpoint → codex → commit.
- 2026-08-08 16:00 — **Segment 3b COMPLETE (NAV-gate confirmation still grinding; no dollars moved
  so PASS expected).** The `0P0*` suggestion was UNSAFE as given — bare prefix matches short LSE
  depositary symbols (`0P07.L` = First Mining Gold, a real miner); the length-qualified
  `^0P[0-9A-Z]{8}\.` separates cleanly (282 rows, 0 operating companies). All 7 FPs closed with
  universe-checked mechanical predicates, no hand-curation. Final: map +300/0 lost, holdings
  **+4,011 rows / +$11.971B across 676 series, 0 lost 0 changed**; row coverage 97.0992→97.3315%;
  X-Ray **+488 medium→high, 0 downgrades**; determinism 0 diffs; 36 tests. Made visible not
  buried: 5 genuine REITs stay honest-null (J-REITs named "…Master Fund" defeat the name rule —
  candidate follow-up filed in-report) + a scoping caveat on 3 primary-vote ISINs. Reviewer
  checkpoint launches on the NAV-gate relay.
- 2026-08-08 16:35 — The worker's NAV-gate confirmation run DIED with its session turn (no process,
  no log — verified, not assumed) and the worker sat stopped awaiting a relay that would never
  come. **Fable Segment-3b reviewer checkpoint LAUNCHED with the gate run folded in** (the reviewer
  runs `check_holdings_valusd_nav_identity` itself on the final artifact, as it did for pre-B1),
  plus holdout-integrity verification (frozen md5, no dev/probe contamination), stratified
  re-adjudication of 10 adopted ISINs, and re-runs of 2 FP-predicate universe safety checks. On
  pass → codex on segments 2+3+3b → commit → merge.
- 2026-08-08 16:49 — **Segment-3b checkpoint: FAIL on the EVIDENCE PACKAGE, data fully verified
  sound.** Reviewer recomputed every delta exact, confirmed the holdout genuine (12/12, md5 clean),
  found NO wrong-sector adoption in any sample, and ran the NAV gate itself: **PASS** (the worker's
  own confirmation had died as an unnoticed OOM traceback — provenance was asserted, not verified).
  The blocking finding: dev was never re-scored after FP-tightening — the shipped rule scores dev
  **7/13 not 8/8** (Jadwa REIT Saudi nulled AND held), the stale claims sit in the `fmp.py` comment
  codex will read, and a ~$26M Saudi REIT cluster (~10 ISINs, all `\bfund\b`-withheld) was missing
  from the coverage-cost disclosure (true residual: 15 held ISINs/$675.1M of the $12.65B target →
  94.7% realized). Corrections bounced (text/comment-only, no rebuild); on their return → codex →
  commit → merge.
- 2026-08-08 17:01 — **Segments 2+3+3b COMMITTED `78ee1a2` + MERGED to fund_score main `c000de4`**
  (codex pass, 0 P0/P1; worker's evidence-package fix round included owning both its errors in the
  committed code comment — the mis-scoped probe and the un-rescored dev set). **Segment 4
  AUTHORIZED** (name/LEI crosswalk, identity-gated, BHP lesson): re-denominate the pre-1b "$38–45B"
  sizing FIRST, inputs = X-absent bridgeables + the 136 C1 ties (corroboration route), normalization
  spec published BEFORE scoring, dev/holdout with the new hygiene rule (after ANY tightening,
  re-score BOTH sets under the final rule), NAV gate run ALONE (the OOM lesson). Remaining after 4:
  segment 5 (per-sector confidence — awaiting P3), 6 (Gulf reason codes), 7 (sibling sweep).
- 2026-08-08 17:47 — **Segment 4 COMPLETE: dev 20/20 + holdout 30/30 under a spec published before
  scoring (never tightened — hygiene held by construction). +2,535 rows / 219 ISINs / $12.997B, 0
  lost 0 changed; TELUS finally classifies.** Re-denomination honesty: the "$38–45B" became
  **$13.4B bridgeable** (−50% valUSD + the new country identity gate = the BHP guard). Worker
  REPEATED the 3b scoping error — first pass applied the bridge map-wide and SPY/QQQ acquired
  "Financial Services" — but its own sweep caught it pre-ship; fixed with a source-side FMP-absence
  gate. Cohort B (11 corroborable C1 ties) deliberately NOT shipped (would need an unvalidated
  second mechanism). NAV-gate OOM root-caused at source (materialize-after-semi-join; 6m34s→1m36s).
  **Fable reviewer checkpoint LAUNCHED** (incl. map-wide-residue probe + pre-B1 teeth re-test of
  the reworked gate).
- 2026-08-08 18:03 — **Segment-4 checkpoint: FAIL — the residue probe fired on the BHP class.**
  Held-cohort work verified clean, but the bridge wrote **36,092 map-level fills beyond the 219
  validated**, incl. PROVEN wrong-company bindings: two bond ETFs carry "Financial Services"
  because their most-frequent FILED N-PORT name is "MORGAN STANLEY & COMPANY LLC" — a COUNTERPARTY
  — which sailed through name+country+unambiguity; plus BlackRock CEF wrappers (FMP carries CEFs
  as "companies") and 163 ABS/debt fills (Affirm tranches → "Technology"). Zero serve TODAY, but
  the holdings coalesce fallback makes every fill servable. **B2: the wrapper safety gate was
  DEGENERATE** — anti-joining FMP-known ISINs means the FMP wrapper flags it checks can never fire.
  **Segment 4b bounced**: gate the bridge to the validated held cohort + counterparty/multi-issuer
  name exclusion + debt-pattern exclusion, replace the gate with one that can fail (proven on a
  synthetic), rebuild, re-run the residue probe to ≈219, audit the 10-min window where the buggy
  first-pass chain sat in the shared lakehouse.
- 2026-08-08 20:26 — Fourth limit window (18:20–20:20) caught the worker at the START of 4b (it had
  just owned both findings, B2 verbatim: "a degenerate verification metric"). RESUMED post-reset
  with the window-audit-first ordering intact.
- 2026-08-08 22:16 — **Segment 4b essentially COMPLETE.** Window audit CLEAN (verified empirically:
  0 contaminated values reached any consumer). **B1 root-caused to filed-data SEMANTICS**: on
  `assetCat='DE'` lines, N-PORT's `name` field is the COUNTERPARTY — most-frequent-name actively
  selected Morgan Stanley 33:5; fixed by gating extraction with the shared equity-longbook
  predicate (753,681 → 16,102 input rows; the counterparty name now absent from the data). B2's
  degenerate gate replaced with a filed-name probe that fired in production (n=14 — catching the
  worker's own token list nulling genuine REITs). Map fills **36,092 → 2,250**, held coverage
  preserved ($12.999B, 0 lost/changed/offenders). **Worker REFUSED the dispatcher's multi-issuer
  exclusion with measured evidence** (would drop 62 validated adoptions; prefix-multiplicity can't
  separate multinationals from counterparty spray) — **RATIFIED**: the data refutes my instruction,
  same standard we hold codex to. Outstanding: /check-data quick pass + the 2-member dev/holdout
  coverage-loss ledger question; then re-checkpoint → codex → commit.
- 2026-08-09 09:38 — **4b closeout: /check-data FAILED and caught two MORE gate bypasses, both
  fixed at source** (the sweep keeps earning its keep): representative-name reduction let
  instruments whose plurality name is the plain issuer route around BOTH gates (Akero filed 14× as
  itself + 12× as "NOVO NORDISK CVR" — full name-set now screened, `\bCVR\b` + instrument ISIN
  shapes added); and missing `PUBL` in the suffix stripper split Calliditas's junk and real
  profiles into different groups so the unambiguity gate never saw the collision. Worker also
  recorded a process error: changed the normalization WITHOUT rebuilding `fmp_name_sector_map` —
  two-sided drift; build_fmp_reference is now step one of the chain. 2-member ledger answered
  honestly: ONE true coverage loss (Precious Shipping, $4.4M normalization gap), the other was a
  precision fix (the holdout's own CVR). One identifier (`US292RGT0409`, regex offset) + final
  /check-data re-run outstanding — worker sent back to VERIFY rather than hand over unverified.
- 2026-08-09 10:26 — 4b verification round 2: /check-data failed AGAIN on the instrument class and
  the worker self-diagnosed both layers — its own probe was DEGENERATE a second time (long-form
  tokens `\bRIGHTS?\b` cannot match filers' abbreviations `RTS`/`WT`; "a check that cannot fail is
  not evidence" — its words), and the residue's root cause is that the instrument marker lives in
  N-PORT's **`title`** column (5/5 probed) while the screen reads `name` (2/5). Worker handed over
  the diagnosis rather than a half-applied fix. **Title-column fix AUTHORIZED** with
  both-directions probe validation (must flag all 22 pre-fix / 0 post-fix); **receipts ruling
  issued (line's call, consistent with the blessed issuer-sector convention)**: subscription
  receipts adopt issuer sector (convert to common, carry issuer economics); liquidating/escrow
  trust units → NULL with reason (not the operating company's economics). /check-data must PASS
  or the third failure comes to the dispatcher raw.
- 2026-08-09 10:42 — Title-fix probe validated BOTH directions (22/22 pre-fix, 0/22 post-fix) and
  surfaced a wrapper the name column had hidden (Fondul Proprietatea). Receipts ruling implemented
  MECHANICALLY (B3 species narrowed `[DR]##`→`D##` — the species distinction does the work; RCP
  tokens dropped; `\bLIQUIDATING\b` added). **The L1 worker RETIRED itself at its context limit
  rather than assert unverified numbers** — the correct failure mode; its detached rebuild
  survives. **Fresh 4b-finisher agent LAUNCHED** (wait for chain → complete missing steps → full
  verification suite with probes proven able to fire → /check-data must PASS or comes back raw).
  Re-checkpoint follows on the finished artifact. Segments 5–7 will also go to fresh workers
  grounded in the reports.
- 2026-08-09 ~10:55 — **Owner productivity check → dispatcher course-correction.** Honest audit:
  L1's big value ($25B coverage, $50T fix, determinism, gates) is BANKED; the last rounds were
  whack-a-mole on $33.5M (0.0001% of panel) of UNSERVED map residue — wrong marginal-round
  economics, and the queue (L5/L6 → F2/F3 → F6) is waiting behind it. **New rules:** (1)
  materiality floor on the L1 tail — new residues <$100M and unserved get FILED not fixed
  (finisher re-briefed); (2) L1 closes after 6+7 (small); Segment 5 does NOT hold L1 open — if P3
  is still unanswered it re-files as its own queued item; (3) on L1 close the lakehouse window
  goes to L5/L6, the F-track unblockers.
- 2026-08-09 11:45 — **4b finisher CLOSED all 7 verification items PASS** (final: +2,227 rows /
  160 ISINs / $12.9587B, 0 lost/changed; /check-data PASS incl. 0 wrong-company; probe fires n=37
  pre-fix / 0 post-fix) and caught TWO method errors in the retired worker's own mid-flight
  numbers (null-key join inflating gains 2,478→10,705 if unfixed; screening security_name instead
  of filed title under-detects 19 vs 37). Residuals filed within the floor (SVB token-miss $709K;
  $11.4M over-suppression; CINS pseudo-ISIN mechanism note). **One proper escalation: $527.7M
  bridge-eligible-but-NULL recall gap** (plurality-name rule picks "prime de fidélité 2027" over
  L'Oréal; ISIN recall 66.4% / dollar recall 96.1%; same-fund-quarter sibling incoherence) — sent
  to the FINAL Fable checkpoint (launched) for file-vs-block adjudication. On pass → codex →
  commit → merge → L1 wraps with 6+7 via fresh workers.
- 2026-08-09 15:15 — **FINAL 4+4b CHECKPOINT: PASS-with-filed-residuals** (survived a sixth limit
  window mid-run). 12-ISIN external sample: 0 wrong-company; all deltas exact; both probe
  directions reproduce bit-for-bit; the counterparty gate falsified LIVE on Verano (14 swap rows
  vs 2 issuer rows — gate held). **Recall-gap adjudicated FILE at CORRECTED sizing: $3.51B / 179
  ISINs / 78.7% dollar recall** — the finisher's $527.7M was the same degenerate resolved-name
  basis it had itself flagged (its one over-claim); second cause found (suffix asymmetry
  PCL-vs-PUBLIC, renames, translations). Chore FILED in backlog at corrected numbers with the
  bundled small items (TR UNIT token, CINS-via-invCountry, partly-paid ledger). W-E stale comment
  fixed inline by dispatcher. **Codex gate running (task bo7nbip06)** on the 4+4b diff; commit +
  merge on pass, then 6+7 to fresh workers (5 waits on P3).
- 2026-08-09 15:21 — **Segments 4+4b COMMITTED `8f58ac1` + MERGED `0674802`** (codex pass, 0 P0/P1;
  advisories = filed repeats). $3.51B recall chore FILED at the reviewer's corrected sizing.
  **L1 closers 6+7 DISPATCHED to a fresh worker** (the 890k-token veteran is retired): Segment 6 =
  Gulf honest-null reason record (C1 precedent — check isolability before any code churn; re-verify
  census post-4b); Segment 7 = sibling sweep applying PROVEN patterns only (PULL_WINDOW dominant-lot
  + sentinel bars + stale-artifact rebuild; positioning/fund_holdings_full onto the shared path;
  148-split re-measure — new rule design gets FILED not built; source_systems sort). One combined
  checkpoint → codex → commit closes L1; Segment 5 re-files pending P3.
- 2026-08-09 17:18 — **Segment 6 CLOSED zero-code** (Gulf cohort isolable by `inv_country`
  predicate that strictly dominates the ISIN-prefix form; census re-denominated $41.75B→$14.88B;
  the "11 Saudi sukuk" were actually REIT funds — a known 3b name-rule miss, not a vendor gap;
  split MEASURED: $14.8749B honest / $3.9M recoverable-no-ISIN). **Segment 7**: window artifact's
  sentinel collapse $121.6B→$0, stale pre-B1 $431.9T→$30.65T; sector routing lifted positioning
  52.3→97.4% and fund_holdings_full 55.6→94.3% classified; 148-split collapsed to 15 ISINs/$7.4B
  pure-coverage (filed). **Three escalations RULED**: (1) window gate red on 2 quarters = the gate
  DETECTING filer errors (pctVal-as-fraction; $135M pre-existing unserved) → filed as the inverse
  sibling of the Jul-8 pct_nav guard; (2) 481-quarter label cost ACCEPTED under honest-null-over-
  wrong (folded into the domicile-routing follow-up, now carrying three cohorts); (3) the stale
  positioning check (its 99.9% held BY CONSTRUCTION — another degenerate grader) → fix authorized
  WITH synthetic-failure proof; checkpoint audits the self-graded rewrite. Worker finishing
  determinism + owed /check-data items.
- 2026-08-09 17:28 — All three rulings applied + proven (check rewrite's non-degeneracy: injected
  5pp divergence detected at exactly 5.0pp; the old grader's blind spot reproduced — 0pp reported
  vs true 14pp). **Adversarial sweep of all 54 relabelled ISINs vindicated ruling 2: the old
  ticker path was serving LIVE wrong-company bindings** (Roche under Roper Technologies; Nu
  Holdings under Eversource; İş Bankası under HEICO). The 2 seemingly-inferior labels turn out to
  CONVERGE with holdings_complete's authority — coherence, not regression. **NEW DEFECT S7-4**:
  same security, two sectors by filed domicile — 20 ISINs/$8.2B in gold, would reach the product
  on next reload. **Domicile-routing follow-up PROMOTED to queue row L14 (five symptoms, one root
  cause; must precede any serving reload).** Worker finishing window determinism + make check,
  then the combined checkpoint.
- 2026-08-09 17:54 — **Segments 6+7 COMPLETE and stopped clean** (make check: 2 pre-existing FAILs
  only, one invariant improved zero regressed; window determinism 0 diffs; `holdings_complete`
  provably untouched — byte-identical golden + 0/1,727,092 attach parity). Worker disclosed two of
  its own process errors unprompted (stale quoted row count; a self-matching pgrep). **Combined
  6+7 checkpoint LAUNCHED** — priority: adversarial audit of the self-graded check rewrite, the
  wrong-company kill list (Roche-as-Roper etc.), the Gulf re-denomination, S7-4's pre-existing
  characterization. On pass → codex → commit → **L1 CLOSES** (Segment 5 re-files pending P3) →
  lakehouse window opens for L5/L6 (F-track unblockers) with L14 sequenced before any reload.
- 2026-08-09 18:12 — **6+7 checkpoint: FAIL on the evidence record, artifacts fully sound** (the
  self-graded rewrite SURVIVED adversarial audit; kill list confirmed end-to-end; every census
  exact). The material catch: **6 of S7-4's 20 ISINs are wrong-company cusip binds INSIDE the US
  branch** (SharkNinja's Energy rows = SANCHEZ ENERGY's cusip; Shift4's = ENERPLUS) — a class
  domicile routing CANNOT fix, mis-filed under the item that won't fix it; re-filed as S7-4b
  (identity-adjudication class, $15.9M served-wrong in gold). Also the "0 series losing" claim
  was false (22 partial / 2 total — outcome defensible, claim not) and the §6.3 coherence
  constants unreproducible (reviewer's numbers STRONGER everywhere). Ledger corrections bounced;
  no rebuild. Then codex → commit → L1 CLOSES.
- 2026-08-09 18:30 — **L1 CLOSED.** Ledger corrections landed (worker sharpened them further: only
  3 of the 6 within-US splits are GENUINE wrong-company binds, $10.1M — the SharkNinja sizing was
  its own 800× overstatement, corrected; the "0 series" bug root-caused to a u32 underflow it had
  visibly printed and not acted on). Codex on 6+7: **pass, ZERO findings**. Committed `8dedede`,
  merged `bd39539`. L1 total: ~$40B sector coverage recovered, the $50T valUSD fabrication fixed,
  deterministic rebuilds, one shared sector basis across all three panels, six live wrong-company
  binds killed, and four permanent non-degenerate gates in make check. **L9 → ready. L5 DISPATCHED
  (fresh worktree `fund_score-wt-l5`)** per the course-correction — F-track unblockers first;
  worker stops after pre-build EDA for its first checkpoint. Backlog flip + Segment-5 re-file +
  S7-2/S7-4b filing next.
- 2026-08-09 18:41 — Backlog fully booked: L1 flipped to Done (archive overflow swept), Segment 5
  re-filed as its own P3-gated item, S7-2 + S7-4b filed. **L5 EDA complete in under an hour** —
  all six spec gates answered; proxy-contamination hard stop CLEARED against issuer sources
  (every ETF first-price ≥ published inception; IGE's 35-day truncation is the safe direction and
  shifts no window). **Price-hole ruling confirmed** (doctrine-determined: all-legs-priced
  intersection + visible n_days_dropped + upstream filing — never patch a served series from a
  non-canonical vendor). EDA reviewer checkpoint LAUNCHED; build proceeds on its pass.
- 2026-08-09 18:54 — **L5 EDA checkpoint: PASS — build released.** Reviewer reimplemented the
  PRNEX prototype from scratch and matched digit-for-digit; every aggregate exact. Its one
  material warning (sharadar-recoverability overstated for GMF/IAK/IJJ) had ALREADY been
  self-caught and corrected by the worker while holding — convergent independent findings. Four
  report corrections folded into the build brief, one load-bearing: **2dp serving rounding is
  mandatory** (28.9 KiB unrounded vs 20.6 KiB at 2dp — the nav_series p99 precedent holds only at
  serving precision). Canonical-panel hole item FILED in backlog now (12 recoverable ticker-dates;
  the Flash-Crash trio marked known-honest). Worker building stage 2 → sweep → implementation
  checkpoint.
- 2026-08-09 20:02 — **L5 stage 2 BUILT, sweep green** (survived the seventh limit window): 6,202
  blends → 4 gold parquets byte-identical across rebuilds; coverage EXACTLY on the EDA prediction
  (3,079/5,819 = 52.91%; 83.46% of twin-displaying funds; 0 fail-open); payload p99 20.6 KiB at
  the mandated 2dp; 16/16 invariants with 16/16 injection self-tests; provenance recomputes exact
  to the day. Worker caught 3 of its own defects via the gates (double-rounding on the base month
  that only EXACT equality caught; 2 probes whose random sample missed the injection; an
  unreachable NameError proven fixed by FORCING the path at runtime). **D3 FOUND AND FILED AS
  L15**: movement 02's passive leg imputes 0% for unpriced sleeves and serves unrenormalized —
  41 funds would render two contradicting twin lines once movement 03 flips; P1, pre-reload.
  Worker adding the fund_score-side DDL (authority-first, H1 lesson), then the implementation
  checkpoint.
- 2026-08-09 20:08 — **L5 DDL landed with a 5-way coherence PROOF** — which caught a live H1-trap
  instance in passing: `positioning_context` + `te_decomposition` were in the contract but missing
  from the CREATE TABLE literal (end-state correct via generated ALTERs; the literal now stops
  lying). The critical identity holds: `set(staging.columns) == set(ALL_COLUMNS)` exactly —
  matters because `copy_columns` fails OPEN (absent columns silently drop the section). No DB was
  touched. **Implementation checkpoint LAUNCHED** (fresh funds for provenance recomputes, an
  independent injection, the D3 characterization on 2 of the 41). On pass → codex → commit →
  merge → **F2 unblocks** (dispatch decision: gate-vs-wait on L15 for the 41 funds).
- 2026-08-09 20:19 — **L5 implementation checkpoint: PASS-with-filed-residuals, 0 blocking.**
  Reviewer recomputed 4 fresh funds end-to-end EXACT at 2dp (incl. the price-hole path and the
  GLD-truncation path to 6dp), rebuilt the panel itself (sha256-identical, stronger than the log
  claim), fired its own independent injection, reproduced the DDL 5-way proof, and verified D3 on
  SLMCX/MOTO. Two report edits applied INLINE by the dispatcher (the AC sample-as-universal —
  full-panel is 6 cash-like blends, real economics; the stale fails-open premise — load.py now
  fails CLOSED). **L15 re-sized to the reviewer's full-universe measurement (51 funds, worst
  304bps/day)**. Codex gate running (task bla0a00jb); commit + merge on pass.
- 2026-08-09 20:40 — **L5 DONE — committed `009b872`, merged (ff).** Codex P2 (four-panel contract
  fail-open — the nested-collapse class) fixed at two grains matching the repo's sibling pattern,
  proven by tests that fail against the reverted code; final codex pass ZERO findings. **L15
  DISPATCHED** (fresh worktree `fund_score-wt-l15`): the benchmark-nav renorm fix — census first,
  intersection-vs-renormalize decision with measurement, all downstream consumers rebuilt,
  same-page coherence becomes a PERMANENT registered gate; stops for dispatcher review after
  census+design. Path to F2: L15 → L14 → local serving reload → web mirror + flip.
- 2026-08-09 21:02 — **L15 census REFRAMED the defect: a STALE-SHARADAR-PRIMARY feed** (frozen
  2026-06-10, exactly the recency-gate-over-frozen-feed time-bomb class) papered over by the
  zero-fill — TRUE blast radius **2,378 funds / 40,314 fund-days (46× the neighbourhood-restricted
  estimate)**; worst blend served on 0.500007 of its weight; the missing month is RECOVERABLE
  (canonical panel runs to 2026-07-10 for 100/101 stale tickers; GLD alone honest). Load-site
  census found SIX consumers, not two (adds return_attribution, factor_exposure→exposure_divergence,
  fee_efficiency_backtest, fund_family indirect). **Both approvals GRANTED as completions of
  standing doctrine** (canonical-primary = finishing the 2026-07-16 migration; intersection = the
  L5-validated shape; renormalizing would serve a different portfolio under the same label) — with
  the deferred-rebuild measurement discipline as a HARD condition (per-series tails, sign flips by
  name, verdict-tier changes) + the primary-source rule becomes a registered invariant. Worker
  building.
- 2026-08-09 22:33 — L15 caught TWO of its own regressions pre-consumer via its own new gates: (1)
  the return-level >50% filter broke compounding chains at excised dates (QAAHBX single-member
  blend proved it — 18.7bps/day; guard moved to the PRICE panel, bad-print V-signature in LOG
  space so both legs of one artifact judge on one scale); (2) removing that filter exposed 4,121
  unadjusted reverse-split/vintage basis breaks being compounded into fabricated NAVs (GGOCX 209×).
  Resolution: one-way breaks chain across as SPLICE SEAMS (existing `splice_etf_proxies` semantic
  — a seam asserts "not a return"; a fill would assert "no move" — the distinction IS this task),
  fund leg ONLY, ETF panel proven clean (0/973,248) and hard-asserted. BGAEX turns out to be a FIX
  of main (its NAV had decayed to 0.0033 from half-handled spikes; truth 1.567). Final rebuild
  running; the checkpoint gets an explicit mandate to adversarially audit the seam machinery.
- 2026-08-09 23:55 — **L15 sweep essentially done**: twin coherence **1.11e-12 bps/day across
  18,953 funds** (15× the acceptance cohort; pre-fix 1,565 disagreeing, worst 47.7); SLMCX/MOTO
  exactly 0.0 vs an independent hand implementation; bit-for-bit deterministic; **coverage
  +238,483 fund-days, 26,903 funds gain, ZERO lose**; residual 392 decomposed structural (zero
  single-member disagreement — the sharpest basis proof). Worker recorded its own lesson: "a
  self-test that cannot fail is a failing self-test" (its first injection rescaled a whole series,
  cancelling in ratio space). Delta harness: 1,266/2,210 scores move (p50 20bps/p99 90), 51
  value_bps sign flips, 0 score100/beta/te sign flips. Bounced for two closers: **/check-data is
  non-negotiable** (was skipped on context budget), and the **FCNTX north-star trip (+20→+90) must
  be pinned** — mismatched-window (old number WRONG → re-base with reviewer sign-off) vs
  aligned-shorter (real sensitivity → decompose before ruling). No self-re-basing (grader-change
  discipline). Then checkpoint.
- 2026-08-10 00:23 — **/check-data FAILED both features with THREE P0s — the protocol earning its
  non-negotiable status a fifth time.** F1 (worker's own): canonical-primary imported the canonical
  panel's WRONG 2010 flash-crash closes (intraday lows as closes — IWS −35.97% "close"; Sharadar
  had it right) because the new ETF assertion was calibrated for reverse splits (≥2×) — 349/2,210
  scored funds contaminated, 28 of the 51 sign flips. F5 (worker's own): the splice-seam rule
  never tested ROUND-TRIPS — vendor garbage baked ×2.170 into PFSLX; MMFZX +255%/month. F2:
  undiagnosed fabricated +31% day (ORSAX). F4: four downstream panels now inconsistent with the
  rebuilt value_score (te_decomposition's own anchor gate reads internally-consistent-but-stale).
  F3: FCNTX breaches an OWNER-APPROVED band — adjudication DEFERRED until numbers are clean; if it
  still breaches, owner stop. F6–F9 pre-existing finds to file, headline: **the fund leg
  forward-fills dead NAVs on 11.1% of ALL fund-days** (same class just fixed on the ETF leg).
  Rulings issued: shared price-hygiene rule both legs with the round-trip criterion; canonical
  flash-crash closes FILED as a panel defect (never substitute cross-vendor); diagnose ORSAX
  before touching; rebuild all four stale panels; delta harness + /check-data re-run. Worker
  continuing in-session.
- 2026-08-10 00:26 — **F2 REFUTED with proof** (ORSAX has a 1,067-day price gap; the +31% step is
  IWM's true return over that exact interval to <1e-12 — the intersection rule WORKING; the check
  compared against a same-day move; one genuine open question logged — should a 3-years-dormant
  fund render a continuous chart at all). F1+F5 diagnosed to ONE root cause: *a magnitude test
  where a SHAPE test was required*. Worker retired at context exhaustion with the fix spec pinned
  (§8.2/8.3), backups beside every artifact, and refused to start a rebuild it couldn't finish —
  the correct failure mode again. **L15 successor LAUNCHED**: one shared round-trip price-hygiene
  rule both legs → full dependency-order rebuild (incl. the four F4-stale panels) → delta harness
  → /check-data → F3 adjudicated LAST against the owner band (breach = owner stop).
- 2026-08-10 00:55 — **Successor amended the pinned rule with measurement** (flagged for the
  checkpoint, correctly): retrace-fraction CANNOT separate fabricated prints from real
  crash-rebounds (populations interleave to 99.4% retrace — XOP 2008-10-13 gave back all of
  +19.8% legitimately); a **MAD-robust volatility yardstick does** — fabricated 12.6–39.1σ vs real
  crises ≤10.1σ, bar at 11σ inside the gap. MAD is load-bearing (PFSLX's TWO spikes mask each
  other under stddev — both 100+σ under MAD); Black Monday (15.9σ one-way) survives via
  seam-requires-excursion; BSCL's 289-step ratchet killed. Honest concession: 4/13 flash prints
  unreachable below any safe bar — stay as the filed upstream panel defect with quantified
  residual. Hygiene touches 0.0037% of observations, converges in 10 passes. Eleven-consumer
  rebuild running (F4 was FOUR panels: te_decomposition, positioning_context, fee_peer_percentile,
  value_offering_reframed).
- 2026-08-10 01:33 — **All acceptance criteria PASS; the fix is provably surgical**: the 349-fund
  corrupt cohort carries 100% of the −7.44bps population shift while the 1,861 clean funds move
  +0.02bps; PFSLX −2.0551% exact (telescoping drift +122%→0.00%); MMFZX lands on the independently-
  derived true ratio; fabricated twin days 330→0; ORSAX preserved; betas restored plausible
  (TRBCX 0.93→1.06). **F3 SELF-RESOLVES: FCNTX 90→20, inside the owner band — the breach WAS the
  contamination**; formal confirmation last, band untouched. Honest residual on record: 246 funds
  keep the −8-to−12.6% prints no safe σ-bar can remove (upstream panel defect, filed; mean Δvalue
  exactly 0.0). All 11 consumers rebuilt; scored count holds 2,210. Gates → delta harness →
  /check-data → determinism → F3 formal.
- 2026-08-10 02:21 — **All gates PASS** (both FAILs byte-identical to the pre-L15 baseline, outside
  the chain); provenance bit-for-bit via a dicts-and-loops re-implementation sharing no code with
  production. **F3 FORMALLY RESOLVED, no owner decision needed**: the band breach was a SYMPTOM —
  v3's fabricated IWF −21.96% inflated var(r_bench), depressing FCNTX's beta to 0.78 and pushing
  value_bps to 90; clean data: beta 0.90, value_bps 20, inside the band, northstars back to the
  baseline 8/10. Band untouched. Remaining: delta harness (running), /check-data, determinism —
  then the reviewer checkpoint.
- 2026-08-10 02:47 — /check-data FAILED ×3 again, and the successor owned a census miss: the
  `risk_decomp_td → l2_replica_quality → passive_alt_blend` chain GATES served coverage/confidence
  but reads raw prices, so it escaped the load-site census (the consumer-audit-≠-literal-grep
  lesson in a new shape) — 5 served scores should be not_comparable on the stale twin, 44
  recoverable. Worse: replacing the blunt pre-L15 ≥50% filter **removed a backstop** — 711
  fabricated adjacent doublings across 412 funds now reach the served chart source (M-class
  residuals: M1 ulp one-liner, M2 seam-bar-brittle-from-below, M3 STRUCTURAL — the round-trip test
  can't see overshoot-through-base, M4 the census miss). Worker correctly stopped for ONE
  adjudication before ONE batched rebuild, and asked the reviewer to re-audit its own unilateral
  11σ amendment. **Fable design-adjudication checkpoint LAUNCHED** (ratify/adjust/reject per item,
  incl. whether a blunt belt-and-braces cap belongs BEHIND the shaped rule).
- 2026-08-10 03:07 — **Adjudication delivered, verdicts relayed, batched rebuild authorized.**
  11σ rule RATIFIED (reviewer re-derived both populations independently; gap empty) with scope
  correction ("no real ETF-POOL round-trip >10.1σ" — the fund leg has a documented small FP class,
  PFFA/TPZ to hand-adjudicate first); M3 → two-sided seam back-search W≈25 (the worker's own
  candidate fix could NOT catch the 17-obs MTGVX plateau); M2 → quantization band 2·(1−ε), σ-seams
  rejected; blunt cap REJECTED for a fail-loud ratcheting census gate. TWO NEW BLOCKERS the worker
  didn't have: **the "no fund loses a day" claim was a u32 OVERFLOW artifact** (truth: 14,326 gain
  / 12,527 lose, worst −34 — wrapped negatives cancelled exactly in modular arithmetic, which is
  why the net looked right), and the M4 chain was incomplete — the td rebuild path re-imports
  Sharadar-primary (B1 muted), TD_CACHE silently no-ops, and `l2_passive_candidate_fit` (the
  serving fit-floor!) + `fund_alternatives` were missing, with candidate_fit's own Sharadar
  `ETFS_DAILY` filed as a named defect. Successor executing the one-pass plan.
- 2026-08-10 09:49 — Overnight: an AUTH EXPIRY (~04:46) killed the L15 successor and both of its
  /check-data sub-agents mid-pass; owner re-logged and asked to pick up. Successor RESUMED from
  disk state (M4 verified against the reviewer's independent numbers to 3–4dp before the kill;
  chain was at consumers/gates; determinism deferred-to-last per the memory-pressure fallback).
- 2026-08-10 10:17 — **L15 batched rebuild DONE and everything ordered PASSES** (M4 coherence
  0→2,105 rows with 65 funds recovered, net scored 2,210→2,269; full-artifact determinism
  bit-for-bit on 71.68M rows; FCNTX 20.0 in-band; 0 identity/leakage violations) — but /check-data
  FAILs both served features on FOUR residual hygiene classes, and the worker STOPPED with the
  run's best line yet: its own M3 acceptance criterion demonstrably failed (ATAFX — "I fixed an
  up-ratchet by creating a down-month and my own criterion couldn't see it"), so no third
  unilateral design round. Bonuses: **DODGX mystery SOLVED after three rounds** (primary_ticker
  binds X-class DOXGX; DODGX absent from fund_metadata — merges into the canonical-ticker item)
  and the **capital-gain defect is now proven SCORE-level** (fabricated weeks inside te_current
  windows; BIAGX served −230bps at HIGH confidence — re-scope required). **Adjudication round 2
  LAUNCHED** (criterion replacement first, the four residuals, serving-hold vs per-fund
  quarantine, what ships vs files).
- 2026-08-10 10:33 — **Round-2 adjudication delivered; finishing pass authorized and relayed.**
  Criterion replaced (honest re-score: "7 of 9" was 4 of 9); the ATAFX class re-diagnosed as
  TERMINAL LIQUIDATION GARBAGE → tail truncation (deletes no real mid-life return by construction)
  + non-terminal bridges quarantined; band widening REJECTED with a census (1.5× would zero real
  returns at scale; 162 of the sub-band steps carry the capital-gain Dec signature — an upstream
  defect a seam must not paper over); adjacency exemption's counted-never-failed ruled a fail-open
  (SHXPX proof) → flag+quarantine; excision-before-seam ratified. Serving hold NARROWED to an
  honest per-fund quarantine at the gold builder (~60–130 of 9,285 series, reasons persisted,
  both panels identically). **DODGX is SYSTEMATIC — all seven Dodge & Cox funds bound to X-class
  tickers** (evidence merged into the canonical-ticker item). Capital-gain RE-SCOPED score-level
  (BIAGX served −230bps at high confidence off fabricated weeks; blocks a serving reload at owner
  level, not the L15 commit). Successor executing the one-pass finish.
- 2026-08-10 03:24 — Steps 1–4 of the authorized plan done, with three more self-corrections on
  the record: u32 wrap CONFIRMED+fixed (truth 14,326 gain / 12,527 lose — and 92.7% of losses are
  the old code's returnless NAV=1.0 rebase row, correctly no longer emitted); the worker's own
  "year-end hole" attribution RETRACTED after checking (172/173 ETFs priced on 2021-12-31);
  **PFFA/TPZ adjudicated as FALSE POSITIVES with mechanism** (±60-obs MAD window dominated by calm
  months judges a real crisis close on a peacetime scale) — documented as the bounded fund-leg FP
  class per the ruling. M1+M2+M3 in (provenance twin matched); M3 acceptance 7/9 with WSCMX/JDSAX
  named residuals (one-way persistent sub-band jumps — NOT widened unilaterally); the contract
  caught a fallback bug (σ-unestimable path fell back to the 2× bar, self-defeating — FRCCX still
  ratcheting until fixed). BSCL example corrected. NAV v5 rebuilding; then determinism → M4 chain
  → consumers → census gate → /check-data.
- 2026-08-10 03:40 — Census PROVES M1/M2 repaired: near-2x steps 185→**31, below the pre-L15
  baseline of 32**; ETF leg pinned 0; the higher `extreme` count (491 vs 403) is BY CONSTRUCTION
  correct — pre-L15's tidier number was bought by censoring real crisis returns. **Worker refused
  to seed its own allowlist to green its own gate** (a reasonless entry is itself a failure by the
  gate's design); the dominant failing cohort (TAAG/BSCL/SMX/GILGX — recycled-ticker family)
  belongs EXCLUDED from serving via the identity item, not allowlisted. Gate stays honestly RED
  pending that adjudication — final-checkpoint question. replica_quality now twin-coherent by
  construction. Remaining: determinism → M4 chain → consumers → gates → /check-data → report
  corrections.
- 2026-08-17 12:09 — **L15 CLOSED (`c159f9a`), and it closed on a defect its own check found.**
  The dispatcher run died 2026-08-10 ~21:00 on a weekly usage limit with L15 one step short:
  the fresh `/check-data` on `profile_nav_series` was in flight and never landed. Resuming it
  was the whole job, and the check came back **FAIL** — v6's terminal-tail truncation anchored
  each series after its last observation that SURVIVED excision, so where a bad print's
  *reversion* was excised instead of the print, the print survived and truncation **promoted it
  to the series' final value** — the endpoint of every period-table window. **MMTMX served
  +60.06% for its terminal month against a +0.80% baseline while its four identical MassMutual
  share classes served +0.74–0.78%**, flipping the headline verdict in all three periods
  (1Y `diff_bps` −343 → **+5,956**). A fix shipping the exact wrongness it was built to remove.
  Owner adjudicated (anchor on evidence, all three threads in scope); the fix walks the anchor
  back using the **existing** `LOG_BRIDGE_SUSPECT` — no new threshold, band, allowlist or
  exemption — and unconverged series go to a new ledger untouched rather than a fallback. That
  ledger is **empty**: every terminal bridge converged. All six verification items measured on
  the served artifact: MMTMX reproduces the independent pre-L15 build to 1e-9 (a value not
  fitted to, corroborated by four siblings); **all 45 truncated tickers diffed per-series** —
  17 anchors moved one day, 2 charts changed, **0 regressed, 0 left the panel**; fabrication
  metric 24/18 → 23/17; both `/check-data` **0 blocking**; determinism **byte-identical incl.
  all 10 hygiene ledgers** (the anchor DECISIONS are deterministic, not just the arithmetic).
  Three side-quests worth the record: the rebuild died twice on a **16GB host** (swap thrash,
  then an OS kill) — resolved by stopping a two-week-old idle Supabase stack and making the NAV
  write **atomic**, after the worker correctly killed run 1 to avoid leaving a truncated
  `passive_alt_daily_nav.parquet` in the shared lakehouse; codex raised **2×P1** — a
  `build_l2_replica_quality` delete of `risk_decomp_td.parquet` that is dead only to ITS OWN
  builder while **five** scripts reference it (the consumer-audit-≠-literal-grep lesson again,
  and the cache is **already gone** — four risk builders will fail until it is regenerated),
  and `price_hygiene_census` registered as a permanently-red default gate. The census now
  **separates blocking from reporting** (ETF leg + ratchet + reason-requirement block; the
  unexplained count WARNs with cohort attribution) — and both naive versions of that change
  would have been silently self-defeating: the self-test asserted on the blocking flag so it
  would have passed **vacuously**, and a bare exit-0 WARN is **suppressed** by `run_checks`.
  Both caught and fixed. **MERGED to fund_score main `75980a3`** (owner-authorized 2026-08-17); web run record merged as `9f04894`.
  Parked for adjudication: thread (c) — the terminal one-way basis-break class is **~32 tickers,
  not 6** (11 KP* classes on 2020-12-07/09 + AQLGX; the terminal-position face of the known
  December capital-gain item, and RIMHX **+28.8%** against a benchmark that moved −1.4% is the
  tell) · SPAX run-selection (a new 14-month feed hole makes "most recent contiguous run" keep a
  1-month stub over a good 28-month run) · W3 quarantine-vs-score, now **tracking** (MSVSX moved
  −130 → −150 while chart-withheld) · **21 steps of ratchet slack** (ceiling 584, actual 563) ·
  the absent td cache. **Next READY: L2** (with L7 needing its single off-cycle L2 re-solve
  coordinated after all price-touching fixes).
