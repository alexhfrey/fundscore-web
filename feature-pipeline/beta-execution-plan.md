# Beta execution plan — the assembly line to invites

**Created 2026-08-06 (owner-directed). This file is the RANK-ORDERED DRAIN QUEUE for the beta
push.** A dispatcher session works it top-down with `/loop`; each item is executed by its listed
worker loop with its listed model/effort; all code review happens INSIDE the worker loops
(data-reviewer checkpoints + `/check-data` + codex gates, already wired); the owner is interrupted
ONLY per the contract below. Item detail lives in `backlog.md` / `specs/queue/` — this file holds
only rank, routing, and status. Update STATUS in place as items complete; this file is the run's
shared state and heartbeat carrier.

`heartbeat: 2026-08-07T03:18-06:00` ← dispatcher re-stamps from `date` output after every unit of
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
| W3 | Screener beta port (default: Postgres-served; see register) — backlog Beta-launch group | SS→IN (standard) | opus/high | **done** (web `feature/crescent-profile-v2`; fund_score `89044fb` on `w3/query-serving-tables` in worktree `fund_score-wt-w3` — **owner merges both**). Uncovered **P2**. |
| W4 | Solver HTTP service — `specs/done/solver-http-service.md` (code/container/web-swap/deploy-gate BUILT; snapshot bake + AC3 → D2) | IN (reviewed) | opus/high impl; gates session-model + codex --high | **done** (web `feature/crescent-profile-v2`; fund_score `6dc6dc7` on `w4/solver-http-service`, worktree `fund_score-wt-w4` — **owner merges both**) |
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
| D1 | Execute preview+prod serving loads — **follow `docs/RUNBOOK-serving-load.md` (W2, 2026-08-07)**; prod stays owner-gated. **SCOPE IS WIDER THAN THE ORIGINAL FOUR TABLES** (W2 finding): `apply_auth_schema.py` is MANDATORY — `resolveSession()` SELECTs `entitlements` on every signed-in render, so a missing table 500s every page for a beta user — and `apply-lens-schema.mjs` is mandatory for the live `/api/lens/quota` route. Plus W1's ops step: `node scripts/apply-ops-schema.mjs` on prod `henxcsknsjfadetomjeu` AND preview `yqyyvhcrmcwarxweusbw`, else the beta records nothing. F4 is met via the freeze-and-prove protocol, NOT a replay (see amended F4). Blocked additionally on **P1** (Supabase paid tier). | FD-style gated run | opus/high | blocked(S1,W2✓,P1) |
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

### P1 — Supabase paid tier for prod + preview (a spend commitment; blocks D1)
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

### P2 — `/screener` is still the pre-pivot demo page, and it is in the beta nav (blocks a full-experience beta)
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
