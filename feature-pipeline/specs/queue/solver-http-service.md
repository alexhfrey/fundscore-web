---
id: solver-http-service
title: Run the passive solver as an authenticated HTTP service so the Portfolio X-Ray can deploy
status: queued
track: full-stack
repo: fundscore-web + fund_score
lane: reviewed
depends_on: ""
source_proposal: feature-pipeline/prds/solver-http-service.md
created: 2026-08-06
scope: global
model: opus
effort: high
---

## Owner summary
The Portfolio X-Ray — the headline promise of the homepage — is today the only part of the product
that cannot run anywhere but your laptop, because it shells out to a local Python solver. This ships
it as a small always-on paid-hosted service the deployed site calls over HTTPS, with the same honest
answers, the same error states, and an automated gate that guarantees the numbers it serves are on
the same data vintage as the fund pages. It is beta-critical: no invitee sees the full experience
until this is live.

**Model note:** `lane: reviewed`, `model: opus`, `effort: high` — this is a cross-repo contract +
infrastructure build (container sizing, hosting pick, concurrency/timeout design, a new deploy
gate), not mechanical plumbing; wrong judgment calls here are operational, and the fable
data-reviewer gates the parity/coherence semantics behind it.

## Goal
Stand up `POST /solve` as an authenticated HTTP service built from the fund_score repo, carrying its
own versioned data snapshot; swap the web bridge `runSolver()` from `spawn()` to `fetch()` behind
the unchanged `SolveResponse` union; land an **automated as-of coherence deploy gate** so the
service's data vintage can never silently diverge from what the fund pages serve. Nothing about
solver logic, contract shapes, or the X-Ray UI changes.

## Context (verified against real code, 2026-08-06)

