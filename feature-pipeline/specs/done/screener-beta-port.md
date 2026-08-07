---
id: screener-beta-port
title: Screener beta port — serve the canonical query surface from Postgres so /q/[slug] runs on Vercel
status: queued
track: full-stack
repo: fundscore-web + fund_score
lane: standard
depends_on:
created: 2026-08-07
scope: global
model: opus
effort: high
---

## Owner summary
The published-question pages (`/q/...`, and the `/search` and saved-`/lens` surfaces that lean on
them) work only on your laptop today: they read analysis files straight off local disk through an
embedded query engine. A beta user on the real site would get an error. This moves that query
surface into the same database the fund pages already use, so it deploys like everything else — and
it fixes a live inconsistency where the screener's value verdict for a fund could disagree with that
fund's own profile page.

## Measured scope (up front — the EDA, not an estimate)

Read from the real panels in `fund_score/data/product/query/` on 2026-08-07:

| Panel | Rows | Cols | Consumed by the reader |
|---|---|---|---|
| `query_canonical_catalog.parquet` | **15** | 13 | all 13 |
| `query_canonical_results.parquet` | **140** (14 slugs × 10; 1 refusal slug has 0) | 17 | all 17 |
| `screener_funds.parquet` | 5,663 | 46 | **4** (`value_coverage_state`, `value_confidence`, `value_passive_alt`, `value_score_100`) |
| `screener_theme_exposure.parquet` | 31,722 | 11 | **0 — not read by the web app at all** |

So the query surface the web actually serves is **155 rows / 30 columns**. Longest text field is 122
chars. This is trivially small for Postgres; nothing here needs DuckDB, object storage, or MotherDuck.

**Coverage (the number that governs the port):** the 140 result rows span **110 distinct
`series_id`. All 110 are present in the already-served `fund_profile_facts` table (110/110 = 100%).**
The value verdict therefore does NOT need `screener_funds.parquet` in Postgres — it can be read from
the fund's own served row. Coverage of the ported path equals coverage of the DuckDB path exactly:
15/15 catalog rows, 140/140 result rows, 110/110 verdicts. There is no honest-missing and no
recoverable-missing remainder.

