# Beta execution plan — the assembly line to invites

**Created 2026-08-06 (owner-directed). This file is the RANK-ORDERED DRAIN QUEUE for the beta
push.** A dispatcher session works it top-down with `/loop`; each item is executed by its listed
worker loop with its listed model/effort; all code review happens INSIDE the worker loops
(data-reviewer checkpoints + `/check-data` + codex gates, already wired); the owner is interrupted
ONLY per the contract below. Item detail lives in `backlog.md` / `specs/queue/` — this file holds
only rank, routing, and status. Update STATUS in place as items complete; this file is the run's
shared state and heartbeat carrier.

`heartbeat: 2026-08-07T00:10-06:00` ← dispatcher re-stamps from `date` output after every unit of
work (never extrapolate — the night-drain lesson).

---

## The owner contract (the ONLY interrupts)

The owner sets vision and has already answered every known product question (see register below).
The line stops for the owner at exactly these points — everything else is the line's call:

| # | Stop | When |
|---|------|------|
| S1 | Per-panel delta review → local serving reload GO | campaign cascade completes (other session presents) |
| S2 | Receipts display-floor sign-off (0.50 priced-NAV floor + 0.50–0.80 sleeve disclosure) | after receipts Segment-0 EDA confirms the numbers |
| S3 | Product review of the built V4 page (critic-panel results in hand) | before route cutover |
| S4 | Sharadar/Tiingo license confirmation | before ANY solver image push to a registry |
| S5 | Batch 4: beta go/no-go + invite list | blocker bar clear + cutover done + prod loaded |

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

- **F1 — lakehouse writes**: until the campaign session closes (S1 + finalize/merge), NO other
  session writes fund_score data or panels. Track L is BLOCKED on F1. Web work and fund_score
  *service code on a feature branch* (no data writes) are exempt.
- **F2 — one lakehouse-writing session at a time**, in a dedicated worktree, per-item commits,
  owner merges ([[shared-worktree-contamination]] / [[fund-score-worktree-shared-lakehouse]]).
- **F3 — branch-guard**: all commits on run/feature branches; NEVER push web `main` (auto-deploy
  = prod). Owner merges.
- **F4 — serving loads**: local reload = S1-gated; preview/prod loads only from the verified
  staging the local reload used ([[serving-db-ahead-of-branches]]).

## The queue (rank order; work top-down; skip BLOCKED, take the next READY)

Legend: STATUS ∈ ready / blocked(<on>) / in-progress / parked:owner / done.
Worker loops: `IN` = /implement-next (routes by track/lane, reads spec model/effort frontmatter);
`FD` = /fundscore-data:fix-data; `FB` = /fundscore-data:fix-bug; `SS` = /spec-story (lean spec).

### Track W — web + service code (READY NOW; exempt from F1)
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| W1 | Beta ops minimum (error tracking + feedback + analytics) — backlog Beta-launch group | SS→IN (lean→**standard**) | opus/med impl, session-model gate | **done** |
| W2 | Preview+prod load RUNBOOK (write only; execution is D1) — backlog Beta-launch group | SS→IN (lean) | opus/med | ready |
| W3 | Screener beta port (default: Postgres-served; see register) — backlog Beta-launch group | SS→IN (standard) | opus/high | ready |
| W4 | Solver HTTP service — `specs/queue/solver-http-service.md` (build code/container/web-swap/deploy-gate NOW; snapshot bake + AC3 deferred to D2) | IN (reviewed) | opus/high impl; gates session-model + codex --high | ready |
| W5 | V4 serving riders spec (skill strip + effective-positions) — backlog Beta-launch group; spec now, build in L after F1 | SS | opus/med | ready |
| W6 | Pipeline-state hygiene chore (3 rot spots) — backlog Hardening sweep | FB | sonnet/low | ready |

### Track C — campaign session (NOT this line's work; listed for sequencing only)
| C1 | Flat-tail detector fix → cascade resume → deltas → **S1** → local reload → finalize/merge | campaign session | — | in-progress (other session) |

