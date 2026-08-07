---
id: beta-ops-minimum
title: Beta ops minimum — error tracking, feedback channel, pageview counter
status: queued
track: frontend
repo: fundscore-web
lane: standard
depends_on: []
created: 2026-08-06
scope: >
  Wire the three things a beta needs before invites go out: (1) an error tracker that
  captures server + client errors, (2) a feedback affordance on every product page, and
  (3) a first-party pageview counter. All first-party — no new vendor, no new secret, no
  new npm dependency. Nothing here touches serving facts, fund_score, or any financial
  calculation.
---

# Beta ops minimum

**Owner summary:** Before we invite strangers, we need to see what they see: error tracking,
a way for them to tell us what's broken or confusing, and basic usage numbers. Small setup,
but without it the beta teaches us nothing.

Source: `feature-pipeline/backlog.md` → Beta-launch group → *(story) Beta ops minimum*.

## Clarity verdict

**CLEAR.** The functionality is unambiguous (three named deliverables), scope in/out is stated
in the story itself ("deliberately small: one error tracker, one feedback affordance, one
pageview counter"), "done" is testable (rows land in the right tables; lint + build pass),
and no product decision is open — the owner already pre-authorised the cheapest honest option
("even a mailto/form"). Vendor and engineering choices are delegated to the implementing line.
No PRD, no red-team.

## Lane

**`lane: standard`**, not `lean`, and the reason is honest bookkeeping rather than risk: the
change spans ~15 files and adds three app-owned Postgres tables, which breaks the lean rules
(`<=2 source files`, `no schema/migration`). It is emphatically **not** `reviewed`: it touches
no serving fact, no gold/product panel, no fund_score module, no financial calculation, and no
cross-repo contract. The three new tables are app-write-only ops tables in exactly the same
category as the existing `waitlist_signups` / `early_access` — they are never read by a fund
page and can never mislead one.

## Vendor decision (delegated engineering call — recorded here)

**Everything is first-party.** No Sentry, no PostHog, no Plausible, no `@vercel/analytics`,
no new npm dependency. Rationale:

- **Zero new secret / zero new account.** The hard constraint on this work is that the owner
  must not have to provision a DSN or an API key for the beta to be observable. Every
  third-party error tracker fails that test.
- **We already own the right store.** The app has a Postgres it writes to (`DATABASE_URL`,
  the waitlist pattern). At beta scale — dozens of invited users — three small tables cost
  nothing and give the owner data they own, queryable next to `early_access`.
- **Vercel Hobby log retention is short.** Relying on `console.error` alone would mean the
  evidence of a beta user's crash is gone before the owner reads about it. Console logging is
  kept as the *backstop* sink, not the only one.
- **Per-user attribution beats aggregate counts.** For a beta the useful question is "did the
  twelve people we invited actually open a fund page, and did it error for them?" — which a
  first-party table answers and an aggregate pageview vendor does not.

One **optional** escape hatch is wired for the owner: if `OPS_ALERT_WEBHOOK_URL` is set (a
Slack/Discord incoming webhook), server errors also POST a one-line summary there. Absent, the
code path is skipped silently — no crash, no log noise. Nothing is required to be provisioned
for the feature to work.

## What gets built

### 1. Error tracker

- `src/lib/observability/record-error.ts` — the single sink. `recordServerError()` always
  emits a structured `[ops:error]` JSON line to stderr (Vercel-log backstop), then
  best-effort INSERTs into `ops_error_events`, then best-effort POSTs to
  `OPS_ALERT_WEBHOOK_URL` when set. **It never throws and never rejects** — an error reporter
  that can crash the request it is reporting on is worse than none.
- `src/instrumentation.ts` — exports Next's `onRequestError`, which catches every uncaught
  server-side error (RSC render, server action, route handler). Guarded on
  `process.env.NEXT_RUNTIME === "nodejs"`: the proxy runs on Edge, where postgres.js has no
  TCP socket, so an Edge-runtime error logs to console only.
- `src/app/global-error.tsx` — root error boundary (catches a root-layout crash, the one
  class of failure a nested boundary cannot see).
- `src/app/(site)/error.tsx` — product-surface error boundary: a plain-English recovery
  screen with a retry and a route into the feedback widget, rather than a raw stack.
- Both client boundaries report through the shared `/api/ops` endpoint.

### 2. Feedback affordance

- `src/components/ops/FeedbackWidget.tsx` — a small persistent "Feedback" button in the
  bottom-right of every `(site)` page, expanding to a textarea + optional email. It
  auto-captures the current path, so "this page is confusing" arrives attached to the page.
- `src/components/ops/actions.ts` — `submitFeedback` server action (the `_landing/actions.ts`
  `useActionState` pattern), INSERT into `ops_feedback`. Attaches the signed-in email when
  there is a session, otherwise the optional field the user typed, otherwise null. Never
  invents an identity.
- A `mailto:` line renders **only if** `NEXT_PUBLIC_SUPPORT_EMAIL` is set. No address is
  hardcoded — shipping a fabricated support address is worse than shipping none.

### 3. Pageview counter

- `src/components/ops/OpsBeacon.tsx` — a client component mounted once in the **root**
  layout, so it covers the marketing landing page and every product route. It fires one
  `fetch(..., { keepalive: true })` per path change. Mounting a client component does not
  break `/`'s `force-static` rendering, and a client beacon (unlike a DB write in a layout)
  cannot run at build time.
- `src/app/api/ops/route.ts` — one endpoint, discriminated by `kind: "pageview" | "error"`.
  Same-origin only (`sec-fetch-site`/`origin` check), 4 KB body cap, all strings truncated.
  No IP address is stored.
- `src/lib/supabase/middleware.ts` — `/api/ops` is added to the gate's public paths, with a
  comment recording why: an error tracker blind to the one page the public can reach is not
  an error tracker. The gate's own rule (gate by path, never by method) is preserved, and the
  endpoint does no expensive compute — unlike `/api/portfolio/solve`, which stays gated.

### Schema + readout

- `src/lib/db/schema/ops.ts` + barrel export — Drizzle definitions for `ops_error_events`,
  `ops_feedback`, `ops_pageviews`.
- `scripts/apply-ops-schema.mjs` — idempotent, non-interactive DDL, mirroring
  `apply-early-access-schema.mjs`. (`drizzle-kit push` hangs against Supabase's pooler and
  would try to reconcile every serving table — same rationale as the existing scripts.)
- `scripts/ops-report.mjs` — the readout. Prints pageviews by path and by day, recent errors,
  and recent feedback. This is what makes "one pageview counter" legible without building an
  admin UI.
- `docs/DEPLOYMENT.md` — new ops section + env-var reference rows.

## Out of scope (deliberate)

- No admin UI for the ops data — `scripts/ops-report.mjs` is the readout for a beta.
- No session/funnel analytics, no cohort retention, no dashboards.
- No email delivery of feedback (the optional webhook covers "tell me now").
- No client-side performance/Web-Vitals capture.
- No PII beyond the signed-in email the user already gave us; **no IP addresses stored**.
- No retention/pruning job. At beta volume the tables are trivial; a prune belongs with the
  first real traffic, not before it.

## Acceptance

Run against the local Supabase (`127.0.0.1:54322`).

1. `node scripts/apply-ops-schema.mjs` creates `ops_error_events`, `ops_feedback`,
   `ops_pageviews`; running it **twice** is a clean no-op (idempotency).
2. `POST /api/ops` with `{kind:"pageview", path:"/funds/FCNTX"}` from the app origin →
   exactly one new `ops_pageviews` row carrying that path.
3. `POST /api/ops` with `{kind:"error", ...}` → exactly one new `ops_error_events` row with
   `source='client'`.
4. A server-side throw is captured by `onRequestError` → one `ops_error_events` row with
   `source='server'` and the failing route, plus a structured `[ops:error]` stderr line.
5. `submitFeedback` with a message + path → exactly one `ops_feedback` row with the path
   attached.
6. With `OPS_ALERT_WEBHOOK_URL` unset, none of the above throws, logs a warning, or degrades
   the response.
7. Cross-origin `POST /api/ops` is refused (no row written).
8. `npm run lint` and `npm run build` both pass.

No number in this spec is a data claim; there is nothing to recompute from live sources.

## Owner provisioning

| What | Required? | Note |
|---|---|---|
| `node scripts/apply-ops-schema.mjs` against **prod** (`henxcsknsjfadetomjeu`) and **preview** (`yqyyvhcrmcwarxweusbw`) | **Yes** | One command each with the right `DATABASE_URL`. Without it the ops writes fail soft (console only) — no crash, but no data. |
| `OPS_ALERT_WEBHOOK_URL` | Optional | Slack/Discord incoming webhook. Absent = silent. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Optional | Renders the `mailto:` fallback in the feedback widget. Absent = the line is not rendered. |

No secret is committed. No account needs to be created for the feature to work.

---

## Implementation Result

**Status:** implemented 2026-08-06 on `feature/crescent-profile-v2`, left **uncommitted** — the
dispatcher owns the codex gate and the commit.

### The three deliverables, as built

| | What shipped | Vendor / secret |
|---|---|---|
| **Error tracker** | Next `onRequestError` (`src/instrumentation.ts`) for every server error + two client error boundaries, all funnelling into `recordServerError()` → `ops_error_events` **and** a structured `[ops:error]` stderr line | none / none |
| **Feedback affordance** | `FeedbackWidget` — a corner button in the `(site)` chrome that auto-captures the current path, posting via a server action to `ops_feedback` | none / none |
| **Analytics** | `OpsBeacon` in the root layout → `POST /api/ops` → `ops_pageviews`, read out by `scripts/ops-report.mjs` | none / none |

### Files

| Path | |
|---|---|
| `src/lib/db/schema/ops.ts` | new — Drizzle defs for the three app-owned ops tables |
| `src/lib/db/schema/index.ts` | barrel export |
| `scripts/apply-ops-schema.mjs` | new — idempotent DDL; RLS on, **no policies, no grants** (direct-connection writes only) |
| `scripts/ops-report.mjs` | new — the readout (pageviews by day/path, recent errors, recent feedback) |
| `src/lib/observability/record-error.ts` | new — the single error sink; never throws, never rejects |
| `src/instrumentation.ts` | new — `onRequestError`; Edge-runtime guarded (postgres.js has no TCP socket there) |
| `src/app/global-error.tsx` | new — root boundary, zero dependencies (it renders when the app is already broken) |
| `src/app/(site)/error.tsx` | new — product-surface boundary; shows the digest, never a stack |
| `src/app/api/ops/route.ts` | new — one endpoint, `kind: pageview \| error`; same-origin, 4 KB cap, no IP stored |
| `src/components/ops/OpsBeacon.tsx` | new — pageview beacon + shared client error reporter |
| `src/components/ops/FeedbackWidget.tsx` | new — the feedback affordance |
| `src/components/ops/actions.ts` | new — `submitFeedback` server action |
| `src/app/layout.tsx` | mount `OpsBeacon` (root, so the landing page is covered) |
| `src/app/(site)/layout.tsx` | mount `FeedbackWidget` |
| `src/lib/supabase/middleware.ts` | `/api/ops` added to the gate's public paths, with the rationale in-comment |
| `eslint.config.mjs` | ignore `supabase/.temp/**` — see "Incidental fix" below |
| `docs/DEPLOYMENT.md` | new §9 (Beta ops) + two optional env vars in §7 |

### Acceptance — all verified against local Supabase + a running dev server

| # | Check | Result |
|---|---|---|
| 1 | `apply-ops-schema.mjs` creates all three tables; second run is a clean no-op | **pass** (exit 0 both runs) |
| 2 | `POST /api/ops` pageview → one row with the path | **pass** (204; row carried path + referrer) |
| 3 | `POST /api/ops` error → one row, `source='client'` | **pass** (204; digest/route/message stored) |
| 4 | Server throw captured by `onRequestError` | **pass** — `source='server'`, `route=/api/opsselftest`, `message='… [App Router/route]'`, stack + UA captured, plus the `[ops:error]` stderr line |
| 5 | Feedback submit → one row with path attached | **pass** — driven through the real widget in **Chromium via Playwright**: button visible, form submitted, confirmation rendered, **zero console errors**; row stored `path=/methodology` + typed email |
| 6 | `OPS_ALERT_WEBHOOK_URL` unset → no throw, no noise | **pass** (0 `ops:alert` lines) |
| 7 | Cross-origin `POST /api/ops` refused, nothing written | **pass** (403 for both `sec-fetch-site: cross-site` and a foreign `Origin`; 0 rows leaked) |
| + | Oversize / malformed input | **pass** — 5 KB body 413, non-JSON 400, absolute-URL path 400, unknown `kind` 400 |
| + | **Gate exception is precisely scoped** (re-run with `LAUNCHED=false`) | **pass** — `/funds/FCNTX` **307**, `/api/portfolio/solve` **401**, `/api/lens/quota` **401**, `/api/ops` **204**, cross-origin `/api/ops` **403** |
| + | `/` still `○ (Static)` after mounting the beacon | **pass** (build output; `force-static` intact, `/q/[slug]` still SSG) |
| 8 | `npm run lint` / `npm run build` | **pass** — lint 0 errors (1 pre-existing warning in an untouched file); build exit 0 |

The acceptance-test rows were **truncated from the local ops tables afterwards** — no synthetic
feedback, errors or pageviews are left behind.

### Incidental fix (not in the original spec)

`npm run lint` was failing with **154 errors** before any of this work, all from
`supabase/.temp/start-secrets/.../index.ts` — a gitignored, minified artifact generated by
`npx supabase start`. It made the build gate red on any machine running local Supabase while saying
nothing about this repo's source. Added `supabase/.temp/**` to `globalIgnores`. Verified
pre-existing: the file is gitignored and untouched by this change.

### Owner provisioning still required

1. **Required:** `node scripts/apply-ops-schema.mjs` against **prod** (`henxcsknsjfadetomjeu`) and
   **preview** (`yqyyvhcrmcwarxweusbw`). Until then ops writes fail soft — no crash, no data.
2. **Optional:** `OPS_ALERT_WEBHOOK_URL` (Slack/Discord incoming webhook — push alerts on errors).
3. **Optional:** `NEXT_PUBLIC_SUPPORT_EMAIL` (renders the `mailto:` fallback; no address hardcoded).

No secret was fabricated or committed. `LAUNCHED` is untouched and stays false.
