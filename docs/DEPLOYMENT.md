# Deployment — architecture decision + go-live runbook

**Status:** adopted 2026-07-14. Supersedes nothing (first deployment decision).
**Stack:** Vercel (app) · Supabase (Postgres + Auth) · **Fly.io (solver — priced against Railway
2026-08-07, see §4.3)**. Cloudflare R2 is no longer in the picture: the query surface serves from
Postgres (screener-beta-port, 2026-08-07) and the solver carries a baked data snapshot.

---

## 0. LIVE STATE (2026-07-14) — Phase 1 is deployed

| | |
|---|---|
| **Live domain** | **https://fundscore.ai** (and `www.fundscore.ai`) — live + TLS valid since 2026-07-14. **Gated**: landing page + waitlist only. |
| **Vercel URL** | https://fundscore-web.vercel.app (same deployment) |
| **DNS** | Namecheap BasicDNS. Apex `A @ → 76.76.21.21`; `A www → 76.76.21.21`. Zoho MX/SPF/DKIM intact. Do NOT switch nameservers to Vercel (would drop Zoho mail). |
| **TLS** | One SAN cert covers apex + www (`vercel certs issue fundscore.ai www.fundscore.ai`). `www` HTTP 308-redirects to HTTPS; apex is the canonical host. |
| **Vercel project** | `alexs-projects-5b2fcda5/fundscore-web` (`prj_F6wRhbt64pYwcPYtl1Gzd1ZTrrKA`) |
| **Supabase project** | `fundscore-web` / ref `henxcsknsjfadetomjeu`, `us-east-1` |
| **Postgres** | `aws-0-us-east-1.pooler.supabase.com` — **6543 (transaction) for the app**, 5432 (session) for DDL scripts |
| **Tables in prod** | `waitlist_signups`, `early_access`. **Nothing else.** No serving data. |
| **Gate** | `LAUNCHED` unset ⇒ gated. Allowlist is **empty** — deliberately (see below). |
| **Credentials** | `.env.production.local` (gitignored, mode 600). **The DB password exists nowhere else** — Supabase cannot re-show it, only reset it. Put it in a password manager. |

