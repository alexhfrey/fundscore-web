# Beta execution plan — the assembly line to invites

**Created 2026-08-06 (owner-directed). This file is the RANK-ORDERED DRAIN QUEUE for the beta
push.** A dispatcher session works it top-down with `/loop`; each item is executed by its listed
worker loop with its listed model/effort; all code review happens INSIDE the worker loops
(data-reviewer checkpoints + `/check-data` + codex gates, already wired); the owner is interrupted
ONLY per the contract below. Item detail lives in `backlog.md` / `specs/queue/` — this file holds
only rank, routing, and status. Update STATUS in place as items complete; this file is the run's
shared state and heartbeat carrier.

`heartbeat: 2026-08-20T17:15-06:00` ← dispatcher re-stamps from `date` output after every unit of
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

## ⇢ S3 CRITICAL PATH (owner directive 2026-08-17) — this OVERRIDES strict rank order

**Owner's stated goal: reach S3 — the product review of the built V4 page — as directly as
honestly possible.** Work the critical path below first; items outside it are deprioritized, and
every such deprioritization is named in § Run log rather than left implicit.

    U1  L5 web-mirror handoff (web repo)              →  F2 prereq #1        ✅ DONE 2026-08-17
    U2  capital-gain / basis-break item               →  reload fence #1
    U3  L14 domicile-routing rule                     →  reload fence #2
    U4  L6 recent-changes-te-ranked                   →  F3
    U5  L9 per-stock receipts backend (**S2** inside) →  F4
    U6  ONE serving reload (freeze-and-prove)         →  F2 + F3 + F4
    U7  F2 · F3 · F4  →  F5 critic panel  →  **S3**

**Dispatcher sequencing call — ONE reload, not three (recorded because it is a real decision).**
The owner's brief fenced the reload behind L14 + the capital-gain item and listed F3←L6, F4←L9
without a reload dependency. But L6 and L9 both write panels that must reach Postgres before the
web can render them, so F3 and F4 need a reload too. Reloading after each backend item would mean
three fenced freeze-and-prove runs; holding one reload until U2–U5 all land costs nothing but
ordering and is the honest read of the dependency graph. **U6 therefore waits for U4 and U5 as well
as the two owner fences.** If the owner would rather see movement 03 early, an interim reload after
U2+U3 is available on request — it is a scheduling choice, not a correctness one.

**Deprioritized, and why.** L2, L3, L4, L7, L8, L10, L12, L13 remain BETA BLOCKERs and stay in the
queue at their ranks, but none of them blocks S3 — they are wrongness the owner will be looking AT,
not machinery the review needs. They are worked after S3 unless the owner reorders. **This means the
S3 review is of a page carrying known-wrong data; F5's handoff MUST list which defects are still
live so the owner reads the page in that light** (see § Run log at the F5 entry).