### Track L — lakehouse (BLOCKED on F1; drain order below once armed)
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| L1 | Foreign-holdings enrichment CORE (BETA BLOCKER; unlocks L8) — backlog Working set item 1 | FD (reviewed, multi-segment) | opus/high impl; Fable-session gates | blocked(F1) |
| L2 | Wrong-price-series collisions sweep (BETA BLOCKER) — Working set | FD | opus/high | blocked(F1) |
| L3 | l2_blend_etfs share-class adjudication (BETA BLOCKER; merged item — sort-key fix FORBIDDEN) | FD | opus/high | blocked(F1) |
| L4 | value_score stale ticker fees ~139 funds (BETA BLOCKER) | FD | opus/high | blocked(F1) |
| L5 | Neighbourhood panel backend — `specs/queue/neighbourhood-panel-backend.md` (unblocks F-movement 03; independent of L1-L4, may run first if a second lakehouse window opens — F2 still binds) | IN (reviewed) | opus/high | blocked(F1) |
| L6 | recent-changes-te-ranked — `specs/queue/recent-changes-te-ranked.md` (unblocks F-movement on Recent Changes) | IN (reviewed) | opus/xhigh | blocked(F1) |
| L7 | V-spike price corruption 174 funds (BETA BLOCKER; needs ONE off-cycle L2 re-solve — coordinate with L2/L3 so the re-solve runs ONCE, after all price-touching fixes) | FD | opus/high | blocked(F1) |
| L8 | Taxonomy misroutes / ALT classification (BETA BLOCKER) | FD | opus/high | blocked(F1) |
| L9 | Per-stock receipts backend — `specs/queue/per-stock-receipts-backend.md` (**blocked on L1**; contains **S2**; on L1 close, blank its `depends_on:` per the spec's unblock note) | IN (reviewed) | opus/high | blocked(L1) |
| L10 | Riders build (from W5's spec) | IN (lean) | opus/med | blocked(F1,W5) |
| L11 | Superlative-guard check (top_bet_confident consumer check) — Working set | FB | sonnet/med | blocked(F1) |

### Track F — V4 frontend (movement-by-movement on /preview; needs S1 reload for real data)
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| F1 | Movements 00/01/02/05/06(partial) — served-after-reload fields; flip protocol per movement (5 conditions incl. methodology anchor + critic pass) — `specs/queue/profile-v2-production-cutover.md` | IN (reviewed, frontend) | opus/xhigh impl; sonnet craft critics; session-model data critics | blocked(S1) |
| F2 | Movement 03 (neighbourhood) | IN | opus/high | blocked(L5,S1) |
| F3 | Recent Changes section flip | IN | opus/high | blocked(L6) |
| F4 | Movement 04 receipts + 01 twin-diff card | IN | opus/high | blocked(L9) |
| F5 | Full-page critic panel `/critique-funds` → fix round → **S3** | critique pipeline | per-agent pins | blocked(F1-F4) |
| F6 | Route cutover (per spec §Final route cutover; force-dynamic stays) | IN | opus/xhigh | blocked(S3) |

### Track D — deploy + beta
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| D1 | Execute preview+prod serving loads (runbook from W2; prod stays owner-gated). **Also carries W1's ops-schema step: `node scripts/apply-ops-schema.mjs` against prod `henxcsknsjfadetomjeu` AND preview `yqyyvhcrmcwarxweusbw` — until it runs, ops writes fail soft and the beta records NOTHING.** W2's runbook must include it. | FD-style gated run | opus/high | blocked(S1,W2) |
| D2 | Solver snapshot bake + AC1-5 acceptance on preview; **S4** before image push | IN (continuation of W4) | opus/high | blocked(W4,D1) |
| D3 | **S5** go/no-go + invites (grant via scripts/grant-early-access.mjs) | owner | — | blocked(all blockers, F6, D1, D2) |

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
(none yet)

## Run log
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
