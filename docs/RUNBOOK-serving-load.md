# Runbook — loading the serving tables into preview and production

**Status:** written 2026-08-07 (beta-execution-plan item **W2**). **Nothing in this file has been
executed.** Executing it is item **D1**, which is owner-gated on stop **S1** (the per-panel delta
review → local serving reload GO).

**Audience:** whoever runs D1. Read it end to end before typing anything. The prod half is
irreversible in practice — there is no snapshot step today (gap **G5**).

**Scope.** Loads four Postgres tables — `fund_profile_facts`, `fund_holdings_full`,
`fund_attribution_blocks`, `serving_manifest` — plus the schema they need, into:

| | Supabase project | Env file | Why |
|---|---|---|---|
| **Preview** | `fundscore-preview` / `yqyyvhcrmcwarxweusbw` | `.env.preview.local` | external prerequisite for the solver spec's **AC3** end-to-end acceptance |
| **Production** | `fundscore-web` / `henxcsknsjfadetomjeu` | `.env.production.local` | the beta itself; `LAUNCHED` stays `false`, access via `early_access` grants |

**Do preview first, in full, including verification.** It is the same procedure against a database
nobody is looking at. If a step is going to surprise you, it will surprise you there.

> ### Read the Gaps section (§8) before you start
> §8 lists eight gaps: six are steps in this procedure with **no script behind them**, one (G8) is
> missing documentation, and one (**G4**, the serving-schema drift) is now **CLOSED** — read it
> anyway, because it is why §3.1 works the way it does. One gap still changes what you *type*, not
> just what you know: **G1** — there is no "replay the verified staging parquet" mode, so the load
> re-assembles.

---

## 0. The shape of it

```
   ┌─ preconditions ─────────────────────────────────────────────────────────┐
   │ S1 approved · lakehouse frozen · provenance fingerprint recorded (§1)  │
   └────────────────────────────────────────────────────────────────────────┘
                                    │
   ┌─ per environment (preview, then prod) ─────────────────────────────────┐
   │ 1. point the shell at the target, out loud            (§2)             │
   │ 2. DDL: serving schema → auth schema → lens → waitlist/early-access    │
   │    → ops schema                                       (§3, §4)         │
   │ 3. pre-flight column diff  ← catches the fail-OPEN    (§5.1)           │
   │ 4. the load: one command, one transaction             (§5.2)           │
   │ 5. verify: manifest equality + counts + coherence     (§6)             │
   └────────────────────────────────────────────────────────────────────────┘
                                    │
   ┌─ preview only ─┐          ┌─ prod only ─────────────────────────────────┐
   │ gate-passing   │          │ LAUNCHED stays false · early_access empty   │
   │ test user (§4.1)│          │ until S5 · invites are D3, not this runbook│
   └────────────────┘          └─────────────────────────────────────────────┘
```

Everything below assumes two checkouts:

- `WEB` = `/Users/alexfrey/Projects/fundscore-web`
- `LAKE` = the fund_score checkout **that produced the S1-approved local reload**. Today that is
  the campaign worktree `/Users/alexfrey/Projects/fund_score-wt-refresh` (branch
  `campaign/refresh-2026-07`); after the owner merges it, it is `/Users/alexfrey/Projects/fund_score`
  on `main`. §1.1 tells you how to prove which one it is rather than assuming.

---

## 1. Preconditions and the provenance gate

### 1.1 Identify the checkout that produced the S1 reload — don't assume it

The local serving DB records its own provenance. Ask it, from `WEB`'s local Supabase:

```bash
cd /Users/alexfrey/Projects/fund_score        # any checkout; this only reads the LOCAL db
uv run python - <<'PY'
import json, psycopg
from fundscore.serving.load import resolve_db_url
url = resolve_db_url()                        # unset DATABASE_URL => local, which is what we want here
print("reading:", url.split("@")[-1])
with psycopg.connect(url) as conn, conn.cursor() as cur:
    cur.execute("SELECT id, profile_build_version, fact_row_count, built_at, build_manifest "
                "FROM serving_manifest WHERE active ORDER BY id DESC LIMIT 1")
    mid, ver, n, built, bm = cur.fetchone()
    print("manifest id      :", mid)
    print("build version    :", ver)
    print("fact_row_count   :", n)
    print("built_at         :", built)
    print("git_sha          :", bm.get("git_sha"))
    print("universe         :", bm.get("universe_name"), bm.get("universe_filter"))
PY
```

`git_sha` is the sha recorded when `build_profile_source_inventory.py` last ran — it identifies the
lakehouse build, and `git log --oneline -1 <sha>` in each checkout tells you which branch carries
it. Confirm the checkout you pick contains that sha **and** that its working tree is clean
(`git -C <LAKE> status --short`).

> **Caveat, stated plainly:** `git_sha` is captured at source-inventory build time, not at load
> time. It narrows the field; it does not prove the loading branch carries every emitter. §1.3 is
> the check that does.

### 1.2 Freeze the lakehouse and record the fingerprint

**Fence F1 applies:** nothing may write fund_score data or panels between the S1 reload and the
prod load. If anything did, the local DB and the prod DB will disagree and neither will be wrong.

Record the fingerprint **now**, before touching any remote:

```bash
cd /Users/alexfrey/Projects/fund_score-wt-refresh          # ← the LAKE you identified in §1.1
shasum -a 256 \
  data/product/fund_profiles/serving_facts_staging.parquet \
  data/product/fund_profiles/fund_holdings_full_staging.parquet \
  data/product/fund_profiles/fund_attribution_blocks_staging.parquet \
  data/product/fund_profiles/profile_build_manifest.json \
  | tee /tmp/s1-staging-fingerprint.txt
```

Keep that file. §5.2 re-runs the same command and diffs it; §6.1 compares the manifest rows.

**Also freeze a copy of the facts staging parquet** — the load overwrites it (see G1):

```bash
cp data/product/fund_profiles/serving_facts_staging.parquet \
   data/product/fund_profiles/serving_facts_staging.parquet.s1-verified
```