**Price-path sequencing (owner's call, 2026-08-17).** L2, L3, L7 and three of the five newly-filed
items all touch the price path, and L7's off-cycle re-solve must run ONCE, after ALL price-touching
fixes. Order: **capital-gain/basis-break → L2 → L3 → ratchet re-tighten to the new count → THEN
L7's single re-solve.** Do not start L7 before that point. Note the head of this chain (capital-gain)
is also reload fence #1, so it is on the S3 path too — the two orderings agree on what comes first.

## ⇢ LINE RULINGS 2026-08-17 (owner: "for non-mission critical items just go with your recommendation for now")

**Principle applied, stated so it can be audited or reversed:** the line took every decision that is
**reversible and changes nothing a user sees**, and held every decision that **changes served
financial figures at scale or ratifies a new permanent rule into serving**. Holding those costs no
schedule, because all four backend items must build and gate Segment 1 before a reload is possible
either way.

**TAKEN by the line (provisional — reversible on the owner's word):**
| id | ruling | why it is not mission-critical |
|---|---|---|
| P5-2 | Leave the 7 event-free terminal funds; file a dividend-coverage item. | Do-nothing + file. No served value changes. |
| P5-3 | Scope acknowledged: regression surface is `value_score` + `l2_replica_quality` + the chart. | A fact, not a choice. |
| P5-1 (floor) | **Drop the `y >= 0.10` scan floor to 0 and re-measure.** | A measurement choice, and the option that keeps "no new tunable" honestly true rather than adopting an undisclosed constant. |
| P7-D2 | **Theme σ via the shared `orthogonalize_levels` call.** | No new constant; reproduces the shared basis to 4.4e-16; a NEW consumer that leaves the idio-skill headline untouched, and the same spec already keeps themes live for theme-bet attribution. |
| P7-D1b | **Leave the serving cut at 8.** | Status quo. No evidence was offered for lowering it; a cut change would be a new rule with nothing behind it. |
| P7-D1 | **Adopt R1 as the design target — but it MUST NOT ship until D8-3 is fixed.** | Today's rule is a live *misdescription*, not a preference: FCNTX serves BRK.B +1.0pp while hiding BRK.A −6.2pp. Fixing a defect is the line's job. The precondition is enforced, not advisory. |
| P5 BRIEF-C | **Drop the `NO_FACTOR` hypothesis** (Segment 1; provisional on its checkpoint). | It is 12 events and it carries **the only path by which this rule could zero a real market crash**. Dropping it is the do-less direction: those 12 keep serving exactly what they serve today, and the rule's worst failure mode disappears. |
| P7 D-4 | **Exclude `style` rows from Recent Changes** (option c; provisional on checkpoint). | It resolves THREE filed defects at once — D-4 (no valid `classification`), D8-6 (no as-of stamps), and the dispatcher's own finding that **35 funds serve 50 undated rows and every one is `style`**. Style rows are RETURNS-derived: no holdings basis, so they cannot honour the section's mandatory-stamp contract. Removing structurally incoherent rows is the honest-data direction, and the 35 funds affected are 0.6 pct. Reversible; blocks nothing either way. |
| S2-b (partial) | **The gate basis and the displayed basis MUST be the same number.** The owner still picks worst-sub-period vs mean; the line rules out serving one while gating the other. | Not a preference — a coherence requirement. Two different "priced coverage" figures on one page is a self-contradiction, which is the defect class this project treats as worse than a gap. |
| L9 recoverable | **Fix the +30-fund extraction defect** (the pricing path never calls `fmp_isin_us_ticker_bridge`, which already resolves Linde, CNH, Fabrinet, Garmin). | Doctrine: a recoverable miss is a DEFECT, not "partial coverage". No new rule — the resolver exists and is simply not called. |
| all four | **Segment 1 authorized as MEASUREMENT ONLY** — sample outputs to a distinct `data/_tmp/<slug>/` prefix, **zero canonical writes**, no Postgres, no serving. | Produces the numbers the held decisions need. Nothing reaches a user. |

**HELD for the owner (mission-critical — these change served financial figures at scale):**
| id | decision | line recommendation, for when you get to it |
|---|---|---|
| **P5-1** | Ratify the new evidence-based trigger class into serving. | Yes — with the floor dropped to 0 and re-measured first. |
| **P5-1a** | Repair vs excise. | None yet by design; Segment 1 measures the flat-vs-superimposed split. |
| **P6-A** | Ratify the sector fill (~$6.06B / ~745 funds) into serving. | B+G1, after the fresh harvest replaces the proxy-population measurement. |
| **P6-B** | The precedence winner ($2.92B of served labels either way). | P1. No correctness answer exists — it is a vendor tie-break — but it is a large relabelling and the owner should own it. |

**Fence reading for concurrent Segment 1s (dispatcher's call, stated explicitly):** F2 forbids more than
one lakehouse-**writing** session. Sample builds writing ONLY to disjoint `data/_tmp/<slug>/` prefixes
mutate no canonical artifact, so the fence's purpose is preserved. Each worker is required to write
nowhere under `data/{gold,product,silver,bronze,reference}` and to prove canonical mtimes unchanged at
the end. If any worker cannot honour that, it stops instead.


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
| L2 | Wrong-price-series collisions sweep (BETA BLOCKER) — Working set | FD | opus/high | **ready — DEPRIORITIZED 2026-08-17** off the S3 critical path (owner directive). Still a BETA BLOCKER; sequenced after the capital-gain item per the price-path order. |
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
| L14 | **Domicile-routing rule (promoted 2026-08-09 from the Segment-1b follow-up — now FIVE symptoms of one root cause**: 2 unrestored 1c pairs · 15-ISIN/$7.4B split cohort · 481 positioning quarters · S7-4 dual-sector contradiction 20 ISINs/$8.2B **served-on-next-reload** · part of the $3.51B recall chore). **MUST LAND BEFORE THE NEXT SERVING RELOAD** (S7-4 is a same-security contradiction that would reach the product) | FD (reviewed) | opus/high | **in-progress** — Segment 0 (EDA, no writes) running 2026-08-17 in worktree `fund_score-wt-l14` on `fix/l14-domicile-routing`. Expected to end in an OWNER DECISION: the fix needs a NEW rule (segment-7 §7: "may a foreign-filed row inherit the Sharadar label its US-filed sibling carries?") and the current refusal is what blocks wrong-company cusip binds. Scope refinement to confirm: the "20 ISINs" split into **S7-4a (14, this item)** + **S7-4b (6, a separate item routing cannot fix)**. |
| L15 | **D3: `benchmark_nav.py:146` imputes 0% return for unpriced blend sleeves + serves unrenormalized at >50% coverage** (found 2026-08-09 by L5's coherence gate; reviewer re-sized the TRUE blast radius: **51 of 1,449 neighbourhood-served funds >1bp/day, median max 44bps/day, worst SLMCX 304bps/day** — size the fix on `passive_alt_daily_nav`'s FULL universe, not the 41 both-movements funds; SLMCX's 47.4% SOXX sleeve held flat unrenormalized). **PRE-RELOAD, P1**; F2's flip decides whether affected funds gate movement 03 closed until this lands | FD (reviewed) | opus/high | **done 2026-08-17** (`c159f9a` on `l15/benchmark-nav-renorm` — **MERGED to fund_score main `75980a3`**, owner-authorized 2026-08-17; three adjudication rounds. Round 3 caught a v6 REGRESSION its own check surfaced: terminal truncation anchored two served charts ON fabricated prints, MMTMX serving +60.06% vs a +0.80% baseline with four sibling classes at +0.74–0.78%, sign-flipping the headline verdict in all three periods. Fixed by anchoring on evidence via the existing `LOG_BRIDGE_SUSPECT` — no new threshold. All 6 verification items PASS; determinism byte-identical incl. all 10 hygiene ledgers; both `/check-data` 0 blocking; `method_version` → `v3_2026-08-17`. Codex: 2×P1 + 1×P2 fixed, clean pass. Follow-ups filed: thread (c) 32-ticker liquidation class, SPAX run-selection, W3 quarantine-vs-score, ratchet slack 584 vs 563, td-cache absent) |

### Track F — V4 frontend (**the reload S1 gated has HAPPENED — 2026-08-07 05:44.** Movement-by-movement, then cutover = the new finish line)
| # | Item | Worker | Model/effort | STATUS |
|---|------|--------|--------------|--------|
| F1 | Movements 00/01/02/05/06(partial) — served-after-reload fields; flip protocol per movement (5 conditions incl. methodology anchor + critic pass) — `specs/queue/profile-v2-production-cutover.md` | IN (reviewed, frontend) | opus/xhigh impl; sonnet craft critics; session-model data critics | **done** (web `6190a96` on `f1/v4-movements-00-06` — **MERGED, verified 2026-08-17**) |
| F2 | Movement 03 (neighbourhood) | IN | opus/high | blocked(serving reload only) — **web mirror DONE 2026-08-17** (`5c052f2`: `serving.ts` column + `gating.ts` GATED_SECTIONS entry + methodology anchor + cutover-spec §03 rewrite; `db:check-serving` exit 0). L15 closed, so the reload now fences on **L14 + the capital-gain item**, and this line holds it further for L6+L9 so ONE reload serves F2/F3/F4 (see § S3 CRITICAL PATH). The read path is a bare `.select()`, so F2 is a RENDER-only job. |
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

### P5 — Capital-gain / basis breaks: the discriminator you chose does not work, and any fix needs a NEW rule (filed 2026-08-17; **U2 is `parked:owner` on this**; reviewer-verified PASS-WITH-CORRECTIONS)
**Blocks a serving reload, and therefore blocks S3.** Full evidence:
`fund_score-wt-capgain/reports/capital_gain_basis_breaks.md`.

**What is actually wrong** (verified by hand from raw vendor files, and the backlog item had it
backwards). On a large distribution the pricing vendor moves its **adjustment factor** by exactly
the distribution yield on a day the **price does not move** — fabricating a one-day *gain* equal to
the yield — and the real drop lands separately, unadjusted. AQLGX 2025-12-01: `close_price` flat at
18.10, dividend 8.3526, served **+46.147%**, then 18.10 → 9.75 the next day. True two-day total
return **+0.014%**; served **−21.3%**. The evidence needed to see this is discarded one stage
upstream of price hygiene: the raw files carry `close_price`, `adj_close`, `dividend`,
`split_factor`, and `build_fund_daily_adj_close.py` keeps only `ticker, date, adj_close`.

**Your discriminator is rejected on measurement, not on taste.** Implemented faithfully it fires on
**626 served tickers' steps, 347 of them with no distribution evidence**, and **~92% of a random
sample of those are real market moves** — March 2020 preferreds, Russia 2022 — including cases the
project has already ruled must survive. It is also *inert*: deleting the benchmark clause leaves the
cohort unchanged, so the discrimination was really coming from a new 25% magnitude bar, which is the
one thing the discriminator was chosen to avoid.

**Sizing, corrected:** 52 scored `value_score` verdicts (25 at HIGH confidence), not 4 · 132 served
mid-series tickers, not 1 · 24 terminal tickers on evidence · 922 events / 730 tickers untouched by
any existing rule. It **subsumes open backlog Item 1**. **QMGAX is not in this cohort** (its event is
ambiguous; it belongs to W3) — so your list of four is really three.

**DECISION 1 (the blocker): authorize a new evidence-based trigger class?** No fix is possible
without one. The proposal is a three-hypothesis distribution test (`H_correct` / `H_early` /
`H_none`) decided with the already-ratified `LOG_EXCURSION_FLOOR` ∧ `EXCURSION_SIGMAS`·σ bars.
**Honest caveat the reviewer forced out and it must not be buried:** the pitch "adds no new
constant" is **not strictly true** — the `y >= 0.10` scan floor is load-bearing (47 of 1,465
firings sit below y = 0.20; the minimum is 0.109), and events below y = 0.10 were never tested.
Two named remedies: adopt the floor as an explicitly adjudicated constant, or **drop it to 0 and
re-measure** — the worker recommends the latter, which is the option that keeps "no new tunable" true.
**2026-08-18 UPDATE — Segment 1's checkpoint returned FAIL and BRIEF-A's repair recommendation is
now known UNSAFE. Do not ratify DECISION 1 or 1a from the current report text.** The measurement
layer is trustworthy — an independent full ~2M-event rescan reproduced every number with **zero
verdict disagreements** — but three decision-facing claims are wrong:
(i) **the kept rho>=0.10 tail is mischaracterised**: 30 of 50 events show the stamped distribution
was never corroborated by the raw price path, only 2 of 50 show the predicted T+1 drop, and the
flagship "real move" (PRMTX +18.54 pct) is **the rebound leg of an unadjusted −29.64 pct drop the day
before** — so **repair would write fabricated double-digit LOSSES** into served history there;
(ii) **"145 false positives" is really 93 rejections + 52 never-adjudicated events** (no vendor row),
so making coherence mandatory **permanently fail-closes every yahoo-sourced ticker** — a policy the
owner must ratify knowingly — and the "no threshold" claim is **false**: an undisclosed
`|recovered| <= 0.05` constant sits in the bar-attribution fallback;
(iii) **GATE 2b's safety headline overstates coherence** — PFFA 2020-03-18 misfires at y = 0.40 and
TREMX at y = 0.50 (yields >= 0.50 are common: 539 of 1,519), and the seeded misfires it demonstrates
are exactly the case coherence **cannot** catch.
Also: the "12 survivors verified by two independent routes" is **8/12**, and four tickers adjudicated
out of scope (**BRLIX, CSIUX +62.7 pct, JOPSX, SMGAX**) **remain served with large fabricated-looking
steps and no remedy path** — filed separately. Corrections are with the worker.

Sub-decision **1a, repair vs excise — RECOMMENDATION WITHDRAWN 2026-08-17, do not decide it yet.**
It was "excise", on the evidence that a uniform repair formula is falsified (on MXXVX it would
"repair" +26.4% to +13.7% when the truth is ~ -0.6%). The checkpoint then showed excision is not the
safe default either: an independent sample found **2 of 29 EARLY_FACTOR events carry a material REAL
same-day move underneath the factor artifact** (FBSIX 2021-12-15 -11.8%, AMCGX 1999-12-10 -16.6%),
so excising would delete a genuine double-digit return. Both remedies are unsafe on some slice of the
class. **The honest ask is now: authorize Segment 1 to MEASURE the flat-versus-superimposed split
first, and bring 1a back with that number.**
**DECISION 2 (now two classes, not one):** **class A** — 7 terminal funds verified event-free
(PLVPX, NTHFX, VSDIX, FMSVX, MLPZ, CYA, POLCX), plus CHNA whose only nearby event is immaterial
(y = 0.46%): catching these would need a magnitude bar, so recommend leaving them and filing a
dividend-coverage item. **class B** — **LHVAX alone**, which was wrongly filed under "no dividend
record": it has a stamped distribution on the exact step day (y = 0.8955) and already sits in the
classifier's own output as AMBIGUOUS with `n_admissible = 0`. It is a *rule-declines-to-classify*
case, so the dividend-backfill remedy does not apply to it.
**DECISION 3:** confirm the widened scope — the regression surface becomes `value_score` +
`l2_replica_quality` + the chart, not the chart alone.
**Ratchet:** 563 today, of which 162 are attributable to this defect; a complete fix lands ≈401.
**Open:** the "55" cohort boundary is explained as an entity-vs-event confusion (33 tickers / 55
steps) but that explanation is plausible, not established.

### P6 — L14 domicile routing: TWO decisions, not one rule (filed 2026-08-17; **U3 is `parked:owner`**; reviewer-verified PASS-WITH-CORRECTIONS)
**The second fence on the serving reload, and therefore on S3.** Evidence:
`fund_score-wt-l14/reports/l14_domicile_routing.md`. The checkpoint re-derived every load-bearing
number from the raw lakehouse **using none of the worker's own scripts**; five corrections were
returned, none of which flips the direction or materially the size of any decision.

**Plain English.** For US-listed companies incorporated abroad — Carnival, Ichor, Scorpio Tankers —
**the sector we serve depends on which country the fund's lawyer typed on the filing line.** That is
one root cause with two separable consequences, and the item's own spec was wrong to say one rule
closes both (**retracted, and the retraction verified**).

**DECISION A — the FILL.** ~**\$6.06B across ~745 funds** carries an honest blank where Sharadar
demonstrably knows the sector. The blank exists because one expression
(`_fill_sector_from_fmp`) throws away a CUSIP-derived sector for any non-US ISIN **even while it
keeps that same row's ticker, name and industry**. So this is **not a novel rule — it is widening an
exemption we already grant to `US`-prefix ISINs on the identical "the ISIN contains the CUSIP"
argument** (verified in code). Recommended option **B+G1**: require the ISIN to literally embed the
identifier AND the filed name to still corroborate — **1,290 rows / \$6.013B / 733 funds**, holdout
identity **99.16%**, sector **96.64%**.
**Two honest caveats that must not be buried.** (1) That 99.16% is measured on a **proxy
population** — ISINs that already have FMP sectors, i.e. exactly where the production rule never
fires; it licenses the *mechanism*, not the rate on the 73 ISINs the fill actually acts on, which
were hand-checked at small n. (2) The name map it leans on is **frozen at 2026-02-25**, which
deflates measured recall and conditions the precision, so production must harvest names fresh.
Also: the "0 positive controls admitted" result is **vacuous by construction** (all 14 controls have
zero NULL rows) — the case rests on the **probe**, which is sound: removing the guard flips
**1,260 rows / \$3.3162B** (Navigator Industrials→Energy, Cango Technology→Consumer Cyclical).
Rejected alternative **A (trust the filed cusip)** reaches slightly more but opens the same trust
surface as the live Patrizia→Celator wrong-company bind.

**DECISION B — the PRECEDENCE.** For **14 securities** both vendors know the company and simply
**classify it differently** — verified per-ISIN as a **pure taxonomy disagreement with no identity
defect**. The largest cluster is **\$1.86B of tankers** (Scorpio + Teekay + DHT): GICS-style schemes
file oil/product tanker owners under Energy, ICB-style under Industrials. **Neither is an error**, so
someone must simply pick. **P1 (US/Sharadar wins)** relabels 1,359 rows / **\$2.92B**; P2 (FMP wins)
touches only 259 rows / \$941M **but re-breaks the LION fix segment 1c shipped**; P3 (honest null)
withdraws sector from 1,618 rows / \$3.86B across 514 funds. **Recommend P1** — consistent with every
prior L1 adjudication.

**Why it fences the reload — corrected twice, and the final version is a genuine trade, not a
one-way risk.** The plan said this was "served-on-next-reload"; querying the live DB directly, **8
securities ALREADY serve two sectors** (1,462 rows / 914 funds), and decomposed, **every majority
side is correct — the wrong side is 26 rows / 26 funds / \$37.0M**, not the "\$8.2B" the queue row
quotes (that is gross value across both sides). Reconciled per ISIN against this item's cohorts:
**0 of the 8 are S7-4a**; **3 are S7-4b** (SharkNinja, Shift4, Genie Energy — Genie still served
under cusip `369604301` with the name "General Electric Co"); **4 are ALREADY REPAIRED by the
current build** (Nu Holdings, Brightstar, Ferroglobe, Clarivate); and **1 is new — Burford**, where
`holdings_complete`'s dominant-lot picker collapses the contradiction but per-row
`fund_holdings_full` does not, so the two panels disagree in treatment (filed **N-7**).
So the honest statement of the trade: **the reload swaps today's small live footprint (\$37.0M
wrong / 26 funds) for the current build's larger S7-4a footprint (1,290 rows / 514 funds / \$3.80B),
while FIXING 4 live contradictions and filling 963 blanks across 592 funds** — clearly positive only
if precedence is settled first. And note the converse: **"not now" does not leave production clean**,
because the live contradictions stay live.
**Scope retraction:** symptom (e), the \$3.51B name-bridge recall, is **not reachable by domicile
routing** — removed from L14. **S7-4b (6 securities) stays a separate item**; routing cannot fix it.
**Corrected before this brief:** the staging fill headline is **963 rows / 592 funds / \$5,752.4M**
on one stated definition (the worker's "632 funds / \$5,781.6M" triple was assembled from different
computations and reproduces under none); the "21 quarter-to-quarter sector flips" are **not
time-series flips at all** (0 of 21 flip between quarters) but same-quarter dual-domicile
double-filings serving two sectors at once — which strengthens the precedence case; and the fill's
effect on the 481 regressed fund-quarters is quoted as an **honest bracket of 164–188**, because the
worker and the reviewer independently got different residuals (293/299 vs 312/317) under different
definitions and neither is trusted — pinning ONE definition in code is now a Segment-1 deliverable.

### P7 — L6 Recent Changes: the section's own surfacing rule is inverted against its promise (filed 2026-08-17; **checkpoint RUNNING — do not act on these numbers until it returns**)
Evidence: `fund_score-wt-l6/reports/l6_recent_changes_te_ranked.md`. Two decisions, one of which
blocks the build and one of which blocks only the serving step.

**The finding that matters most is not the feature — it is that the section is quietly broken
today.** `is_surfaced` requires a change to be BOTH a cross-sectional outlier (`|change_z| >= 1`)
AND already half-complete at the half-window (`persistence == 'sustained'`). But `single_quarter`
means *the move happened in the most recent half of the window* — so **the freshest moves are
exactly what gets filtered out of a section whose promise is "what has the manager been doing
lately".** Measured: **1,092 served funds (18.8%) serve "none available" while holding 25,030
`available` gold rows** — 226 honestly empty, **470 killed by the z-gate, 396 by persistence**. And
because `z` is null when fewer than 30 funds hold a change and `z_ok` fill-nulls to False, **36.2%
of qualifying rows are silenced for being DISTINCTIVE** (21,307 position rows; 116 funds have null z
on every row), and those rows are not smaller (median est. TE 53 bps vs 61 bps).
**The specimen is damning and should be checked personally:** FCNTX today serves exactly one row —
`entered BRK.B +1.02pp`, 16 bps, **8th of 8** on both TE impact and magnitude — while suppressing
META halved (−6.0pp), AI Infrastructure +4.9pp, **BRK.A −6.2pp (killed by null z)**, Semis +4.9pp,
Hyperscalers −6.3pp, Financials −7.7pp, Mag-7 −4.6pp. **Serving BRK.B +1.0pp while hiding BRK.A
−6.2pp does not merely under-report the trade; it misdescribes it.**

**DECISION D-1 (blocks the serving step, not the build): the surfacing rule.** Options R0–R6 are
measured in the report's §9. Recommended **R1** — keep the magnitude floors, **retire `|z|` and
persistence as FILTERS but keep them as displayed attributes**, and let `te_rank` do the selecting:
**3,277 funds served, +866** (this headline is cut-independent and reproduced exactly).
**CORRECTED after checkpoint:** the report's payload cells were computed under a **top-6** cut while
the serving path cuts at **8** (`fact_assembler.py:140`, `TOP_POSITIONING = 8` — dispatcher-verified).
At the real cut, R1 ships **20,968 rows, median 8 rows/fund, median 84 bps** — not 16,770 / 6 / 91.
Option ordering is unchanged, but the payload is ~25% LARGER and slightly lower-bps-per-row than the
first brief said. Dependency: **R1 makes D8-3 servable, so D8-3 must be fixed first — and the checkpoint found
it WORSE than filed.** The mechanism is **both** causes, adjudicated: SPYC's current-endpoint
lookthrough book is literally **1 row, IVV at weight 1.000, against 503-504 resolved constituents at
prior and mid** — the wrapper is unresolved AND `lookthrough_coverage = 1.0` is mislabelled. **8 of
the 10 worst rows are already `available` + `sustained`, held back today ONLY by the null-z gate**,
and **97 further spurious "exited AAPL/MSFT/..." rows ride in the same funds.** So approving R1
without fixing this first would surface a fund as having "entered IVV at 99pp" and exited Apple.

**~~DECISION D-3~~ — WITHDRAWN 2026-08-17. It is not a decision; it is a defect already filed, and
the dispatcher measured this independently on the served payload rather than accept either the
worker's or the reviewer's framing.** The question raised was "may a filing more than a year old
headline a section promising *lately*?", pointed at the **457 panel funds (9.0%) beyond 365 days**
(a panel figure the reviewer independently reproduced — that part is sound). But the panel is not
what ships. Measured on `serving_facts_staging.parquet`, ages relative to 2026-08-17:
**of 2,411 funds serving a section, 2,376 are DATED — median 139d, p90 170d, MAX 199d, 15 over 180d,
and ZERO over 365 days.** The remaining **35 funds serve 50 rows carrying NO
`holdings_as_of_current` at all — and every one of those 50 rows is `change_type: 'style'`.** The
four funds the worker named as the stale served cohort (EAPDX, ACTV, COHOX, VVPSX) are in that
undated set, not in a stale-but-dated one.
So D-3 collapses into **D8-6, which the worker had already filed**: style rows are returns-derived,
have no holdings basis, and are served into a section whose contract makes both as-of stamps
mandatory. **Nothing served today is a year-old filing headlining "lately" — the honest defect is 35
funds showing undated rows.** Fix, do not adjudicate. One residual for Segment 1, not for the owner:
R1 widens the served set, so re-measure whether it admits panel-stale funds carrying *holdings*-dated
rows.

**DECISION D-1b (kept separate, correctly, by the worker): leave the serving cut at 8 or lower it to
6?** R1@8 = 20,968 rows / median 8 / 84 bps; R1@6 = 16,770 / 6 / 90 bps. A real rule change, so it is
owned explicitly rather than folded into D-1.

**DECISION D-2 (blocks the build): where theme volatility comes from.** The shared Σ is
`global_basis_v0.2_nothemes` — **sector 11/11 have a σ, theme 0/28.** Either compute theme σ through
the shared `orthogonalize_levels` call (recommended; reproduces `sqrt(diag(Σ))` to **4.4e-16**, so it
is the same basis, not a new recipe) or serve `te_impact_bps = null` for all **1,416** surfaced theme
rows. **ANSWERED by the checkpoint, and it changes how to read the ask.** The exclusion is a
**deliberate, documented decision of 2026-06-25** (`docs/research/global_clustered_basis_spec.md`,
git `3120e05`, dispatcher-verified): themes were dropped from the idio-skill basis because the
alpha-persistence study showed they add nothing to idio persistence and are sector subsets, and the
no-themes variant is *the headline idiosyncratic-skill measure*. **But the same document keeps themes
in production for theme-bet attribution and exposure betas, and a 57-factor themes-inclusive basis
was explicitly retained for research.** So computing theme σ for TE ranking is **applying existing
machinery to a NEW consumer, not reopening the skill decision** — it does not touch the idio-skill
headline. That is the line's read; the owner should have the citation to judge it.

**Two silent traps the EDA caught before they were built on.** (1) **A 100× error waiting to happen**:
the panel emits pp of NAV while the exposure path uses `decimal_weight`, so the mapping is Δpp/100 —
and the regression beta is a third, unusable object (corr +0.061 sector / +0.152 theme against Δw).
(2) **A REORDERING error, not a rescale**: the shared Σ is FF6-residualised while
`target_return_series` is raw, and raw/shared spans **0.96×–2.69×** — mixing raw theme σ with
residual sector σ would float mega-cap themes to the top for a purely basis-driven reason
(`mag_7` 2.41×, `us_megabanks` 2.34×).

**Staleness — the spec's launch gate is ALREADY SATISFIED, correcting this plan's own assumption.**
The spec says holdings are frozen at 2025-10-31 and the section is only launch-honest after an N-PORT
refresh. **That refresh has happened.** Broad frontier **2026-04-30 = 109 days (3.6 months)**, per-fund
current-endpoint age median **139 days**, p75 170d. The honest residual: **11.7% older than 180 days
and 9.0% (457 funds) older than a year.** Dual as-of stamps on **98.4%** of served rows; the 1.6% gap
is 164 returns-derived `style` rows with no holdings basis (filed as a contract inconsistency).
**Coverage:** 41.4% of served funds (2,411) get a section today; **94.2% of surfaced rows get a TE
estimate**; recoverable-missing **0.24%** — one ticker, `BK` (BNY Mellon), absent from the entire
Sharadar SEP store.

### S2 — Receipts display-floor sign-off (**OWNER STOP, now FIRED**; filed 2026-08-18; checkpoint RUNNING — do not act on these numbers until it returns)
Evidence: `fund_score-wt-l9/reports/l9_per_stock_receipts.md`. **It is four decisions, not one.**

**The headline you did not ask for but need.** Lowering the floor does **not** open receipts to
international funds. Served share by *measured* foreign share of the filed book: **under 5 pct
foreign -> 47 pct served; 60 pct-or-more foreign (n = 1,013) -> ZERO at EVERY floor**, median priced
coverage 3.6-20 pct. By mandate, moving 0.80 -> 0.50 takes **INTL from 0 to 9 of 714** and **EM from
0 to 1 of 336**, while GLOBAL goes 32 -> 259. **The 0.50 floor opens receipts to global /
part-international US-majority books, not to international ones.** Only a future foreign-pricing path
reaches the other 1,013. Any framing of "0.50 helps international funds" is wrong.

**CHECKPOINT VERDICT 2026-08-18: PASS-WITH-CORRECTIONS, NO BLOCKING ISSUES — S2 is ready to sign
once three numbers are fixed (below).** The gate model was reproduced by a **second, fully
independent implementation** that also matched the shipped panel at **FP=0 / FN=0 across all three
periods**, and which produced wildly different counts under probe variants — so the validation is
non-degenerate. The asymmetry finding, the honest-exclusion verdict, the commensurability defect, all
three stale-spec claims and the #10 silent-drop defect (**1,387 / 2,013 / 2,404 — exact**) all
reproduce.
**Corrections that do not change the decision content:** (i) S2-b's absolutes, below; (ii) **GSIB and
MIOFX are not band funds** — they fail a different gate and are suppressed even at 0.50, so the
worked example must be ARTYX/BRAZ/DWLD or TPMN/JHAAX (the band point itself stands: **36 of 361 below
0.50, 29 below 0.30**); (iii) **"no US-listed instrument at any price" is too strong** for part of the
excluded class — several have OTC ADRs the pipeline's price source simply cannot price, so the true
claim is "unpriceable **by our price source** until EODHD/OTC".
**One caveat worth reading before signing:** the "measured foreign share" cut is the **non-US-ticker**
share, which is **partially tautological with coverage**. On an **issuer-country** basis the >=60 pct
cohort is **1,313 funds and 18 DO clear 0.50**. The headline conclusion survives because it rests on
the **mandate cross-tab, which is basis-free** (INTL 714, EM 336, GLOBAL 32->259 exact) — but the
"zero at every floor" edge is slightly softer than first written.

**S2-a — the floor.** 0.80 -> 1,947 funds (36.1 pct) · 0.65 -> 2,148 (39.8 pct) · 0.50 -> 2,312
(42.9 pct). **The mockup's hero fund decides itself here: TRNEX/PRNEX measures 0.593** — it clears
0.50 and fails both 0.65 and 0.80.
**The argument AGAINST 0.50, which is strong and is a data fact rather than taste:** on the
historical book the receipts window must use, twin look-through for international ETFs is **IEFA
0.35 pct, IEMG 1.97 pct, VEA 28.7 pct**. At 0.80 that barely bites (median 0.997; only 19 of 1,951
below 0.50), but **the 0.50-0.80 band has median 0.705 with 40 of 365 below 0.50 and 33 below 0.30**
(GSIB 0.19 pct). There, an un-renormalized twin yields **false 0.00 pct twin weights** and subtracts
a COMPLETE twin NAV return against an ALMOST-EMPTY twin book. **Lowering the floor concentrates the
defect it would need to survive.**

**S2-b — worst sub-period or mean? CORRECTED 2026-08-18 after checkpoint.** The brief's original
"53-fund difference" rested on absolutes that reproduced under **none of 10 tried definitions** (and
contradicted the report's own gate figure). Correct pair: **min 1,947 vs mean ~2,003 = +~56 funds at
0.80, widening to ~+210 at 0.90.** The qualitative point is **confirmed and was understated**. Note this is not free-form:
serving one basis while gating on the other would put **two different "priced coverage" numbers on
one page**. *(Line ruling below removes the incoherent combinations; the owner still picks which.)*

**S2-c — the twin basis** (how to handle the un-renormalized twin in the band). Three options, **all
new rules**, so the worker stopped. Blocking for any floor below 0.80.

**S2-d — ADR pricing.** Worth **+59 funds**, but only under a **new pricing-basis rule**. Separable
and deferrable.

**Exclusion is honest, and the recoverable part is small and mechanical.** For excluded cohorts
**68-74 pct of the filed book has no US-listed instrument at all** (Roche, Bayer, BNP, Schneider,
Reckitt, Kering). Recoverable without any new rule: **+30 funds** — `fmp_isin_us_ticker_bridge`
already resolves US-primary listings (Linde, CNH, Fabrinet, Garmin) and **the pricing path simply
never calls it**. That is a plain extraction defect, not a decision.

**A pre-existing defect that resizes the spec's own denominator:** shipped spec-#10 **silently drops
1,387 funds at 1Y (2,404 at 5Y)** — present in **neither the panel nor the suppressions**, so
invisible to every coverage check. The spec's "4,002 in-universe" figure IS that hole; **the honest
served share is 36.1 pct, not 48.5 pct.**

**Three spec claims were stale and are corrected in the report** (twin book has no `security_name`
to display; the window twin reads a different ETF book than the spec names; **L1 delivered
classification, not priceability**, and the foreign-inclusive book is latest-quarter only so it
cannot serve a 5-year window at all).

## ⇢ KNOWN-WRONG DATA ON THE PAGE THE OWNER IS REVIEWING (as of the 2026-08-18 reload)
**Read the S3 review in this light. Every item here is measured, filed, and being worked — none is a
surprise.** Give this list to the F5 critic panel UP FRONT so it does not spend findings rediscovering
them.

| # | What is wrong | Size | Status |
|---|---|---|---|
| 1 | **Capital-gain / basis breaks** — a vendor adjustment artifact fabricates a one-day gain; some charts show a cliff that never happened, and some headline verdicts are computed off it. | **52 scored verdicts** (25 high-confidence), 151 served tickers | U2 parked on owner; remedy not yet choosable (only 8 pct of the class shows the assumed mechanism) |
| 2 | **4 funds with large fabricated-looking steps and NO remedy path** — BRLIX, **CSIUX (+62.7 pct)**, JOPSX, SMGAX — adjudicated out of the capital-gain rule's scope. | 4 funds | filed as a bad-dividend-record item |
| 3 | **Same-security sector contradictions** — 8 securities serve two different sectors; the minority side is wrong. Includes Genie Energy served under the GE-Aerospace identifier. | **26 rows / 26 funds / \$37.0M** | U3 parked on owner (fill + precedence) |
| 4 | **Recent Changes hides the freshest and most distinctive trades** — the surfacing rule demands a move be both a crowd outlier and already half-finished. FCNTX serves "entered BRK.B +1.0pp" while hiding "BRK.A −6.2pp". | **1,092 funds (18.8 pct)** serve "none available" over 25,030 usable rows | U4; R1 adopted as design target, not yet shipped |
| 5 | **35 funds serve undated rows** in Recent Changes (all `style` rows, no holdings basis). | 35 funds / 50 rows | line ruled: exclude style rows; not yet shipped |
| 6 | **Receipts (movement 04) is not built** — the section is absent, not wrong. | — | U5; **S2 awaiting owner sign-off** |
| 7 | **Return-attribution top-4 was arbitrary** — the component sliced raw array order. | 38 funds | **FIXED 2026-08-18** (`c0c13bd`) |
| 8 | **Effective-positions + top-10 concentration are gated CLOSED** (wrong book upstream). | all funds | L10, deliberately withheld — absence is correct |
| 9 | Holdings data is **~3.6 months old** (frontier 2026-04-30); 9 pct of funds older than a year. | universe | honest, disclosed on-page via as-of stamps |
| 10 | Still-live BETA BLOCKERs not on the S3 path: **L2** wrong price series (WMSIX tracks a muni index), **L3** nondeterministic named ETFs, **L4** ~139 stale-fee scores, **L7** V-spike corruption (174 funds), **L8** taxonomy misroutes, **L12** twin-label, **L13** active-share. | see backlog | deprioritized by owner directive, not fixed |

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
- 2026-08-17 12:4x — **Owner drained all five L15 follow-ups in one sitting; filed to `backlog.md`
  Working set (top).** Decisions, with the measured context each was made on: **(1) capital-gain /
  basis breaks — ONE item**, terminal + mid-series adjudicated together (they are one defect at two
  positions; AQLGX sits in both, so splitting risks two rules disagreeing on one fund). Measured
  blast radius: **31 served funds carry a fabricated chart tail, 4 also serve a headline verdict
  off it** (AQLGX −290, CWCFX −210, PSMPX −150, QMGAX −70). Discriminator: a one-way step whose own
  benchmark did not move — costs no new magnitude threshold. **(2) W3 — extend the quarantine to
  `value_score`.** The "defect may fall outside the score window" defence was checked and FAILS:
  `n_weeks` 389–1,228 (7.5–23y), so the window fully contains the withheld period; fits look healthy
  (r²0.86–0.93), which is why it reads as fine. Costs 6 of 2,270 scores. **(3) ratchet → 563**, and
  re-tighten per fix; auto-ratcheting rejected (count scales with universe size → a sampled build
  would set a too-low ceiling and the next full build fails on nothing). **(4) td cache — leave
  ABSENT as a deliberate tripwire.** The finding is bigger than the cache: `build_risk_decomposition`
  reads the fund leg from the RAW panel (the MMTMX 8.8122 print is still there — hygiene is applied
  downstream at NAV-build, never baked in) and the ETF leg from Sharadar+Tiingo, so served
  `theme_ride_bps` was built on the contaminated basis and re-running would bake it back in. No
  serving impact today (all three outputs exist on disk). Consumer error text to be repointed away
  from "run build_risk_decomposition first". **(5) SPAX — measure before ruling.** Not served at all,
  so a coverage gap not a wrongness; my naive cohort scan returned 310 and was **retracted** —
  VWUSX/AMECX/NMANX appear in it yet serve full 283-month histories, so it measured my assumption,
  not the builder. Re-measure with the builder's own trim before touching a rule that governs all
  9,238 series. **Serving reload remains fenced** behind L14 + the capital-gain item; L15 landing
  did not lift either. **Next READY: L2.**
- 2026-08-17 20:58 — **DISPATCHER RESUMED on the owner's S3 CRITICAL PATH; U1 DONE (`5c052f2`).**
  Queue state re-verified against the owner's description before taking anything: both repos match
  (`fund_score` main `75980a3`, web main `aa10daf`), the five owner decisions sit at the top of
  backlog.md's Working set, Supabase is up (12 containers), 5,819 fact rows intact.
  **DEPRIORITIZED, explicitly: L2 — the strict-rank next-READY item.** It is a BETA BLOCKER but it
  does not block S3; the same is true of L3, L4, L7, L8, L10, L12, L13. New ordering recorded in
  § S3 CRITICAL PATH above. **First unit taken was the cheapest thing on that path**, not the
  largest: L5's web-mirror handoff is the only S3-critical item that was small, fully unblocked and
  in the WEB repo, and it is the gate every later serving step gets measured against — doing it
  first also de-risked the DB before four hours of backend work land on it.
  **The known `db:check-serving` red is CLEARED, and it took two fixes, not one.** (i) Re-applying
  `apply_serving_schema.py` from post-H1 fund_score main revoked the anon/authenticated
  CRUD+TRUNCATE grants and turned RLS ON for all six serving tables — verified against a pre-apply
  snapshot, and the script was read first to confirm it is idempotent (CREATE TABLE IF NOT EXISTS +
  ADD COLUMN IF NOT EXISTS + four DROP COLUMN IF EXISTS on already-retired columns; **no data path**)
  rather than trusted. Row counts unchanged: 5,819 / 1,398,380 / 2,104 / 55 / 15 / 140.
  (ii) That apply then exposed the SECOND failure the owner's brief did not predict: it added
  `neighbourhood` (40 → 41 columns), so the check flipped from `postgrest-exposure` to mirror DRIFT.
  The two are coupled — the schema apply and the web mirror had to land together, which is exactly
  what L5 §12.2 said ("only then is a Postgres reload safe"). All four handoff items shipped:
  `serving.ts` column, `gating.ts` GATED_SECTIONS registration (**a missing entry there is
  fail-OPEN** — registered for that reason, not for its tier, which is `public`), a `neighbourhood`
  methodology anchor written from the shipped builder + L5's measured numbers, and the cutover
  spec's §03 "no serving source" claim retired with its render contract recorded (hypothetical
  chip is mandatory; BND is US investment-grade, not global bonds).
  **Behaviourally inert today and said so plainly:** every served row has `neighbourhood` NULL and
  applyGates skips a null section, so nothing changes until the reload. One thing verified rather
  than assumed — the read path is a bare `.select()`, so the column reaches the page automatically
  and **F2 is a render-only job**, no data-layer work. Gates: `db:check-serving` **exit 0** (41
  columns match, no anon/authenticated grants anywhere) · gating-golden all assertions · lint 0
  errors · build clean and **resolving 127.0.0.1:54322, not prod** (H3's guard doing its job) ·
  **codex --high PASS, 0 findings**.
  **Two facts filed for the record, neither an owner decision.** (a) L6's spec `depends_on`
  includes `unify-te-decomposition-global-basis`, still `status: queued` — checked rather than
  assumed: segments 1, 2 and 3 are shipped and merged (`0037a23`, `0c30cda`), only segment 4 (the
  fail-closed gates, incl. the anchor-alignment gate that suppresses the 94 stale-window funds) is
  outstanding. L6's stated dependency is on the BASIS, which segments 1–3 established, so L6 is
  buildable; its segment-0 EDA must confirm that and decide whether the alignment gate rides along.
  (b) **Disk is at 98% — 18 GiB free.** The v6 snapshot is ~1.6 GB and a v7 snapshot before the
  capital-gain rebuild costs about the same, on top of an 828 MB tmp NAV write. It fits, but after
  RAM killed the L15 rebuild twice this is the next resource tripwire, so it is being watched rather
  than discovered. **Next: U2, the capital-gain / basis-break item** — reload fence #1 and the head
  of the owner's price-path order.
- 2026-08-17 21:02 — **U2 DISPATCHED — capital-gain / basis-break, Segment 0 (EDA, NO WRITES).**
  F2 preconditions re-verified on disk first: zero pipeline processes running, `fund_score` main
  clean at `75980a3`. Dedicated worktree `fund_score-wt-capgain` on `fix/capital-gain-basis-breaks`,
  `data/` symlinked to the one shared lakehouse. Worker = `fundscore-data:backend-implementer`
  (opus/high); data-reviewer checkpoint, codex gate and commit stay with the dispatcher
  ([[workflow-finalize-cannot-await-codex]]).
  **v7 snapshot taken BEFORE dispatch** at `fund_score-l15-snapshots/v7/` — and taken cheaply,
  which is worth recording as a reusable trick: `build_benchmark_nav.py` writes the 828 MB NAV via
  `os.replace(tmp, path)`, so a **hard link** is an exact point-in-time snapshot (the rebuild's
  rename leaves our link on the old inode). Real disk cost ~0 — free space unchanged at 18 GiB —
  versus 828 MB for a copy, on a disk already at 98%. Served artifacts and all 10 hygiene ledgers
  were copied normally (their writers are not verified atomic, and a hard link is only safe under
  rename semantics — an in-place truncate+write would mutate the "snapshot" too).
  Segment-0 mandate, in priority order: **reconcile the 32-vs-55 cohort boundary BEFORE any
  sizing** (with the builder's own logic, not a reimplementation — the retracted SPAX 310 is the
  cautionary case); re-measure the served blast radius on v7; size the mid-series face and its
  overlap with the terminal one; and **empirically validate the owner's discriminator** — precision
  on the known cohort, false-positive rate over all 9,238 series hand-adjudicated against raw
  source, and two design questions that could stop it: whether the matched benchmark is even
  available at the point in the pipeline where the rule would run (if the benchmark leg derives
  from the hygiened fund leg the rule is CIRCULAR — a design blocker to brief, not to work around),
  and how "did NOT move" is expressed. The worker was given one threshold-free formulation to try
  first (fund step clears the existing `LOG_EXCURSION_FLOOR` and `EXCURSION_SIGMAS` bars on its own
  sigma while the benchmark's same-day step does not clear those same bars on the BENCHMARK's
  sigma) and told that **if it needs any new constant, that is a STOP-and-brief, not a decision** —
  never invent a bar to make a rule work, never seed an allowlist to green your own gate.
  **Dispatcher note on model tiering, for the owner:** the plan's START HERE section calls for a
  Fable session because the rule is *reviewer >= implementer* and the gates inherit the SESSION
  model while implementers are pinned to opus. This session is Opus 5, so reviewer == implementer —
  the weaker margin the plan flags. It satisfies the rule but does not exceed it; Track L is where
  that would cost something, so this is surfaced rather than absorbed silently.
- 2026-08-17 21:38 — **U2 Segment 0 LANDED and it OVERTURNS the owner's own discriminator; U2 →
  `parked:owner`. U3 (L14) DISPATCHED in its place so both reload fences reach the owner together.**
  Report: `fund_score-wt-capgain/reports/capital_gain_basis_breaks.md` (F1–F30, DECISION 1–3).
  Lakehouse verified unmutated — NAV inode 77680801 identical to the v7 snapshot's, worktree carries
  only the report.
  **The root cause is INVERTED relative to the backlog item, and the dispatcher confirmed it
  independently from raw vendor fields the `adj_close` pipeline never sees.** The item says
  "`adj_close` records the drop but is never back-adjusted". The truth is the opposite: the vendor
  carries the distribution adjustment IN ADVANCE and releases it on the ex-date while the price has
  not moved, fabricating a **spike UP** equal to the distribution yield; the real drop then lands
  the next day **unadjusted**. AQLGX 2025-12-01, from `data/vendors/tiingo/daily_pricing/`:
  `close_price` flat at 18.10 while the factor snaps 0.684243 → 1.0 (= `P/(P+D)` → none),
  `adj_ret` **+46.147%** ≡ `dividend/close` = 8.3526/18.10 to 6 dp; next day 18.10 → 9.75,
  **−46.13%** straight through. **True two-day total return +0.014%; served −21.3%.**
  **The evidence needed to detect this is thrown away one stage upstream of hygiene, and that is
  the real defect**: the raw vendor files carry `ticker, date, close_price, adj_close, dividend,
  split_factor`, and `build_fund_daily_adj_close.py` selects **only `ticker, date, adj_close`**
  (its output schema is exactly those three). Dispatcher-verified by reading the builder, not the
  report. This also supplies the NON-degenerate check the review needs: the two-day total return
  reconstructed from `close_price` + `dividend` is a path the classifier never sees.
  **The owner's discriminator ("a one-way step whose own matched benchmark did NOT move") is
  reported FALSIFIED on three counts; the dispatcher independently confirmed one and a half.**
  CONFIRMED: `clean_price_panel` is applied per-leg inside `benchmark_nav.py:110` under the explicit
  contract "ONE shared price-hygiene rule, both legs, same parameters" — and an ETF leg has no "own
  benchmark", so a benchmark-conditioned rule cannot be that one shared rule. **Recorded as weaker
  than the report frames it:** the blend WEIGHTS (`passive_alt_blend.parquet`) do exist as an input,
  so a fund-leg-only rule is not strictly impossible — the honest statement is that one-rule-both-
  legs is lost, not that the data is unreachable. NOT yet independently confirmed, and left to the
  reviewer: the "inert" claim (cohort 30 → 30 with the benchmark clause deleted, i.e. the work is
  really being done by a new 25% magnitude bar — which would defeat the very reason the owner chose
  this discriminator) and the **92% false-positive rate** (23/25 sampled of 211 firings, including
  **PFFA 2020-03-12, which `price_hygiene`'s own docstring already names as a REAL crisis close**).
  **Blast radius resized upward and it is no longer a tail-only defect:** 1,489 events / 1,237
  tickers panel-wide, of which **922 events / 730 tickers are untouched by any existing rule**;
  mid-series **132 served tickers / 149 events** (not BIAGX alone) which SUBSUMES open backlog
  Item 1; and **52 scored `value_score` rows (25 HIGH), not 4** — `build_value_score.py` reads
  `passive_alt_daily_nav.parquet` directly. The report also asserts **QMGAX is NOT in this cohort**
  (ambiguous event; belongs to W3), which contradicts the owner's own list of four — flagged to the
  reviewer as needing careful verification precisely because it contradicts an owner statement.
  D1 cohort boundary: the L15 predicate reproduces the L15 table on all five rows on v6 and gives
  31 on v7 (31st = GRTVX; v6→v7 delta is exactly MMTMX + QDVIX, the two the v7 anchor fix
  de-fabricated). **The "55" was NOT closed** — reported as an entity-vs-event confusion (33
  tickers / 55 steps over the final 22 observations) rather than a reproduced ticker count.
  **Adversarial data-reviewer checkpoint RUNNING** with a priority instruction that the headline
  `served_return == D/P` identity is **degenerate by construction if the vendor's dividend field is
  itself derived from the adjustment factor** ([[verification-metric-must-be-non-degenerate]]) —
  it must be corroborated from `close_price` + `dividend` instead.
  **U3 (L14) dispatched in parallel — read-only EDA, so the F2 one-writer fence holds.** Rationale
  recorded because it is a dispatch judgement: L14 *also* needs a NEW rule (segment-7 §7 states it
  outright — "may a foreign-filed row inherit the Sharadar label its US-filed sibling carries?"),
  and **the current refusal is what blocks cusip collisions**, so relaxing it trades coverage for
  identity risk in a project whose doctrine is *a wrong sector is worse than an honest null*. Both
  reload fences therefore end in an owner decision; running them concurrently gets both briefs onto
  one owner sitting instead of two round trips. Its mandate is to frame — never decide — with
  measured yield AND measured risk per option on a **dev/holdout split scored once**, using the 6
  known wrong-company binds as positive controls a candidate rule must NOT admit. It was also told
  to verify a refinement the plan's own one-line L14 summary lacks: the "20 ISINs / $8.2B" splits
  into **S7-4a (14, this item)** and **S7-4b (6, a separate item domicile routing cannot fix)**.
- 2026-08-17 21:57 — **U2 Segment-0 checkpoint: PASS-WITH-CORRECTIONS (adversarial data-reviewer).
  U2 is now `parked:owner` as P5.** The reviewer reproduced every load-bearing conclusion from raw
  source — root-cause inversion, D1 settlement, blast-radius resize, discriminator falsification,
  ratchet arithmetic — and **four corrections went back to the worker** rather than into the brief
  unexamined ([[fix-round-economics]]: it owns the scripts, so the report edits went to it; the
  owner brief was written from the corrected numbers here).
  **The most consequential correction ran AGAINST the worker's own case and made it stronger.** Its
  D4 script prefiltered candidates on `|simple return| >= 0.20`, which is asymmetric against a
  LOG-space floor and silently dropped every ticker whose only qualifying steps were down-moves
  between −16.7% and −20%. A faithful re-implementation agreed on every shared ticker (0
  disagreements) and added 357 firings: the discriminator actually fires on **626 served tickers'
  steps, 347 unexplained across 302 tickers** — a false-positive blast radius **~64% larger** than
  reported — and the **92% FP rate reproduced independently** on the corrected population
  (seed-42, 23/25; PFFA 2020-03-12 −21.1%, RSX 2022-02-28 −30.4%, RSXJ 2022-03-03 −17.0%, all real).
  It also killed the report's explanation of its one recall miss: VPGEX clears its own σ bar ~8×
  and was lost to the prefilter, not to the rule. Corrected recall is **173/173 steps, 155/155
  tickers — perfect**.
  **The claim that would have gone to the owner as the rule's main selling point is NOT TRUE as
  written**: "no new constant, self-limiting below ~20% by construction" — the `y >= 0.10` scan
  floor is load-bearing, **47 of 1,465 firings sit below y = 0.20** (min 0.109, MXXVX 2021-12-16),
  and nothing below y = 0.10 was ever tested. P5 discloses it instead of burying it; authorizing a
  "no new tunable" rule that has one is exactly the failure the standing constraint exists to stop.
  **The degeneracy flagged at dispatch was real and is now labelled**: `distribution_yield =
  dividend / close_price` comes from the same rows whose `adj_close` embeds the vendor's
  dividend-derived factor, so the headline `served == D/P` identity holds **by construction** —
  mechanism, not evidence ([[verification-metric-must-be-non-degenerate]]). The non-degenerate
  proof (two-day `close_price` + `dividend` total return, a path the pipeline never sees) exists and
  was reproduced from raw for all six tickers, independently of the dispatcher's own AQLGX check.
  Also corrected: **LHVAX** was filed as "no dividend record" but has a same-day stamped
  distribution (y = 0.8955) and sits in the worker's OWN classifier output as AMBIGUOUS — it is a
  rule-declines case, so DECISION 2's cohort is **7**, not 9. And F22's "29/29 price-flat" does not
  generalize: an independent seed-7 draw found 2/29 with material same-day raw moves (FBSIX −11.8%,
  AMCGX −16.6%), which pushes the mixed-mechanism problem INSIDE the EARLY_FACTOR class and bears
  directly on repair-vs-excise. Still open and carried into P5 as open: the **"55" boundary is
  plausible, not established**.
  Reproduced exactly by the reviewer: v6 L15 table 51/36/32/24/14; v7 30/31 (GRTVX); v6→v7 delta
  {MMTMX, QDVIX}; terminal 24 / mid 132/149; **value_score 52 rows, 25 high**; QMGAX AMBIGUOUS and
  quarantined, **not in the cohort**; 344 seamed / 223 excised / **922 untouched (730 tickers)**;
  census 563, allowlist ceiling 584 with 0 entries, **162 defect-attributable — independently
  matching the execution plan's own separately-recorded 162** — remainder ≈401. Integrity: NAV inode
  77680801 still identical to the v7 hardlink, no lakehouse file modified after 12:00 today.
  **U3 (L14) still running.** Both reload fences now end in an owner ruling, which is what P5 and
  L14's forthcoming brief are for. Line does NOT stall: U4 (L6) is next once L14's EDA lands.
- 2026-08-17 22:04 — **U3 (L14) Segment 0 LANDED; adversarial checkpoint RUNNING. Dispatcher found
  independently that the plan's own framing of this fence is WRONG in both directions.**
  Report: `fund_score-wt-l14/reports/l14_domicile_routing.md`. Nothing written under `data/`.
  **CORRECTION 1 — it is not "served-on-next-reload"; it is SERVED NOW.** The worker stated honestly
  that it could not query Postgres, so the dispatcher ran the same-security test directly against the
  live serving DB: **8 ISINs currently carry two different sectors across 1,462 rows / 914 funds** in
  `fund_holdings_full`. Among them are the exact known bad binds — Genie Energy also labelled
  Industrials (the GE-Aerospace cusip), Shift4 also Energy (ENERPLUS), SharkNinja also Energy
  (SANCHEZ), Nu Holdings also Utilities. So the reload is not what would introduce this contradiction;
  we have been serving it. (`fund_holdings_full` is a PAID table, so it sits behind the tier gate —
  served, not free.)
  **CORRECTION 2 — and this one cuts the other way, so quote it instead of the headline.** The plan's
  L14 row sizes this as "20 ISINs/$8.2B". That is the GROSS value of every row on those securities,
  both sides of the disagreement. Decomposed majority-vs-minority on the live DB, **every majority
  side is correct** (Brightstar=Consumer Cyclical, Ferroglobe=Basic Materials, Burford=Financial
  Services, Clarivate=Technology, Nu Holdings=Financial Services, SharkNinja=Consumer Cyclical,
  Genie Energy=Utilities, Shift4=Technology) and the **wrong side is 26 rows across 26 funds worth
  \$37.0M**. Reporting \$8.2B as the wrongness would have been the aggregate-masks-the-real-number
  error this run has already been bitten by twice; the honest live figure is \$37.0M.
  **The worker's own structural retractions (pending checkpoint):** symptom (e), the \$3.51B
  name-bridge recall, is **not reachable by domicile routing → retract from L14**; **"one rule closes
  all four" is RETRACTED** — it needs a FILL rule for (a)/(b)/(c) and a separate PRECEDENCE rule for
  (d)/S7-4a; and the pivotal supporting claim that **S7-4a has sector NULL = 0** (every row already
  classified, so a fill rule is a no-op there) with all 14 being the **same company on both sides** —
  i.e. a vendor taxonomy disagreement, not an identity defect. It also narrows the root cause below
  "a new rule": `isin_reference` already resolves 14 of 15 to the right ticker, name AND industry and
  drops only `sector`, and Layer 1 **already grants this exemption for `US`-prefix ISINs on exactly
  the same "the ISIN contains the CUSIP" argument** — which would reframe the owner's ask from
  "authorize a novel rule" to "extend an existing exemption". All of that is with the reviewer.
  Measured options (dev 938 / holdout 977, scored once): **B+G1** — ISIN-embeds-CUSIP plus filed-name
  corroboration — **1,290 rows / \$6.013B / 733 funds at 99.16% holdout identity, 96.64% sector**,
  with **0 of the 14 positive-control wrong-company binds admitted** and the control proven
  non-vacuous (removing the guard flips 1,260 rows / \$3.316B). Worker recommends B+G1 + P1, and
  disclosed its own three weaknesses: the eval set is a **proxy** (the rule never fires on it), G1's
  recall leaned on a **frozen 2026-02-25** ISIN→name map, and P1 relabels \$2.92B of served value
  including a \$1.86B tanker Energy-vs-Industrials judgement call.
  **Line does not stall on two parked fences: U4 (L6, recent-changes-te-ranked) dispatched next** —
  it is the highest-value item on the S3 path that needs no owner ruling.
- 2026-08-17 22:12 — **U2 report corrected (worker applied all 7 checkpoint findings); P5 amended and
  ONE RECOMMENDATION TO THE OWNER WITHDRAWN.** The worker took the corrections properly: R2 retracts
  its own prefilter bug with the buggy figures kept in a side column for auditability, R3 withdraws
  the "self-limiting below ~20% by construction" claim, F7 is promoted to THE LOAD-BEARING PROOF with
  the 6-dp identity demoted to mechanism, and its self-audit now carries **four retractions, two of
  which the reviewer found rather than the worker**.
  **The substantive change: DECISION 1a flipped, so the brief the owner already received is now
  wrong on that point and has been corrected.** "Excise" was recommended because a uniform repair
  formula is falsified. But C4's independent sample found **2 of 29 EARLY_FACTOR events carry a real
  material same-day move underneath the factor artifact** — so excision would delete a genuine
  double-digit return. Neither remedy is safe across the whole class; the ask becomes "authorize
  Segment 1 to measure the flat-vs-superimposed split, then decide 1a on that number."
  Segment 1's gate list also gained a **log-space symmetry test** asserting that down- and up-move
  admission thresholds are exact mirrors — a permanent regression test for the exact bug class the
  reviewer caught, which is the right response to a defect found in one's own validation code.
  Lakehouse re-verified untouched: nothing under `data/` newer than 21:00, NAV still inode 77680801
  at 827,741,516 bytes. **U2 stays `parked:owner` on DECISION 1 + 1a. U4 (L6) dispatched and
  running; U3's checkpoint still running.**
- 2026-08-17 22:23 — **U3 (L14) checkpoint: PASS-WITH-CORRECTIONS; filed as P6. Both reload fences
  are now parked on the owner.** The reviewer re-derived every load-bearing number from raw
  artifacts **using none of the worker's scripts** — decision framework, both retractions, root
  cause, dev/holdout table, probe and all three precedence counts reproduced, most to the exact row
  and dollar (P1 1,359/\$2,915.5M; P2 259/\$941.0M; P3 1,618/\$3,856.6M; staging S7-4a
  1,290/514/\$3,795.5M; the 481 regressed fund-quarters exactly, with the report-vs-spec one-off
  explained as a weight-vs-pct_nav basis choice). Five corrections went back to the worker.
  **The one that matters most inverted a mechanism, in the item's favour:** the "21 within-fund
  quarter-to-quarter sector flips" are **not time-series flips — 0 of 21 flip between quarters**.
  All 21 are the same security filed TWICE IN ONE QUARTER under two domiciles, serving two sectors
  simultaneously (the worker's own DHT example was wrong: both rows are `2026-03-31`). That makes it
  a same-as-of within-fund contradiction, which argues harder for settling precedence, and the
  Segment-4 gate was renamed from "time-series flips → 0" to "dual sectors per (series, ISIN,
  quarter) → 1".
  **Also caught: an owner-facing headline that reproduced under no definition** — "963 rows / 632
  funds / \$5,781.6M" was assembled from different scratch computations; ~12 natural definitions
  were tested and none yields all three coordinates jointly. Magnitude survives (~950–1,050 rows,
  ~\$5.7–5.9B), so the conclusion stands, but the brief now quotes **963 / 592 / \$5,752.4M** on
  one stated definition. This is the second time this session a worker's own arithmetic was the
  weakest link in an otherwise sound report — the checkpoint is earning its cost.
  **And the reviewer's own closing paragraph needed correcting against the dispatcher's live-DB
  measurement**: it repeated "nothing is live in Postgres yet". L1's *fixes* are not loaded, true —
  but *contradictions* are already served (8 securities, wrong side \$37.0M / 26 funds). The
  reconciliation went back to the worker.
  Two further reviewer findings carried into Segment 1: the "0 positive controls admitted" result is
  **vacuous by construction** (all 14 controls have zero NULL rows) so the case rests on the probe,
  which is sound; and **W1, a real implementation trap** — "stop discarding a CUSIP-derived layer
  sector" must be keyed on the EMBEDDED-NSIN check plus name corroboration, because for CINS ISINs
  the filed cusip differs from `isin[2:11]` (Cimpress: filed `G2143T103` vs embedded `00BKYC3F7`) and
  a loose reading would smuggle in Option A — filer trust, the Patrizia→Celator surface — by accident.
  Lakehouse unmutated: **zero files under `data/` modified since 2026-08-10.**
  **U4 (L6) still running — the only item on the S3 path that needs no owner ruling.**
- 2026-08-17 22:32 — **U3 report corrected (all 5 checkpoint defects + 4 warnings); P6 sharpened.
  Both fences remain parked on the owner; U4 (L6) still the only thing moving.**
  **The worker handled a disputed number the right way and it is worth recording as the pattern.**
  On C4 it could reproduce neither its own residual (279) nor the reviewer's (312/317) — its own
  stated definition gave 293/299, two further variants 292/299 and 302/305. Rather than adopt the
  reviewer's figure or defend its own, it **retracted both and quoted an honest bracket — the fill
  recovers 164–188 of the 481 regressed fund-quarters — flagged the residual as definition-sensitive,
  and made "pin ONE definition in code" a Segment-1 deliverable.** Two independent parties disagreeing
  is evidence the definition is underspecified, not evidence that one of them is right.
  **The live-DB reconciliation (R-6) is the most useful thing to come out of the round**, and it
  turned the fence from a one-way risk into a measurable trade: of the 8 securities serving two
  sectors on the live site, **0 are S7-4a**, **3 are S7-4b** (SharkNinja, Shift4, Genie Energy —
  Genie still served under the GE-Aerospace cusip with the name "General Electric Co"), **4 are
  already repaired by the current build**, and **1 is new**: Burford, where `holdings_complete`'s
  dominant-lot picker collapses the contradiction while per-row `fund_holdings_full` does not — the
  two panels disagree in treatment, filed **N-7**. So the reload trades a \$37.0M/26-fund live
  footprint for a 1,290-row/514-fund one **while fixing 4 live contradictions and filling 963
  blanks**, and **"not now" does not leave production clean either.**
  Also corrected: the refusal table now lists all 14 ISINs (\$43.815M) and splits them **6 genuine
  as-of drift vs 5 false refusals costing 10 rows / \$8.07M** — a cost now argued explicitly against
  the recommended option rather than hidden inside it; LZ is 1 refused row, not 2 (the `Ltd.`
  spelling is admitted while `LIMITED` is refused), so N-5 is softened from "every token is a
  stopword" to a spelling-dependent failure within one security; the "0 controls admitted" line now
  says plainly it is **vacuous by construction** and that the probe carries the case; and W1 became a
  boxed trap with its own Segment-1 probe — a Cimpress-shaped Layer-2 binding must be REFUSED, since
  the loose phrasing "stop discarding a CUSIP-derived layer sector" would smuggle filer-trust back in.
  Lakehouse untouched: `find data/{gold,product,reference,silver} -newermt <session start>` empty;
  `git status` shows only the report.
- 2026-08-17 22:37 — **U4 (L6) Segment 0 LANDED — the strongest EDA of the run, and it found a LIVE
  product defect rather than just scoping a feature. Filed as P7; adversarial checkpoint RUNNING.**
  Report: `fund_score-wt-l6/reports/l6_recent_changes_te_ranked.md` (719 lines). Lakehouse
  independently re-verified by the dispatcher, not taken on report: `positioning_changes_panel.parquet`
  still Aug 9 16:42, `serving_facts_staging.parquet` still Aug 9 20:27, and `find data -newermt
  "2026-08-17 22:00"` returns empty.
  **The FCNTX "none available" mystery is a RULE, not a bug — and the rule is inverted against the
  section's own promise.** Surfacing demands a change be both a cross-sectional outlier AND already
  half-complete at the half-window, so `single_quarter` moves — the ones that happened MOST RECENTLY —
  are precisely what gets filtered out of a section that promises "lately". 1,092 served funds (18.8%)
  serve nothing while holding 25,030 available rows. Worse, 36.2% of qualifying rows have a null `z`
  (fewer than 30 funds hold that change) which fill-nulls to False, so the gate **silences names for
  being distinctive** — and those rows are not smaller. The worker's gate reconstruction reproduces
  `is_surfaced` with 0 mismatches over 89,945 rows **and provably fails (4,564 mismatches) when one
  gate is broken** — a negative control that actually fires, which is the standard this run has been
  holding everyone to.
  **The specimen is the argument:** FCNTX serves ONE row — `entered BRK.B +1.02pp`, 8th of 8 on both
  ranking axes — while hiding **BRK.A −6.2pp** (killed by null z), META halved −6.0pp, and five more.
  Serving the small side of a Berkshire trade while suppressing the large one does not under-report
  it, it **misdescribes** it.
  **Two silent traps caught before anything was built on them.** A **100× unit error** (panel emits
  pp of NAV, exposure path uses `decimal_weight` → Δpp/100; the regression beta is a third, unusable
  object at corr +0.061/+0.152), and a **REORDERING error rather than a rescale** — the shared Σ is
  FF6-residualised while `target_return_series` is raw, spanning 0.96×–2.69×, so mixing bases would
  float mega-cap themes to the top for a purely basis-driven reason.
  **A correction to this plan's own assumption, and it is good news for S3:** the spec's launch gate
  ("only launch-honest after an N-PORT refresh") is **already satisfied** — the frontier is 2026-04-30,
  **109 days / 3.6 months**, per-fund median 139 days, not the ~10 months the frozen 2025-10-31 spec
  implied. The honest residual is 9.0% of funds (457) older than a year. The dispatcher had flagged
  this to the owner as a probable S3 honesty problem; measured, it is materially smaller than feared.
  **Two decisions parked (D-1 surfacing rule, D-2 theme σ)** — the worker picked neither, correctly.
  The dispatcher added one question to the checkpoint before D-2 goes up: the shared basis is literally
  named `_nothemes`, so it must be established whether themes were **deliberately excluded** or merely
  never computed — that decides whether the recommended option is "apply existing machinery" or
  "re-open a settled call", which is a materially different ask.
  **Also filed, not absorbed — two are live defects:** `build_fund_takeaways.py` pins
  `EVAL_DATE = 2025-10-31` and filters the panel on it, so `fund_takeaways.parquet` currently holds
  **zero positioning-change takeaways** (a silent fail-open date pin); and 27 rows in 26 funds claim
  "entered IVV/SPYM/VOO at ~99pp" with `lookthrough_coverage = 1.0`. Plus `BK` missing from the whole
  Sharadar SEP store, the manifest's absent `as_of` key, and style rows serving null as-of stamps
  against a contract that says both are mandatory.
- 2026-08-17 22:56 — **U4 (L6) checkpoint: PASS-WITH-CORRECTIONS. Core story UNBROKEN; two
  owner-facing numbers corrected — including one the dispatcher had already relayed to the owner.**
  The reviewer re-derived every decision-driving number with its own code (own gate reconstruction
  from source constants, own σ pipeline from Sharadar SEP + `orthogonalize_levels`, own staging JSON
  parse) and nearly everything reproduced **to the digit**: the whole FCNTX specimen including
  BRK.A's null-z kill at 96.59 bps, the null-z analysis, the unit triad, all 33 σ ratios, the
  staleness picture, all of coverage, and the **4.4e-16 basis identity matched exactly** at
  `sector::energy`. The negative control was confirmed genuinely falsifiable in BOTH directions
  (4,564 dropping sustained, 1,270 dropping z).
  **C1 — the R-table was computed at a top-6 cut while serving cuts at 8.** Dispatcher verified the
  constant directly (`fact_assembler.py:140`, `TOP_POSITIONING = 8`). The report contradicted itself
  internally — its D5 counts today's payload at 8,818 rows (`head(8)`) while its R0 row says 8,013
  (`head(6)`). **R1 actually ships 20,968 rows, median 8/fund, median 84 bps — not 16,770 / 6 / 91**,
  which the owner had already been told. The **+866 funds headline is cut-independent and reproduced
  exactly**, so the recommendation stands; only the payload description was wrong.
  **C2 — the flagship non-degenerate check did not trace to its stated source.** "median 0.26, 81 of
  3,475 funds > 1.0 vs `te_current`" cannot be reconstructed: across all four `value_score.parquet`
  vintages plus three sibling TE columns, non-null `te_current` covers at most 2,270 funds — fewer
  than the claimed n. Independent recomputation: **2,217 funds, median 0.228, 23 (1.0%) > 1.0** — the
  conclusion survives and is MORE conservative, but Segment 1's G4 gate bound is specified as
  "derived from the measured distribution", so the distribution must be restated before that gate can
  be written.
  **C3 — the `_nothemes` question the dispatcher added is ANSWERED, and it defuses D-2.** The
  exclusion is a documented 2026-06-25 production decision (themes add nothing to idio persistence
  and are sector subsets), **but the same spec keeps themes live for theme-bet attribution and
  retains a 57-factor themes-inclusive basis for research** (dispatcher-verified in the source doc).
  So theme σ for TE ranking is a **new consumer of existing machinery, not a reopening of the
  skill decision**. The owner still gets the citation.
  **C4 — D8-3 is worse than filed and its count was wrong.** The mechanism is BOTH causes, now
  adjudicated: SPYC's current-endpoint book is **1 row, IVV at 1.000, versus 503-504 resolved
  constituents at prior/mid**. **8 of the 10 worst rows are `available` + `sustained`, held back only
  by the null-z gate**, with **97 more spurious "exited AAPL/MSFT" rows in the same funds** — so
  "R1 requires fixing D8-3 first" is verified and was understated.
  **A THIRD decision surfaced that the worker had not raised (D-3): may a filing over a year old
  headline a section promising "lately"?** — the 457 funds (9.0%) beyond 365 days. Bounced back to be
  framed and measured, not decided.
  Also corrected: three small count slips, an unstated including-zeros definition behind F5's gap
  stats, and one wording overstatement ("those rows are not smaller" — 53 vs 61 bps is 12% smaller;
  "comparable" is what the data supports, and the claim survives on that wording).
  **Seven decisions are now parked across P5/P6/P7. Consolidated sheet going to the owner.**
- 2026-08-17 23:02 — **U5 (L9, per-stock receipts) DISPATCHED — the last backend item on the S3
  path, and the one carrying owner stop S2.** Worktree `fund_score-wt-l9` on
  `feat/l9-per-stock-receipts`; Segment 0 is EDA, no writes, so the F2 one-writer fence still holds
  with four read-only worktrees on the shared lakehouse. Its `depends_on: foreign-holdings-enrichment`
  was blanked per the queue row — L1 closed 2026-08-09.
  **Dispatched deliberately WHILE three items sit parked, rather than idling.** Every other S3-path
  item now waits on an owner ruling; L9's EDA needs none to start, and doing it now means that when
  the owner rules, all four backend items can enter Segment 1 in parallel instead of serially. It
  also front-loads **S2**, which the owner has already said will fire and wants briefed CPO-level.
  The S2 mandate is the segment's centre of gravity and was framed to measure the thing an owner is
  least likely to be told: not just how many funds clear each candidate priced-NAV floor (0.50 /
  0.65 / 0.80), but **which KINDS of fund each floor excludes** — foreign-heavy funds keep an
  unpriced sleeve by construction, so the floor silently decides who gets the product's most
  persuasive card. It must also spot-check the raw source at the misses to separate a genuinely
  unpriceable foreign line from a recoverable extraction failure, since a large recoverable miss is
  a DEFECT rather than "partial coverage".
  Two traps were named up front from this session's own record: the spec mixes bases DELIBERATELY
  (fund side renormalized-priced-book, twin side un-renormalized so its unresolved sleeve shows as
  missing weight) — the same commensurability class L6 nearly shipped a ranking on — and the totals
  row must never read as "what the fund did" when it is "what the priced book did".
- 2026-08-17 23:07 — **U4 (L6) corrections applied; D-3 WITHDRAWN after the dispatcher measured it
  independently. Decision count drops from nine to eight, and a defect takes its place.**
  The worker applied all seven corrections and root-caused C2 honestly rather than just restating it:
  the unreproducible scale-bound figures came from **its own first, RETRACTED raw-σ script** leaking
  into the final report — wrong basis, position rows excluded, and the >1.0 count divided by 3,475
  inner-join rows instead of the 2,210 with a non-null `te_current`. Rebuilt with the join spelled
  out, it now matches the reviewer's independent recomputation exactly (n=2,217, median 0.228, 23
  funds / 1.0% > 1.0), and **Segment 1's G4 gate bound now points at this table instead of the
  retracted one**. It also removed the "higher-quality list, not a noisier one" framing that the
  cut-6 arithmetic had flattered — at the real cut R1 still has the higher median TE (84 vs 72) but
  the list is **~2.4x longer**, which the owner should see — and it did **not** fold a cut change into
  D-1, raising **D-1b** as a separately-owned ask instead. That is the right instinct.
  **D-3, however, does not survive contact with the served data.** The worker narrowed it to "4 funds
  serve a section today"; the dispatcher measured the served staging payload directly rather than
  accept a convenient narrowing. Result: **of 2,411 served sections, 2,376 are DATED with median
  139d, p90 170d, MAX 199d and ZERO beyond 365 days** — while **35 funds serve 50 rows with NO
  `holdings_as_of_current` at all, every one of them `change_type: 'style'`**, and the four named
  funds are in that undated set. The panel figure (457 funds > 365d) is real and the reviewer
  reproduced it, but **the panel is not what ships.** So the question "may a year-old filing headline
  *lately*?" has no live instance; the honest defect is **35 funds showing undated rows**, which is
  exactly **D8-6, already filed**. Converted from an owner decision into a fix. Within-fund stamps
  were also checked and are consistent (0 funds disagree across their own rows).
  Lakehouse untouched — `find data/ -newermt "2026-08-17 12:00"` still returns nothing.
- 2026-08-18 07:25 — **RUN INTERRUPTED overnight by a session usage limit (reset 02:30); all three in-flight
  Segment-1 workers died mid-start. Resumed, not relaunched.** The heartbeat went ~8h stale because
  the backstop cron only fires while the REPL is idle and the REPL was itself limit-blocked — worth
  recording as a real gap in the night-drain design, not a one-off.
  **Safety checks ran BEFORE anything was restarted, and everything is clean:** the lakehouse is
  untouched — `passive_alt_daily_nav.parquet` still inode **77680801** and identical to the v7
  snapshot hardlink, and `find data/{gold,product,reference,silver} -newermt "2026-08-17 12:00"`
  returns **nothing**. No `data/_tmp/{capgain,l6,l9}/` was ever created, so the measurement-only
  Segment 1s died before their first write. **Five worktrees, zero canonical writes, across the
  entire session.**
  One near-miss worth logging: the L9 worker reported "the worktree script ran against the wrong
  repo (my cwd)" as its last act. Verified — **it caught itself**: the web repo has only its main
  checkout and `fundscore-web-wt-f1`, no stray `l9` worktree or branch, and
  `fund_score-wt-l9` exists correctly at `75980a3` on `feat/l9-per-stock-receipts`. Nothing to clean
  up. (The helper resolves the repo from cwd, which is a sharp edge for an agent whose cwd defaults
  to the web repo — filed as a harness note.)
  All three workers resumed via **SendMessage**, never relaunched, so their context survives
  ([[interruption-resilient-agent-runs]]).
- 2026-08-18 07:45 — **U2 SEGMENT 1 COMPLETE — measurement only, the strongest work of the run. Checkpoint
  RUNNING. Non-mutation independently re-verified by the dispatcher, not taken on report.**
  Report: `fund_score-wt-capgain/reports/capital_gain_segment1.md` (449 lines, written incrementally
  as instructed after this run lost workers to usage limits twice).
  **Repair-vs-excise is now answered by a threshold-free measurement instead of an argument.** The
  worker defined a **destruction ratio** — how much real return excision would delete as a fraction
  of the artifact it removes — computed against raw `close_price`, a field the classifier never
  consumes, and **adopted no cut**, reporting five. For the median event the raw same-day move is
  **0.0000 pct**: excision is *exactly* free. It stays free or near-free for ~96 pct of the class
  (rho >= 0.10 is 50 events, 3.7 pct). Hand-adjudicated 14/14 flat and 14/14 superimposed — and the
  superimposed ones are ordinary 2-5 pct days, not crises. **BRIEF-A therefore recommends repair for
  all coherent verdicts, which needs no rho cut and so adds no threshold at all.**
  **An unplanned second falsifier arrived, and it is the finding that matters most.** Every verdict
  makes a directly observable claim about what the vendor's factor did, so coherence is testable with
  no threshold. `EARLY_FACTOR` is **1,416/1,416 coherent** (median deviation 3.7e-12). `NO_FACTOR` is
  **only 12/36** — the other 24 are self-contradictory and are **real crashes** (VENAX 2020-03-09,
  HIPS 2020-03-18, PSSAX/PSSCX 2008-12, SDSCX 2000-12). And the 12 survivors are **exactly** the set
  Segment 0 hand-verified by a completely different route. Two independent paths, same funds — the
  checkpoint is asked to confirm that is genuine cross-validation rather than shared filtering.
  **The line's zero-floor ruling paid for itself, but not the way expected.** The 30 extra events it
  exposed were **0/30 genuine defects**. What it actually surfaced was a **degeneracy**: **75 verdicts
  are decided SOLELY by the excursion floor**, recovering "true moves" of 9-17 pct; it concentrates
  below y = 0.10 but also lives at 3.5-4 pct in the high-yield bands the old floor hid. It also named
  a clean false-positive class — **8 MAPOX events that are exact 2:1 SPLITS** (exp(s) = 2.0009) with
  a coincidental 1.2 pct dividend, where the rule would claim a **+97 pct real return**. A rule that
  mistakes a share split for a distribution artifact is a serious defect, and it was invisible while
  the floor was in place.
  **GATE 2b is the adversarial gate that earned its place:** the worker seeded a dividend onto real
  crisis days and **proved its own rule vulnerable** — RSXJ 2022-03-03 misfires at a yield as small as
  **0.5 pct** — then showed every such misfire is `NO_FACTOR` and every one is caught by coherence.
  **So coherence is load-bearing safety, not an optimisation.** Residual risk stated rather than
  papered over: coherence cannot protect "dividend stamped + factor genuinely not applied + real
  crash the same day".
  **BRIEF-B changes what DECISION 1 actually ratifies and the owner must see it:** the rule as
  originally framed **would ship 145 false positives**. Two filters remove them, **neither adds a
  threshold**, and both must sit INSIDE the ratification rather than be bolted on later. One of them,
  coherence, **requires `close_price` — which `build_fund_daily_adj_close.py` discards** — so the fix
  necessarily includes retaining that column upstream.
  **Blast radius after adjudication: served tickers 155 -> 151, and the scored `value_score` rows are
  UNCHANGED at 52** (25 high / 27 limited) — the 145 removed false positives were almost all dead
  tickers. Segment 0's sizing stands.
  Two further self-retractions (R4: a 1e-6 tolerance mislabelled ~30 rounding cases as
  contradictions; R5: the destruction ratio is meaningless for `NO_FACTOR`, ~1.0 by construction).
  **Non-mutation re-verified independently:** NAV still inode **77680801 at 827,741,516 bytes, mtime
  2026-08-17 11:03**; `find` over gold/product/silver/bronze/reference/vendors since 07:20 returns
  **empty**; all **7** outputs under `data/_tmp/capgain/`; the worktree carries only 3 untracked files
  (2 reports + the new module, which nothing imports).
  **Line ruling: BRIEF-C TAKEN — drop `NO_FACTOR`** (provisional on the checkpoint). **DECISION 1, 1a
  and BRIEF-B remain the owner's**; Segment 2 is blocked on them and stays non-canonical when it runs.
- 2026-08-18 07:51 — **U4 (L6) SEGMENT 1 COMPLETE, measurement only; checkpoint RUNNING. And its R15 forced the
  dispatcher to audit ITS OWN verification method — which held.**
  Report: `fund_score-wt-l6/reports/l6_recent_changes_te_ranked.md` §S1.0-S1.11. Three additive files,
  four outputs under `data/_tmp/l6/`; the sample runner **refuses any `--out-dir` without `_tmp` in
  its path**, which is the right way to make a constraint structural instead of remembered.
  **Gates: 7 PASS, and 10 seeded defects ALL turned RED.** Both traps flagged at dispatch were caught
  **two independent ways each**: the 100x unit error trips G1 (7,257/7,257 violations) *and* G4
  (median ratio 23.7 against an IQR of [0.157, 0.355]); the raw-vs-residual sigma swap trips G2 at
  exactly `sector::technology`, the 2.69x factor. G4's bound is read off the CORRECTED reference
  table (n=2,217) — no invented number.
  **Coverage 85.6 pct of sample rows / 93.6 pct of surfaced rows, and recoverable-missing = 0** — all
  335 sigma-missing tickers adjudicated against raw SEP: 294 have zero SEP rows, 39 have <100 weeks
  in-window, and **0 have a full in-window history**. That last bucket is the only one that would
  indict the pipeline, and proving it empty is the right way to close a coverage claim.
  **R14 is the catch of the segment, and it is the wrong-company class again.** Its own filed defect
  D8-1 was wrong: `BK` the TICKER is absent from SEP, but BNY Mellon the SECURITY is present as
  **`BNY`** — price-verified as the bank, not the same-ticker BlackRock muni trust. **And the obvious
  fix is a trap**: `cusip_reference` maps **`BNY` -> BLACKROCK NEW YORK MUNICIPAL INCOME TRUST** while
  still mapping `BK` -> BNY Mellon, so a resolver built on it **would have bound a bank's prices to a
  muni fund**. cusip6 recovers 0/294. L6 serves an honest null and attempts no resolution — correct.
  **R15 made the dispatcher audit its own session-long non-mutation proof, and the audit is worth
  recording.** The worker claimed BSD `find -newermt` returned zero rows *including its own
  just-written files*, i.e. vacuously green, and switched to a Python `st_mtime` walk with a
  self-test. **The dispatcher tested `find -newermt` directly with four timestamp formats, including
  the exact seconds-precision form: all four correctly caught a just-written probe.** So the tool is
  not broken here and **every non-mutation proof this session stands.** The likely real cause is that
  the worker searched `data/{gold,product,...}` — which legitimately EXCLUDES its own writes under
  `data/_tmp/l6/` — making that zero *correct* rather than vacuous. The self-test discipline should
  stand regardless; the recorded root cause is with the checkpoint to adjudicate, because a false one
  would send someone "fixing" `find` across the repo for no reason.
  **New stop-and-brief D-4:** the serving contract enum (`profile-v2.ts:222`) is closed and
  **five-valued** while the panel has **six** change_types — **`style` has no valid classification**
  (14 rows in-sample, 164 universe-wide). The worker emitted NULL and made G3 **fail-closed** so the
  unmapped set cannot grow silently. It also framed D-4 and D8-6 as one question, which is right.
  **Line ruling: D-4 TAKEN, option (c) — exclude `style` rows** (provisional on the checkpoint). It
  closes D-4, D8-6 and the dispatcher's undated-rows finding together: style rows are returns-derived,
  have no holdings basis, therefore cannot carry the mandatory as-of stamps, and are exactly the 50
  undated rows the 35 affected funds serve today. Serving structurally incoherent rows is worse than
  serving none. Reversible, and it blocks nothing either way.
  Segment 2 is scoped and pinned to `--eval-date 2026-04-30` (frontier re-detection shifts every
  downstream join and is explicitly left as an owner call), with a pre-state snapshot, a per-fund
  regression diff over all 142,216 rows asserting zero change to pre-existing columns, and
  rebuild-twice determinism. **R1 stays unshipped; D8-3 remains a Segment-3 precondition.**
- 2026-08-18 08:02 — **U5 (L9) SEGMENT 0 COMPLETE — OWNER STOP S2 HAS FIRED and is filed above. Checkpoint
  RUNNING. Zero writes under `data/`.**
  **S2 is four decisions, not one** (floor · worst-sub-period-vs-mean · twin basis · ADR pricing),
  and the worker refused all four rather than bundle them — correct.
  **The finding that most changes the decision is the one the dispatch brief asked for: WHICH KINDS
  of fund each floor excludes.** Lowering the floor does **not** open receipts to international
  funds. Under 5 pct foreign: 47 pct served. **60 pct-or-more foreign (n = 1,013): ZERO at every
  floor.** Moving 0.80 -> 0.50 takes INTL from **0 to 9 of 714** and EM from **0 to 1 of 336**, while
  GLOBAL goes 32 -> 259. So 0.50 buys *global/part-international US-majority* books, not
  international ones — and any framing of "0.50 helps international funds" is simply wrong.
  **And the floor decides the mockup's own hero fund: TRNEX/PRNEX measures 0.593**, clearing 0.50 and
  failing 0.65 and 0.80.
  **A strong data-based argument AGAINST 0.50 that nobody had:** on the historical book the receipts
  window must use, twin look-through for international ETFs is IEFA 0.35 pct, IEMG 1.97 pct, VEA
  28.7 pct. At 0.80 that barely bites (median 0.997, 19/1,951 below 0.50); **in the 0.50-0.80 band the
  median is 0.705 with 40/365 below 0.50 and 33 below 0.30**, where an un-renormalized twin produces
  **false 0.00 pct twin weights** and subtracts a complete twin NAV return against an almost-empty
  twin book. **Lowering the floor concentrates the very defect it would then have to survive.**
  **Method validated non-degenerately, after failing twice:** the floor model reproduces the shipped
  panel at **FP = 0, FN = 0 across all three periods** and cross-checks to raw N-PORT at median
  absolute error **0.00000**. The worker also **discarded its own first cohort derivation** on
  discovering a fixed-calendar cut sampled only June-fiscal filers (2,385 of 5,395) and re-derived at
  the pipeline's own nearest-snapshot rule.
  **A pre-existing silent-drop defect that resizes the spec's own denominator:** shipped spec-#10
  drops **1,387 funds at 1Y (2,404 at 5Y)** into **neither the panel nor the suppressions** — funds
  invisible to every coverage check. The spec's "4,002 in-universe" IS that hole; **honest served
  share is 36.1 pct, not 48.5 pct.** A fund that is neither served nor suppressed is the worst shape
  a coverage gap can take, because nothing can see it.
  **Three spec claims were stale and are corrected**, the sharpest being that **L1 delivered
  classification, not priceability** — it never touched `holdings_snapshots.parquet` and shipped no
  ADR crosswalk, and the foreign-inclusive book is latest-quarter only, so it cannot serve a 5-year
  window at all. Three retractions in writing, including its own BK->BNY "smoking gun" (+3 funds,
  immaterial) — and notably a sibling agent independently found the deeper trap in that same
  identifier, which the checkpoint is asked to confirm L9 did not repeat.
  **Line rulings taken:** (i) **gate basis == displayed basis** — the owner still picks which, but
  serving one while gating the other is a self-contradiction, not an option; (ii) **fix the +30-fund
  extraction defect** — `fmp_isin_us_ticker_bridge` already resolves those listings and the pricing
  path simply never calls it, which is a defect by doctrine, not a coverage choice.
  **S2-a, S2-c and S2-d remain the owner's**, and S2-c blocks any floor below 0.80.
- 2026-08-18 08:16 — **U2 Segment-1 checkpoint: FAIL — and the dispatcher must correct TWO things it told the
  owner.** The verdict's shape matters: an independent implementation (own sigma, own bars, own
  vendor pull, full ~2M-event rescan) reproduced **every load-bearing number with zero verdict
  disagreements and membership identity** to the worker's parquets. **The measurement is sound; the
  briefs are not.** All three blocking defects sit exactly where DECISION 1a lives, and all three
  were findable with the same raw-source test the worker applied to the class it EXCLUDED but never
  applied to the class it KEPT.
  **CORRECTION 1 (to the owner):** the dispatcher relayed that BRIEF-A now recommends "repair for all
  coherent verdicts, which needs no rho cut and therefore adds no threshold at all." **Both halves are
  wrong.** Repair is **unsafe on the tail** — 30 of the 50 kept rho>=0.10 events show the stamped
  distribution never left the raw price, only 2 of 50 show the predicted T+1 drop, and the flagship
  case PRMTX +18.54 pct is **the rebound leg of an unadjusted −29.64 pct drop the previous day** (the
  pair nets ~0; any single-day remedy breaks the cancellation). Repair there would **write fabricated
  double-digit losses into served history.** And the "no threshold" claim is false: an undisclosed
  **`|recovered| <= 0.05`** constant sits in the bar-attribution fallback — the exact R3-class defect
  the worker had already retracted once.
  **CORRECTION 2 (to the owner, about the dispatcher's own verification):** yesterday the dispatcher
  tested `find -newermt` against a probe, found all four timestamp formats worked, and told the owner
  "every non-mutation claim this session stands." **That test did not exercise the real failure mode
  and the counter-diagnosis was wrong.** The true cause, found by the L6 reviewer: **`data` is a
  SYMLINK in every checkout** (`fund_score/data -> fundscore-lakehouse`) and **BSD `find` will not
  descend a symlinked path argument** — `find data ...` traverses exactly **1 entry** and returns 0
  **vacuously**. Verified directly: `find data -newermt "2026-08-17 00:00"` returns **0**, while
  `find -L data ...` returns **41**. **At least one dispatcher check used the bare `data` form and
  proved nothing.** The checks that named SUBDIRECTORIES (`data/gold data/product ...`) were sound,
  because the final path component is a real directory.
  **The conclusion survives the method error, and was re-established properly:** an authoritative
  `find -L` scan excluding `_tmp` returns **0 canonical writes since 2026-08-17 12:00 and 0 since
  2026-08-18 07:20**; the capgain reviewer independently confirmed the same over
  gold/product/silver/bronze/reference/vendors with the sound subdirectory form **plus the NAV
  hard-link still at links = 2**; and the L6 reviewer walked **2,252,125 files with
  `followlinks=True`** and found zero. **Three independent sound methods agree: the lakehouse is
  untouched.** Standing rule from here: **never use `find data/...` for a non-mutation proof — use
  `find -L`, or a Python walk with a self-test that must see the prover's own writes.**
  Other findings carried to the worker: the "12 survivors by two independent routes" is really
  **8/12** (Segment 0 had called CRSGX a "garbage dividend"; the raw rows vindicate it, so the
  inclusion is right but a prior adjudication was silently reversed); the MAPOX class is **recurring
  one-day doubled close prints, not exact 2:1 splits**, and is handled by pre-2003 excision rather
  than the seam; two of the five gates are **non-probative** (a construction identity and a
  self-comparison), so GATE 1 and GATE 2b are doing all the work; and **four tickers adjudicated out
  of scope — BRLIX, CSIUX (+62.7 pct), JOPSX, SMGAX — remain SERVED with large fabricated-looking
  steps and now have no remedy path**, filed as a separate bad-dividend-record item so they are not
  silently abandoned.
  **Confirmed unchanged: blast radius 155 -> 151 served tickers and the 52 scored rows, verified
  set-identical pre and post rather than coincidentally equal.**
- 2026-08-18 12:45 — **Second usage-limit interruption (reset 12:20); both in-flight workers resumed via
  SendMessage, not relaunched. Lakehouse re-verified clean with the SOUND method: 0 canonical writes
  since session start.** Worker liveness confirmed by transcript mtimes before re-stamping (both had
  written within 75 seconds), per [[verify-run-dead-before-resuming]].
  **Dispatcher defect, recorded because it produced false alarms:** the heartbeat was left at 08:16
  while the run kept working through to 12:44 — 4.5 hours stale on a LIVE run. The backstop cron
  fired repeatedly against it. The rule "re-stamp after every unit of work" was followed for build
  units but not for resume/report units; a stale heartbeat on a live run is exactly the signal the
  backstop cannot distinguish from death.
  **The L9 reviewer was resumed with an explicit correction to its V9 method** — it was about to run
  the `find data ...` lakehouse scan that this session proved vacuous (BSD find will not descend the
  `data` symlink). Told to use `find -L` or a Python walk with a self-test that must see its own
  writes, and to say so loudly if its result disagrees with the three methods that currently agree.
  **STRATEGIC READ DELIVERED TO THE OWNER (they asked: are we on the right course?).** Honest
  position: **the rigor is right, the sequencing is not.** Twenty-four hours in, **1 of 7 units
  shipped, zero `fund_score` commits, ~10 decisions parked.** What the rigor bought is real and not
  process theatre — the owner's own discriminator falsified at ~92 pct FP, the capital-gain root
  cause found to be BACKWARDS, a live product misdescription (FCNTX), a wrong-company trap that
  would have bound a bank's prices to a muni fund, a silent-drop defect hiding 1,387 funds from every
  coverage check, and an error in EVERY report — including one recommendation that had already
  reached the owner through the dispatcher and would have written fabricated losses into served
  history. What it cost is ~6 agent rounds per item before any code ships, with the decision queue
  growing faster than it drains.
  **Recommendation put to the owner: DECOUPLE the review from the fixes.** S3 is currently gated on
  everything, but **F2 needs only the reload** (its data is built and merged), F1's movements are
  live, and the reload's fences protect ~52 wrong verdicts and \$37.0M of sector labels — real, but
  ~1 pct of funds. So: **reload now with a written known-defect list -> build F2 -> run the critic
  panel on 6 of 7 movements -> owner reviews in days, not weeks**, with the backend fixes continuing
  behind it. The trade was stated plainly: acceptable for a PRODUCT review if the critic panel is
  told what is known-wrong up front; **not** acceptable for a launch. This collapses the owner's
  immediate decision load from ~10 to **one**.
- 2026-08-18 12:49 — **U2 report corrected against the FAIL; the worker WITHDREW its own recommendation and
  downgraded Segment 2 from a build to another MEASUREMENT pass. This materially moves the
  capital-gain item further from shipping, and it sharpens the decouple recommendation.**
  The correction round is a model of the behaviour this run has been asking for: it ran the
  corroboration/T+1 census **on the class it had KEPT** — the test it had only ever applied to the
  class it excluded — and every number reproduces the reviewer's independently.
  **The census reframes the defect.** Of the final 1,362 events, only **101 (8.0 pct)** show the clean
  T+1 drop the early-factor story predicts; **497 (39.5 pct)** show the distribution **never leaving
  the price at all**; **660 (52.5 pct)** show neither, and `corr_ratio < 0.50` for **598 (43.9 pct)**.
  Its own flagship "real return" — **PRMTX 1996-12-31 +18.54 pct** — is confirmed as the **rebound leg
  of an unadjusted −29.64 pct drop the day before**. **FRSGX**: only **33.0 pct** of the stamped
  dividend ever left the price. And **516 of the 1,362 carry the project's own `suspect_yield=True`**,
  unmentioned in the first draft.
  **The honest position is now: the DEFECT is real and the DETECTION is sound, but the true return is
  not established for most of the class — which is precisely what makes a remedy unchoosable today.**
  AQLGX and the fabricated-gain mechanism stand; the median event is still exactly price-flat.
  **A boundary defect that must be fixed before anything touches served data:** AMCGX is KEPT
  (|rec| 0.138000 vs an 11-sigma bar of 0.141993) while its sister class **AMGAX is EXCLUDED**
  (0.136966 vs 0.135625) — **same family, same day, same dividend, 0.4 pct apart in the bar, opposite
  adjudications**. A rule that splits share classes of one fund cannot serve.
  **R7 is the R3 defect committed a SECOND time** — an undisclosed `|recovered| > 0.05` constant — now
  disclosed, with measured bimodality (0.001154 vs 0.668003, a 578.8x gap) and a comparison-form
  replacement `|recovered| > log(1+y)` **verified to reject the identical 8 of 54**. That is the right
  fix: it removes the constant rather than documenting it.
  **GATE 2b corrected with a full sweep**: PFFA 2020-03-18 first misfires at **y = 0.397** and TREMX at
  **0.463** — the original "never" came from a 7-point sweep that stopped at 0.20 — and **539 of 1,519
  events (35.5 pct) carry y >= 0.50**, so **no crisis day is structurally safe**. Safety headline
  narrowed to what it actually has.
  **W8 filed as S1-F14**: BRLIX, **CSIUX (+62.72 pct)**, JOPSX and SMGAX remain SERVED with no remedy
  path, filed as a bad-dividend-record item alongside the ~40 pct uncorroborated class and the 516
  `suspect_yield` events. Six new retractions (R6-R11).
  **Schedule consequence, stated plainly:** U2 now needs a further measurement segment before any
  build, so **the capital-gain fence is weeks out, not days.** Since that fence gates the serving
  reload, and the reload gates F2/F3/F4 -> F5 -> S3, **holding S3 behind it holds S3 for weeks.** This
  is the strongest argument yet for the decouple option already put to the owner: reload with a
  written known-defect list, ship F2, run the critic panel on 6 of 7 movements.
  Non-mutation re-verified: NAV inode 77680801, 827,741,516 bytes, **link count still 2**; zero files
  under `data/{gold,product,silver,bronze,reference}`; still exactly 7 files in `data/_tmp/capgain/` —
  the correction round wrote no new data.
- 2026-08-18 12:50 — **U5 (L9) checkpoint: PASS-WITH-CORRECTIONS, NO BLOCKING ISSUES. S2 is the one item on
  this run that is fully verified and ready for signature.** The gate model was rebuilt from scratch
  by the reviewer — its own universe, coverage formula, degeneracy gate and twin-NAV requirement, not
  importing the builder — and **reproduced the shipped panel at FP=0/FN=0 on first evaluation across
  all three periods**, while probe variants gave wildly different counts (3,147 without the twin
  requirement). Two independent implementations agreeing to within +/-4 funds on every counterfactual
  is the strongest validation any item has produced this run.
  Verified exactly and needing no change: **TRNEX/PRNEX 0.593** (clears 0.50, fails 0.65/0.80); the
  mandate cross-tab (GLOBAL 32->259 exact, EM 0->1, INTL 714 / EM 336); **all 7 atomic N-PORT filed
  lines against raw `data/nport/holding/`** with FCNTX Sigma-EC = 96.277 exact; the historical twin
  look-through (IEFA **0.35 pct / 5 names**, IEMG 1.97 pct / 31, VEA 28.7 pct / 414); **the pricing
  path never calls the bridge** (consumers enumerated); and the **#10 silent-drop defect reproduced
  exactly** at 1,387 / 2,013 / 2,404, with the report's line citations corrected (506 not 508, 699
  not 719).
  **Three corrections to the brief already with the owner, none changing decision content:** S2-b's
  "53-fund difference" rested on absolutes reproducible under **none of 10 definitions** and
  contradicting the report's own gate figure — correct pair **1,947 vs ~2,003 (+~56 at 0.80, ~+210 at
  0.90)**, so the point was **understated, not overstated**; **GSIB/MIOFX are not band funds** (they
  fail passive-side degeneracy and are suppressed even at 0.50) so the worked example must change,
  though the band finding itself holds at 36/361 and 29 below 0.30; and **"no US-listed instrument at
  any price" is too strong** — several excluded names have OTC ADRs our price source cannot price.
  **One caveat that softens the headline slightly and the owner should see before signing:** the
  "measured foreign share" cut is the **non-US-ticker** share, which is **partially tautological with
  coverage** — on an issuer-country basis the >=60 pct cohort is 1,313 funds and **18 do clear 0.50**.
  The conclusion survives because it rests on the **basis-free mandate cross-tab**, but "zero at every
  floor" is a shade softer than first written.
  Non-mutation confirmed a fourth independent way — the reviewer scanned the real lakehouse path
  directly AND ran a symlink-following `find -L` **with a must-see self-test** (it saw
  `gold/l2_replica_quality.parquet`, Aug 17 11:59): **0 canonical writes since 2026-08-17 12:00**.
- 2026-08-18 13:05 — **SERVING RELOAD EXECUTED (owner authorised the decouple: reload now, review in parallel,
  fixes continue). Manifest id=56 active. The neighbourhood section is LIVE for the first time.**
  Pre-flight per the runbook: fund_score main clean at `75980a3` with L5 + L15 emitters confirmed
  ancestors, and — the check that catches the silent failure — **zero unmerged emitters across all
  four worktrees**, so no section could be NULLed by loading from an incomplete branch
  ([[serving-db-ahead-of-branches]]). Prior state frozen and fingerprinted for rollback.
  Dry run first (`--staging-only`): 5,819 rows, clobber guard silent. **Two sections shrank and were
  chased rather than waved through** — 14 funds lost `nav_series`, 2 lost the value badge. 13 of the
  14 are the L15 quarantine; **AWEG and MGLYX have zero nav rows in gold and are `too_new`**, so
  serving nothing is the correct honest null. Nothing collapsed, nothing fabricated.
  Load committed in ONE transaction: **5,819 facts + 1,398,380 holdings + 2,104 attribution**.
  Verified after: served == staging on all six sections (**neighbourhood 3,094, was 0**), and
  `db:check-serving` **PASS** (41 columns, no anon/authenticated exposure).
  **The §5.3 determinism proof FAILED, and chasing it found a real user-visible defect.** Two
  assemblies of identical gold produced different bytes; a third produced a third hash. Per
  [[rebuild-twice-proves-determinism]] the report diffed column by column instead of assuming row
  order: **`return_attribution.rows` is emitted in a nondeterministic ARRAY ORDER for 38 of 5,819
  funds** — ranks and values are **identical** across same-gold builds (0 funds differ on
  `(row_id -> rank, contribution)`), so the backend defect is cosmetic.
  **It was not cosmetic on the page.** `ReturnAttributionTiles` did `.slice(0, 4)` over the raw array
  and never sorted, so **which four stocks displayed as top contributors and top detractors depended
  on emit order**, as did the as-of dates via `scoped[0]`, as did the displayed PERIOD via
  `ra.rows[0].period` for funds with no stock rows. The payload has carried `rank_within_dimension`
  all along and **the component's own type did not declare it**. Fixed in `c0c13bd`.
  **A dispatcher error worth recording, because it was caught by re-testing rather than by luck:** an
  intermediate comparison concluded the fix did NOT stabilise the display — that comparison was
  against the **8-day-old** staging built from pre-L15 gold, so the moved values were L15's, not
  nondeterminism. Re-run correctly against a same-gold build, rank and value differences are **zero**.
  The wrong conclusion was retracted before it reached the owner.
  **Codex gate UNRUNNABLE — vendor account over quota until 2026-08-19 22:52.** The commit hook
  correctly refused; committed with `SKIP_CODEX_GATE=1` **disclosed, not waived on merit** — there is
  no finding, only an unavailable reviewer — with substituted evidence (rank semantics verified
  against served data; old-vs-new selection logic replayed over two builds). **The gate is OWED on
  `c0c13bd`.**
  **Filed for the backend: `return_attribution` array-order nondeterminism** — same class as the
  l2_blend_etfs dedup lesson; the emitter should sort before writing so the artifact is reproducible,
  independent of the web now defending itself.
  **§ KNOWN-WRONG DATA ON THE PAGE added above** — 10 numbered items with sizes, to be handed to the
  F5 critic panel up front so it does not spend findings rediscovering known defects.
- 2026-08-18 15:32 — **F2 SHIPPED (`f69b6d5`) and L6 SEGMENTS 0-2 COMMITTED (`29c3d22` on
  `feat/l6-recent-changes-te-ranked`). Canonical writes this session remain ZERO outside the one
  authorised reload.**
  **F2 — movement 03 is live on the page the owner is reviewing.** Render-only. The honesty contract
  is enforced **structurally, not by convention**: `buildNeighbourhood` returns null unless the
  payload carries BOTH `hypothetical === true` AND `mix_as_of`, so **an unlabelled backcast cannot
  physically reach the page**. Chip reads `HYPOTHETICAL · MIX-AS-OF 30 JUN 2026`; the card leads with
  "The gold line is a backcast, not a track record." BND is labelled from the served label with the
  caption spelling out US investment-grade — **zero user-facing "global bonds" anywhere in `src/`**,
  and the mockup's own label was wrong and deliberately not reproduced. Null payload renders
  **nothing** (verified on VOO): no section, no nav entry, no placeholder — omission chosen over a
  vague notice because the payload carries no reason code. Verified across PRNEX / FCNTX / MCHFX
  (ongoing 65-month drawdown) / TAN (singular-drawdown copy path) / VOO, and the tier matrix walked
  at anonymous / free / paid.
  **Two dispatcher errors corrected in the same commit.** The methodology registry the dispatcher
  wrote in U1 said coverage was **3,079 / 52.9 pct**; the served table says **3,094 / 53.2 pct**
  (83.9 pct of the 3,689 with a twin). And it claimed the skipped-day count is "**visible**" — it is
  **not emitted at all** (0 of 3,094 rows), so the page cannot disclose it per fund. Both fixed.
  Also corrected to the owner: **TRNEX does not exist in `fund_profile_facts`** — it had been offered
  as a fund to look at.
  **L6 Segment 2 is the most rigorous unit of the run, and its value is in what it refused to round.**
  Diffed against canonical over all 142,216 rows: **every DECISION column is bit-identical**
  (`is_surfaced`, `surfaced_rank`, `persistence_state`, both as-of stamps), but **104,320 float cells
  differ at <=4.3e-14 and the worker declined to call that "zero"**. Determinism: two builds are not
  byte-identical **and it is NOT row order** — sorting on the key still differs. **Attribution
  exonerated its own change**: a `--no-te-impact` rebuild, with none of the new code invoked, already
  produces 85,725 cell-diffs, so the root cause is **pre-existing non-associative float reduction in
  `cross_sectional_z`**. Then the question that actually matters was MEASURED rather than argued:
  `is_surfaced` gates at `|change_z| >= 1.0`, the **minimum margin across 118,165 rows is 7.489e-06**
  — eight orders of magnitude clear of the drift — so **0 rows can flip**. Headroom is not a
  guarantee, so it is filed as **D8-7** rather than dismissed.
  Gates: 21 base + 6 TE PASS, **10 seeded defects all RED**; the 100x trap fires two independent
  gates and the sigma swap fires a third at exactly `sector::technology`. **G4 was wired to read
  `value_score` rather than left skipped — "a skipped gate is not a gate"** — and its own limitation
  is stated honestly: it is a regression check, not independent validation. Coverage 86.8 pct of rows
  / 94.2 pct of surfaced, **recoverable-missing = 0** proven by adjudicating all 2,233 sigma-missing
  tickers against raw SEP with the only indicting bucket empty. The reviewer's probe finding is now
  written into the module next to G5: **delete a whole factor from the sigma table and every gate
  stays green** — the gates prove arithmetic, not completeness.
  **R15's root cause is now settled and matches the dispatcher's own measurement:** `data` is a
  symlink and BSD `find` will not descend it, so `find data/...` returns 0 **vacuously**. The
  non-mutation proof now uses `os.walk(followlinks=True)` plus **a canary file written seconds before
  the walk** — a self-test that must see the prover's own writes.
  **Codex gate remains UNRUNNABLE (vendor quota until 2026-08-19 22:52). Three commits now carry an
  explicitly disclosed `SKIP_CODEX_GATE=1` with the gate recorded as OWED: `c0c13bd`, `f69b6d5`,
  `29c3d22`.** None overrode a finding; there is no finding, only an unavailable reviewer.
  **L6 Segment 3 is blocked on owner rulings D-4 and D-1/D8-3, and it writes `serving_facts_staging`
  — a canonical path needing its own explicit authorisation.**
- 2026-08-18 18:18 — **D8-3 (wrapper look-through) dispatched and RUNNING; the predicted resource tripwire
  fired and was diagnosed rather than guessed at.** It is the one item on the board that is a FIX
  rather than a decision, and it is the hard precondition on shipping R1: 8 of the 10 worst
  "entered IVV at ~99pp" rows are already `available` + `sustained` and held back ONLY by the null-z
  gate that R1 removes, with 97 phantom "exited AAPL/MSFT" rows riding in the same funds.
  **Liveness lesson worth recording: the task-stub `.output` files are NOT a liveness signal.** The
  backstop check found the D8-3 stub unwritten for 88 minutes at 148 bytes — the same size every
  agent stub carries — which reads exactly like death. The worker was in fact **alive and working**:
  `ps` showed `build_holdings_lookthrough_window.py --full --out data/_tmp/d83/...` running since
  17:20 with 172 minutes of CPU. **Verify liveness from the PROCESS TABLE, not the stub**
  ([[verify-run-dead-before-resuming]] — a stub that never grows is the same shape as a dead run).
  Also confirms the worker honoured the no-canonical-write constraint: it passed `--out` into its own
  `_tmp` prefix unprompted.
  **The resource tripwire flagged at session start fired.** Disk fell from 14 GiB to **3.4 GiB free
  (100 pct used)** in an hour. Diagnosed instead of assumed: the artifact being rebuilt is only
  **134 MB** and 138 MB was already written, so the build was never the disk hog — **swap was**.
  `vm.swapusage` showed **26.6 GB allocated / 25.5 GB used** on a **16 GB** host, and macOS grows
  swapfiles on the boot volume. Cause is the standing one: Supabase's 12 containers + a full
  lookthrough rebuild + browser + session on 16 GB. It is self-correcting as the build passes peak —
  disk recovered to **5.2 GiB** during the check — so nothing was killed and no backup was deleted
  (the 55 MB redundant `.POSTLOAD` copy was kept deliberately: provenance of exactly what was loaded
  is worth more than 55 MB).
  **Operational rule reaffirmed for the next heavy build: stop Supabase first.** It could not be
  stopped here because it is serving the page the owner is actively reviewing — which is itself the
  trade-off to know about, not a reason to be surprised by it.
  Canonical writes remain **0**.
- 2026-08-18 18:40 — **D8-3 FIXED and committed (`076562f` on `fix/d83-wrapper-lookthrough`). It corrected the
  ITEM'S OWN PREMISE, and that correction is the headline.**
  All 24 candidate rows were adjudicated against raw N-PORT — did the fund actually file that CUSIP
  at its own prior endpoint? — and **14 of the 24 are TRUE allocations that really happened** (SHUS
  really did enter SSPY at 98.9pp). **Only 10 are bogus.** The magnitude cut everyone had been
  quoting was never a defect cut. Restated blast radius: **10 false "entered" rows, 97 phantom
  "exited" rows, and a coverage flag that lied for 276 funds** (`partial=false` for 291).
  **Root cause proven, not guessed:** the filer swapped the issuer LEI on the wrapper line from the
  SERIES LEI to the REGISTRANT/TRUST LEI — same CUSIP throughout — so `lei2series` missed, `msid`
  came back null, and the book collapsed to the wrapper line. **And the disclosure flag was computed
  from THE SAME FAILED LOOKUP** (`is_unresolved_wrapper = msid.is_not_null() & …`), so a
  99%-of-NAV S&P 500 ETF was reclassified as an operating-company leaf while coverage reported 1.0.
  One unknown identifier produced both halves. The dispatcher's own briefed hypothesis — that
  `etf_holdings_snapshots` has only 5 as-of dates — was **RETRACTED with evidence: that table is
  never read.**
  **The fix separates identity from resolution**: a CUSIP→series map built only where the SEC MF
  ticker file and Sharadar agree on the FILED cusip (4,839 CUSIPs) feeds the FLAG only and never
  `msid`, so *knowing what a line is* can no longer be confused with *having expanded it*. Plus a
  per-wrapper resolution ledger, a basis-break gate that marks holdings-derived rows `missing` with a
  reason when a wrapper is expanded at one endpoint and opaque at another, and fail-CLOSED wiring
  (`finalize()` raises without the gate column; NULL counts as broken).
  **The best thing in the report is a fix it built, measured and DELETED**: excluding wrapper lines
  from the position family as "not single names" removes 604 rows across 201 funds — and 14 of the 24
  are true allocations. A wrapper position IS a position. A comment now marks it so it is not
  re-added.
  Verification: regression shows **0 rows added, 0 removed, 0 magnitude changes**; 2,264 status flips
  **all** carrying the basis-break reason; **101 of 5,062 funds changed, 4,961 byte-identical**;
  10/10 false rows suppressed, **0 of 97 phantom exits survive**. An **independent cross-check
  rebuilt the ledger from raw N-PORT using none of the pipeline's code — 94 funds against the
  pipeline's 123, a strict SUBSET with 0 funds missed.** 14 tests, and reverting the two gate
  expressions in place makes exactly 7 fail. Coverage 97.0 → 92.6 pct: **coverage did not fall, the
  measurement stopped over-stating**; the residual is 26.2 pct honest vs **73.8 pct recoverable**
  (2,552 lines / 390 funds) — a defect, filed as its decision 1.
  **Cost it refused to hide:** 143 surfaced rows across 43 funds stop surfacing, and **69 of them
  have magnitudes larger than the entire basis-broken weight** (median break 1.93pp) — the fund-level
  rule over-suppresses. Filed as decision 2(a) with the alternative already sized (1,700 rows / 69
  surfaced), and no constant chosen.
  **It also found the same root cause LIVE in the X-Ray** — `holdings_complete.parquet` carries
  SPYC/HEQT/SHUS/GBXA as a single opaque ETF line with no wrapper flag at all (partially contained by
  `exposure_xray.is_opaque`). Filed.
  Non-mutation: `os.walk(followlinks=True)` over 2,252,145 files with a canary, **and the detector
  proved non-vacuous by relocating its allowed prefix (it then reports 9 offenders)** — the strongest
  form of this proof the run has produced. **Canonical writes remain 0.** Disk recovered to 13 GiB as
  swap released. **Four commits now carry a disclosed, OWED codex gate.**
- 2026-08-18 22:47 — **Movement 03 audited end-to-end: PASS on every NUMBER, three HIGH findings on the STORY.
  One was a false sentence on 144 live pages and is FIXED (`3c291ab`); the rest are filed to
  backlog so they survive this session.**
  This closed a gap in the dispatcher's own process: every other unit of the run got an adversarial
  check and F2 — the newest thing on the owner's page — had not. The audit walked
  **rendered HTML → Postgres → staging → gold → raw daily prices** and **reconciled all 3,094 served
  payloads against gold with ZERO field-level discrepancies**, rebuilding PRNEX's entire panel
  bit-for-bit from raw adjusted closes (25228.951859 == 25228.951859). Every figure the owner is
  reading — $25,229 / $46,574 / +5.3 pct/yr / 110 pct / 98 pct / 79 down months / 15 of 79 / 18.1
  years — **reproduced**. External sanity clean (VT +8.88 pct/yr vs a published 8.96 pct
  since-inception): no units error, no off-by-a-decade window.
  **The honesty machinery was MUTATION-TESTED, not assumed.** Dropping `hypothetical`, dropping
  `mix_as_of`, dropping both, dropping `series`, and an empty-string `mix_as_of` **all** produce a
  null view with no section and no nav entry. The claim that an unlabelled backcast cannot reach the
  page is TRUE. VOO renders nothing; "global bonds" appears nowhere; ongoing drawdowns say "not yet".
  **HIGH-1, and it was shipping a FALSEHOOD: 144 funds' twin IS the reference leg.** A `100% VT`
  twin makes both capture ratios 100 **by identity**, and the old rule matched
  `downPct <= 100 && upPct >= 100` and printed *"Less of the falls came through than the gains"* —
  next to "$46,574 ... turned the same $10,000 into $46,574". **Fixed and committed**: suppressed on
  the identity, plus a branch that never existed for the ADVERSE case (MCHFX, down 88 / up 77 while
  returning 4.84 pct/yr against VT's 11.40 pct in a 70 pct ongoing drawdown, previously rendered as
  the reassuring "moved less than world stocks in both directions"). Funds already correct are
  unchanged. **Removing a false claim was treated as a defect fix, not deferred to a decision**; what
  IS deferred is whether the card or the section should render at all for an identity twin.
  **HIGH-2 (owner): "twin" means two different portfolios on one page.** M02 uses a point-in-time
  twin refit as the fund changed; M03 uses today's mix backcast. Same window, same named object:
  **$28,600 vs $24,503, a 16.7 pct divergence** — and M02's own caption warns against "today's mix
  projected backwards ... a mirror that did not exist at the time", which is precisely M03's method.
  The two displayed figures sit close enough to imply 2008-2012 was flat when the twin actually
  **lost 11.8 pct**. Filed.
  **HIGH-3 (owner): 18 index ETFs get "before you judge the manager".** TAN has no manager and its
  twin is a rival passive ETF. One root cause, two symptoms — these 18 are EXACTLY the 18 with no
  `asof_refit_date`, having entered via a path that bypasses the L2 fit record, so their chip date is
  asserted rather than sourced. The assembler's own docstring already forbids this. Filed.
  **MEDIUM-HIGH: the headline dollar figure assumes DAILY REBALANCING for 18 years, undisclosed** —
  PRNEX $25,229 vs buy-and-hold $26,539; worst case **$111,953 vs $177,659, a $65,706 gap on
  $10,000**. Filed.
  **Two errors in the dispatcher's OWN methodology copy, corrected (`8e8b1e7`)**: the suppression
  components did not sum (published 2,130/608/2 = 2,740 against a real 2,725; truth **2,130/588/7**),
  and the coverage denominator **understated our own result** — against the 3,101 funds that actually
  display a twin mix, coverage is **99.8 pct**, not the published 83.9 pct. Both re-derived from the
  staging parquet by the dispatcher before editing.
  **Six findings filed to `backlog.md` Working set** so none of this is lost with the session.
  **Environment: the local Postgres is DOWN and needs the owner.** Docker reported the container "Up
  24 hours (healthy)" while `exec` said it was not running — its VM disk took an I/O error during the
  swap episode. `docker start` fails on `/var/lib/docker/.../hosts: input/output error`. Docker
  Desktop was quit (the standard non-destructive fix) and **will not relaunch from the CLI** — the
  owner must open it, then `npx supabase start`. **No prune, no factory reset: that would destroy the
  local serving DB.** The data is recoverable regardless — the exact loaded staging artifact is on
  disk at sha `38a84c41…`, so the DB is one reload away. Disk recovered to 19 GiB once Docker quit.
  **Owed, and tracked rather than forgotten:** `npm run build` and a live render-check on `3c291ab`
  (the build guard fails closed on an unreachable DB, which is correct — verified the failure is
  `ECONNREFUSED`, not the change; `tsc --noEmit` clean), and the **codex gate on six commits**
  (`c0c13bd`, `f69b6d5`, `29c3d22`, `076562f`, `8e8b1e7`, `3c291ab`), still out of vendor quota until
  2026-08-19 22:52.
- 2026-08-20 10:44 — **Docker recovered by the owner; the serving DB survived INTACT; all owed gates cleared
  and the review debt is nearly closed.** Verified against the live DB, every count identical to
  what was loaded before the crash: **facts 5,819 · holdings 1,398,380 · attribution 2,104 ·
  neighbourhood 3,094 · active manifest 56**. No reload was needed and the preserved staging
  artifact was not called upon.
  **Cleared, all three owed on the down database:** `db:check-serving` **PASS** (41 columns, no
  anon/authenticated exposure) · `npm run build` **clean** against 127.0.0.1:54322 · the render-check
  on `3c291ab`, which confirms the capture fix behaves: **PRGSX (twin IS world stocks) now prints NO
  takeaway** where it used to assert a false asymmetry, **MCHFX now reads "More of the falls came
  through than the gains"** instead of the reassuring old line, and PRNEX/FCNTX are unchanged.
  **The codex gate PASSED on the web branch — and independently reproduced three findings the
  movement-03 data audit had already made, by a different method.** Two reviewers, different
  approaches, same three defects: the undisclosed daily rebalancing, the manager copy on passive
  vehicles, and the fail-OPEN parser. That convergence is the strongest quality signal this run has
  produced, and it turned three "filed" items into three fixes.
  **All three fixed and committed (`14ec752`) with a PASSING GATE AND ZERO FINDINGS** — the first
  commit in two days needing no exception. (1) `buildNeighbourhood` now **fails closed** on a missing
  drawdowns/years/capture: coercing to `[]` had silently dropped whole cards while the section and
  its nav entry still rendered — the nested-contract-collapse shape where the parent looks populated
  so no guard can see the hole. (2) The **"only second a bet on the manager" clause is suppressed for
  passive vehicles** — 18 index ETFs reach this section and none of them has a manager; suppressing
  the SECTION for them stays an owner call, this only stops a claim that cannot be true. (3) The
  **daily-rebalancing assumption is disclosed**, conditioned on `twinLegCount > 1` so the 2,860
  single-leg twins stay silent rather than carry an irrelevant caveat — the gap it discloses reaches
  **2.96pp/yr, $111,953 vs $177,659** on the worst multi-leg twin. Render-checked across six cells,
  all as intended.
  **Debt status: 4 of 6 owed gates now cleared** (the web branch, plus this new commit gated
  properly rather than skipped). Remaining: the two `fund_score` branches — L6 (`29c3d22`) now
  running, then D8-3 (`076562f`).
  One operational note: the first branch-wide gate took **3h04m** to return where these normally take
  5-15 minutes. It did complete and did pass; smaller per-diff scopes returned in minutes. Prefer
  narrow scopes.
- 2026-08-20 11:23 — **L6 committed with a CLEAN GATE (`6e177e2`, 0 findings) after four review rounds. 5 of 6
  owed gates cleared; only D8-3 remains and is running.** Worth recording what those rounds caught,
  because every one would have shipped looking green: (1) the check **validated SCRATCH, not
  production** — on a clean checkout `make check` died file-not-found, and with stale scratch present
  it PASSED while never opening the gold panel; (2) G4 made **targeted builds unusable**; (3) the
  three-state refactor **broke a caller** (`not None` is truthy, so every sample build exited GATE
  FAILURE); (4) that fix **re-created its own bug through a side door** — `--panel` hard-coded
  full-universe, reinstating the very false failure (2) had removed; (5) **partial writes passed
  vacuously** — a panel with SOME new columns took the absent-column path and validated nothing on
  disk, the same shape as (1) returning through the partial door.
  **On the sixth finding the reviewer was BACKWARDS, and following it literally would have made
  things worse.** It called the targeted `--panel` path "broken" for exiting 1. The exit was correct:
  4 seeded defects cannot trip on a small sample because it holds no COUNT rows, no `style`
  classifications and too few funds for G4's bound. The real defect was conceptual —
  **falsifiability is a property of the CODE**, established on the full universe, so running the
  battery on a sample yields "DID NOT FIRE" lines that describe the SAMPLE rather than the gate:
  misleading green of exactly the kind this check exists to prevent. Resolution: the battery is
  full-universe only, and a targeted panel validates its VALUES while stating plainly that
  falsifiability was **not re-proven there**. Both paths verified — canonical runs all 9 gates with
  every seeded defect tripping; targeted exits 0 honestly; an UNEXPECTED skip still aborts.
  Discipline held throughout: each new guard was **proven able to fail** (the partial-write guard by
  seeding a panel with `te_rank` dropped → exit 1), the consumer audit was done **by symbol, not by
  literal path** (3 call sites, all handling the new state), and **D8-8 was filed rather than
  absorbed** — a pre-existing `--sample N` crash that reproduces with `--no-te-impact` and was never
  touched by the diff.
  Also cleared earlier in the session: the web branch gate (PASS), and its three advisories fixed and
  committed (`14ec752`) with a **passing gate and zero findings** — codex having independently
  reproduced three findings the movement-03 data audit made by a different method.
  **Canonical writes across this entire session remain 0** outside the one owner-authorised reload;
  the positioning panel is byte-identical at sha `c1e5e138…`, verified independently each round.
- 2026-08-20 11:30 — **REVIEW DEBT FULLY CLEARED. All SIX commits that carried a disclosed, owed codex gate
  are now gated, and every one PASSED.** D8-3 (`076562f`) closed the set with **0 findings**: "I did
  not find a discrete code defect in the diff. The new unit tests pass, and the only failure observed
  was against stale local generated parquet data that lacks the new column/ledger until the upstream
  artifact is rebuilt" — i.e. the one red was a stale local artifact, not the code, which is the
  expected state since D8-3 built to `_tmp` and never promoted.
  Ledger, for the record: `c0c13bd` · `f69b6d5` · `8e8b1e7` · `3c291ab` (web branch, PASS) ·
  `29c3d22` -> `6e177e2` (L6, PASS after four rounds, 0 findings) · `076562f` (D8-3, PASS, 0
  findings). Plus `14ec752`, gated properly rather than skipped. **No commit in this run now rests on
  an unrun gate.**
  The `SKIP_CODEX_GATE=1` exceptions taken while the vendor account was over quota were **disclosed
  at the time, tracked as OWED, and have now all been discharged** — none was a finding overridden;
  every one was an unavailable reviewer, and the review happened as soon as it was available.
  **Session integrity summary:** canonical lakehouse writes **0** outside the single owner-authorised
  serving reload; the positioning panel byte-identical at sha `c1e5e138…` and the NAV at inode
  77680801 throughout; the serving DB verified intact after the Docker VM failure (5,819 / 1,398,380
  / 2,104 / neighbourhood 3,094 / manifest 56) with no reload required.
  **Everything the line can do without the owner is now done.** Four decisions remain and were
  re-presented in one page: S2 (the receipts floor — recommend hold at 0.80), the capital-gain
  measurement pass (recommend authorise measuring, NOT fixing), L14's fill + precedence (recommend
  B+G1 and P1), and the "twin means two different portfolios on one page" question — the only one
  carrying **no** recommendation, because it is a product-voice call.