**One intentional behavioural difference, measured:** today the verdict is read from a stale
`screener_funds.parquet` (emitted 2026-07-11) while the fund page reads `fund_profile_facts`. Across
the 110 funds those two sources disagree on `value_coverage_state` for **5** funds, on
`value_score_100` for **12**, on `value_confidence` for **4** and on `value_passive_alt` for **12** —
i.e. the screener and the fund profile currently contradict each other, which is exactly what the
comment in `screener.ts` says must never happen. Sourcing the verdict from `fund_profile_facts`
removes the second source and the contradiction. `value_score_100` is never selected (verdict free,
precision paid); `breakeven_state` is taken from the SERVED field rather than re-derived (verified:
the served value matches the reader's `>50 above / <50 below / else near` rule on 110/110 rows).

## Context — what is actually true today (the story's premise is partly wrong)

- `/q/[slug]`, `/search` and `/lens/[lens_slug]` read parquet through DuckDB
  (`src/lib/serving/screener.ts`, `QUERY_PARQUET_DIR` defaulting to an absolute path inside the local
  fund_score checkout). `@duckdb/node-api` is imported by that one module and nothing else.
- **`/screener` does NOT read parquet.** It reads `getFundSummaries()` → the legacy `funds` table,
  which holds **25 rows of synthetic seed data** (fabricated analyst notes, retired "FundScore /
  Strong Buy tier" fields). It is the only consumer of that table, and the table is not part of any
  serving load, so in prod it is empty. **Out of scope here — filed separately** (see § Out of scope).

## Goal

Serve the canonical query surface from Postgres, same pattern as the fund profiles, so `/q/[slug]`,
`/search` and `/lens/[lens_slug]` run on Vercel with no local filesystem and no DuckDB.

## Design

**Two new serving tables**, owned by fund_score exactly like the other four:

- `query_canonical_catalog` — PK `query_slug`; 13 columns, 1:1 with the panel. `as_of` typed `date`.
- `query_canonical_results` — PK `(query_slug, rank)`; 17 columns, 1:1 with the panel.
  `holdings_as_of` typed `date`.

DDL goes in `scripts/pipeline/apply_serving_schema.py` (the authoritative DDL source per the open
3-way-drift bug); Drizzle definitions mirror it and say so in a comment.

**Loading** follows `docs/RUNBOOK-serving-load.md`: TRUNCATE + COPY both tables inside ONE
transaction. Wired two ways from one function in `fundscore/serving/load.py`:
- called from `load_to_postgres()` so a full serving load refreshes them atomically with
  `fund_profile_facts` (which the verdict join depends on), and
- exposed as a standalone `scripts/pipeline/load_query_serving.py` so the query tables can be loaded
  without touching the other four.

**The verdict join moves into Postgres**: `query_canonical_results LEFT JOIN fund_profile_facts` on
`series_id`, selecting `value_coverage_state` (scalar) plus `value_score->>'breakeven_state'`,
`->>'confidence'`, `->>'passive_alt_label'`. LEFT JOIN so a fund absent from the served universe
renders an em-dash rather than a fabricated verdict.

**`screener_funds.parquet` and `screener_theme_exposure.parquet` are NOT loaded** — nothing in the
web app reads them. When the queued `exposure-screener` spec lands it can add what it needs then.

**`@duckdb/node-api` is removed from `package.json`** — its only importer is the module being
rewritten. This also removes a native binary from the Vercel bundle.

## In scope
- `fund_score`: DDL for the two tables; `_load_query_tables()` in `serving/load.py`; standalone
  loader script; panel provenance entries.
- `fundscore-web`: Drizzle definitions; `src/lib/serving/screener.ts` rewritten over Drizzle/Postgres
  with an **unchanged exported API** (`CatalogRow`, `ResultRow`, `QueryPage`, `getCanonicalCatalog`,
  `getAllCatalog`, `getQueryBySlug`, `slugExists`) so no consumer changes; drop the DuckDB dep;
  runbook update.

## Out of scope (filed, not silently dropped)
- **`/screener`'s synthetic `funds` table.** Real defect, different feature: the page renders 25
  fabricated funds with fabricated analyst notes and a retired scoring model, and is empty in prod.
  Rebuilding it on `fund_profile_facts` is a page redesign around the Value Score that overlaps the
  queued `exposure-screener` spec — a product call, escalated to the owner, not made here.
- Regenerating the canonical query panels (they are 2026-07-02 vintage). Panel emits are fenced (F1).
- Free-text ranking over the full universe (already deferred).
- Loading `screener_funds` / `screener_theme_exposure`.

## Acceptance
1. **Byte-level parity of the transported columns.** For all 15 catalog rows and all 140 result rows,
   every column served from Postgres equals the value in the parquet read through DuckDB. Verified by
   a diff script, not by inspection.
2. **Coverage identity.** Postgres serves 15 catalog rows, 140 result rows, 14 non-refusal slugs ×
   10 rows — identical to the DuckDB path. Any shortfall is a FAIL.
3. **Verdict join coverage** is 110/110; the 4 verdict fields come from `fund_profile_facts` and
   `value_score_100` appears nowhere in the payload.
4. `grep -r "@duckdb/node-api" src/` returns nothing; the package is gone from `package.json`.
5. `npm run build && npm run lint` pass, and `/q/[slug]` still prerenders (● SSG) with 14 paths from a
   host that can reach the database; on a host that cannot, `generateStaticParams` still degrades to
   `[]` + on-demand rendering rather than failing the build.
6. `docs/RUNBOOK-serving-load.md` documents the two tables and the load step.

(Numbers above are measured 2026-08-07 against the live panels; acceptance recomputes from live
sources, or the deviation is explained.)

---

## Implementation Result

**Status: implemented 2026-08-07, awaiting the codex gate + commit (dispatcher-owned).**
Branches: `fundscore-web` → `feature/crescent-profile-v2`; `fund_score` → `w3/query-serving-tables`
in the dedicated worktree `/Users/alexfrey/Projects/fund_score-wt-w3` (created off `main`; the
campaign session's worktree was untouched). **Both repos are left UNCOMMITTED.**

### Approach — the owner's default held, no hard blocker
Postgres-served, same pattern as the profiles. The EDA found nothing resembling a blocker: the whole
query surface is 155 rows. The one thing worth flagging is that it turned out to be *smaller* than
the framing assumed — small enough that R2/httpfs and the MotherDuck "v1" plan were retired outright
rather than ported, and `@duckdb/node-api` (a native binary) left the dependency tree.

### Coverage / scale, measured before building
| | DuckDB path (before) | Postgres port (after) |
|---|---|---|
| catalog rows | 15 | **15** |
| result rows | 140 | **140** |
| slugs with rows | 14 (× 10 each) | **14 (× 10 each)** |
| distinct `series_id` | 110 | **110** |
| verdicts resolved | 110/110 (from `screener_funds.parquet`) | **110/110** (from `fund_profile_facts`) |
| orphan result rows (series not in the served universe) | — | **0** |

No shortfall, so no honest-missing / recoverable-missing split to make. `screener_funds.parquet`
(5,663 × 46) and `screener_theme_exposure.parquet` (31,722 × 11) were deliberately NOT loaded: the
web app reads 4 columns of the former and zero of the latter.

### The one intentional behavioural change
The verdict source moved from the stale `screener_funds.parquet` (2026-07-11) to
`fund_profile_facts` — the same row the fund's own profile page renders. Measured drift between the
two sources across the 110 funds: `value_coverage_state` 5, `value_confidence` 4,
`value_passive_alt` 12, `value_breakeven_state` 8. After the UI's own `scored` gate
(`ResultCard.tsx:53/56/108`), **13 of 140 rendered rows change**. This removes a live defect — the
screener and a fund page could show different verdicts for the same fund. `value_score_100` is not
selected anywhere; `breakeven_state` is read from the served field (verified equal to the reader's
old `>50/<50/else` derivation on 110/110 rows) so that rule lives in one place.

### Files touched
`fund_score` (worktree `fund_score-wt-w3`, branch `w3/query-serving-tables`):
- `scripts/pipeline/apply_serving_schema.py` — DDL for both tables + index; the summary now lists six.
- `src/fundscore/serving/load.py` — panel paths, column lists, `_read_query_panel`,
  `_load_query_tables`, wired into `load_to_postgres` (same transaction) and into panel provenance.
- `scripts/pipeline/load_query_serving.py` — NEW standalone loader (`--dry-run`, prints the target host).

`fundscore-web` (branch `feature/crescent-profile-v2`):
- `src/lib/db/schema/serving.ts` — `queryCanonicalCatalog` + `queryCanonicalResults` (typed reads only).
- `src/lib/serving/screener.ts` — rewritten over Drizzle; exported API unchanged.
- `src/app/(site)/q/[slug]/page.tsx` — `generateStaticParams` comment/log now describe the DB source.
- `package.json` / `package-lock.json` — `@duckdb/node-api` removed.
- `docs/RUNBOOK-serving-load.md` — §3.1 six tables, §5.2 transaction order + standalone loader,
  §6.2b verification query, §6.3 smoke checks + the post-load redeploy note, §7, §9.
- `docs/DEPLOYMENT.md` — R2 no longer carries query parquet; `QUERY_PARQUET_DIR` marked retired.
- `feature-pipeline/backlog.md` + `backlog-archive.md` + `beta-execution-plan.md` — bookkeeping.

### New tables and how they load
`query_canonical_catalog`, `query_canonical_results`. DDL from
`apply_serving_schema.py` (idempotent). Data by TRUNCATE+COPY inside `load_to_postgres`'s single
transaction on a full serving load, or standalone via `load_query_serving.py`. Verified against the
LOCAL database only (`127.0.0.1:54322`): 15 / 140 / 0 orphans. Nothing was run against preview or
prod, and none of the four existing serving tables was reloaded.

### Acceptance
1. Parity — **PASS**, 0 failures: every column of all 15 catalog rows and all 140 result rows equals
   the DuckDB read (`.tmp-parity.mjs`, removed after the run).
2. Coverage identity — **PASS** (table above).
3. Verdict join 110/110, `value_score_100` absent from the module's code — **PASS**.
4. `@duckdb/node-api` gone from `src/` and `package.json` — **PASS**.
5. `npm run lint` — pass (1 pre-existing warning in `.claude/workflows/implement-backend-spec.js`).
   `npm run build` — pass. `/q/[slug]` **● SSG, 14 prerendered paths, revalidate 1d / expire 1y** —
   identical to the pre-change build, when the build's `DATABASE_URL` reaches a loaded serving DB.
   Against an unloaded DB the build still succeeds and degrades to on-demand rendering (0 prerendered
   paths + one `no query catalog reachable at build` warning), which is the intended fallback.
   Live `next start` smoke: a canonical slug renders 10 ranked cards with real data, the refusal slug
   404s, an unknown slug 404s, `/search` 200s, `/search?q=<canonical text>` 307s to the right slug.
6. Runbook updated — **PASS**.

### What must happen at deploy time (feeds D1)
- Run `apply_serving_schema.py` from the `LAKE` **that contains this change** — an older checkout
  creates only four tables and the load then fails on `query_canonical_catalog`.
- No extra load command: `build_serving_facts.py` now covers all six tables in one transaction.
- **Redeploy the web app after the load.** `generateStaticParams` reads the catalog at build time;
  a build that ran before the tables were populated ships 0 prerendered `/q/` slugs (they still
  render on demand). A rebuild afterwards restores all 14 and the SEO benefit.
- Delete `QUERY_PARQUET_DIR` from any Vercel environment — it is dead.

### Deliberately out of scope
`/screener`'s synthetic `funds` table (filed as its own Open bug — a product call, and a beta
blocker); re-emitting the 2026-07-02 canonical query panels (fenced by F1); loading
`screener_funds` / `screener_theme_exposure`; free-text ranking.