That `.s1-verified` suffix follows the convention already in that directory
(`.pre-refresh-campaign-bak`, `.pre-recency-fix-bak`). It is your only way back if the re-assembly
in §5.2 turns out not to be deterministic.

### 1.3 The branch-completeness check — the one that catches the silent failure

This is the `serving-db-ahead-of-branches` lesson, mechanised. The loader intersects its column
contract with `information_schema.columns` on the target and **COPYs only the intersection**; it
raises only if one of five required columns (`series_id`, `profile_build_version`, `identity`,
`source_inventory`, `gates`) is missing. Every other mismatch **fails open**: the section is simply
never written, and the fund page renders as if that feature had no data.

So diff the contract against the target explicitly. Run this **from `LAKE`**, once per target,
after the DDL of §3 and before the load of §5.2:

```bash
cd /Users/alexfrey/Projects/fund_score-wt-refresh
set -a; . /Users/alexfrey/Projects/fundscore-web/.env.preview.local; set +a
export DATABASE_URL="$DATABASE_URL_SESSION"          # port 5432 — see §9

uv run python - <<'PY'
import psycopg
from fundscore.serving.fact_assembler import ALL_COLUMNS
from fundscore.serving.load import resolve_db_url
url = resolve_db_url()
print("TARGET:", url.split("@")[-1])                  # ← read this line out loud before continuing
with psycopg.connect(url) as conn, conn.cursor() as cur:
    cur.execute("SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='fund_profile_facts'")
    db = {r[0] for r in cur.fetchall()}
missing = sorted(set(ALL_COLUMNS) - db)
extra   = sorted(db - set(ALL_COLUMNS) - {"updated_at"})
print("BRANCH EMITS, DB LACKS  (would be SILENTLY skipped):", missing or "none")
print("DB HAS, BRANCH DOES NOT EMIT (stale/retired)       :", extra or "none")
PY
```

**Pass condition: both lists empty.** (`updated_at` is excluded on purpose — it is a DB default the
assembler never emits. Verified against the local DB on 2026-08-07: `missing` empty, `extra` =
`['updated_at']` only.)

- **`BRANCH EMITS, DB LACKS` non-empty** → the DDL step didn't run, or ran from a different
  checkout. Re-run §3.1 from `LAKE`. Do **not** load.
- **`DB HAS, BRANCH DOES NOT EMIT` non-empty** → you are loading from a branch **older** than the
  schema. That branch does not carry every emitter. Find the branch that does (compare
  `fact_assembler.ALL_COLUMNS` across candidates:
  `git -C <LAKE> show <branch>:src/fundscore/serving/fact_assembler.py | grep -n 'ALL_COLUMNS'`)
  and load from that one. Do **not** load.

Run the same check against a **candidate branch's** checkout before you commit to it, not after.

### 1.4 Capacity

`fund_holdings_full` is ~1.4M rows (1,398,380 locally on 2026-08-07). Supabase's free tier will not
hold it — the target project must be on Pro **before** the load, or the COPY fails partway and
rolls back. `docs/DEPLOYMENT.md` §4.4 already flags this. Confirm the plan in the Supabase dashboard
for the target ref; there is no CLI check wired here.

---

## 2. Point the shell at the target — out loud, once, per environment

Every script in this runbook resolves its target from `DATABASE_URL`, and **every one of them falls
back to LOCAL when it is unset**:

- `WEB`'s `scripts/*.mjs` each default to the local Supabase URI hardcoded at the top of the file
  (`127.0.0.1:54322`).
- `LAKE`'s `resolve_db_url()` falls back to `~/Projects/fundscore-web/.env.local`, i.e. local.

A missing `export` therefore does not error — it silently operates on your development database.
Use one dedicated terminal per environment, and never reuse it for local work.

```bash
# --- PREVIEW shell ---
set -a; . /Users/alexfrey/Projects/fundscore-web/.env.preview.local; set +a
export DATABASE_URL="$DATABASE_URL_SESSION"       # 5432 session pooler — see §9
psql "$DATABASE_URL" -c "select current_database(), inet_server_addr(), version()" 2>/dev/null \
  || echo "no psql — confirm the host from the TARGET: line each script prints"
```

Sourcing the env file keeps credentials out of your shell history and out of this document. Do
**not** paste a connection string on the command line.

**Confirm the target before every destructive step.** The scripts that print their target:

| Script | Prints target? |
|---|---|
| `build_serving_facts.py` | yes — `Loading to Postgres (<host>)…`, but **only after** assembly finishes (minutes in) |
| the §1.3 / §6 inline snippets | yes — first line, before anything else |
| `apply_serving_schema.py`, `apply_auth_schema.py` | **no** (gap **G2**) |
| `apply-*-schema.mjs`, `grant-early-access.mjs` | **no** (gap **G2**) |

For the silent ones, run the §1.3 snippet's `TARGET:` line first in the same shell.

---

## 3. Schema (DDL) — fund_score is the source of truth, not Drizzle

Run in this order. All four steps are idempotent; re-running is safe and is the correct response to
a partial failure (each script is `autocommit=True`, statement-by-statement — a mid-run failure
leaves partial DDL behind).

### 3.1 Serving tables — from `LAKE`

```bash
cd /Users/alexfrey/Projects/fund_score-wt-refresh
uv run python scripts/pipeline/apply_serving_schema.py
```

Creates the four enums, **all six serving tables**, the additive `ALTER … ADD COLUMN IF NOT EXISTS`
sweep for every JSONB section, the retired-column drops, and the indexes. Ends with
`tables present: [...]` listing all six, then `serving schema applied.`

The six are `fund_profile_facts`, `fund_holdings_full`, `fund_attribution_blocks`,
`serving_manifest`, and — added 2026-08-07 by **screener-beta-port** —
`query_canonical_catalog` + `query_canonical_results`, the published-query surface behind
`/q/{slug}`, `/search` and `/lens/{lens_slug}`. Those two used to be read by the web app straight
off local parquet through DuckDB, which could not run on Vercel at all; they are tiny (15 + 140
rows) and now load with everything else. If `tables present:` shows only four, you are running an
older `LAKE` — stop and re-check §1.1.

#### `apply_serving_schema.py` is the ONE definition of these tables

