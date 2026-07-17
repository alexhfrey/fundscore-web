# PRD — Run the passive solver as an HTTP service so the app can deploy

**Status:** red-teamed (1 round, revised) → **AWAITING OWNER** · **Slug:** `solver-http-service` · **Created:** 2026-07-16 (night run)

## Problem

The Portfolio X-Ray's passive-blend solve runs as a local child process: `runSolver()`
(`src/lib/serving/portfolio-solver.ts`) spawns `uv run python scripts/pipeline/run_portfolio_passive_solver.py`
inside the fund_score checkout. That requires Python, uv, CVXPY, and the pricing panels on local
disk — none of which exist on Vercel. Everything else in the app is a clean Vercel fit (RSC pages
over Postgres). The X-Ray — the headline promise of the homepage — is therefore the one feature
that cannot deploy.

## Who & why

Launch-blocking infrastructure. No retail user sees this directly; they see the X-Ray working (or
not existing) on fundscore.ai.

## What it does (behavior, not implementation)

- A small **always-on HTTP service** owned by us exposes `POST /solve`, taking
  `{ portfolio: [{ticker, weight}], as_of_date? }` and returning the solver's own
  `SolveResult.to_dict()` JSON on success. The contract is the existing one; nothing downstream
  changes shape. (The web `SolveResult.look_through` field is NOT the service's job — it stays
  route-attached from Postgres, as today.)
- The web app's `runSolver()` swaps `spawn()` → `fetch()` behind the **same `SolveResponse`**
  union. No fabricated results, ever — an unreachable solver is an error state, not a cached or
  default answer. Trade-off acknowledged: the spec must pick ONE dev story (keep the local spawn
  path alive behind an env switch, or dev runs the service via Docker) — two maintained bridge
  paths is a cost, a dead local path is a different cost.
- **Error contract (service-side, so the web mapping is mechanical):** the service re-validates
  inputs (MAX_HOLDINGS=50, ticker alphabet — defense in depth, never trusts the caller) and
  emits the existing `SolveError {error, detail}` body shape with: `400` invalid body/limits,
  `401` missing/bad secret, `500` solver crash (stderr tail in `detail`), `504` internal solve
  timeout. The web maps these onto the existing honest error states.
- The service is **not publicly callable**: `POST /solve` requires a shared secret (env var on
  both sides). Exception: the health/version endpoint is unauthenticated (platform health checks
  need it) and exposes no user data — only solver version + data as-of.
- The service ships with its own copy of the solver's data inputs. **Verified inventory
  (fund_score `main`, post-d92213c — the solver live-reads NINE files, ~690 MB total, not the
  ~2.2 GB in the backlog item; that figure is the raw Tiingo store, no longer read):**
  - `data/gold/fund_daily_adj_close.parquet` — 581 MB (canonical panel; both `funds_daily` and
    `tiingo_daily` default to it)
  - `data/vendors/sharadar/sfp/daily/adj_close_all.parquet` — 10 MB
  - `data/gold/fund_metadata.parquet` — 19 MB (**unguarded read — solve crashes without it**)
  - `data/gold/fund_taxonomy.parquet` — 0.4 MB (**unguarded read — crashes**)
  - `data/gold/holdings_complete.parquet` — 53 MB (fail-soft: missing ⇒ silent
    `exposure.coverage_state="missing"`)
  - `data/gold/cusip_reference.parquet` — 3.8 MB (fail-soft, same)
  - `data/gold/etf_holdings_snapshots.parquet` — 1.7 MB (fail-soft, same)
  - `data/gold/expense_ratio_history.parquet` — 0.8 MB
  - `data/nport/class_ticker_mappings.parquet` — 7.6 MB
  The three fail-soft exposure inputs are exactly why acceptance has an anti-fail-soft criterion
  (below) — a mis-packaged container would otherwise boot, solve, and silently serve empty
  exposure to every user.