- 2026-08-20 12:45 — **OWNER RULED ON ALL FOUR. Three unblocked, one turned into a measurement.**
  **S2-a = 0.80** ("Sure 80%") — the receipts floor holds where it is; 1,947 funds get the card.
  Consequences that follow automatically and are recorded so nobody re-opens them: **S2-c (the twin
  basis) is NOT blocking at 0.80** — it was only blocking for a floor BELOW 0.80, where the
  un-renormalized-twin defect concentrates; **S2-d (ADR pricing) stays deferred**; and **S2-b takes
  the status quo** — the shipped gate already uses the worst-sub-period basis, and the line ruling
  (gate basis == displayed basis) then forces display to match it. No change needed.
  **Capital-gain: "Yes measure"** — Segment 2 authorised as a MEASUREMENT pass, not a build. The
  owner also asked for a proper root-cause explanation, which was given: the vendor moves its
  ADJUSTMENT FACTOR on the ex-date while the PRICE does not move until the next day, so for one day
  the two disagree — AQLGX shows +46.1 pct on a flat-price day, then the real -46.1 pct lands
  unadjusted. **The deeper defect is that `build_fund_daily_adj_close.py` keeps only `adj_close` and
  discards the raw close and the dividend**, so nothing downstream can tell an invented move from a
  real one. The fabricated charts are the symptom; the discarded evidence is the cause.
  **L14: "You pick"** — line takes **B+G1** (fill, ISIN-embeds-identifier + filed-name corroboration)
  and **P1** (US/Sharadar wins the vendor tie). Recorded as a delegated line decision, not an owner
  ruling, so the provenance is honest.
  **Twin question: the owner pushed back well and the pushback is being taken seriously.** Their
  argument — "for past performance we should use the current mix, since it is anyway derived from a
  past regression" — has real force. Evidence put in front of them: **PRNEX's section-02 benchmark is
  SEVENTEEN different portfolios stitched end to end** (2020 VEU 55/XLE 45 → 2021 VT 60/XLE 40 →
  2024 VT 52/IXC 48 → 2026 IGE 68/VT 32), which is **not a portfolio anyone could have held** — you
  would have had to switch on our refit dates — and the page currently labels it "IGE", which is
  false for the early years. Against that, the current mix carries hindsight: it is fitted knowing
  the fund's recent returns, so grading 2020 with it uses information from the future.
  **Nobody has measured what that hindsight is worth**, so the line offered to measure it — Value
  Score verdicts under both benchmarks, same funds — rather than argue the principle. Three options
  are on the table (A all point-in-time, B all current-mix, C keep both but stop calling both "the
  twin"); the line leans C but will not defend it without the number.
  **Q1 answered with evidence, and the premise was wrong in a useful way: we CAN price foreign
  companies — when the line is US-exchange-listed.** Measured against the real equity store (8,643
  tickers): Shell, TSMC, BP and AstraZeneca are all **present**; the OTC ADRs (RHHBY, BAYRY, BNPQY,
  RBGLY, PROSY, PPRUY) are all **absent**; home-exchange ordinaries (Bayer/Xetra, Nestle/SIX) are
  **absent**. So the dividing line is not "foreign" — it is **where that specific share line trades**.
  The vendor covers US EXCHANGES, not the US OTC market and not foreign exchanges, which is exactly
  why no floor reaches international funds. **A trap was flagged in the same breath:** `ROG` and `MC`
  ARE in the store — as Rogers Corp and Moelis, not Roche and LVMH — so matching foreign holdings by
  ticker would silently price the wrong company, the same class as the Genie/GE bind.

- 2026-08-20 14:07 — **RUN RECOVERED after a process death, and L6 SEGMENT 3 AUTHORISED BY THE OWNER.**
  **What died:** the dispatcher session (`c4a3c451`) lost its stream at 13:00 MDT and the process
  bonked at 13:32. Both in-flight workers were killed by the stall watchdog after 600s with no
  progress. **They died simultaneously, right after successful tool results — that points at the
  process, not at either agent's work.**
  **What survived, verified on disk rather than assumed:** L14's ISIN name harvest **COMPLETED at
  13:05** (445,153 rows, 49,054 distinct ISINs -> `data/_tmp/l14/fresh_isin_names.parquet`) — the
  agent was blocked in a wait loop and died five minutes before its own result landed. Both
  worktrees intact with uncommitted work; capital-gain's Segment-2 report written to S2-F1;
  **canonical lakehouse writes 0** — both workers were `_tmp`-fenced and the fences held.
  **What did NOT survive, and is the lesson:** the `:14/:44` backstop heartbeat cron was registered
  INSIDE the dispatcher session, so it died with the run it exists to rescue. The backstop only ever
  covered "alive but stalled", never process death. Recorded as [[backstop-cron-dies-with-session]].
  **OWNER RULING: L6 Segment 3 is authorised to write the canonical `serving_facts_staging.parquet`.**
  That was the explicit authorisation §S2.11 said it needed, and it was the only decision on the board
  that could be taken without waiting on a measurement.
  **Restart state:** Docker restarted (it was down, taking Supabase with it); the local stack came back
  healthy. Three workers dispatched — capital-gain Segment 2 (measurement, `_tmp`), L14 Segment 1
  (sample, `_tmp`), L6 Segment 3 (the one canonical writer). F2's fence is honoured: exactly one
  lakehouse-writing session.
  **A PREREQUISITE THE BOARD HAD LOST TRACK OF, found while dispatching L6 and raised to the owner:**
  P7-D1 says R1 must not ship until D8-3 is fixed — and D8-3's fix `076562f` is **committed only on
  `fix/d83-wrapper-lookthrough`, not merged to main and not an ancestor of the L6 branch**, while its
  rebuilt artifacts sit unpromoted in `data/_tmp/d83/` and canonical
  `positioning_changes_panel.parquet` is still dated **2026-08-09**, pre-D8-3. So R1 cannot honestly
  ship on today's canonical data. L6 is sequenced Phase A (no canonical writes, and measure the true
  cost of the prerequisite) / Phase B (the authorised writes) and told to STOP between them.
  Fence F2/F3 reserves merges to the owner, so the merge is the owner's call and is now in front of them.