There is no second source. As of 2026-08-07 there is no longer a second *copy* either — but read
the **Status** column, because half of this landed in `WEB` and half is still on an unmerged
`fund_score` branch:

| Was | Now | Status |
|---|---|---|
| `WEB/schema.sql` serving section | **deleted** — it was 4 columns short, still carried 4 columns retired in 2026-06, and never knew the two long tables existed. Replaced by a pointer. | **live** in this checkout |
| `WEB/drizzle/*.sql` + `drizzle/meta/` | gitignored, never tracked — local-only leftovers on one machine. Nothing reads them; delete yours. | **live** |
| `WEB` `drizzle-kit push` | refuses, at the config layer, so `npx drizzle-kit push` is blocked too. | **live** |
| `apply_serving_schema.py` — revokes anon/authenticated, enables RLS, self-verifies its own column contract | closes the PostgREST exposure and makes a forgotten column fail at apply time | ⚠️ **`feat/h1-serving-ddl-authority` (`1f3d91f`), NOT merged** |
| `apply_auth_schema.py` serving-RLS block | **removed** — it ran *after* §3.1 and re-created a `USING (true)` read policy exposing the paid JSONB sections | ⚠️ **same branch, NOT merged** |
| `WEB/src/lib/db/schema/serving.ts` | kept, as a **read-only typed mirror** so the app can query the tables. It creates nothing. | **live** |