Verified live: `/` 200 · `/methodology` 200 · `/signin` 200 · `/xray`, `/screener`, `/funds/*`, `/lens`
all **307 → /** · `POST /api/portfolio/solve` **401** · waitlist signup writes to the production
database.

### Environments (Production vs Preview are DATA-ISOLATED)

| | Production | Preview |
|---|---|---|
| **Serves** | `fundscore.ai` (the launch site) | per-deploy `*.vercel.app` URLs (private — Vercel deployment protection) |
| **Supabase** | `fundscore-web` / `henxcsknsjfadetomjeu` | `fundscore-preview` / `yqyyvhcrmcwarxweusbw` |
| **Updated by** | `vercel deploy --prod` (or a merge to `main`, once Git is connected) | `vercel deploy` (or any non-`main` branch/PR, once Git is connected) |
| **Creds** | `.env.production.local` | `.env.preview.local` |

Isolation is **proven**, not assumed: a row written to the preview DB is invisible to production
(write-to-preview / read-both probe, 2026-07-15). Iterate on branches → preview; the domain only
moves when you deploy `--prod`. Preview signups/experiments never touch real data.

**Mental model:** the site you *invite people to* is **production** — grant them `early_access` and
they sign in at `fundscore.ai` while the public still sees the landing page. The *preview* env is for
**iterating on the app**, not for beta users. (See the "keeping preview separate" discussion —
inviting testers ≠ a separate deployment.)

### ⚠️ Do NOT grant early access yet
The production database holds only the two pre-launch tables. A granted user would pass the gate and
immediately hit errors, because `/screener`, `/funds/*` and `/xray` have no serving data (and the
solver isn't deployed at all — §1). **The gate is currently the only thing keeping those pages from
500-ing.** Keep `early_access` empty until §4 is done.

### Phase 1 — DONE
- **GitHub auto-deploy: CONNECTED + verified** (2026-07-15). Repo `alexhfrey/fundscore-web` is linked
  to the Vercel project (it had been wrongly linked to `alexhfrey/fund_score`, the Python backend —
  fixed). Push to `main` → production (`fundscore.ai`); push any other branch / open a PR → automatic
  private preview URL on the isolated preview DB. Proven by a git-triggered deploy landing 2s after a
  push. Manual `vercel deploy --prod` / `vercel deploy` still work if needed.
- **Domain.** `fundscore.ai` + `www` are LIVE with valid TLS (done 2026-07-14, see §8).

### Day-to-day workflow (post-setup)

**Local is where the full product actually works.** Local Supabase has the real serving data (5,706
profiles, 1.38M holdings); production and preview hold ONLY the waitlist + allowlist. The X-Ray solver
also spawns local Python against the local parquet lakehouse, so it can't run anywhere but local until
§4. So the loop splits by what you touch:

- **Product features** (X-Ray, fund pages, screener, anything reading serving data or the solver):
  **local only** — `npm run dev` + local Supabase + the fund_score checkout. There is nothing to
  preview on Vercel because the data and solver aren't there yet.
- **Marketing / gated-surface changes** (hero, landing copy, waitlist, the gate): behave identically
  everywhere, so the preview pipeline earns its keep here — it catches Vercel-specific rendering
  (fonts, image optimisation, edge redirects) that local can't show.

**Git rhythm (now that `main` auto-deploys to the LIVE site):** treat `main` as production. The
branch-guard enforces this (no commits on `main`).
```
git checkout -b feat/x        # iterate locally
git push -u origin feat/x     # → automatic private preview URL
git checkout main && git merge feat/x && git push   # → production
```

**Inviting people:** to the real product = `early_access` on PRODUCTION (they sign in at fundscore.ai,
public still sees the landing page) — NOT a separate site. To a work-in-progress = share a preview
URL (Vercel deployment protection makes previews private by default).

**Known weak spot:** preview is isolated but EMPTY of serving data, so a preview link can't show the
actual product (only the landing page). If you need to demo the real X-Ray to someone, that requires
loading a serving snapshot into the preview Supabase + a deployed solver — do it when you actually
need it, not speculatively.

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
| ~~Pricing parquet (solver inputs)~~ | ~~Cloudflare R2~~ | **Retired 2026-08-07.** The solver ships a versioned snapshot baked into its own image (see §4.3), so nothing pulls parquet at boot. The query parquets went the same way — the canonical query surface serves from Postgres (screener-beta-port). |
| Passive-blend solver (Python/CVXPY) | **Fly.io** | A small always-on machine holding the price panel warm in memory, answering `POST /solve` over HTTP. Vendor chosen 2026-08-07 by pricing it against Railway — §4.3 has the actual numbers. |

### What we deliberately did NOT do

- **Bundle parquet into the app.** The query parquets are only 1.1 MB and it would have been easy —
  but it's the wrong boundary, and it rots the moment the lake rebuilds. (Superseded 2026-08-07: the
  query surface is 155 rows, so it just serves from Postgres like every other panel — no parquet on
  the app host, no object store, no query engine in the request path.)
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

### 4.1 ~~Compact the pricing panel~~ — RETIRED (superseded 2026-07-16, confirmed by the owner 2026-08-06)

This section described the solver re-globbing 3,994 tiingo files per request, and made compaction a
prerequisite for a synchronous HTTP solve. Both facts are stale. The solver reads the canonical
single-vintage `data/gold/fund_daily_adj_close.parquet` with predicate pushdown, and **warm solves
are ~1–4 s** (measured again 2026-08-07 across the parity fixture suite). No job queue is needed and
compaction is not a dependency.

One residual, and it is a real one: a book whose rows fall back to the ETF universe (no taxonomy)
draws on the whole 180-ETF mimicking pool, and that solve measured **~278 s** — beyond both the
service's 210 s budget and the web's 240 s fetch budget, on either transport. That belongs to the
`SPY`-as-input backlog item in §6, not to the service.

### 4.2 ~~Cloudflare R2~~ — RETIRED 2026-08-07, provision nothing

**There is no R2 step. Do not create a bucket or an API token.** Both things this section used to
upload have gone elsewhere, and neither pulls an object at runtime:

- **Solver inputs** → the service carries a versioned snapshot baked into its image, sha256-verified
  at boot (§4.3). Nothing is fetched at startup.
- **Query parquets** → `/q/[slug]`, `/search` and `/lens/[lens_slug]` read the
  `query_canonical_catalog` / `query_canonical_results` serving tables in Postgres
  (screener-beta-port, 2026-08-07). DuckDB, `QUERY_PARQUET_DIR` and the MotherDuck plan are all
  retired. Build-time prerendering of `/q/[slug]` comes for free on any host whose `DATABASE_URL`
  reaches a loaded serving database — see `docs/RUNBOOK-serving-load.md`.

Kept as a heading rather than deleted so the §4.x numbering in older notes still resolves, and so the
"why not object storage" question does not get re-litigated: the original argument for R2 over S3 was
free egress, which stopped mattering once nothing egresses.

### 4.3 The solver service — BUILT 2026-08-07 (`solver-http-service`)

**The "pull the panel from R2 on boot" sketch that used to live here is superseded.** The service
carries a **versioned data snapshot baked into its image**, verified by sha256 at boot. Nothing is
fetched at startup, so there is no boot-time network dependency and no way to come up healthy on the
wrong data. Full documentation lives with the code:
**`fund_score/deploy/solver/README.md`**.

The web side of the swap is done: `src/lib/serving/portfolio-solver.ts` now dispatches on
`SOLVER_URL` — set ⇒ `fetch()` to the service; unset ⇒ the original `spawn()` path, kept for local
dev only. **On Vercel with `SOLVER_URL` unset it fails closed** with an honest error instead of
attempting a `spawn()` that cannot work. `route.ts`, `XrayResult.tsx` and the look-through are
untouched: the `SolveResponse` contract is unchanged.

#### What runs there

| | |
|---|---|
| Endpoints | `POST /solve` (bearer), `GET /healthz` (public), `GET /manifest` (bearer) |
| Image | `fund_score/deploy/solver/Dockerfile`. Deps+code layers measured **920 MB**; the snapshot adds **~712 MB** ⇒ **~1.6 GB** total |
| Memory | peak RSS measured over the fixture suite incl. a 50-holding book — see the parity report; instance sized ≥ 1.5× that |
| Concurrency | solves are **serialized** (one in flight). Warm solves ~1–4 s; five concurrent users ⇒ ~20 s worst case |
| Timeouts | service budget `SOLVER_SOLVE_TIMEOUT_S=210` sits inside the web's `PORTFOLIO_SOLVER_TIMEOUT_MS=240000`. Over budget ⇒ 504, then the process exits for a supervisor restart |

#### Vendor: priced 2026-08-07, Fly.io picked

Owner decision was "price both, pick the cheaper, report the actual numbers". Both from public
pricing pages on 2026-08-07, us-east, one always-on instance, no volume (the snapshot is in the
image), egress negligible at beta scale:

| | Fly.io | Railway |
|---|---|---|
| Pricing model | fixed per always-on machine | $5/mo Hobby plan (incl. $5 credit) + **metered actual usage** |
| 1 GB resident | **$5.92/mo** (`shared-cpu-1x`) | $10.00/mo ($0.00000386/GB/s × 2.592 M s = $10.005, less the $5 credit, plus the $5 plan) |
| 2 GB resident | **$11.83/mo** (`shared-cpu-2x`) | $20.01/mo (same arithmetic at 2 GB) |
| 4 GB resident | $23.66/mo (`shared-cpu-4x`) | $40.02/mo |
| CPU | included in the machine price | $0.00000772/vCPU/s — metered; negligible for a mostly-idle solver |
| Volume (not needed) | $0.15/GB/mo | $0.156/GB/mo |
| Egress | $0.02/GB | $0.05/GB |

**Fly.io is cheaper at every size we would plausibly pick** — roughly half, because Railway meters
resident memory continuously and a warm solver is resident by design. One open item to verify before
provisioning: Fly's docs do not state a default rootfs size or a maximum image size, and this image
is ~1.6 GB. Confirm the machine's rootfs accommodates it (or provision a larger one) as part of D2.

*No account was created and no infrastructure was provisioned — these are quoted prices only.*

#### Licensing gate (owner stop S4)

The image bakes licensed vendor data (Sharadar SFP prices, the Tiingo-derived canonical panel) into
a layer. Local build and local run are fine. **No push to ANY registry — including a platform's own,
which both `fly deploy` and a Railway build perform — until the owner confirms the Sharadar/Tiingo
terms permit it.** Plan B if they don't: code-only images plus a platform volume populated out of
band. Not built.

#### After every deploy

Run the coherence gate. Non-zero exit ⇒ roll back to the previous image:

```sh
SOLVER_SHARED_SECRET=… uv run python scripts/checks/check_solver_service_coherence.py \
    --solver-url https://<service> --database-url "$DATABASE_URL" --lake-root "$(pwd)"
```

It proves the service's `solve_as_of` equals the L2 refit the serving DB actually serves; that **no
fit-sample regression** is baked into the deployed snapshot (the refit's own weekly sample is
re-derived from the live lakehouse, because the container's boot-time sha check is self-referential
and cannot vouch for itself); that the served refit stamp has not been quietly nulled by a load; and
that the snapshot's fee/holdings panels match the lakehouse state behind the serving load. Set
`SOLVER_URL` and `SOLVER_SHARED_SECRET` in Vercel's **preview and production** envs.

**On price-panel staleness:** the snapshot builder refuses to bake a snapshot whose price panels
supply fewer weekly observations, *per series*, than the served refit itself achieved. Lag in days
is recorded and displayed (`/healthz`, build logs, deploy logs) but is never the bound — see
`fund_score/deploy/solver/README.md` for why lag-in-days and any aggregate date-grid count are both
the wrong test.

### 4.4 Load the serving tables

**→ Full procedure: [`RUNBOOK-serving-load.md`](./RUNBOOK-serving-load.md)** (written 2026-08-07).
It covers both environments end to end — the provenance gate, the DDL order, the load, verification,
rollback, secrets, and an explicit list of the steps that have no script behind them yet. Read it
rather than improvising from this section.

The app's pages read Postgres, not parquet. Load `fund_profile_facts`, `fund_holdings_full`,
`fund_attribution_blocks` and `serving_manifest` into the hosted Supabase using the existing
TRUNCATE+COPY-in-one-transaction path (fund_score's `scripts/pipeline/build_serving_facts.py`).
Watch the free-tier size limit — 1.4M holdings rows will push you to Supabase Pro ($25/mo).

**Never load from a branch missing another feature's emitters** — that NULLs newer sections. This has
bitten before, and it fails *silently*: the loader COPYs the contract∩table intersection and only
errors on five required columns, so a missing column is a blank section, not a crash. The runbook's
pre-flight column diff is the check that catches it.

Two things the schema step needs to get right, both detailed in the runbook: the serving DDL comes
from fund_score's `apply_serving_schema.py` (**not** `npm run db:push` — `drizzle.config.ts`
hardcodes `.env.local`, and the TS schema is missing `fund_holdings_full.position_direction`), and
`apply_auth_schema.py` must run too, because `resolveSession()` reads `entitlements` on every
signed-in page render.

### 4.5 Flip the switch

Set `LAUNCHED=true` on Vercel. The gate disappears; the middleware short-circuits.

Then put the product CTAs back on the landing page. `src/app/page.tsx` has an `EarlyAccess`
component with a comment marking exactly where "X-ray my portfolio" / "Explore funds" belong — they
were removed because a button that bounces you back to the page you're on is worse than no button.

---

## 5. What the solver actually needs

**Re-measured 2026-08-07** (the 2026-07-14 sizing below it was wrong in both directions — it named
the retired raw tiingo glob and missed six files). The lakehouse is **not** the deployment unit; the
live-read closure is **ten files, ~712 MB**, and `scripts/service/build_solver_snapshot.py` is the
single source of truth for the list.

| Input | Size | If it is missing |
|---|---|---|
| `data/gold/fund_daily_adj_close.parquet` | 609 MB | crash |
| `data/gold/fund_metadata.parquet` | 20 MB | crash |
| `data/vendors/sharadar/sfp/daily/adj_close_all.parquet` | 10 MB | crash |
| `data/gold/expense_ratio_history.parquet` | 0.9 MB | crash |
| `data/gold/fund_taxonomy.parquet` | 0.4 MB | crash |
| `data/gold/holdings_complete.parquet` | 57 MB | **fail-soft** → exposure goes `missing` |
| `data/gold/cusip_reference.parquet` | 4 MB | **fail-soft** (same) |
| `data/gold/etf_holdings_snapshots.parquet` | 2.1 MB | **fail-soft** (same) |
| `data/nport/class_ticker_mappings.parquet` | 8 MB | **fail-soft** → non-primary share classes stop resolving |
| `data/reference/etf_expense_ratios.parquet` | 5 KB | **fail-soft** → UIT ETFs (SPY/QQQ/DIA) silently lose their expense ratio |

**Five of the ten fail SOFT.** A container packaged without them boots healthy and quietly serves
degraded answers — which is why the service verifies presence *and* sha256 of all ten against the
snapshot manifest before it binds a port, and refuses to start on any mismatch.

The raw `data/vendors/tiingo/daily_pricing/*.parquet` glob (2.2 GB, 3,994 files) is **no longer
read** — the solver moved to the canonical single-vintage panel, which is also why the "compact the
pricing panel" prerequisite in §4.1 is retired. The query/screener parquets are gone entirely
(Postgres).

---

## 6. Known blockers before a real user touches the X-Ray

Filed in `feature-pipeline/backlog.md` (deploy group):

- **`SPY` as an input is still the first thing a real user will hit.** It no longer comes back
  `unsupported` — it resolves through the ETF-universe fallback — but *because* that fallback has no
  taxonomy, the blend search runs over the full 180-ETF mimicking pool and the solve measured
  **~278 s** on 2026-08-07 (identical on both transports; it is a solver property, not a service
  one). That is past the service's 210 s budget and the web's 240 s fetch budget, so the user gets a
  timeout. Still the top X-Ray blocker.
- ~~**170–220 s solve**~~ — retired; warm solves are ~1–4 s (§4.1).
- ~~**Solver can't deploy**~~ — **BUILT 2026-08-07** (§4.3). Remaining: the owner's licensing
  confirmation before any image push, then the snapshot bake, deploy and end-to-end acceptance
  against a populated preview DB.

---

## 7. Env var reference

| Var | Phase | Used by |
|---|---|---|
| `DATABASE_URL` | 1 | Drizzle / postgres.js — waitlist, allowlist, serving reads |
| `NEXT_PUBLIC_SUPABASE_URL` | 1 | Supabase auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1 | Supabase auth client |
| `LAUNCHED` | 1 | The gate. Unset/`false` = gated. `true` = public. |
| ~~`QUERY_PARQUET_DIR`~~ | — | **Retired 2026-08-07 (screener-beta-port).** The query surface serves from Postgres via `DATABASE_URL`; delete this var wherever it is set. |
| `SOLVER_URL` | 2 | Base URL of the solver service. **Set ⇒ HTTP transport; unset ⇒ local `spawn()`.** On Vercel, unset means the X-Ray returns an honest "could not reach the solver" error — it never attempts `spawn()`. |
| `SOLVER_SHARED_SECRET` | 2 | Bearer secret for `POST /solve`. Must match the service's env exactly. Never `NEXT_PUBLIC_`. |
| `FUND_SCORE_REPO`, `UV_BIN` | local | Only for the `spawn()` path in local dev |
| `PORTFOLIO_SOLVER_AS_OF` | **local only** | The spawn path's CLI as-of pin (code default `2026-06-30`; this table said `2026-02-28`, which was never the code's value). **Retired from every deployed environment 2026-08-07** — the HTTP path sends no as-of, because the service's snapshot manifest owns the solve basis and returns it in `SolveResult.as_of_date`. Two independent pins is exactly how the X-Ray and the fund pages drift apart. |
| `OPS_ALERT_WEBHOOK_URL` | beta, **optional** | Slack/Discord incoming webhook. Set = server errors also POST a one-line summary. Unset = silent (§9). |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | beta, **optional** | Renders the `mailto:` fallback in the feedback widget. Unset = the line is not rendered (no address is hardcoded). |

---

## 8. Pointing fundscore.ai (Namecheap) at Vercel — DONE 2026-07-14

**Completed.** Both `fundscore.ai` and `www.fundscore.ai` serve the gated site over valid TLS. This
section is kept as the record of what was done + the gotchas hit, in case the domain is ever re-pointed.

### What actually worked (the short version)
- Namecheap → Advanced DNS: `A @ → 76.76.21.21` and `A www → 76.76.21.21` (the `www` CNAME to
  `cname.vercel-dns.com.` also works, but the A record was more reliable in Namecheap's UI here).
- **Nameservers stayed on Namecheap BasicDNS** — the domain runs Zoho mail, so switching NS to Vercel
  would have dropped MX/SPF/DKIM. Web (A/CNAME) and mail (MX/TXT) coexist fine on one zone.
- After DNS went clean, Vercel auto-issued the apex cert. `www` needed a nudge because the first cert
  covered only the apex: `vercel certs issue fundscore.ai www.fundscore.ai` issued one SAN cert for
  both, live on the edge ~15s later.

### Gotchas that cost time (watch for these on any re-point)
1. **Namecheap "Parking" injects a phantom apex A record** (`192.64.119.204`) that does NOT show up
   in the A-record list — it's the domain-level Parking/URL-Redirect feature. Symptom: the apex
   round-robins between Vercel and a parking IP, so the browser shows "not secure" ~half the time.
   Fix: turn Parking OFF at the domain level (not in the record list).
2. **Turning Parking off deleted the `www` record too** — had to re-add it.
3. **Trust `dig`, not the browser.** Query the authoritative NS directly to see the real zone, past
   all caching: `dig +short A www.fundscore.ai @dns1.registrar-servers.com`. The Namecheap UI showed
   a record that wasn't in the served zone more than once.
4. **"not secure" after DNS is clean = cert not issued yet**, not a DNS problem. Check
   `vercel certs ls`; the apex/www certs issue within minutes of DNS going clean.

### Original instructions (for a future re-point)

Do this when you're happy with the site on `fundscore-web.vercel.app`.

1. **Vercel:** Project → Settings → Domains → add `fundscore.ai` **and** `www.fundscore.ai`.
   Vercel will show the exact records; they should match the below.

2. **Namecheap:** Domain List → Manage → **Advanced DNS**. Set *Nameservers* to "Namecheap
   BasicDNS" (not Custom DNS), then replace the default parking records:

   | Type | Host | Value | TTL |
   |---|---|---|---|
   | `A` | `@` | `76.76.21.21` | Automatic |
   | `CNAME` | `www` | `cname.vercel-dns.com.` | Automatic |

   Delete Namecheap's default `CNAME @ → parkingpage.namecheap.com` and any `URL Redirect` record —
   they will silently shadow the records above.

   **Confirm the A-record IP against what Vercel's dashboard shows for your project.** Vercel has
   changed it before; the dashboard is the source of truth, not this doc.

3. Wait for propagation (usually minutes on Namecheap), then verify:

   ```bash
   dig +short fundscore.ai
   curl -sI https://fundscore.ai | head -1
   ```

   Vercel provisions the TLS certificate automatically once DNS resolves.

4. Decide the canonical host in Vercel (apex vs `www`) so one 308-redirects to the other. Apex is
   the better choice here — the brand is `fundscore.ai`.

**Note:** the site is gated, so the moment DNS resolves, the public sees the landing page and the
waitlist form. That is the intended launch state.

---

## 9. Beta ops — errors, feedback, pageviews

Wired 2026-08-06 (`feature-pipeline/specs/done/beta-ops-minimum.md`). Before invites go out we
need to see what beta users see. All three pieces are **first-party** — no Sentry, no PostHog,
no analytics vendor, no new npm dependency, **and no secret to provision**. The reason is the
constraint, not purity: the beta had to become observable without the owner creating an account
or pasting a DSN, and Vercel Hobby log retention is too short to be the only record of a beta
user's crash.

| Piece | How | Where it lands |
|---|---|---|
| **Error tracker** | `src/instrumentation.ts` (`onRequestError`, all server errors) + `src/app/global-error.tsx` and `src/app/(site)/error.tsx` (client boundaries) | `ops_error_events` **and** a structured `[ops:error]` stderr line (Vercel-log backstop) |
| **Feedback** | `FeedbackWidget` in the `(site)` chrome — a corner button that captures the current path automatically | `ops_feedback` |
| **Pageviews** | `OpsBeacon` in the ROOT layout (so it covers the landing page too) → `POST /api/ops` | `ops_pageviews` |

### Required step per environment

The tables are **not** created by a deploy. Run once against each database:

```bash
DATABASE_URL='<prod pooled URI>'    node scripts/apply-ops-schema.mjs   # henxcsknsjfadetomjeu
DATABASE_URL='<preview pooled URI>' node scripts/apply-ops-schema.mjs   # yqyyvhcrmcwarxweusbw
```

Idempotent and non-interactive, like the waitlist/allowlist scripts. **Until it is run, ops writes
fail soft** — the app does not crash and users see nothing wrong, but nothing is recorded either.
RLS is on with no policies and no grants: only the app's direct connection can read or write, so a
beta user can never read another's feedback, errors or browsing history.

### Reading the data

```bash
node scripts/ops-report.mjs --days 7     # pageviews by day + top paths, recent errors, recent feedback
```

Deliberately a CLI, not an admin page — at beta scale the owner needs the numbers, not a dashboard
to maintain.

### The one gate exception

`/api/ops` is the **only** `/api/` path added to the pre-launch gate's public list
(`src/lib/supabase/middleware.ts`). An error tracker that cannot see the landing page is blind to
exactly where a first-time invitee arrives. It is safe in the way `/api/portfolio/solve` is not:
no expensive compute, one small capped row, same-origin only, and it reflects nothing back to the
caller. Verified while gated (`LAUNCHED=false`): `/funds/*` 307, `/api/portfolio/solve` 401,
`/api/lens/quota` 401, `/api/ops` 204, cross-origin `/api/ops` 403.

**No IP addresses are stored.** The only identity recorded is the signed-in email when a session
exists — never inferred, never fabricated.