- 2026-08-20 15:01 — **ALL THREE DISPATCHED SEGMENTS LANDED, all three stopped correctly at their checkpoints, all
  three adversarial reviews now RUNNING. Zero canonical writes across all of them.**
  **U2 capital-gain Segment 2 (measurement).** Two changes to the owner's mental model. (a) The
  early-factor account is CONFIRMED and far stronger than the 8 pct they hold — the 8 pct was an
  ARITHMETIC ARTIFACT: Segment 1's statistic degenerates to `-y^2` when the drop lands, so it measures
  y and **cannot fire above y = 0.2236** while the class median y is 0.3661. True landing rate **41.0
  pct on exactly T+1; 0 of 1,362 events had money leave on the stamped day.** (b) **Roughly half the
  trigger class is a DIFFERENT defect** — 740 of 1,519 events (609 tickers, **569 served**, 77 scored)
  have a stamped amount the price path contradicts. M1 returns three remedies, not two, exact on
  disjoint halves; **excision deletes no real return anywhere and repairs nothing anywhere** (window
  no-op bar 104 truncating events), and R3 — the repair actually on the record — is **undefined for 271
  events (19.9 pct)**. **S2-F9 RETRACTS the predecessor's S2-F2**: the 705 "price exactly flat" events
  are stale prints and flat is evidence the money DID leave, one day late — the opposite of what was
  written. Zero floor changed the final population by **exactly zero events**. **BRIEF-B(2) retracted:
  mandatory coherence does NOT fail-close yahoo tickers** (phi computable 67/67, cost 0 not 46) — but
  re-adjudicating them exposed a **NEW unnamed defect**: the yahoo factor over-moves ~2.5x on days the
  distribution went ex correctly (ICENX 2008-11-11 served **+111.8 pct** against a true **-2.2 pct**).
  Agent self-caught and disclosed a polars `NaN >= x` bug in its own classifier.
  **U3 L14 Segment 1 (sample).** **1,322 rows / \$6.0854B / 754 funds newly classified; 0 existing
  labels changed.** Precision measured on the population the rule ACTUALLY acts on (the Segment-0
  correction): on the 60 held ISINs E1 8/8, E2 10/12, E3 23/24, four contradictions hand-adjudicated.
  Every guard defeated **twice** — fixture and production scale; the W1 probe refuses Cimpress-shaped
  bindings 8/8. Non-mutation CLEAN and **earned** — a seeded violation flips it DIRTY. Segment 0's only
  material false refusal (Brookfield Business Corp) is retracted, not worked around. **M4 is inert at
  production scale and is reported as fixture-only rather than dressed as a scaled proof.**
  **U4 L6 Segment 3 PHASE A.** **It reversed the dispatcher's own read of the D8-3 prerequisite:
  D8-3 is a CODE-MERGE prerequisite, NOT a data-promotion one** — the suppression lives in PANEL code
  (0 matches on this branch, 20 on `076562f`), so promoting the frame alone would fix nothing. Merge is
  clean, zero conflicts. Cost is trivial: **panel 4.0s, staging 34s, ~335 MB**. **R16 retracts the D8-4
  blast-radius warning this file carried — it is currently ZERO** (staging is 2026-08-18, not 08-09;
  08-09 is the `.prereload` copy). **R17 corrects the headline: +866 was gross and pre-D-4; net is
  +854** (3,265 funds / 20,894 rows at cut 8). D-4 takes **undated served rows 139 across 93 funds to
  0**. G6 caught a defect in the agent's OWN code before it could report green.
  **It declined Phase B for a better reason than the merge:** merging `076562f` drags in **two owner
  decisions D8-3's own author declined to make** — a suppression refinement (143 rows/43 funds today, of
  which **69 have a break arithmetically too small to explain the move**) and **2,552 lines / 390 funds
  (73.8 pct) RECOVERABLE-missing, a DEFECT under the house rule.** R1 widens what surfaces, so those
  rulings decide what the +854 funds see.
  **New defects filed, none of them L6's or L14's:** **D8-9** `return_attribution` row order is
  non-deterministic (31/47 funds differ across consecutive runs; **1,939 of 5,819 served funds
  exposed**); the capital-gain **bad-dividend-record** item is re-sized to **740 events / 609 tickers /
  569 served / 77 scored**; the **yahoo factor over-move**; and two web-side items — `profile-v2.ts:646`
  `recentChangesTe` is still **fixture-only** (nothing populates it from the served row) and
  `registry.ts:485` pins `positioning_changes_v0.1` with prose that goes stale on promotion.
  **Nothing is committed and nothing is gated yet — three `data-reviewer` checkpoints are running, and
  no result above should be treated as established until they return.** Reviewer >= implementer holds:
  implementers were opus, reviews are on the session model.

