---
id: prod-serving-data-load-beta-runbook
title: Prod + preview serving-data load runbook (WRITE ONLY — execution is D1)
status: queued
track: full-stack
repo: fundscore-web
lane: lean
depends_on: []
created: 2026-08-07
scope: docs
model: opus
effort: medium
---

**Owner summary:** Today the live site's database holds only the waitlist — none of the actual
fund data. Before we can invite anyone, somebody has to copy the verified fund data into the live
database and into the preview database the solver is tested against. That copy is a one-shot,
irreversible-feeling operation against production, so this item writes the *checklist* for it —
exactly which commands, in which order, what to verify, and what to do when it fails halfway —
so the person running it (item D1) is following a script instead of improvising against prod.

## Story

From `feature-pipeline/backlog.md` (Beta-launch group, line 153):

> Prod Supabase (`henxcsknsjfadetomjeu`) has ONLY `waitlist_signups` + `early_access`; the beta
> needs the four serving tables (`fund_profile_facts`, `fund_holdings_full`,
> `fund_attribution_blocks`, `serving_manifest`) loaded from the SAME verified staging parquet the
> local reload uses (TRUNCATE+COPY, one transaction, in-transaction coherence checks), plus env
> wiring (`LAUNCHED` stays false; access via `early_access` grants) and a WRITTEN prod-reload
> runbook. ALSO loads the PREVIEW Supabase (`yqyyvhcrmcwarxweusbw`) with the same verified tables +
> a gate-passing test user: the solver-http-service spec's end-to-end acceptance (AC3) runs against
> preview, so the preview load is its external prerequisite.

## Scope — write only

This spec delivers **a document**. It executes nothing.

**In scope**
- One runbook file in `fundscore-web/docs/` covering the preview load, the prod load, W1's
  ops-schema step, verification, rollback, and secrets handling.
- Every command in it verified to exist in the current tree (fund_score Makefile targets / CLI
  entry points / web `scripts/`), read from the real argparse or script source.
- An explicit, un-softened **Gaps** section naming every step that needs a script or capability
  that does **not** exist yet, so D1 knows what it must build or do by hand.
- A pointer from `docs/DEPLOYMENT.md` to the runbook.

**Out of scope (owned by beta-execution-plan item D1)**
- Running any load, schema application, or write against preview or prod. Fence F4 binds: the
  preview/prod loads happen only in D1, from the S1-verified staging.
- Building any of the missing scripts the Gaps section names, beyond a trivially small one that is
  clearly in scope. D1 decides build-vs-manual with the gap list in hand.
- Any fund_score data or panel write (fence F1 — another session owns the lakehouse).

## Why `lane: lean` is honest here

The deliverable is a markdown document. Zero executable change, zero schema change, zero data
write, no serving-fact semantics touched, no financial calculation. The reviewed-lane triggers all
attach to the **execution** (D1), which this spec explicitly does not perform. Acceptance is
file-level and concrete (below). Track is `full-stack` only because the runbook *describes*
commands in both repos; the file itself lands in `fundscore-web`.

## Required content

The runbook MUST cover, concretely and in this order:

1. **Preconditions / provenance gate** — how to prove the staging parquet about to be loaded is the
   SAME verified artifact the S1-approved local reload used, and how to check *mechanically* that
   the loading branch carries ALL current emitters (the `serving-db-ahead-of-branches` lesson:
   diff `information_schema.columns` against the emitter's column contract across branches; a
   stale-branch reload NULLs newer sections rather than erroring).
2. **Ops schema step (from W1)** — `node scripts/apply-ops-schema.mjs` against BOTH prod
   (`henxcsknsjfadetomjeu`) and preview (`yqyyvhcrmcwarxweusbw`). Shipped 2026-08-07 in commit
   `dfcb513`; until it runs, the beta records **no** errors, feedback, or pageviews (ops writes
   fail soft — no crash, no data).
3. **Preview load** (`yqyyvhcrmcwarxweusbw`) — including the gate-passing test user the
   solver-http-service spec's AC3 needs.
4. **Prod load** (`henxcsknsjfadetomjeu`) — owner-gated, `LAUNCHED` stays `false`, access via
   `early_access` grants.
5. **Verification after each load** — what to check, and what a failure looks like.
6. **Rollback / a load that fails halfway.**
7. **Secrets handling** — name the env vars required; never a real credential in the file.

Plus the **Gaps** section described above.

## Grounding rules (non-negotiable)

- Ground every step in the REAL local reload path. Read fund_score's serving load target, the
  staging parquet layout, the TRUNCATE+COPY transaction, and the in-transaction coherence checks
  before writing a single command line.
- **Never write a command line for a script that does not exist.** If a step needs one, describe
  the step in prose and file it under Gaps by name.
- No invented table names, column names, flags, or env vars.
- No credentials, connection strings, or project passwords in the file — variable NAMES only.

## Acceptance

1. The runbook file exists at the path recorded in the Implementation Result and contains all seven
   required sections plus Gaps.