- **As-of has ONE owner: the data snapshot.** The refit-aligned as-of is baked into the snapshot
  at build time; the service defaults to it when the request omits `as_of_date`, and **rejects**
  a requested as-of beyond the snapshot's coverage (no silent clamp — a result labeled with an
  as-of the data can't support is a mislabeled result). The web-side `PORTFOLIO_SOLVER_AS_OF`
  pin is retired (or reduced to a passthrough of the service's advertised as-of) so three
  independent pins (web env / CLI default / L2 partition) collapse to one source of truth.
  Rationale: `served_l2_refit_date()` resolves from L2 weight partitions the service won't ship,
  and alignment today is a manual pin convention per `io_utils.py` — the snapshot bake makes it
  structural.
- **Data refresh:** each quarterly refit produces a new snapshot + as-of for the service; the
  health/version endpoint advertises them, and the quarterly runbook gains a checked step
  "service data as-of == served refit date" (automated deploy gate vs. runbook check is an owner
  question below, tied to the freshness-stance question).

## In scope

- The service (containerized solver + its ~690 MB data snapshot + `POST /solve` + unauthenticated
  health/version endpoint + shared-secret auth + the error contract above).
- The web-side swap (`spawn` → `fetch`), env config for the service URL/secret, the fetch timeout
  budget (today: bridge 240 s, route `maxDuration` 300 s — restated as the fetch budget), and the
  chosen local-dev story.
- A documented data-refresh runbook step attached to the quarterly refit.
- A stated non-functional target in the spec: expected concurrent solves for one small instance
  (solves are ~1–4 s warm; reads are ticker-scoped) so worker/process config isn't guesswork.

## Out of scope

- Job queue / async solve architecture (obviated by the 2026-07-16 speed fix — see below).
- Autoscaling, multi-region, CDN. One small always-on instance.
- Any change to solver logic, contract shapes, or the X-Ray UI.
- The pricing-store compaction chore (separate backlog item; no longer a dependency).

## Stale premise, surfaced not silently dropped

The backlog item says "Do the compaction FIRST — a warm in-memory panel is what makes a
synchronous HTTP call viable." That predated the 2026-07-16 solver fix (fund_score d92213c):
warm solves are now ~1–4 s off the canonical panel with ticker-scoped predicate pushdown.
Synchronous HTTP is viable **without** the compaction item; proposed **de-scoped as a
dependency** (owner confirmation below).

## Acceptance (testable)

1. **Parity (same-image reference):** for a fixed fixture set (incl. a suppressed-coverage case,
   an unsupported-ticker case, and a known-covered portfolio), `POST /solve` output is
   deep-equal — **including** `solver_run_id`/`portfolio_analysis_id`, which are deterministic
   hashes — to the CLI's `--json` output executed **inside the same container image** on the same
   snapshot, same day (or pinned clock: the staleness label reads today's date). Cross-platform
   (dev-macOS vs container) comparison, if wanted, is a separate check with explicit tolerances
   ("identical ETF ticker set; weights within X bps") — OSQP/SCS floats are not bit-stable across
   platforms and near-tie combinations can tip.
2. **Anti-fail-soft packaging gate:** against the containerized snapshot, a known-covered fixture
   portfolio returns `exposure.coverage_state != "missing"` with non-null blend exposure — so a
   container missing the three fail-soft exposure inputs cannot pass by silently serving empty
   exposure.
3. **End-to-end:** a Vercel preview deployment (pointing at the data-isolated preview DB
   environment — the one with the serving tables populated, NOT prod's waitlist-only DB) with
   `SOLVER_URL`+secret set renders the X-Ray page and completes a solve round-trip; with the
   service stopped, the page shows the existing honest error state (no crash, no fabricated
   output).
4. **Auth:** unauthenticated `POST /solve` → 401; health endpoint reachable without auth.
5. **Observability:** health endpoint reports solver version + snapshot as-of, and that as-of
   equals the served refit date at deploy time (mechanism per owner answer to Q4).

## Open questions (owner) — AWAITING OWNER

1. **Hosting vendor + cost envelope** — the item names "Fly.io/Railway" (undecided). This is your
   billing/account. Need: vendor pick (or "cheapest of the two that fits a ~1 GB-disk always-on
   container"), and rough monthly budget approval.
2. **Vendor-data licensing** — the snapshot bakes licensed data (Sharadar SFP prices,
   Tiingo-derived panels) into a container image pushed to a third-party host/registry. Confirm
   this redistribution-into-infrastructure is within our Sharadar/Tiingo license terms (or that
   you'll check) before the vendor pick.
3. **Confirm de-scoping the compaction-first dependency** (evidence above — the owner-stated
   dependency predates the d92213c fix).
4. **Freshness stance between refits** — some solver inputs update more often than quarterly
   (expense_ratio_history on filings, holdings_complete on N-PORT ingests), so between refits the
   X-Ray's fee/exposure figures could disagree with the same fund's page served from fresher
   panels. Is quarterly-frozen X-Ray data acceptable at launch, or must fee/holdings inputs
   refresh on the fund-page cadence? (Also settles whether the as-of match check is a manual
   runbook step or an automated deploy gate.)