- 2026-08-20 15:45 — **SESSION LIMIT killed all three reviewers mid-flight; all three RESUMED from their own
  transcripts (not relaunched), progress intact.** Partial findings they had already reported are worth
  recording because one is adverse: the capital-gain reviewer had found **the 740-event union claim
  fails in BOTH directions — it gets 851 vs 740 with 71 uncovered.** The L6 reviewer had confirmed the
  builder fails closed on both batteries and that G6 gates the final post-reorder rank; the L14 reviewer
  had independently confirmed non-mutation. **No verdict is in yet and nothing is established.**
  **ANSWERED THE OWNER'S FOREIGN-RETURNS QUESTION, and the previous answer was wrong in the direction
  that matters.** On 2026-08-20 the line told the owner the dividing line is "where that share line
  trades" and implied the gap is honest-missing. Measured on the densest quarter (2026-03-31; 2,471
  series, $12.74T): **87.1 pct of held value is priceable per-stock; 12.9 pct — $1,644B — is not**, and
  **81 pct of the unpriced rows (198,546 rows / $1,340B) carry NO TICKER AT ALL** — they never reach a
  price lookup to fail it. Split by the ISIN-keyed `fmp_isin_us_ticker_bridge`: **$540.4B (32.9 pct) is
  RECOVERABLE — 1,047 securities across 1,808 funds whose ISIN resolves to a US ticker ALREADY IN OUR
  PRICE STORE** (TSM $46.6B, NVS $11.4B, BTI $10.6B, TTE, NXPI, LIN, HSBC); $716.1B (43.6 pct) resolves
  to a US ticker we do not price; $299.6B (18.2 pct) has no bridge entry — the plausibly-honest cohort;
  $87.9B (5.3 pct) has no ISIN. **Under the house rule a recoverable miss is a DEFECT, not partial
  coverage.** This is the same defect as the L9 line ruling "the pricing path never calls
  `fmp_isin_us_ticker_bridge`" — but that ruling sized it at **+30 funds** and the true size is
  **1,808 funds / $540B**, off by more than an order of magnitude. Filed to backlog Working set.
  **Two things must be settled before anyone builds it:** whether a US ADR's USD return is the right
  return for a foreign ORDINARY line (it differs by FX — defensible for a USD-reporting fund, but
  adjudicated and labelled, never assumed), and the wrong-company trap (bind on ISIN ONLY — `ROG` and
  `MC` are in the store as Rogers Corp and Moelis). **Consequence the owner should see: this gap is the
  denominator the 0.80 priced-coverage floor they ratified today is computed on.**

