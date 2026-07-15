# Deployment — architecture decision + go-live runbook

**Status:** adopted 2026-07-14. Supersedes nothing (first deployment decision).
**Stack:** Vercel (app) · Supabase (Postgres + Auth) · Cloudflare R2 (parquet) · Fly.io (solver)

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