> ### ⚠️ The RLS hole is NOT closed on `fund_score` `main`
>
> If you run §3.1 and §3.2 from `main` as it stands, **§3.2 re-opens the hole §3.1 was supposed to
> close** — `apply_auth_schema.py` on `main` still enables RLS on `fund_profile_facts` /
> `serving_manifest` and recreates `fpf_public_read` / `sm_public_read` as `FOR SELECT TO public
> USING (true)`, so every paid JSONB section (`value_score` figures, `return_attribution`,
> `alternatives`, `te_decomposition`) is readable over PostgREST with the browser-shipped anon key.
> `fund_holdings_full` and `fund_attribution_blocks` are worse on `main`: RLS off, zero policies,
> and `anon` holding SELECT/INSERT/UPDATE/DELETE/**TRUNCATE**.
>
> **Do not treat this as done until `feat/h1-serving-ddl-authority` (`1f3d91f`) is merged into
> `fund_score` `main` and your `LAKE` checkout contains it.** Verify before you start:
>
> ```bash
> git -C "$LAKE" log --oneline -1 --grep='serving.DDL' || \
>   grep -c 'REVOKE ALL ON TABLE' "$LAKE/scripts/pipeline/apply_serving_schema.py"   # expect ≥1
> grep -c 'fpf_public_read ON public' "$LAKE/scripts/pipeline/apply_auth_schema.py"  # expect 0
> ```
>
> If either check fails you are on the pre-fix code. The load itself still works; the exposure just
> stays open — and `npm run db:check-serving` will **fail** on it (exit 1, `PostgREST EXPOSED`)
> rather than let you call the load done.

**Do not use `npm run db:push`.** It is now a guard script that refuses and names the right tool.
Measured 2026-08-07 against an empty database: `drizzle-kit push` creates all six serving tables
with **ROW LEVEL SECURITY OFF**, and on Supabase they inherit `anon`/`authenticated` full-DML
grants. (`tablesFilter` does *not* prevent this — it filters what push reads back, not what it
creates. Verified, not assumed.) `docs/DEPLOYMENT.md` §3.1 also records that it hangs against
Supabase's pooler, and `drizzle.config.ts` hardcodes `.env.local`, so it can silently target the
wrong database.

**Access control is part of this step.** `apply_serving_schema.py` revokes `anon`/`authenticated`
from all six tables and enables RLS with no policy. The app reads them as the owner role over
`DATABASE_URL` (which bypasses RLS) and never through PostgREST — verified: the only PostgREST
reads in the app are `entitlements` and `early_access`. This matters because the anon key ships to
every browser; before the fix, `fund_holdings_full` (the PAID full-holdings list) was readable —
and truncatable — by anyone holding it.

#### Then verify the app can read what you just created

```bash
cd "$WEB"
DATABASE_URL='<the same target>' npm run db:check-serving
```

**Exit 0 from this command means "this database is fit to serve this checkout of the app".**
Take no flags, and treat a non-zero exit as a stop. It fails on:

| | |
|---|---|
| `TABLE ABSENT` | the app reads a table this database does not have — those routes 500, and `/q/[slug]` silently prerenders **nothing** rather than erroring, so the build will not warn you |
| `MISSING IN DB` | the app would query a column that isn't there |
| `MISSING IN APP` | the loader serves a column the app can't read — this is the `position_direction` case, served for weeks and invisible because only the mirror had drifted |
| `PostgREST EXPOSED` | `anon`/`authenticated` hold grants on tables carrying PAID payloads, with the anon key in every browser |

**Run it against local, preview and prod.** Every table it checks is required because *this
checkout's code reads it* — that is a different question from what has merged in `fund_score`, and
only the first one predicts whether the deployment works.

Expect it to FAIL today on two counts until the merges land, and that is the honest answer, not
noise:

- `query_canonical_catalog` / `query_canonical_results` — created by **`w3/query-serving-tables`
  (`89044fb`)**, unmerged. `/search`, `/q/{slug}` and `/lens/{lens_slug}` cannot work without them.
- `PostgREST EXPOSED` — the revoke lives on **`feat/h1-serving-ddl-authority` (`1f3d91f`)**,
  unmerged. See the box at the top of this section.

Two named escape hatches exist, `--allow-pending` (a table whose DDL is on an unmerged branch may
be absent) and `--allow-exposed`. Both print `PASS-RELAXED` and say in plain words that it is not a
serve-ready verdict. **Neither is appropriate for D1** — they are for someone knowingly inspecting
an intermediate database mid-merge.

### 3.2 Auth / entitlements / RLS — from `LAKE`

```bash
uv run python scripts/pipeline/apply_auth_schema.py
```

**This is not optional for a beta.** `resolveSession()`
(`WEB/src/lib/serving/session.ts:34`) SELECTs from `entitlements` on every signed-in page render.
If that table does not exist, every signed-in page 500s.

It creates `users`, `entitlements`, `lenses` with own-row RLS, and installs the `handle_new_user()` /
`on_auth_user_created` trigger that provisions a `free` entitlements row for every new auth user.
Ends with `auth tables: [...]`, an RLS policy summary, and `auth schema + RLS applied.`

⚠️ **On `fund_score` `main` this step still re-opens the §3.1 lockdown.** `apply_auth_schema.py`
there also enables RLS on `fund_profile_facts` + `serving_manifest` and recreates
`fpf_public_read` / `sm_public_read` as `FOR SELECT TO public USING (true)` — running *after* §3.1,
it undoes it, and exposes every paid JSONB section to the browser-shipped anon key. That block is
removed on **`feat/h1-serving-ddl-authority` (`1f3d91f`)**, so serving access control belongs to
§3.1 alone — **once that branch is merged**. Check with the `grep -c 'fpf_public_read ON public'`
command in the §3.1 box before you run this; expect `0`.

Two ordering facts:
- It **must** run after §3.1 — it references `fund_profile_facts` and `serving_manifest`.
- It creates a trigger on `auth.users`, which needs privileges the pooled `postgres` role normally
  has on Supabase but which has **not been exercised against a remote project here**. If it fails
  on permissions, see gap **G7**.

### 3.3 Lens tables — from `WEB`

```bash
cd /Users/alexfrey/Projects/fundscore-web
node scripts/apply-lens-schema.mjs
```

Additive columns on `lenses` plus `lens_snapshots` and the `get_shared_lens(text)` RPC. Required
because `/api/lens/quota` and `src/lib/serving/lens.ts` are live routes; without the tables they
throw. Must run **after** §3.2 (it ALTERs the `lenses` table that step creates).

### 3.4 Gate + ops tables — from `WEB`

```bash
node scripts/apply-waitlist-schema.mjs
node scripts/apply-early-access-schema.mjs
node scripts/apply-ops-schema.mjs
```

On **prod** the first two already exist (idempotent — re-running just prints the readback). On
**preview** they may not; run all three.

`apply-ops-schema.mjs` is the W1 step and is **required on both environments** — see §4 below. Each
script prints its own columns / policies / row counts.

---

## 4. The W1 ops-schema step — both environments, non-negotiable

Shipped 2026-08-07 in commit `dfcb513` (`WEB`, branch `feature/crescent-profile-v2`). It creates
`ops_error_events`, `ops_feedback`, `ops_pageviews` with RLS on and no policies. **Extended
2026-08-07 (H4)** to also create `ops_rate_limits` — throttle state for `POST /api/ops` itself (the
one unauthenticated INSERT path on the public site); see `src/lib/ops/rate-limit.ts`. No new secret
to provision — the throttle's HMAC key is `DATABASE_URL`, already present in every environment.

**Until it runs against a database, the beta on that database records nothing** — no errors, no
feedback, no pageviews, and no throttle (an unthrottled `/api/ops` is exactly today's behavior, so
this is a safe default, not a regression). The writes fail soft: no crash, no user-visible symptom,
no data. A beta you cannot observe is the failure mode this step exists to prevent.

```bash
cd /Users/alexfrey/Projects/fundscore-web
node scripts/apply-ops-schema.mjs        # in the PREVIEW shell   (yqyyvhcrmcwarxweusbw)
node scripts/apply-ops-schema.mjs        # in the PRODUCTION shell (henxcsknsjfadetomjeu)
```

Expected output per run: four `<table>: <columns> (0 rows)` lines, then
`policies: none (intended — direct-connection writes only)`, then `ops schema applied.`

Verify it took, per environment:

```bash
node scripts/ops-report.mjs --days 7
```

A missing table makes it exit with `Run: node scripts/apply-ops-schema.mjs` — that is the failure
signal. Zero rows on a fresh database is success, not failure.

### 4.1 Preview only — the gate-passing test user (solver AC3)

The solver spec's AC3 needs a preview deployment that renders the X-Ray as a signed-in, allowlisted
user. Two things are required, and **no script does the first one** (gap **G6**):

1. **A Supabase auth user in the preview project.** Create it in the Supabase dashboard for
   `yqyyvhcrmcwarxweusbw` → Authentication → Users → *Add user* → **auto-confirm the email** (there
   is no mail sender configured on preview). `grant-early-access.mjs` says so itself: *"The user
   still has to create an account at /signin."* The `on_auth_user_created` trigger from §3.2 then
   provisions the `users` + `entitlements(tier='free')` rows automatically.
2. **An allowlist row**, in the preview shell:

```bash
cd /Users/alexfrey/Projects/fundscore-web
node scripts/grant-early-access.mjs <tester-email> --note "preview AC3"
node scripts/grant-early-access.mjs --list
```

**Keep `LAUNCHED` unset on preview.** Setting `LAUNCHED=true` would also satisfy AC3 (the solver
spec allows either), but it short-circuits the gate entirely — so AC3 would then exercise a code
path the prod beta never runs. Previews are already private behind Vercel deployment protection, so
the gate costs nothing to keep. If dashboard user creation turns out to be blocked, `LAUNCHED=true`
on the preview Vercel environment is the documented fallback; record that you took it, because it
means the gate is untested end-to-end before prod.

**A `free`-tier user sees the free experience.** Paid/pro sections stay gated. If AC3 needs a paid
view, promote the row deliberately — there is no script (gap **G6**), it is a one-row UPDATE on
`entitlements.tier`, and it should be reverted after.

---

## 5. The load

### 5.1 Immediately before: re-run the §1.3 pre-flight

Both lists empty, in the shell you are about to load from, against the target you are about to load
to. This is the last point at which the silent section-NULLing failure is catchable.

### 5.2 Run it

```bash
cd /Users/alexfrey/Projects/fund_score-wt-refresh     # the LAKE from §1.1 — provenance depends on it
# PREVIEW or PRODUCTION shell, DATABASE_URL exported per §2

uv run python scripts/pipeline/build_serving_facts.py
```

**One command, one transaction, all six tables.** What it does, in order
(`src/fundscore/serving/load.py:235`, `load_to_postgres`):

1. Assembles the fact rows in memory from the gold/product panels (`assemble_fact_rows()`).
2. Prints the coverage summary (`data_completeness_state`, `value_offering_status` histograms).
3. Runs the **clobber guard** against the existing canonical staging parquet — refuses with exit
   code `2` if any JSONB section or tracked nested key would collapse populated → 0.
4. Overwrites `data/product/fund_profiles/serving_facts_staging.parquet` (this is why §1.2 froze a
   copy — see G1).
5. Prints `Loading to Postgres (<host>)…` — **check this host**.
6. Opens one `psycopg` connection with `autocommit=False` and, on a single cursor:
   `TRUNCATE fund_profile_facts` → `COPY fund_profile_facts` → `TRUNCATE fund_holdings_full` →
   `COPY` it from `fund_holdings_full_staging.parquet` → **in-transaction coherence check** →
   `TRUNCATE fund_attribution_blocks` → `COPY` it from
   `fund_attribution_blocks_staging.parquet` → `TRUNCATE`+`COPY`
   `query_canonical_catalog` and `query_canonical_results` from
   `data/product/query/query_canonical_{catalog,results}.parquet` (`_load_query_tables`) →
   `UPDATE serving_manifest SET active=false WHERE active` → `INSERT` the new manifest row →
   `commit()`.

Any exception propagates out before the commit, so **a failed load commits nothing** — see §7.

The query tables ride in the SAME transaction deliberately: the web reader LEFT JOINs
`query_canonical_results` to `fund_profile_facts` for each result's Value Score verdict, so loading
them together means the verdict can never be read against a half-swapped facts table. The loader
also prints `query_results_orphan_rows` — ranked rows pointing at a series that is not in the served
facts universe. Those render an honest em-dash verdict rather than a fabricated one, so a non-zero
count does **not** roll the load back; it means the canonical query panel is stale against the
current universe and wants re-emitting. It was `0` at the 2026-08-07 local verification.

If the query panels ever need loading **without** touching the four profile tables, there is a
standalone entry point (same TRUNCATE+COPY-in-one-transaction discipline):

```bash
uv run python scripts/pipeline/load_query_serving.py            # add --dry-run to validate only
```

Flags that exist (the complete set — `build_serving_facts.py:93-101`):

| Flag | Effect |
|---|---|
| `--db-url URL` | target, highest precedence over `DATABASE_URL`. Prefer the exported env var so no credential lands in shell history. |
| `--series S000... ...` | partial slice. **Not for a prod load** — it diverts staging to `data/_tmp/` and relaxes the orphan guard to a filter. |
| `--staging-only` | assemble + write staging, skip the DB entirely. This is the closest thing to a dry run. |
| `--no-activate` | load but leave `serving_manifest.active` false. |
| `--allow-section-drop` | override the clobber guard. **Never pass this on a prod load.** If the guard fires, something is wrong upstream — stop and find out what. |

There is **no** `--as-of`, no `--dry-run`, no `--tables`, and no "load table X only".

> Do **not** invoke this through `make build-serving-facts` for a remote load. That target
> unconditionally chains `scripts/reports/build_serving_facts_report.py`, which reads the canonical
> staging parquet rather than the database — for a remote run the report describes local state and
> is at best confusing.

### 5.3 Immediately after: confirm the re-assembly reproduced the S1 artifact

```bash
shasum -a 256 \
  data/product/fund_profiles/serving_facts_staging.parquet \
  data/product/fund_profiles/fund_holdings_full_staging.parquet \
  data/product/fund_profiles/fund_attribution_blocks_staging.parquet \
  data/product/fund_profiles/profile_build_manifest.json \
  > /tmp/post-load-fingerprint.txt
diff /tmp/s1-staging-fingerprint.txt /tmp/post-load-fingerprint.txt && echo "IDENTICAL — provenance holds"
```

**Identical → the rows you just pushed are the rows S1 approved.** The holdings and attribution
tables are a true replay (the loader COPYs those parquets straight from disk); the facts table is a
re-assembly, and this diff is what proves the re-assembly was deterministic.

**Different → STOP.** You have loaded rows that S1 did not review. Do not load prod. Restore the
frozen copy (`cp …parquet.s1-verified …parquet`), and treat the difference as a determinism defect
worth its own investigation — the `rebuild-twice-proves-determinism` lesson is that "probably just
row order" has been wrong here before. Diff the two parquets column by column rather than assuming.

---

## 6. Verification — after each load

### 6.1 Manifest equality: prove remote == local

This is the strongest check available and it is the point of `serving_manifest`. Run it once
against **local** and once against the **target**, and compare the two outputs:

```bash
cd /Users/alexfrey/Projects/fund_score-wt-refresh
uv run python - <<'PY'
import hashlib, json, psycopg
from fundscore.serving.load import resolve_db_url
url = resolve_db_url()
print("TARGET:", url.split("@")[-1])
with psycopg.connect(url) as conn, conn.cursor() as cur:
    cur.execute("SELECT profile_build_version, fact_row_count, source_panels, build_manifest "
                "FROM serving_manifest WHERE active ORDER BY id DESC LIMIT 1")
    ver, n, panels, bm = cur.fetchone()
    print("build version :", ver)
    print("fact rows     :", n)
    print("git_sha       :", bm.get("git_sha"))
    print("panels sha256 :", hashlib.sha256(
        json.dumps(panels, sort_keys=True, default=str).encode()).hexdigest())
    for t in ("fund_profile_facts", "fund_holdings_full",
              "fund_attribution_blocks", "serving_manifest"):
        cur.execute(f"SELECT count(*) FROM {t}")
        print(f"  {t:26s}: {cur.fetchone()[0]}")
PY
```

**Pass:** `build version`, `fact rows`, `git_sha`, and the `panels sha256` are **identical** between
local and target, and the four row counts match on the first three tables. (`serving_manifest`
counts will differ — it is append-only, one row per load, 55 locally on 2026-08-07.)

`panels sha256` covers the 40-entry `source_panels` list — every input panel's repo-relative path,
file mtime and row count. If any input moved or was rebuilt between the two loads, this hash
changes. That is exactly the "loaded from a different lakehouse state" failure, made visible.

For scale reference, local on 2026-08-07 (these **will** move after S1 — treat them as an order of
magnitude, not a target): `fund_profile_facts` 5,819 · `fund_holdings_full` 1,398,380 ·
`fund_attribution_blocks` 2,104 · manifest `src_inv_v0_20260731`.

### 6.2 The holdings check, against the remote

```bash
cd /Users/alexfrey/Projects/fund_score-wt-refresh
# same shell, DATABASE_URL still pointed at the target
uv run python scripts/checks/check_fund_holdings_full.py
```

Run it **without** `--skip-db` — the DB half is the point. It re-runs the loader's own FULL JOIN
coherence query against the target, asserts served row/series counts equal the staged parquet,
asserts every present `gates->>'holdings_full'` is `'paid'`, and asserts the active
`serving_manifest.source_panels` mentions `fund_holdings_full`. Sections [A]–[C] additionally
re-verify grain, byte-equal copy fidelity vs the raw N-PORT store, and the EDGAR spot checks
(FCNTX: 428 filed rows, `as_of 2026-03-31`, accession `0000035402-26-003312`).

It must run from `LAKE`, because it compares the live database against **that checkout's** staging
parquet and raw store.

There is **no equivalent readback for `fund_profile_facts` or `fund_attribution_blocks`** — gap
**G3**. §6.1's counts plus §5.1's column diff are what you have.

### 6.2b The query tables (screener-beta-port)

```sql
-- against the target
select (select count(*) from query_canonical_catalog)                       as catalog_rows,
       (select count(*) from query_canonical_results)                       as result_rows,
       (select count(distinct query_slug) from query_canonical_results)     as slugs,
       (select count(*) from query_canonical_results r
          left join fund_profile_facts f using (series_id)
        where f.series_id is null)                                          as orphan_rows;
```

Expect the same numbers the load printed and the same numbers local shows — at the 2026-08-07
verification: `15 / 140 / 14 / 0`. `orphan_rows > 0` is not a load failure (those rows render an
em-dash verdict), but it means the canonical query panel is stale against the served universe.

### 6.3 Web smoke test

Preview (Vercel preview deploy pointed at `yqyyvhcrmcwarxweusbw`), signed in as the §4.1 test user:

- `/funds/FCNTX` renders with fees, passive baseline, holdings, and the value verdict — no empty
  sections where local shows content. An empty section is the §1.3 fail-open, showing up in the UI.
- "View all N holdings" opens and N matches the teaser.
- `/q/funds-ai-infrastructure-exposure-above-passive-blend-7bc9f42d` renders 10 ranked cards (not a
  500 and not an empty list); `/search?q=funds with AI Infrastructure exposure above their passive
  blend` 307s to that same slug. Both prove the query serving tables landed.
- `/screener` and `/xray` load (the X-Ray needs `SOLVER_URL`, which is the solver spec's D4/AC3, not
  this runbook). **`/screener` is a known-bad surface** — it still renders the legacy synthetic
  `funds` table, which no load populates, so on preview/prod it renders an empty screener. That is a
  filed defect (see the backlog's screener-page item), NOT a symptom of a bad load.

**After the load, redeploy so `/q/[slug]` prerenders again.** `generateStaticParams` reads
`query_canonical_catalog` at build time; a build that ran before the tables existed logged
`no query catalog reachable at build` and shipped zero prerendered slugs (they still render on
demand, correctly — just without the static/SEO benefit). A rebuild after the load restores all 14.

Production, while gated:

- Anonymous: `/` 200, `/methodology` 200, `/signin` 200, `/funds/FCNTX` 307 → `/`,
  `POST /api/portfolio/solve` 401, `/api/ops` 204.
- `node scripts/grant-early-access.mjs --list` prints `0 with early access`. **It must stay 0 until
  S5** — granting access is item D3, not this runbook.

### 6.4 What failure looks like

| Message | Meaning | Do |
|---|---|---|
| `No Postgres URL: pass --db-url, set DATABASE_URL, or ensure …` | nothing resolved | export `DATABASE_URL` (§2) |
| `Loading to Postgres (127.0.0.1:54322/postgres)` | **you are about to overwrite LOCAL** | Ctrl-C now |
| `REFUSING to overwrite canonical staging: section(s) [...] would collapse populated→0` (exit 2) | a masked/missing panel input | fix the input; never paste `--allow-section-drop` to get past it |
| `fund_holdings_full_staging.parquet missing — run scripts/pipeline/build_fund_holdings_full.py first` | staging not built in this checkout | wrong `LAKE`, or the build never ran |
| `fund_holdings_full staging has N series not in the assembled facts universe (stale staging vs source_inventory?)` | holdings staging built against a different universe than the facts assembly | rebuild both from one lakehouse state; do not load |
| `fund_holdings_full gate/teaser coherence violated for N series — rolling back the load.` | teaser N ≠ served rows | **already rolled back**; nothing committed. Root-cause before retrying |
| `column "<x>" does not exist` | schema/emitter mismatch | §1.3, then §3.1 from the right checkout |
| **no error, but a section is blank in the UI** | the fail-open — column absent on the target, silently skipped | §1.3. This is why the pre-flight is mandatory |

---

## 7. Rollback, and a load that fails halfway

**A failed load has already rolled itself back.** `load_to_postgres` opens the connection with
`autocommit=False` and commits once, at the very end. All six `TRUNCATE`s, all six `COPY`s, the
coherence check and the manifest insert are inside that single transaction. Any exception unwinds the
`with psycopg.connect(...)` block before `conn.commit()`, so the target keeps whatever it had
before. **There is no half-loaded state to clean up, and no "resume" — you re-run the whole thing.**

Two failure modes are *not* covered by that:

1. **A DDL step that fails partway** (§3). Those scripts run `autocommit=True`,
   statement-by-statement, so a failure leaves partial schema. Every statement is
   `IF NOT EXISTS` / `IF EXISTS`-guarded — **re-run the same script**. That is the fix.
2. **A load that succeeds but is wrong** (loaded from the wrong branch, wrong lakehouse state).
   The transaction cannot help you: it committed. Recovery is to fix the checkout and **run the load
   again** from the correct one — the loader is full-replace, so a correct second load is a complete
   repair of the three data tables. `serving_manifest` is append-only, so the wrong load stays in
   the table as a record with `active=false`; that is intended, not something to clean up.

**There is no snapshot or restore step (gap G5).** For the *first* prod load this is acceptable —
the target's serving tables are empty, so "roll back" means "truncate", and a failed load already
leaves them empty. For any *subsequent* prod reload it is a real exposure: the window between
`TRUNCATE` and `commit` is a window where the previous data only exists in the transaction's undo,
and after commit it does not exist at all. Before a second prod load, either wire the G5 dump step
or turn on Supabase PITR (a paid add-on — an owner call, not a command).

`waitlist_signups`, `early_access` and the three `ops_*` tables are **never touched** by this
procedure. The loader truncates only the three serving data tables. Beta signups and feedback are
safe across a reload.

**If you must stop mid-procedure:** the safe stopping points are (a) after any DDL step, (b) after a
verification step. Do not leave a `LAUNCHED` value changed or an `early_access` row granted as a
side effect of stopping.

---

## 8. Gaps — what has no script behind it

**G1, G2, G3, G5, G6, G7 are steps D1 must either build or perform by hand.** None of them appears
above as a runnable command line, because none of them exists. **G4 is a live defect** in the repo
(schema drift) that changes how §3.1 must be done. **G8** is missing documentation.

**G1 — There is no way to load an existing staging parquet.** `build_serving_facts.py` calls
`assemble_fact_rows()` in process and passes the in-memory rows straight to `load_to_postgres`;
`serving_facts_staging.parquet` is written as a side artifact and **never read back**
(only `fund_holdings_full_staging.parquet` and `fund_attribution_blocks_staging.parquet` are
COPYed from disk). So "load the SAME verified staging parquet the local reload used" is not
literally achievable today — every load re-assembles from `data/gold/*` and
`data/product/fund_profiles/*`, and overwrites the canonical staging parquet as it goes.
§1.2 + §5.3 work around this with a checksum freeze and an after-the-fact byte-identity diff, which
proves determinism rather than assuming it. *Missing capability:* a `--from-staging PATH` flag on
`build_serving_facts.py` that COPYs an existing facts parquet instead of re-assembling. That would
turn a three-checksum ritual into an actual replay, and is the single highest-value fix here.

**G2 — No target confirmation before a destructive step.** `apply_serving_schema.py`,
`apply_auth_schema.py` and all five `WEB/scripts/apply-*.mjs` print nothing about which host they
are about to modify, and every one of them silently falls back to **local** when `DATABASE_URL` is
unset. `build_serving_facts.py` does print its host — but only after assembly, minutes into the run.
§2 mitigates by echoing the target manually. *Missing capability:* a printed `TARGET: <host>` banner
at the top of each script, and/or a `--db-url` flag on `apply_serving_schema.py` /
`apply_auth_schema.py` (neither has any argparse at all today).

**G3 — No readback verification for `fund_profile_facts` or `fund_attribution_blocks`.** The only
live-DB verifier that exists is `check_fund_holdings_full.py`'s `[D/db]` section, and it covers the
holdings table only. Nothing checks that the facts table's per-section population on the target
matches local, which is precisely the regression the fail-open in §1.3 produces. §6.1's row counts
and manifest equality are a proxy, not a substitute. *Missing capability:* a per-section
non-null-count comparison (local vs target) for all `SECTION_COLUMNS`, and a row count + payload
sanity check for `fund_attribution_blocks`. This is the second most valuable thing to build.

**G4 — FIXED, NOT YET MERGED (serving-DDL-authority, 2026-08-07).** The web half is live in this
checkout; the `fund_score` half is committed on **`feat/h1-serving-ddl-authority` (`1f3d91f`)** and
is **not** on `main`. Until it merges, the loader still fails open and the RLS hole is still open —
see the boxed warning in §3.1. The gap was real and larger than written:
the serving tables had four hand-maintained definitions that silently disagreed, and only
`apply_serving_schema.py` reproduced the live database. Measured before the fix — `schema.sql` 4
real columns short with 4 retired ones still present; `drizzle/*.sql` 13 short; both blind to
`fund_holdings_full` and `fund_attribution_blocks`; the Drizzle mirror missing `position_direction`.

What shipped:

- `apply_serving_schema.py` is now the sole definition, **verifies itself** after applying (it
  re-reads `information_schema` and fails if any column the loader writes is absent), and owns the
  tables' access control as well as their shape.
- The loader **no longer fails open.** `load_to_postgres` used to intersect its column list with
  whatever the table happened to have and COPY the overlap — a table built from a stale definition
  simply lost columns and the app served silent NULL sections. It now aborts, before the TRUNCATE,
  naming the missing columns. Proven: dropping two columns and running a load raises and leaves the
  target untouched.
- The stale copies are gone (see the table in §3.1), and `npm run db:check-serving` verifies the
  surviving read-mirror against any live database.

The residual, now-explicit rule: **change `apply_serving_schema.py` first, mirror into
`serving.ts` second, and let `db:check-serving` prove it.** Never the other way round.

**G5 — No pre-load backup or restore.** Nothing dumps the target's serving tables before a
TRUNCATE+COPY, and no restore path is written. Harmless for the first prod load (empty target);
a real exposure for every reload after. *Missing capability:* a scripted `pg_dump --data-only
--table=fund_profile_facts --table=fund_holdings_full --table=fund_attribution_blocks
--table=serving_manifest` against the 5432 session URL before the load, or Supabase PITR (paid —
owner decision).

**G6 — No script creates a gate-passing user.** `grant-early-access.mjs` writes the `early_access`
allowlist row only; the Supabase **auth** user must be created by hand in the dashboard (or via the
Admin API) and auto-confirmed, because preview has no mail sender. Likewise there is no script to
set `entitlements.tier` for a paid/pro test view. §4.1 documents the manual path. *Missing
capability:* a `scripts/create-test-user.mjs` using the Supabase Admin API — which would need the
**service-role key**, a secret not currently held in `.env.preview.local` (that file has only
`DATABASE_URL`, `DATABASE_URL_SESSION`, `SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Provisioning that key is itself an owner decision.

**G7 — The `auth.users` trigger has never been applied to a remote Supabase project.**
`apply_auth_schema.py` creates `handle_new_user()` (`SECURITY DEFINER`) and a trigger **on the
`auth` schema**. That works locally. Whether the pooled `postgres` role on a hosted Supabase project
can create a trigger on `auth.users` is untested here. If it fails on permissions, the fallback is
to run those two statements from the Supabase SQL editor (which runs as a more privileged role), or
to accept the trigger's absence: `resolveSession()` already falls back to `"free"` when the
`entitlements` row is missing, so a signed-in user without the trigger still gets the free
experience — but the `users`/`entitlements` rows are then never created and any paid/pro flow has
nothing to read.

**G8 — No `.env.example` in either repo.** The only inventory of required variables is
`docs/DEPLOYMENT.md` §7 plus §9 of this file. A new operator has no machine-checkable list of what a
working environment needs.

**Not a gap, but worth stating: `sslmode` is never set.** Neither `resolve_db_url()` nor the loader
adds it; psycopg3 does not force TLS on its own. Supabase pooler URIs connect without it, but if you
want TLS guaranteed, append `?sslmode=require` to the URI in the env file yourself.

---

## 9. Secrets

**No credential, connection string, password, or key appears in this file, and none may be added
to it.**

Variable names, and where they live:

| Variable | Where it lives | Used by |
|---|---|---|
| `DATABASE_URL` | `.env.production.local` / `.env.preview.local` / `.env.local` (all gitignored) | everything — Drizzle, `WEB/scripts/*.mjs`, `LAKE`'s `resolve_db_url()`. **Port 6543** (transaction pooler) is the app's value. |
| `DATABASE_URL_SESSION` | same files | **Port 5432** (session pooler). Read by no code — it exists for operators. **Use this one for every step in this runbook**: DDL and a 1.4M-row `COPY` both need a real session, and the transaction pooler does not provide one. |
| `SUPABASE_DB_PASSWORD` | same files | operator convenience; read by no code. Supabase cannot re-show it — it lives in a password manager or nowhere. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same files, and Vercel env | Supabase auth client. Public by design. |
| `LAUNCHED` | Vercel env, per environment | the gate. **Must stay unset/`false` on production for the whole beta.** Only `"true"` (exact string) opens the site. |
| `OPS_ALERT_WEBHOOK_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL` | Vercel env, optional | beta ops extras (§9 of `DEPLOYMENT.md`) |
| `SOLVER_URL`, `PORTFOLIO_SOLVER_AS_OF` | Vercel env | solver; owned by the solver spec, not this runbook. (`QUERY_PARQUET_DIR` was retired 2026-08-07 by screener-beta-port — the query surface serves from Postgres; delete the var wherever it is set.) |
| `REQUIRE_Q_PRERENDER` | Vercel env, optional, unset today | `1` makes a **deployed** build FAIL when it cannot read `query_canonical_catalog`, instead of shipping 0 prerendered `/q/` slugs with a loud warning. Set it once prod actually carries the query tables (i.e. after this runbook has been executed against prod); until then a hard failure would break every deploy. |

**Which database `npm run build` / `npm start` use.** Next's own file precedence is
`.env.production.local` > `.env.local` > `.env.production` > `.env`, and both `next build` and
`next start` run with `NODE_ENV=production` — so until 2026-08-07 every *local* build silently
opened read queries against the **production** pooler (and a local `npm start` would have *served*
prod rows). Both now go through `scripts/next-env-guard.mjs`, which:
on a deployed host (`VERCEL` set) changes nothing, and on any other host promotes `.env.local`'s
keys into the build's environment so they outrank `.env.production.local`. An explicit shell export
still wins over both (`DATABASE_URL='postgres://…' npm run build`), and every build prints the
`host:port/dbname` it resolved before it starts. A local build with no `.env.local` and no explicit
`DATABASE_URL` is **refused**, not guessed.

Handling rules:

- **Source, never paste.** `set -a; . <env file>; set +a`. Do not type a URI containing a password
  on a command line — it lands in shell history, in `ps` output, and in any transcript.
- Prefer the exported `DATABASE_URL` over `--db-url` for the same reason.
- `.env.production.local` and `.env.preview.local` are gitignored and mode `600`. Keep them that
  way. `.gitignore` covers `.env*`.
- If a credential is ever pasted into a shared transcript, rotate the DB password in the Supabase
  dashboard — do not assume the transcript is private.
- No service-role key is currently held for either project. Do not provision one to work around
  G6 without asking the owner.

---

## 10. What this runbook deliberately does not cover

- **Executing any of it.** That is beta-execution-plan item **D1**, owner-gated on **S1**.
- **Granting beta access.** `early_access` stays empty on production until **S5**; invites are D3
  (`node scripts/grant-early-access.mjs --from-waitlist N`).
- **Setting `LAUNCHED=true`.** That is the public launch, not the beta.
- **The solver service** (`SOLVER_URL`, Fly/Railway, the snapshot bake) — solver-http-service spec,
  items W4/D2. This runbook only supplies the populated preview DB its AC3 depends on.
- **Rebuilding any panel or staging parquet.** Fence F1: the campaign session owns the lakehouse.
  This runbook consumes what S1 approved and rebuilds nothing.

## References

- `docs/DEPLOYMENT.md` — §0 live state, §2 the gate, §3 Supabase bootstrap, §4.4 (the placeholder
  this runbook fills), §7 env vars, §9 beta ops
- `/Users/alexfrey/Projects/fund_score/docs/context/serving.md` — the local serving-load reference
  this procedure extends
- `feature-pipeline/beta-execution-plan.md` — fences F1/F3/F4, stops S1/S5, items W1/D1/D3
- `feature-pipeline/specs/queue/solver-http-service.md` § Sequencing ¶4 — the AC3 dependency