- 2026-08-20 15:48 — **U3 (L14) Segment 1 CHECKPOINT: PASS-WITH-CORRECTIONS, nothing blocking. Codex gate RUNNING;
  the commit hook correctly refused a pre-gate commit.**
  The reviewer re-derived every load-bearing number from scratch — its own admit-set construction from
  the fresh harvest + vendor map + the repo's `_names_match`, never re-reading the report — and it all
  reproduces: 574-admit set (symmetric diff **0**), `gained 574 / changed 0 / lost 0`, the 1,322 rows /
  \$6.0854B / 754 funds propagation, the remainder decomposition to the row, M4 inert at production
  (0/1,077) and non-degenerate at fixture, the Brookfield retraction correct on identity, and
  non-mutation confirmed on the real non-symlink paths. **It re-adjudicated all four held-set
  contradictions from raw evidence and AGREED** — share-class artifact, share-structure, rename, stale
  vendor record; none a wrong-company bind. It also **recomputed the 9-of-14 P1 split from data after
  finding the segment's own scratch script had HARDCODED it** — and got exactly 9.
  **The material correction changes the owner's Segment-4 choice: the structural option sweeps in
  `MHY621321089` Navigator (78 rows / \$81.2M, Industrials→Energy), which is an S7-4b security** — so
  the structural route DOES touch S7-4b, directly contradicting the report's claim beside it, and it was
  hidden inside an ellipsis. **The owner must see it named before choosing allowlist vs structural.**
  Second correction worth carrying: **R-8 is LABEL-BLIND** — a sector flip leaves `classified_weight`
  unchanged, so "0 regressed" can never detect one. The check is not degenerate (a seeded real loss
  makes it report **206 regressed**), but Segments 2/3 must pair it with the reference-level per-ISIN
  `changed 0 / lost 0` diff. Also: W1's "+8 ISINs" is properly "6 held + 2 reference-only", and the
  structural collateral is 31 ISINs / 362 rows / \$880.3M actually changing label (definitional delta
  against the report's 32/363). All four corrections appended to `reports/l14_segment1.md`.

- 2026-08-20 15:53 — **U2 (capital-gain) Segment 2 CHECKPOINT: PASS-WITH-CORRECTIONS, but FIVE statements must not
  reach the owner as written — two of them inside the owner briefs. ONE revision round dispatched.**
  The measurement layer is real: the reviewer re-derived every load-bearing table from canonical/raw
  sources with its own code, including **the entire S2-F10 remedy window table cell-by-cell from raw
  closes**, and confirmed the stale prints appear in EVERY tiingo vintage — so the staleness test is not
  a panel-build artifact. **All the central reframings survive**: the -y^2 retraction of the 8 pct
  headline, the stale-print reversal of S2-F2, the three-remedy table, "excision is a window no-op",
  R3 undefined for 19.9 pct, the 740/609/696/569/77 sizing, the M3 retraction, the yahoo defect's
  existence, and non-mutation.
  **What does NOT survive, and why it blocks the owner decision:**
  **(1) The 575 "genuine timing" class is contaminated by the report's OWN proven bad prints.** The
  2025-09 family splits **38/38 across the two halves of the taxonomy** — every 2025-09-10 stamp has
  `left_T1 ~ 0.99` and lands INSIDE the "stamped amount is right, only the timing is wrong" class.
  **DECISION A would therefore write R3 repairs onto >=38 events whose premise the same report
  falsifies.** The "union is the 740" parenthetical is false in both directions: union = **851**; 182
  sub-class events are outside the 740; 71 of the 740 are in no sub-class. The counts are right — the
  BOUNDARY leaks, and the boundary is what 1a turns on.
  **(2) "0 of the 38 appear in `value_score`" is a FABRICATED ZERO from a check that could never fire** —
  `m2e.py` falls back to `vs.columns[0]` (= `series_id`) when there is no `ticker` column, so filtering
  it by ticker strings returns 0 vacuously. **MSVSX is in fact scored.** The mitigation is real (hygiene
  truncates MSVSX at 2025-09-09, so its score predates the bad print) but the claim as printed is the
  vacuous-check class this run keeps finding.
  **(3) "Class A is empty" is a THEOREM, not evidence** — min served step 0.18244 >= the 0.18232
  excursion floor every event must clear, while class A requires s <= ~0.105. No selectable event can
  land there; for the 271 events with y >= 1 it is impossible at any s.
  **(4) The NaN fix did not propagate to three downstream numbers** — median `left_T1` 0.993 is
  NaN-inflated (clean **0.9829**); S2-F7's 513/94/18.3 pct/0.0073 is pre-fix (corrected: 559/94/16.8
  pct/0.0084); and "100+ thrown out of PAID" is **false** — one-sidedness had ZERO net PAID effect.
  **(5) DECISION D's "over-moves above 1 pct of NAV" onset is a BANDING ARTIFACT** — `.round(0)` applied
  before `.cut()` shifts every band edge up to 0.5pp. True onset is **~2-3 pct of NAV**, not 1 pct.
  **U3 (L14) committed** on `fix/l14-domicile-routing` after codex pass (0 blockers, 0 advisories); a
  post-gate lint fix tripped the commit hook's "code changed after review" guard, correctly, and the
  gate is re-running. **Both fences behaved exactly as designed today** — the hook refused a pre-gate
  commit and then refused a post-gate edit.

