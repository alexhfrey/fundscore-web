# Deployment — architecture decision + go-live runbook

**Status:** adopted 2026-07-14. Supersedes nothing (first deployment decision).
**Stack:** Vercel (app) · Supabase (Postgres + Auth) · Cloudflare R2 (parquet) · Fly.io (solver)

---

## 1. The decision

**Vercel hosts the entire Next.js app, permanently.** It is not a launch-stage stopgap. Almost
everything in this product is RSC pages reading Postgres, which is exactly what Vercel is for.

**One thing cannot live there: the passive-blend solver.** `runSolver()`
(`src/lib/serving/portfolio-solver.ts`) does this:

```ts
spawn(UV_BIN, ["run", "python", SOLVER_CLI, ...], { cwd: FUND_SCORE_REPO })
```

It needs the `fund_score` checkout, `uv`, Python, CVXPY and a pricing panel on local disk, and it
currently runs for **170–220 seconds**. Vercel functions have no Python runtime, no persistent
filesystem, and execution caps well below that. This is not a Vercel limitation to work around — a
long-running, stateful, warm-memory compute job is simply not a serverless workload.

So the split is:

| Concern | Where | Why |
|---|---|---|
| Next.js app — all pages, RSC, server actions, route handlers | **Vercel** | CDN, preview deploys, image optimisation, zero ops. The landing page is `force-static` and served from the edge. |
| Postgres + Auth | **Supabase** | Already the app's DB and auth provider. Free tier covers the gated phase outright. |
| Pricing parquet + query parquet | **Cloudflare R2** | DuckDB reads it over `httpfs`. R2 has **zero egress fees**, which matters a lot when a query scans remote parquet. |
| Passive-blend solver (Python/CVXPY) | **Fly.io** | A small always-on machine that holds the pricing panel warm in memory and answers `POST /solve` over HTTP. |

### What we deliberately did NOT do

- **Bundle parquet into the app.** `src/lib/serving/screener.ts` states the rule: *"parquets stay in
  object storage / the lake, never bundled with the app."* The query parquets are only 1.1 MB and it
  would have been easy — but it's the wrong boundary, and it rots the moment the lake rebuilds.
- **Run Next.js in a container next to the solver.** One deploy, simpler ops — but it gives up the
  CDN, preview deploys and image optimisation on a page whose entire job is marketing. Wrong trade.
- **Ship the whole 51 GB lakehouse to the solver host.** The solver reads **four inputs, ~2.2 GB
  total** (see §5). The lakehouse size is a red herring.

---

## 2. The gate

The product is not public. `src/lib/supabase/middleware.ts` enforces:

- **Anonymous** → `/`, `/methodology`, `/signin`. Everything else 307s to `/`. API routes return 401.
- **Signed in is NOT enough.** Supabase signup is self-serve, so "gated to logged-in users" would
  mean "gated to anyone willing to spend ten seconds making an account". A user reaches the product
  only if their email is on the **`early_access` allowlist**.
- **`LAUNCHED=true`** disables the gate entirely. That is the single switch for going public.

Gating is by **path, never by method** — otherwise an anonymous `POST` to `/api/portfolio/solve`
would sail past the redirect and trigger a ~170s solve. That endpoint is an open door to expensive
compute; it must 401.

Grant access:

```bash
node scripts/grant-early-access.mjs someone@example.com --note "beta"
node scripts/grant-early-access.mjs --from-waitlist 25   # oldest signups first
node scripts/grant-early-access.mjs --list
```

RLS lets a signed-in user read **only their own row**, so the allowlist can never be enumerated
through the anon key. Writes are service-role / direct-connection only.

---

## 3. Phase 1 — put the landing page live (today, $0)

The only thing the public can reach is a static page and a form that writes one row. That is the
cheapest possible deploy.

### 3.1 Supabase

1. Create a project (free tier). Note the **project URL**, **anon key**, and the **connection string**
   (Settings → Database → Connection string → URI; use the **pooled** port 6543 for serverless).
2. Apply the two pre-launch tables:

```bash
export DATABASE_URL='postgresql://postgres.<ref>:<pw>@<host>:6543/postgres'
node scripts/apply-waitlist-schema.mjs
node scripts/apply-early-access-schema.mjs
```

Both are idempotent and non-interactive. **Do not use `drizzle-kit push`** — it hangs against
Supabase's pooler (see the comment in `apply-lens-schema.mjs`), and it would try to reconcile every
serving table.

