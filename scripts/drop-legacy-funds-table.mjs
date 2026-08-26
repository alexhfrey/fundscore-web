#!/usr/bin/env node
// ============================================================================
// Drop the pre-pivot demo `funds` table — the fabricated-data retirement (F7).
// ----------------------------------------------------------------------------
//   node scripts/drop-legacy-funds-table.mjs            # dry run: reports only
//   node scripts/drop-legacy-funds-table.mjs --apply    # performs the drop
//
// WHAT THIS REMOVES AND WHY. `public.funds` held 25 hand-written rows carrying
// an invented 0-100 `fund_score`, an invented `score_label` ("Strong Buy"), an
// invented `fee_level`, invented trailing returns, and an `analyst_note` with
// invented trade attributions and an investment recommendation — all under REAL
// tickers. `/screener` rendered it until F7 rebuilt that route on
// `fund_profile_facts`. The code path is already gone (src/lib/data/,
// src/lib/db/schema/funds.ts, the demo UI chain and the demo enums were deleted
// on branch f7/screener-rebuild); this removes the DATA so it cannot be revived
// by a future accessor, which is the acceptance criterion: after `--apply`,
// `SELECT to_regclass('public.funds')` returns NULL.
//
// SCOPE. Local dev only. `funds` is NOT a serving table — it has no DDL in
// fund_score's scripts/pipeline/apply_serving_schema.py — so `npm run
// db:check-serving` is unaffected, no fund_score change is implied, and prod
// (Supabase henxcsknsjfadetomjeu, which holds only waitlist_signups +
// early_access) never carried it. The D1 serving-load runbook needs no change.
//
// It also drops the five demo-era enum TYPES that existed only for that table:
// score_label, fee_level, attribution_type, trade_action, trade_outcome. The one
// enum the serving mirror uses, asset_class_code, is deliberately NOT touched.
//
// Refuses to run against anything but a local database unless
// ALLOW_NONLOCAL_DROP=1 is set — a fabricated-data cleanup should never be the
// thing that fires a DROP at a remote host by accident.
// ============================================================================
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (and .env.local has none).");
  process.exit(2);
}

const host = new URL(url.replace(/^postgres(ql)?:/, "http:")).hostname;
const isLocal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!isLocal && process.env.ALLOW_NONLOCAL_DROP !== "1") {
  console.error(
    `REFUSING: ${host} is not a local database. This drops a table; set ALLOW_NONLOCAL_DROP=1 if you truly mean it.`,
  );
  process.exit(2);
}

const DEMO_TYPES = [
  "score_label",
  "fee_level",
  "attribution_type",
  "trade_action",
  "trade_outcome",
];

// The demo-era CHILD tables are DISCOVERED, not hard-coded. `funds` cannot be
// dropped while FK constraints point at it, and the first --apply attempts failed
// twice (2026-08-26) because Postgres reports dependents INCREMENTALLY — the error
// named 5, then 3 more. Guessing from error text converged slowly and would have
// left tables behind; querying the constraint graph is exact and stays correct if
// the schema changes. Measured at the time of writing: 13 children, 14,078 rows,
// the largest being monthly_returns (12,000).
//
// They are the same fabricated seed as `funds` itself: `stock_picks` (250) and
// `sector_bets` (220) are what the invented "batting average of 50.8%" and
// "Recent successes include ServiceNow Inc. (+23.9%)" prose in `funds.analyst_note`
// was dressed up from. Verified before dropping: none appears in
// src/lib/db/schema/ (the mirror carries only enums/index/ops/serving/waitlist)
// and no snake_case name or camelCase accessor appears in src/ or scripts/. Note
// `holdings` here is the 250-row DEMO table, NOT the 1.4M-row serving table
// `fund_holdings_full` — different table, and the serving one is untouched.
//
// Dropped children-first rather than with CASCADE: a CASCADE drops the
// CONSTRAINTS and leaves the child TABLES behind, which is half a cleanup.
async function discoverChildren(sql) {
  const rows = await sql`
    SELECT tc.table_name AS child
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'funds'
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => r.child);
}

const sql = postgres(url, { max: 1, prepare: false });
let exitCode = 0;
try {
  const [{ t }] = await sql`SELECT to_regclass('public.funds')::text AS t`;
  const types = await sql`
    SELECT typname FROM pg_type WHERE typname = ANY(${DEMO_TYPES})`;

  console.log(`database: ${host}`);
  console.log(`  public.funds        : ${t ?? "absent"}`);
  if (t) {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM public.funds`;
    console.log(`  rows                : ${n}`);
  }
  console.log(
    `  demo enum types     : ${types.length ? types.map((r) => r.typname).join(", ") : "none"}`,
  );

  const children = await discoverChildren(sql);
  let childRows = 0;
  for (const child of children) {
    const [{ n }] = await sql.unsafe(`SELECT count(*)::int AS n FROM public.${child}`);
    childRows += n;
    console.log(`  ${child.padEnd(22)}: ${n} rows`);
  }
  console.log(`  ${"(children total)".padEnd(22)}: ${children.length} tables, ${childRows} rows`);

  if (!apply) {
    console.log("\ndry run — nothing changed. Re-run with --apply to drop.");
  } else {
    await sql.begin(async (tx) => {
      // children first. Same transaction, so this is all-or-nothing: a failure
      // leaves the demo cluster exactly as it was.
      for (const child of children) {
        await tx.unsafe(`DROP TABLE IF EXISTS public.${child}`);
      }
      await tx`DROP TABLE IF EXISTS public.funds`;
      for (const type of DEMO_TYPES) {
        await tx.unsafe(`DROP TYPE IF EXISTS ${type}`);
      }
    });
    const [{ after }] = await sql`SELECT to_regclass('public.funds')::text AS after`;
    const leftover = await sql`
      SELECT typname FROM pg_type WHERE typname = ANY(${DEMO_TYPES})`;
    console.log(`\nafter: to_regclass('public.funds') = ${after ?? "NULL"}`);
    console.log(
      `after: demo enum types = ${leftover.length ? leftover.map((r) => r.typname).join(", ") : "none"}`,
    );
    if (after !== null || leftover.length > 0) {
      console.error("FAILED — the legacy surface is still present.");
      exitCode = 1;
    } else {
      console.log("OK — the fabricated demo table and its enums are gone.");
    }
  }
} finally {
  await sql.end();
}
process.exit(exitCode);