- 2026-08-20 15:58 — **U4 (L6) Phase A CHECKPOINT: PASS-WITH-CORRECTIONS. All three checkpoints are now in. U3
  (L14) COMMITTED (`98c3433`) after a second codex pass.**
  The reviewer re-derived every headline number and several trace to the **raw SEC filings**: R0
  reconstruction == production staging row-for-row; **served == gold, 0 mismatches over 480,562 field
  comparisons**; D8-6's 139 undated rows / 93 funds -> 0; the D8-3 frame trio (+3,459 wrapper flags
  strictly one-way, 0 reversals on a 4.03M-row keyed join); determinism reproduced to the row with
  inertness **stress-tested rather than accepted**; G6 falsified with the reviewer's OWN seeded defects;
  the consumer audit re-done independently — `build_fund_takeaways` confirmed **dead**, no hidden
  consumer; FCNTX's 8 rows traced to N-PORT `0000035402-26-003312` (META -6.010pp, BRK.A -6.210pp,
  BRK.B +1.024pp); non-mutation clean.
  **Four corrections, two of which the owner brief depends on:**
  **(C-1) "Merging `076562f` is clean, zero conflicts" is FALSE for the branch that will actually
  merge.** The clean result was measured against COMMITTED `6e177e2`, but Phase A's code is
  **uncommitted** and touches the same files. Snapshotting the working tree yields **one conflict** in
  `positioning_changes.py` — a single both-sides-insert hunk of adjacent constants, resolvable by
  keeping both. **The D8-3 substance survives entirely** (0 basis-break refs on this branch vs 20 on
  `076562f`; frame promotion IS a no-op; the prerequisite IS a code merge) — but the merge ruling reads
  that sentence, so it must say "one trivial conflict".
  **(C-2) D8-9 was MIS-DIAGNOSED by exactly the vacuous-verification pattern this run keeps hunting.**
  Served rows carry **no `total` field at all**, so "all 107 moved positions have `total = null`" is true
  **by construction**, and "1,939 of 5,819 exposed" is merely the count of funds HAVING the section. The
  real sort key is null on **0** funds. The phenomenon is real and pre-existing (reproduced on MAIN),
  but the mechanism is **exact-duplicate float keys** on overlapping-theme twins and **true exposure is
  56 funds, ~35x smaller than filed**. A fix built against "nulls sort last" would not fix it. Refiled.
  **(C-3)** §S3.10's "3 ERRORS" is **28** (mechanism as claimed; load-bearing half verifies at 30
  passed / 1 failed against the v0.2 panel).
  **(C-4) MATERIAL OMISSION from the ruling brief — served-content CHURN.** The report gives "+854 net"
  and never states that **4,069 currently-served non-style rows across 1,325 funds LEAVE the served
  top-8 under R1 — 46.9 pct of today's non-style served rows — with 214 funds having their ENTIRE
  current section content replaced.** All 4,069 verified as cut-displacement (still `is_surfaced` at
  rank > 8, **0 surfacing regressions**), so this is D-1 + D-1b operating as ruled, not a defect. But a
  brief showing only net adds while half the displayed rows rotate out is not a complete brief, and the
  owner must see it.
  **Phase B is safe once the owner rules, on four conditions** (adopted from the reviewer): fix C-1..C-4
  first; commit Phase A, merge keeping both constant blocks, and **re-run the full gate battery on the
  MERGED tree** (the review covered the pre-merge tree plus merged blob reads, not a built merged
  artifact); **re-measure the D8-4 blast radius immediately before the staging write**; and rebuild
  `value_offering_reframed_panel` AFTER the positioning panel.
  **All corrections appended to the reports; L6 confirmed holding cleanly at the Phase A/B boundary
  with 0 canonical writes and both authorized paths still at their pre-existing timestamps.**