2. Every fenced shell command in the runbook resolves in the current tree: each `make` target
   appears in the corresponding `Makefile`; each `uv run python -m …` module exists with the flags
   as written; each `node scripts/*.mjs` file exists. Verified by inspection, command by command.
3. Every step that needs a non-existent script appears in **Gaps**, named precisely, with what it
   would have to do — and does **not** appear anywhere in the runbook as a runnable command line.
4. `grep -nEi '(postgres(ql)?://[^ ]*:[^ ]*@|service_role|sb_secret|eyJ[A-Za-z0-9_-]{20,})'` over
   the runbook returns nothing — no real credential, key, or populated connection string.
5. `docs/DEPLOYMENT.md` links to the runbook.
6. Nothing was executed against preview or prod: no load, no schema application, no remote write.
   The Implementation Result states this explicitly.
7. Docs-only change — `npm run build` / `npm run lint` are not required; `git diff --check` is
   clean and the markdown renders.

## Implementation Result

**Runbook:** `docs/RUNBOOK-serving-load.md` (new). **Pointer:** `docs/DEPLOYMENT.md` §4.4 rewritten
to link it and to carry the two findings that change how the DDL step must be done.
**Lane:** lean, as specced — docs only, two files, no code, no schema, no data.
**Nothing was executed against preview or production.** No load, no DDL, no remote connection, no
write of any kind. The only commands run were read-only inspections of the LOCAL environment
(`information_schema` + `count(*)` on local Supabase, `shasum` of local staging parquet, `ls`/`grep`
of both repos). Fence F4 is intact; the loads are item D1.

**Sections:** 0 shape · 1 preconditions/provenance gate · 2 pointing the shell at the target ·
3 schema (DDL) · 4 the W1 ops-schema step (+4.1 preview test user) · 5 the load · 6 verification ·
7 rollback · 8 gaps · 9 secrets · 10 out of scope · references.

**Every command was verified to exist** before being written: `apply_serving_schema.py`,
`apply_auth_schema.py`, `build_serving_facts.py` (full argparse read — `--db-url`, `--series`,
`--staging-only`, `--no-activate`, `--allow-section-drop`, and *no* `--as-of`/`--dry-run`/`--tables`),
`check_fund_holdings_full.py --skip-db`, and web `apply-{serving,waitlist,early-access,ops,lens}`
scripts + `grant-early-access.mjs` + `ops-report.mjs`. The §1.3 pre-flight column-diff snippet and
the §6.1 manifest-equality snippet were **executed against the local DB** to prove they run.

**Findings that changed the procedure** (not anticipated by the story):

1. `build_serving_facts.py` never reads `serving_facts_staging.parquet` back — it re-assembles the
   facts in memory and COPYs those. "Load the SAME verified staging parquet" is therefore not
   literally achievable today (gap G1); the runbook substitutes a checksum-freeze + byte-identity
   diff that *proves* the re-assembly was deterministic rather than assuming it.
2. `WEB/src/lib/db/schema/serving.ts` is missing `fund_holdings_full.position_direction`, which the
   loader COPYs — so Drizzle/`schema.sql` must not create the serving tables (gap G4). Live drift
   defect, worth its own backlog item.
3. `apply_auth_schema.py` is **mandatory**, not optional: `resolveSession()` SELECTs `entitlements`
   on every signed-in render, so a missing table 500s every page for a beta user.
4. Every script silently falls back to the LOCAL database when `DATABASE_URL` is unset, and most
   print nothing about their target (gap G2) — §2 exists entirely to defuse that.

**Gaps filed:** G1 no replay-from-staging · G2 no target confirmation · G3 no readback for
`fund_profile_facts`/`fund_attribution_blocks` · G4 Drizzle/SQL schema drift · G5 no backup/restore ·
G6 no test-user script (needs a service-role key nobody holds) · G7 `auth.users` trigger untested
remotely · G8 no `.env.example`.

**Acceptance:** 1 ✓ (all seven sections + Gaps) · 2 ✓ (every fenced command resolves; enumerated
above) · 3 ✓ (`--from-staging`, `pg_dump`, `create-test-user.mjs` appear only in §8 prose, never as
command lines) · 4 ✓ (credential grep clean) · 5 ✓ · 6 ✓ · 7 ✓ (`git diff --check` clean).

**This spec does NOT close the backlog story.** Only the runbook half shipped. The preview + prod
loads are beta-execution-plan item **D1**, owner-gated on **S1**; the backlog line stays open with a
pointer to the runbook.

## Notes

- The backlog story does **not** close on this spec. Only the runbook half ships here; the load
  itself is beta-execution-plan item **D1**, owner-gated on stop **S1**. The backlog line stays
  open with a note pointing at the runbook.
- Queue depth at spec time: 11 specs already sitting in `feature-pipeline/specs/queue/`. Well past
  the ≥3 nudge threshold — this one was specced because W2 was dispatched for it, but the queue
  wants draining before more speccing.