**Web bridge (fundscore-web):**
- `src/lib/serving/portfolio-solver.ts` — `runSolver()` spawns
  `uv run python scripts/pipeline/run_portfolio_passive_solver.py --portfolio T:W,… --as-of-date
  $PORTFOLIO_SOLVER_AS_OF --json` with `cwd=$FUND_SCORE_REPO`. Env pins: `PORTFOLIO_SOLVER_AS_OF`
  (code default `2026-06-30` — DEPLOYMENT.md §7's "`2026-02-28`" is stale),
  `PORTFOLIO_SOLVER_TIMEOUT_MS` (default 240 000). It defines the full `SolveResult` /
  `SolveError {error, detail}` / `SolveResponse` union and `validatePortfolio()`
  (`MAX_HOLDINGS=50`, ticker alphabet `^[A-Z0-9.\-]{1,12}$`, dedupe, positive finite weights).
- `src/app/api/portfolio/solve/route.ts` — `force-dynamic`, `maxDuration=300`; validates, calls
  `runSolver()`, maps `{ok:false}` → HTTP 502 `{error, detail}`; attaches `look_through` from
  Postgres AFTER the solve (explicitly NOT the service's job — unchanged). Privacy charter in the
  route comment: row-level holdings are NEVER logged or persisted.
- Middleware gate: anonymous `POST /api/portfolio/solve` → 401 (path-based, method-independent).

**Solver (fund_score):**
- CLI `scripts/pipeline/run_portfolio_passive_solver.py` → `PortfolioPassiveSolver`
  (`src/fundscore/product/portfolio_passive_solver.py`), `--json` prints `SolveResult.to_dict()`.
  Constructor: `scoped=True` default (per-solve predicate-pushdown reads, sub-second; cached frame
  grows as the UNION of tickers across solves in one process); `scoped=False` preloads the full
  panel "for a future warm service". Warm solves ~1–4 s.
- **Live-read closure is TEN files, ~712 MB — the PRD's nine-file/~690 MB inventory misses one**
  (sizes re-verified 2026-08-06; they drift with panel refreshes — treat as indicative):
  | file | size | on missing |
  |---|---|---|
  | `data/gold/fund_daily_adj_close.parquet` | 609 MB | crash (price basis; also the `tiingo_daily` default and the perf path's scan) |
  | `data/vendors/sharadar/sfp/daily/adj_close_all.parquet` | 10 MB | crash (ETF legs) |
  | `data/gold/fund_metadata.parquet` | 20 MB | crash (unguarded read) |
  | `data/gold/fund_taxonomy.parquet` | 0.4 MB | crash (unguarded read) |
  | `data/gold/holdings_complete.parquet` | 57 MB | **fail-soft** → `exposure.coverage_state="missing"` |
  | `data/gold/cusip_reference.parquet` | 4 MB | **fail-soft** (same) |
  | `data/gold/etf_holdings_snapshots.parquet` | 2.1 MB | **fail-soft** (same) |
  | `data/gold/expense_ratio_history.parquet` | 0.9 MB | crash (`load_ticker_er` reads it unguarded) |
  | `data/nport/class_ticker_mappings.parquet` | 8 MB | fail-soft (`CTM.exists()` guard → resolution degrades) |
  | `data/reference/etf_expense_ratios.parquet` | 5 KB | **fail-soft** (`vendor_path.exists()` in `load_ticker_er` — missing ⇒ UIT ETFs (SPY/QQQ/DIA) silently lose their ER and blend fee degrades to `partial`) — **the 10th file the PRD misses** |
  (`SERIES_ER = data/gold/series_expense_ratio_history.parquet` is a dead constant — defined, never
  read; do NOT ship it. `ETF_PROXY_MAP` is code, not data.) All paths are repo-relative constants
  resolved from CWD — the service process must run with CWD = the snapshot root.
- As-of today is a **manual pin convention** (`io_utils.py` `served_l2_refit_date()` docstring:
  "Keep the Portfolio X-Ray's `PORTFOLIO_SOLVER_AS_OF` pinned to the same quarter-end"). Three
  independent pins exist: web env / CLI default / L2 weight partitions. This spec collapses them.
- `pyproject.toml` has **no HTTP framework** (no fastapi/uvicorn/flask) and a heavy full-repo
  dependency set (pymc, prefect, jupyterlab…) that must NOT ship in the container.
- Served-refit fields exist in the serving payload for the deploy gate to compare against:
  `fact_assembler.py` emits `blend_asof` (:450, :1193), `asof_refit_date` (:520),
  `l2_refit_date_used` (:2089).

**Deployment context (`docs/DEPLOYMENT.md`):** Vercel app + Supabase Postgres; production DB is
waitlist-only; **preview Supabase (`fundscore-preview` / `yqyyvhcrmcwarxweusbw`) is data-isolated
and currently EMPTY of serving tables** — acceptance #3 depends on populating it (see Sequencing).
§4.3's "pull the panel from R2 on boot" sketch is superseded by this spec's baked snapshot; update
the doc.

**Redesign-collision check (2026-08-06):** `specs/queue/portfolio-exposure-parity.md` (queued,
full-stack) extends `portfolio-lookthrough.ts` and attaches new exposure blocks in `route.ts`, but
consumes the identical `SolveResponse` contract this spec preserves — adjacent, not colliding. No
queued item retires the solver bridge or the X-Ray. No `at_risk`.

## Deliverables

### D1 — Snapshot builder + manifest (fund_score)
`scripts/service/build_solver_snapshot.py`:
- Copies the TEN live-read files (table above) into `data/service/solver_snapshots/<snapshot_id>/`
  preserving repo-relative layout (`data/gold/…`, `data/vendors/…`, `data/nport/…`,
  `data/reference/…`) so the module's relative-path constants resolve under CWD = snapshot root.
- Writes `manifest.json` carrying **two distinctly-labeled cadences** (owner answer Q4):
  - `snapshot_id`, `built_at`, `git_sha` (fund_score HEAD at build).
  - `solve_as_of` — resolved from `served_l2_refit_date()` **at build time in the lakehouse** and
    frozen into the manifest. NEVER derived from panel dates, NEVER "today". This is the refit-
    pinned basis of the solve and the value `SolveResult.as_of_date` is labeled with.
  - `inputs[]` — per file: `relpath`, `bytes`, `sha256`, `content_as_of` where a date column
    exists: `fund_daily_adj_close` → max(`date`); sharadar `adj_close_all` → max of its date
    column; `expense_ratio_history` → max(`quarter`); `holdings_complete` → max(`quarter_end`);
    `etf_holdings_snapshots` → max(`holdings_as_of_date`); `class_ticker_mappings` →
    max(`last_seen_date`). Files with no meaningful date column (`fund_metadata`,
    `fund_taxonomy`, `cusip_reference`, `etf_expense_ratios`) carry `content_as_of: null` —
    honest null, never a fabricated date.
- Builder asserts fail-closed: all ten files present; `solve_as_of` ≤ both price panels'
  `content_as_of` (a solve basis newer than price coverage is incoherent); the L2 partial-partition
  guard in `served_l2_refit_date()` already fails closed on sliver partitions — do not bypass it.
- **The freshness mechanism (owner Q4):** rebuilding a snapshot after a fee/holdings panel refresh
  produces a NEW `snapshot_id` with fresher `inputs[].content_as_of` but an **unchanged
  `solve_as_of`** (it can only advance when a new full L2 refit partition exists). This makes "a
  fresher panel never silently relabels the solve as-of" structural, not procedural.

### D2 — The service (fund_score)
`src/fundscore/service/solver_http.py` (FastAPI app) + `deploy/solver/Dockerfile` + entrypoint:
- **Boot:** load `manifest.json`; verify presence + sha256 of ALL ten files against it; construct
  ONE `PortfolioPassiveSolver(as_of_date=manifest.solve_as_of, scoped=True)`. Any mismatch/missing
  file ⇒ **refuse to boot** (non-zero exit → platform health check fails). This is the structural
  half of the anti-fail-soft criterion: a mis-packaged container can never come up.
- **`POST /solve`** (auth required): body `{ portfolio: [{ticker, weight}], as_of_date? }`.
  Re-validates server-side, never trusting the caller (defense in depth): ≤ `MAX_HOLDINGS=50`,
  ticker alphabet `^[A-Z0-9.\-]{1,12}$` after trim/uppercase, positive finite weights, dedupe
  first-wins — mirror `validatePortfolio()` semantics exactly. `as_of_date` omitted ⇒
  `manifest.solve_as_of`; supplied and > the price panels' `content_as_of` ⇒ **400, no silent
  clamp** (a result labeled with an as-of the data can't support is a mislabeled result). Success ⇒
  200 with `SolveResult.to_dict()` verbatim — the service adds NO fields, drops NO fields;
  `look_through` stays web-side.
- **`GET /healthz`** (unauthenticated — platform health checks need it; exposes no user data):
  `{ status, solver_version (module const), snapshot_id, solve_as_of, built_at, git_sha,
  inputs_as_of: {relpath → content_as_of} }`.
- **Auth:** `Authorization: Bearer $SOLVER_SHARED_SECRET`, constant-time compare
  (`hmac.compare_digest`); missing/wrong ⇒ 401. Secret is an env var on both sides; never in the
  image, never logged.
- **Privacy (binding, inherited from the route's charter):** request bodies (tickers/weights) are
  NEVER logged or persisted — access logs must be body-free; metrics may count solves, durations,
  and coverage states only.
- **Concurrency / non-functional target (one small instance, beta scale):** `solve()` mutates
  shared caches (`_funds_df` scoped-union growth, lazy reference loads) and is not established
  thread-safe — **serialize solves** (1 in-flight, async queue). Warm solves are ~1–4 s, so a
  worst-case burst of 5 concurrent users waits ≤ ~20 s — acceptable at beta; state this in the
  service README. Internal per-solve budget `SOLVER_SOLVE_TIMEOUT_S=210` (< the web's 240 s fetch
  budget so the 504 arrives before the client aborts); a solve exceeding it returns 504 and, because
  a killed-thread CVXPY solve can wedge the serialized worker, the process then exits for a
  supervisor restart (fail closed and honest — never a silently wedged always-on box). An
  equivalent subprocess-kill design is acceptable.
- **Bounded memory:** the scoped cache grows with the union of ever-requested tickers; reset
  `_funds_df`/`_loaded_fund_tickers` past a cap (e.g. 3 000 tickers) and measure peak RSS over the
  fixture suite + a 50-holding book to size the instance (smallest tier ≥ 1.5× measured peak).
- **Container:** slim Python base; a **minimal dependency group** (e.g.
  `[project.optional-dependencies] solver-service = [fastapi, uvicorn, polars, numpy, cvxpy + its
  solvers (osqp/scs/ecos), pyarrow]`) — derive the actual import closure and prove it by running
  the fixture suite in-container; do NOT ship pymc/prefect/jupyterlab. Layer order: deps → code →
  snapshot (data churns most). Report final image size.

### D3 — Automated as-of coherence deploy gate (fund_score) — owner Q4's chosen mechanism
`scripts/checks/check_solver_service_coherence.py` (pattern: `scripts/checks/check_l2_served_refit.py`),
run in the deploy runbook immediately after every service deploy, exit non-zero = deploy is rolled
back to the previous image. Inputs: `SOLVER_URL`, `DATABASE_URL` of the serving DB that deploy
serves (preview now, prod at launch), the lakehouse checkout. Checks (all fail-closed):
1. `GET /healthz` reachable; manifest fields present.
2. **Solve-basis check:** `solve_as_of` == the served refit date in the serving DB. Read it from a
   served refit field in `fund_profile_facts` payloads. CORRECTED paths (2026-08-06 review — two
   candidates are NOT top-level; the JSONB nesting follows fact_assembler's dict structure):
   `passive_baseline.source.asof_refit_date` (the :520 `source` sub-dict merges verbatim into the
   payload), `fees.peer_percentile.blend_asof` (:450 via `_fees()`), `positioning_context.blend_asof`
   (:1193), `value_offering_reframed.l2_refit_date_used` (:2089). Implementer picks ONE canonical
   field, RE-VERIFIES its actual JSONB nesting against `fact_assembler.py` before writing the query,
   and documents it; the query must find exactly one distinct value across served rows (0 or >1
   distinct ⇒ FAIL, that is a serving defect, not a pass).
3. **Panel-freshness check (fund-page cadence):** the snapshot's `sha256` for
   `expense_ratio_history`, `holdings_complete`, `etf_holdings_snapshots`, `cusip_reference`,
   `fund_metadata` equals the current lakehouse gold files' sha256 — i.e. the deployed snapshot was
   built from the exact lakehouse state that feeds the serving loads. (Runbook couples "reload
   serving facts" with "rebuild + redeploy snapshot", and this check catches the drift when they
   decouple.) A deliberate exception requires an explicit `--allow-input-drift <relpath>` flag with
   a reason string — never used in CI.
4. Prints both cadences side by side (`solve_as_of` vs each `content_as_of`) so the two-cadence
   snapshot is visible in every deploy log, per the owner's "keep them distinctly labeled" answer.

### D4 — Web swap (fundscore-web)
`src/lib/serving/portfolio-solver.ts` only; `route.ts` and everything downstream untouched:
- `runSolver()` dispatches: `SOLVER_URL` set ⇒ `fetch(\`${SOLVER_URL}/solve\`, { method: "POST",
  headers: { Authorization: \`Bearer ${SOLVER_SHARED_SECRET}\` }, body: { portfolio },
  signal: AbortSignal.timeout(SOLVER_TIMEOUT_MS) })` — the HTTP path sends **no `as_of_date`**;
  the service's snapshot owns it and `SolveResult.as_of_date` carries it back
  (`PORTFOLIO_SOLVER_AS_OF` is thereby retired from the deployed path — it survives ONLY as the
  spawn-path CLI pin for local dev, documented as such).
- Response mapping (mechanical, same `SolveResponse` union): 200 ⇒ `{ok:true, result}`; 400/401/
  500/504 ⇒ parse `{error, detail}` ⇒ `{ok:false, error}`; network failure / abort ⇒ `{ok:false,
  error:{error:"Could not reach the passive-blend solver.", detail}}`. No fabricated results, no
  caches, no defaults — an unreachable solver is an error state.
- **Fail-closed on Vercel:** `SOLVER_URL` unset AND `process.env.VERCEL` set ⇒ return the honest
  error immediately, never attempt `spawn()` on a host that cannot have the checkout.
- `npm run build && npm run lint` pass.

### D5 — Hosting pick + priced cost report (owner answer Q1)
Do NOT assume a vendor. Price BOTH for a ~1 GB-disk always-on container (Fly.io small always-on
machine sized per the D2 RSS measurement + image storage; Railway equivalent always-on service),
pick the cheaper that fits, and **report the actual monthly cost to the owner** (in the same
message as the licensing gate, D6). Region: us-east (co-located with Supabase `us-east-1`). One
instance, no autoscaling. Secrets (`SOLVER_SHARED_SECRET`) via the platform's secret store; Vercel
gets `SOLVER_URL` + `SOLVER_SHARED_SECRET` in preview + production envs.

### D6 — LICENSING HARD GATE (owner answer Q2)
The snapshot bakes licensed vendor data (Sharadar SFP prices; Tiingo-derived canonical panel) into
a container image. **Everything up to a registry push may proceed** — snapshot build, Dockerfile,
local `docker build`, in-container parity/fixture runs. **NO image push to ANY registry (including
the platform's own — `fly deploy`/Railway build push count) until the owner explicitly confirms the
Sharadar/Tiingo license terms permit it.** The implementer stops, presents the licensing question +
the D5 cost report, and waits. Fallback if licensing refuses image-baking: keep code-only images
and attach the snapshot via a platform volume populated out-of-band — note it as plan B in the
briefing, do not build it speculatively.

### D7 — Docs
- `docs/DEPLOYMENT.md`: rewrite §4.3 (baked snapshot supersedes the R2-pull sketch), fix §7
  (`SOLVER_URL`, `SOLVER_SHARED_SECRET`; `PORTFOLIO_SOLVER_AS_OF` = spawn-path dev pin only, and
  its stale "2026-02-28" note), add the deploy-gate step, AND update the `Stack:` masthead (line 4)
  + §1's vendor decision-table row to name whichever host D5 actually picks — both currently
  hardcode Fly.io, which D5 explicitly does not assume (2026-08-06 review).
- fund_score: service README (endpoints, error contract, snapshot/refresh runbook: quarterly refit
  ⇒ new snapshot with advanced `solve_as_of`; between-refit panel refresh ⇒ new snapshot, same
  `solve_as_of`; both end with D3 green). Add the cadence row to the **Pending Actions** table
  (`docs/status/pipeline_status.md:~737` — the file has no table named "refresh table";
  corrected 2026-08-06 review), or place it in the service README if that table's TODO framing
  doesn't fit.

## Local-dev story — DECISION: keep the spawn path behind the env switch (`SOLVER_URL` unset ⇒ spawn)
The PRD demands ONE choice. Chosen: **spawn stays for local dev**, HTTP everywhere `SOLVER_URL` is
set. Justification: (1) per DEPLOYMENT.md, local is where the full product actually works and where
solver iteration happens — a Docker-only dev story inserts a snapshot rebuild + ~1.5 GB image
rebuild between every fund_score code or data change; (2) the spawn path is not a second
implementation — it IS the CLI entry point that acceptance #1 pins the service to (`service ==
CLI, same image, same snapshot`), so keeping it maintains the reference implementation the parity
gate requires anyway; (3) the dead-path risk is inverted here: local dev exercises spawn daily,
and the D4 Vercel fail-closed guard guarantees deployed environments can never fall back to it.
Cost accepted: one `if` dispatch in `runSolver()` and the dev-only env pins.

## Error contract (service-side; the web mapping is mechanical)
| Status | When | Body |
|---|---|---|
| 200 | solve completed (incl. honest `coverage_state="suppress"` results — suppression is a RESULT, not an error) | `SolveResult.to_dict()` |
| 400 | invalid body / >50 holdings / bad ticker / non-positive weight / `as_of_date` beyond snapshot price coverage | `{error, detail}` |
| 401 | missing/bad bearer secret | `{error}` |
| 500 | solver crash | `{error, detail}` — traceback tail, bounded 2 000 chars |
| 504 | internal solve timeout (210 s) | `{error, detail}` |

## Acceptance criteria (all five PRD criteria restated concretely + two structural ones)
1. **Parity (same-image reference):** for a fixture set of 10–30 portfolios — at minimum a
   known-covered multi-fund book (e.g. the CLI docstring's `FCNTX:0.6,DODGX:0.3,VOO:0.1`), a
   suppressed-coverage book (≥ exclusion-threshold weight in an unsupported ticker — verify the
   CURRENT unsupported set at implementation time; SPY was the canonical case, era-stamped
   2026-07-14, non-binding), an unsupported-ticker-below-threshold (partial) book, an ETF-only
   passive book, a 50-holding max book, and weights not summing to 1 — `POST /solve` output is
   **deep-equal, including `solver_run_id`/`portfolio_analysis_id`** (deterministic hashes), to the
   CLI's `--json` output executed **inside the same container image** on the same snapshot, same
   day (the staleness label reads today's date — run both sides same day, same TZ). Any
   cross-platform (dev-macOS vs container) comparison is a separate, explicitly-toleranced check
   ("identical ETF ticker set; weights within X bps") — OSQP/SCS floats are not bit-stable across
   platforms.
2. **Anti-fail-soft packaging gate:** against the containerized snapshot, a known-covered fixture
   returns `exposure.coverage_state != "missing"` with non-null blend exposure rows (proves the
   three fail-soft exposure inputs shipped), AND a solve whose blend contains a UIT-structured leg
   (SPY/QQQ/DIA) returns that leg with non-null `expense_ratio_bps` (proves the 10th, PRD-missed
   fail-soft file `etf_expense_ratios.parquet` shipped), AND a solve including a ticker resolvable
   ONLY via `class_ticker_mappings.parquet` — a non-primary share-class ticker absent from
   `fund_metadata.primary_ticker` — resolves (not `unresolved`), proving the fifth fail-soft file
   shipped and is wired (added 2026-08-06 review: CTM is behind `if CTM.exists()` at
   `portfolio_passive_solver.py:390`, same silent-degradation class). Plus structurally: boot-time
   sha256 manifest verification refuses to start a container missing/corrupting ANY of the ten
   files — demonstrated by mutating one file and asserting boot failure.
3. **End-to-end preview:** a Vercel preview deployment pointing at the populated preview DB (see
   Sequencing) with `SOLVER_URL`+secret set renders the X-Ray page and completes a solve
   round-trip; with the service stopped, the page shows the existing honest error state (no crash,
   no fabricated output). Anonymous `POST /api/portfolio/solve` still 401s (middleware unchanged).
4. **Auth:** unauthenticated / wrong-secret `POST /solve` → 401; `GET /healthz` reachable without
   auth and body contains no user data.
5. **Observability / coherence:** `/healthz` reports solver version, `snapshot_id`, `solve_as_of`,
   and per-input `content_as_of`; the D3 gate is green against the deploy's serving DB — i.e.
   `solve_as_of` == the served refit date (mechanism = automated gate per owner answer Q4, not a
   manual runbook step) and the fee/holdings inputs match the lakehouse state behind the serving
   load. A snapshot rebuilt after a panel refresh (no new refit) demonstrably changes
   `inputs[].content_as_of` while `solve_as_of` stays fixed — the two-cadence invariant.
6. **Licensing hard gate honored:** no registry/platform image push before the owner's recorded
   confirmation (D6). The commit history / PR notes must show the stop.
7. Web: `npm run build && npm run lint` pass; no gated data or secrets leak (no `NEXT_PUBLIC_`
   solver vars).

## Verification plan (for the data-reviewer gate)
- **Sample:** the 10–30 fixture portfolios of AC1, spanning covered / partial / suppressed /
  max-size / dupe-and-case-variant inputs. Baseline/prior: the same-image CLI output (the existing,
  trusted path) — parity IS the baseline comparison.
- **Atomic checks:** per-fixture deep-equality (AC1); the two anti-fail-soft probes (AC2); the 400
  on an as-of one day past price coverage (no clamp — assert the response detail names the
  coverage bound); 401 wrong-secret; 504 path exercised with a tiny `SOLVER_SOLVE_TIMEOUT_S`
  override.
- **Aggregate checks:** fixture-suite pass rate 100% (parity admits no partial credit); measured
  warm-solve p50/p95 and peak RSS reported with the instance sizing; D3 gate output attached for
  the preview deploy.
- **No-leakage / privacy check:** grep the service logs from the fixture run for any fixture
  ticker — zero hits (body-free logging).
- **Statistical-coherence concern:** none new — the service adds no computation; the risk surface
  is packaging (AC2) and labeling (AC5), which is where the gates sit.

## Sequencing (beta-critical — owner 2026-08-06 full-experience scope decision)
1. D1 snapshot builder + D2 service + Dockerfile; local `docker build`; in-container parity + anti-
   fail-soft fixtures green (no push yet).
2. **STOP — D6 licensing hard gate** + D5 priced hosting report to the owner in one briefing.
3. On owner confirmation: push/deploy; D3 gate green against the target serving DB.
4. **Explicit external dependency for AC3:** the preview Supabase (`fundscore-preview` /
   `yqyyvhcrmcwarxweusbw`) currently has NO serving tables — populating it via the existing
   TRUNCATE+COPY load, **from a branch carrying ALL current emitters** (serving-DB-ahead-of-
   branches lesson), plus a gate-passing test user (`early_access` on preview or `LAUNCHED=true`
   in the preview env), is a prerequisite this spec flags but does not own. Coordinate with the
   owner's beta-launch serving-load plan; AC3 and the D3 solve-basis check both block on it.
5. D4 web swap on a branch → preview E2E (AC3) → D7 docs → done.

## Out of scope
- Job queue / async solve architecture; autoscaling; multi-region; CDN.
- Any change to solver logic, contract shapes, or the X-Ray UI (incl. the `SPY`-unsupported input
  problem — separate backlog item).
- The pricing-store compaction chore (owner answer Q3: NOT a dependency; warm solves are ~1–4 s
  post-d92213c).
- `portfolio-exposure-parity` (queued separately; contract-compatible).
- Loading the preview/prod serving tables (flagged above as an external prerequisite, owned by the
  beta-launch plan).

## Risks
- **Packaging is the real failure mode** — four of the ten inputs fail soft, one of them missed by
  the PRD's own red-teamed inventory. Mitigated structurally (boot-time sha256 manifest check) and
  behaviorally (AC2 probes both fail-soft classes).
- **Two-cadence confusion**: a fresher panel silently relabeling the solve basis. Mitigated by
  construction (`solve_as_of` derives only from the L2 refit partitions at build time) + D3's
  side-by-side print + AC5's invariant demo.
- **Thread-safety of the shared solver instance**: serialized solves make it moot at beta scale;
  revisit only if measured queue waits exceed the stated target.
- **Determinism across rebuilds**: `solver_run_id` parity holds only same-image/same-snapshot;
  never gate across snapshots (input dates legitimately move). Era-stamp any fixture output
  committed to the repo.
- **License refusal** (D6): plan B (volume-mounted snapshot) exists but is unbuilt; the briefing
  must present it as an option, not a fait accompli.
- **Cost drift**: the hosting pick is priced at implementation time and reported — no number in
  this spec is binding.