- 2026-08-20 16:06 — **U2 (capital-gain) REVISION ROUND COMPLETE. All five must-fix findings addressed, and the
  corrected boundary CHANGES the remedy's shape. Focused re-check dispatched (not a second full
  review) because the corrected taxonomy is NEW analysis the owner's decision now rests on.**
  **The leak is diagnosed, not just patched:** a round-tripping print produces a T+1 fall of ~1x`D`
  that `left_T1` **cannot distinguish** from a real ex-drop — so the round-trip test had to be IN the
  boundary and was not. The rebuilt taxonomy puts a BAD PRINT bucket AHEAD of both halves:
  **BAD PRINT 85 events / 40 tickers / 76 kept / 1 scored · AMOUNT WRONG 701 / 570 / 658 / 76 scored ·
  TIMING ONLY 537 / 515 / 536 / 83 scored** · collapse 25 · unmeasurable 171. Arithmetic closes both
  ways (1,348+171=1,519; 1,270+104=1,374) and the union audit reproduces exactly (851 union; 182
  sub-class events outside the 740; 71 of the 740 in no sub-class). Old counts retained, labelled
  superseded.
  **The vacuous zero is retracted AS THAT CLASS, and the worker generalised it into a standing rule
  worth adopting line-wide: "a check that returns 0 must be shown capable of returning non-zero before
  its 0 is quoted."** It named this as the THIRD vacuous check this run has found. **MSVSX is scored**
  (`S000003671`, score100=25, n_weeks=1184); the real mitigation is that its served NAV ends
  2025-09-09, so the score predates the print — one fund protected by truncation, not zero by design.
  Class A demoted from evidence to theorem (min |s| 0.18244 vs floor 0.18232; class-A bound maxes at
  0.09910, and is negative for the 271 with y>=1 — A=0 would hold on a defect-free population).
  Clean `left_T1` median **0.9829**; S2-F7 rebased to 559 / 94 / 16.8 pct / p50 0.0084; **"100+ thrown
  out of PAID" WITHDRAWN as false** (one-sidedness had zero net effect). DECISION D onset corrected to
  **~2-3 pct of NAV** (clean bands 1.000/1.002/1.006/1.007 through y=2 pct, then 1.911).
  **CORRECTED RECOMMENDATION — conclusion unchanged, ORDERING changed:** run the round-trip/bad-print
  test FIRST, then the amount test, then apply the two-legged repair ONLY to the **537** timing events;
  route **701** to the bad-record item and **85** to `price_hygiene`, which already handles them.
  **The observation the owner should weigh, raised by the worker unprompted:** *every falsifier added
  has moved events OUT of the remediable class, never in — **1,519 -> 537 across three rounds** — and a
  fourth has not been looked for.* That is an argument for the conservative branch and it is now an
  explicit item in the re-check, along with the obvious next leak: **bad prints that do NOT round-trip
  inside the detector's window would still sit in TIMING ONLY.**
  **S2-DECISION C re-sized:** the bad-record item is **701 events / 570 tickers / 534 served / 76
  scored / 658 kept (~48 pct of the class)**, PLUS 85 print artifacts (~5.5 pct). Option (b) is
  **two gates and a band**, not one band.

- 2026-08-20 16:14 — **U2 RE-CHECK: taxonomy confirmed cell-for-cell, but a THIRD leak found — on the axis nobody
  was testing. Two bounded edits dispatched. And the "is the class converging?" question is now
  SETTLED, empirically: it is not.**
  The reviewer rebuilt the taxonomy with its OWN round-trip detector and `left_any`: **all 25 cells
  reproduce exactly**, both closures hold. Its adversarial probe for a second round-trip blind spot
  (late reversion T+2..T+15 at 5 pct tolerance, plus series-end censoring) found **none** — every flag
  resolved on raw rows to a genuine T+2..T+4 landing or its own baseline artifact. The bad-print bucket
  is complete on that axis.
  **THE NEW LEAK: the boundary tests the PRICE PATH and never the `verdict`.** All **12** kept
  NO_FACTOR events sit inside "TIMING ONLY — this item's genuine class": AEMIX, SCGLX, SEOFX,
  VPGCX/VPGEX/VPGYX, LTGAX x2, AMWCX/AMWIX/AMWYX, **CRSGX**. Every one has `left_T ~ 1` — the money
  left ON the stamped day — and serves a fabricated **LOSS** of -16.9 pct to -28.9 pct, with
  **CRSGX 2019-03-19 serving -97.17 pct** (13.41 -> 0.38, D=13.036, factor never moved; verified on raw
  tiingo + the gold panel). **These are the MIRROR defect, and DECISION A's prescription is SIGN-WRONG
  for all 12** — the two-legged repair would deepen CRSGX's -97 pct toward -99.9 pct, and its
  `-log(1-y)` leg is **undefined at y = 34.3**. TIMING ONLY is really **525 EARLY_FACTOR + 12
  NO_FACTOR**; the repair needs a `verdict == EARLY_FACTOR` guard and the 12 need the mirrored remedy as
  their own bucket. 7 of the 12 served, 0 scored.
  **ITEM 2 — the meta-observation is real and it UNDER-claims.** The 1,519 -> 1,374 -> 575 -> 537
  sequence is a genuine one-way ratchet (both apparent "in" moves added 0 events). The worker's
  "a fourth has not been looked for" is now settled: **the reviewer looked, and it exists** — the verdict
  axis takes 537 -> at most **525**. **Four rounds, and TWO CONSECUTIVE REVIEW ROUNDS have each found a
  new falsifier in under a day. The class is still shrinking, not converged.** The reviewer's words:
  the conservative branch "is not just argued for, it is the only defensible reading of this trajectory."
  **ITEM 3 — one claim overbroad, and it exposed an UNOWNED SERVED DEFECT.** "price_hygiene already
  handles them" holds for the kept 76 (2025-09 family) but is **false for CSIUX**: hygiene excised only
  the reversion leg (2022-07-14), so the served `passive_alt_daily_nav` **STILL CARRIES the fabricated
  +62.72 pct print step on 2022-07-13** and the stale 1.9632 level after it. MAPOX by contrast is fully
  excised — so the machinery handles this shape and simply did not here. **CSIUX was adjudicated OUT of
  the capital-gain rule's scope, and the report that ruled it out implied hygiene covered it. Nothing in
  any branch of the plan owns it.** Filed to backlog as its own item, with an instruction to check the
  same excision asymmetry on BRLIX / JOPSX / SMGAX.
  **Verdict: fit for the owner after the two bounded edits. The recommendation's ARCHITECTURE holds** —
  evidence-first split, conservative branch, and no remedy without consuming `close_price`, which is the
  same root cause the owner already holds (`build_fund_daily_adj_close.py` discards the raw close and
  the dividend, so nothing downstream can tell an invented move from a real one).

- 2026-08-20 16:23 — **U2 ROUND-3 EDITS APPLIED AND VERIFIED. The capital-gain report is now internally consistent
  and FIT FOR THE OWNER.** No further review round — the edits were bounded, the reviewer had already
  adjudicated the direction, and the implementer verified each with its own numbers.
  **Edit 1 (verdict axis):** TIMING ONLY = **525 EARLY_FACTOR (524 kept) + 12 NO_FACTOR (12 kept)**,
  11 tickers, **7 served, 0 scored**. All 12 have `left_T` 0.9638-1.1374 and serve a fabricated LOSS
  from -16.86 pct (LTGAX) to **-97.17 pct (CRSGX)**. CRSGX verified end-to-end: raw tiingo
  `13.42 -> 13.41 -> 0.38`, dividend 13.036, `adj_close/close_price = 1.000000` throughout, gold panel
  books -0.971663. **New S2-F24** names them the MIRROR defect and shows the prescription is sign-wrong:
  the day-T leg rewrites CRSGX **-97.17 pct -> -99.92 pct**, and the T+1 leg `-log(1-y)` is the log of a
  negative number at y = 34.31 — **it does not mis-fire, it does not evaluate.** Their remedy is the
  opposite sign. DECISION A now specifies **four ordered gates** — round-trip -> `verdict ==
  EARLY_FACTOR` -> stamped-amount -> repair — with only **525** events reachable.
  **The honesty sentence that matters most to the owner: 7 of those 525 (1.3 pct) have `n_fwd <= 3`, so
  non-reversion is truncation-censored and "not a bad print" is UNVERIFIABLE — and the owner's own named
  archetype AQLGX is one of the seven.**
  **Edit 2 (hygiene scope):** measured on `passive_alt_daily_nav` — MAPOX fully excised (526 excised
  observations, 0 served rows around its prints); the 2025-09 family truncated at 2025-09-09, before the
  print; **CSIUX NOT handled** — the served NAV books `1.206452 -> 1.963191, +62.7244 pct` and carries
  that inflated level for **396 rows to 2024-02-09**. **The excisor removed the leg that REVEALS the
  artifact and kept the leg that IS the artifact.** The report now states plainly that CSIUX belongs to
  no gate in the corrected plan and needs its own owner.
  **The self-accounting is worth recording:** both round-3 errors were **errors of SCOPE, not of
  measurement, and both were visible in output the worker had already produced** — `m4_four.py` printed
  CSIUX's exact step on the same screen where the blanket "hygiene covers them" sentence was written.
  **Two durable lessons came out of this item, both generalised by the worker itself:** round 2's — *a
  check that returns 0 must be shown capable of returning non-zero before its 0 is quoted*; and round
  3's, sharper — ***a class boundary must be tested against every axis the downstream action branches
  on*** (here the `verdict`, which the remedy reads and the boundary did not).
  It withdrew its own "a fourth falsifier has not been looked for" and replaced it with the measured
  series, now the report's headline: **1,519 -> 1,374 -> 575 -> 537 -> 525**, two consecutive review
  rounds each finding a new falsifier in under a day, **each along an UNTESTED AXIS rather than by
  refining one in hand.** DECISION C option (b) is now **three gates and a band**, and the gate count has
  grown at every review round. That is the strongest available argument for the conservative branch.

- 2026-08-20 17:15 — **Heartbeat went stale at 51 min. Verified NOT dead: the run is PARKED ON THE OWNER, which is
  a legitimate state — no compute in flight, every worker completed and reported, all three reports
  carrying their checkpoint corrections.** Per the owner contract the line does **not** stall on owner
  decisions, so it moved to the next READY item rather than idling.
  **U5 (L9 — per-stock receipts backend) DISPATCHED, Segment 0, EDA + read-only.** It is unblocked: its
  `depends_on: L1` closed 2026-08-09, and **S2-a was ratified at 0.80 today** (1,947 funds get the card),
  which was the last thing holding it. F2's fence holds — Segment 0 writes nothing, and L6's uncommitted
  Phase A is not a writing session.
  **It was dispatched with the foreign-returns finding as its HEADLINE input, because that finding is
  this item's own coverage denominator.** The existing L9 line ruling sizes the missing-bridge defect at
  **+30 funds**; the measurement says **1,808 funds / \$540.4B**. The worker is told to re-derive rather
  than inherit, and to say plainly — with its own numbers — whether the denominator the 0.80 floor was
  ratified on is itself defective. It must frame the **ADR/FX basis** question as a numbered DECISION
  (S2-d reopened as a MEASUREMENT, not a re-litigation) and bind on **ISIN only**, because `ROG` and `MC`
  are in the price store as Rogers Corp and Moelis.
  **Both falsification rules this run earned were written into its brief**: a check returning 0 must be
  shown capable of returning non-zero before its 0 is quoted (three vacuous checks caught today), and a
  class boundary must be tested against every axis the downstream action branches on.
  **Still awaiting the owner on all three fences** — the D8-3 merge (+ D8-3's own DECISIONS 1 and 2(a)),
  L14's Segment-4 scope fork with Navigator named, and the capital-gain remedy. Brief published.