3. **Turn off public signups** (Authentication → Providers → Email → disable "Allow new users to sign
   up"), or leave them on and rely on the allowlist. The allowlist is the real lock either way; this
   is defence in depth.

Nothing else needs to be in this database. **None of the 5,706 fund profiles or 1.4M holdings rows
are required to serve the landing page.**

### 3.2 Vercel

1. Import the repo. Framework preset: Next.js. No build-command override.
2. Environment variables:

| Var | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase pooled URI | Used by the waitlist server action |
| `NEXT_PUBLIC_SUPABASE_URL` | project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | |
| `LAUNCHED` | *(unset)* | Absent = gated. Set to `true` to open the site. |

3. Deploy. Point the domain at it.

The build is already safe for a host with no data lake: `/q/[slug]`'s `generateStaticParams` fails
soft to `[]`, and `/screener` is `force-dynamic`. Neither reaches for parquet or serving data at
build time.

**Cost: $0** (Vercel Hobby + Supabase free). Domain ~$12/yr.

---

## 4. Phase 2 — open the app (~$25/mo)

Do these in order. **The compaction comes first** — it is what makes everything after it simple.

### 4.1 Compact the pricing panel (blocking, and the highest-leverage fix)

The solver defaults to the glob `data/vendors/tiingo/daily_pricing/*.parquet` — **3,994 separate
files, re-globbed and re-read on every single request.** That, not CVXPY, is the 170–220s.

Materialise one compacted panel and repoint the default. See the backlog item
*"Compact the Tiingo daily-pricing panel"*. Expected: minutes → seconds. Verify the blend and fee gap
come back **bit-identical** — this is a pure I/O change, so any numeric drift is a defect.

Until this lands, a synchronous HTTP solve is not viable and you would need a job queue instead.

### 4.2 Cloudflare R2

Upload the solver's inputs and the query parquets. Create an R2 bucket + an S3-compatible API token.

DuckDB reads R2 over `httpfs` with no query rewrite (`screener.ts` already anticipates this:
*"v1 swaps the source path for a MotherDuck connection string"*). Point `QUERY_PARQUET_DIR` at the
bucket to restore build-time prerendering of `/q/[slug]` and its SEO value.

R2 over S3 specifically because **egress is free** — DuckDB scanning remote parquet is exactly the
access pattern that makes S3 egress bills unpleasant.

### 4.3 Fly.io — the solver service

A small always-on machine (`shared-cpu-1x`, 2 GB RAM is enough for a ~2.2 GB panel read lazily; size
up if you hold it fully in memory). It should:

1. Pull the compacted pricing panel from R2 on boot (or mount a Fly volume).
2. Hold it **warm in memory** — this is the entire point of a persistent service.
3. Expose `POST /solve` returning the solver's existing `to_dict()` payload unchanged.

Then in `src/lib/serving/portfolio-solver.ts`, replace `spawn()` with `fetch()` behind the **same
`SolveResponse` contract**. Nothing downstream changes — `route.ts`, `XrayResult.tsx` and the
look-through all keep working, because they only ever see `SolveResult`.

Add `SOLVER_URL` to Vercel's env.

### 4.4 Load the serving tables

The app's pages read Postgres, not parquet. Load `fund_profile_facts`, `fund_holdings_full` etc. into
the hosted Supabase using the existing TRUNCATE+COPY-in-one-transaction path. Watch the free-tier
size limit — 1.4M holdings rows will push you to Supabase Pro ($25/mo).

**Never load from a branch missing another feature's emitters** — that NULLs newer sections. This has
bitten before.

### 4.5 Flip the switch

Set `LAUNCHED=true` on Vercel. The gate disappears; the middleware short-circuits.

Then put the product CTAs back on the landing page. `src/app/page.tsx` has an `EarlyAccess`
component with a comment marking exactly where "X-ray my portfolio" / "Explore funds" belong — they
were removed because a button that bounces you back to the page you're on is worse than no button.

---

## 5. What the solver actually needs

Sized 2026-07-14. The 51 GB lakehouse is **not** the deployment unit.

| Input | Size |
|---|---|
| `data/vendors/tiingo/daily_pricing/*.parquet` | **2.2 GB** across **3,994 files** ← compact this |
| `data/vendors/sharadar/sfp/daily/adj_close_all.parquet` | 10 MB |
| `data/nport/class_ticker_mappings.parquet` | 7.6 MB |
| `data/gold/expense_ratio_history.parquet` | 840 KB |

The query/screener parquets are a separate, tiny set (1.1 MB total).

---

## 6. Known blockers before a real user touches the X-Ray

Filed in `feature-pipeline/backlog.md` (deploy group):

- **`SPY` is `unsupported` as an input**, and 30% of it suppresses the *entire* solve. The landing
  page tells people to paste in what they hold; SPY is the most widely held ETF in existence. This is
  the first thing a real user will hit.
- **170–220s solve** (§4.1).
- **Solver can't deploy** until it becomes an HTTP service (§4.3).

---

## 7. Env var reference

| Var | Phase | Used by |
|---|---|---|
| `DATABASE_URL` | 1 | Drizzle / postgres.js — waitlist, allowlist, serving reads |
| `NEXT_PUBLIC_SUPABASE_URL` | 1 | Supabase auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1 | Supabase auth client |
| `LAUNCHED` | 1 | The gate. Unset/`false` = gated. `true` = public. |
| `QUERY_PARQUET_DIR` | 2 | DuckDB screener source (local dir, or R2 via httpfs) |
| `SOLVER_URL` | 2 | The Fly.io solver service (replaces `FUND_SCORE_REPO` + `UV_BIN`) |
| `FUND_SCORE_REPO`, `UV_BIN` | local | Only for the `spawn()` path in local dev |
| `PORTFOLIO_SOLVER_AS_OF` | 2 | Pinned solver as-of. Currently `2026-02-28` — **stale**, revisit. |
