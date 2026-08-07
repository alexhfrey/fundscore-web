#!/usr/bin/env node
// ============================================================================
// db:check-serving — is this database fit to serve THIS checkout of the app?
// ----------------------------------------------------------------------------
// The serving tables have exactly ONE authoritative definition: fund_score's
// scripts/pipeline/apply_serving_schema.py. This repo keeps a read-only typed
// mirror (src/lib/db/schema/serving.ts) so the app can query them, and that
// mirror is the thing that can silently drift — as it did until 2026-08-07,
// when `position_direction` was served for weeks but unreadable from the app
// because only the mirror had been forgotten.
//
// This is the post-load gate in docs/RUNBOOK-serving-load.md § 3.1, so its exit
// code has to mean "safe to serve". It fails, exit 1, on any of:
//
//   TABLE ABSENT      the app reads a table this database does not have
//                     (routes 500; /q/[slug] silently prerenders nothing)
//   MISSING IN DB     the app would query a column that isn't there
//   MISSING IN APP    the loader serves a column the app can't read
//   EXPOSED           anon/authenticated hold grants — these tables carry PAID
//                     payloads and the anon key ships to every browser
//
// Two named escape hatches, both OFF by default, for someone who knows they are
// looking at an intermediate state:
//   --allow-pending   a table whose DDL is on an unmerged branch may be absent
//   --allow-exposed   PostgREST grants may still be in place
// Neither is appropriate for a deployment you intend to serve traffic from.
//
//   npm run db:check-serving
//   DATABASE_URL='postgres://…' npm run db:check-serving
//   npm run db:check-serving -- --allow-pending
//
// Read-only against the database: SELECTs on catalog views, nothing else.
//
// The mirror's columns come from `drizzle-kit export --sql`, i.e. from Drizzle's
// OWN rendering of src/lib/db/schema/serving.ts. Two reasons: a checker that
// reads its own transcription of the schema checks nothing, and shelling out to
// drizzle-kit keeps this script on plain Node (importing the .ts directly needs
// Node 22.6+ type stripping, above this project's @types/node ^20 floor).
// ============================================================================
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import postgres from "postgres";
import { SERVING_TABLES, SERVING_TABLE_NAMES } from "./serving-tables.mjs";

config({ path: ".env.local" });

const allowPending = process.argv.includes("--allow-pending");
const allowExposed = process.argv.includes("--allow-exposed");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (and .env.local has none).");
  process.exit(2);
}

/** Columns the app's Drizzle mirror declares, per table, via drizzle-kit. */
function readMirror() {
  let sqlText;
  try {
    sqlText = execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["drizzle-kit", "export", "--sql"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (err) {
    console.error("Could not read the Drizzle schema via `drizzle-kit export`:");
    console.error(err.stderr?.toString() || err.message);
    process.exit(2);
  }
  const out = new Map();
  const re = /CREATE TABLE "(\w+)" \(([\s\S]*?)\n\);/g;
  for (const [, table, body] of sqlText.matchAll(re)) {
    if (!SERVING_TABLE_NAMES.includes(table)) continue;
    const cols = [];
    for (const line of body.split("\n")) {
      const m = line.trim().match(/^"([a-z_][a-z0-9_]*)"\s+\S/);
      if (m) cols.push(m[1]);
    }
    out.set(table, cols.sort());
  }
  return out;
}

const mirror = readMirror();
const sql = postgres(url, { max: 1, prepare: false });
const failures = [];
const warnings = [];

try {
  const host = new URL(url.replace(/^postgres(ql)?:/, "http:")).host;
  console.log(`serving-schema parity — mirror vs ${host}`);
  const relaxed = [
    allowPending ? "--allow-pending" : null,
    allowExposed ? "--allow-exposed" : null,
  ].filter(Boolean);
  console.log(
    relaxed.length
      ? `mode: RELAXED (${relaxed.join(" ")}) — not a serve-ready verdict\n`
      : "mode: strict (any absence, drift or exposure fails)\n",
  );

  const dbCols = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ${sql(SERVING_TABLE_NAMES)}
  `;
  const byTable = new Map();
  for (const r of dbCols) {
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
    byTable.get(r.table_name).push(r.column_name);
  }

  for (const spec of SERVING_TABLES) {
    const { table, readBy, upstream } = spec;
    const declared = mirror.get(table);
    const actual = byTable.get(table)?.sort();

    if (!actual) {
      // Absent is a FAILURE: this checkout's code reads the table, so the
      // deployment is broken whatever the state of the other repo. `upstream`
      // only makes the failure actionable — it is never an excuse.
      const lines = [`      reads: ${readBy}`];
      if (upstream) {
        lines.push(
          `      DDL is on \`${upstream.branch}\` (${upstream.commit}), not on fund_score main —`,
          `      merge it and re-run apply_serving_schema.py against this database.`,
        );
      } else {
        lines.push("      run fund_score's apply_serving_schema.py against this database.");
      }
      if (upstream && allowPending) {
        warnings.push(table);
        console.log(`  ~ ${table}: TABLE ABSENT — downgraded by --allow-pending`);
        lines.forEach((l) => console.log(l));
        console.log("      This database CANNOT serve those routes.");
      } else {
        failures.push(table);
        console.log(`  ✗ ${table}: TABLE ABSENT`);
        lines.forEach((l) => console.log(l));
      }
      continue;
    }
    if (!declared) {
      failures.push(table);
      console.log(`  ✗ ${table}: no Drizzle mirror in schema/serving.ts (${actual.length} cols in db)`);
      continue;
    }
    const missingInApp = actual.filter((c) => !declared.includes(c));
    const missingInDb = declared.filter((c) => !actual.includes(c));
    if (missingInApp.length === 0 && missingInDb.length === 0) {
      console.log(`  ✓ ${table}: ${actual.length} columns match`);
      continue;
    }
    failures.push(table);
    console.log(`  ✗ ${table}:`);
    if (missingInDb.length)
      console.log(`      MISSING IN DB  (app would query, db lacks): ${missingInDb.join(", ")}`);
    if (missingInApp.length)
      console.log(`      MISSING IN APP (db serves, mirror lacks):   ${missingInApp.join(", ")}`);
  }

  // PostgREST exposure. A FAILURE by default: these tables carry paid payloads,
  // the anon key is public, and a grant without a restricting policy means
  // anyone can read them — or, with RLS off, TRUNCATE them.
  const exposure = await sql`
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls,
           EXISTS (
             SELECT 1 FROM information_schema.role_table_grants g
             WHERE g.table_schema = 'public' AND g.table_name = c.relname
               AND g.grantee IN ('anon', 'authenticated')
           ) AS granted
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname IN ${sql(SERVING_TABLE_NAMES)}
  `;
  const exposed = exposure.filter((r) => r.granted);
  console.log("");
  if (exposed.length === 0) {
    console.log("  ✓ PostgREST: no anon/authenticated grants on any serving table");
  } else {
    const detail = exposed
      .map((r) => `${r.table_name}${r.rls ? "" : " (RLS OFF)"}`)
      .join(", ");
    const explain = [
      "      These tables carry PAID payloads and the anon key ships to every browser.",
      "      `(RLS OFF)` additionally means anon can INSERT/UPDATE/DELETE/TRUNCATE.",
      "      Fixed by apply_serving_schema.py — but only once `feat/h1-serving-ddl-authority`",
      "      (1f3d91f) is merged into fund_score main. Note apply_auth_schema.py on main",
      "      RE-CREATES the public read policies after apply_serving_schema.py runs.",
    ];
    if (allowExposed) {
      warnings.push("postgrest-exposure");
      console.log(`  ~ PostgREST EXPOSED: ${detail} — downgraded by --allow-exposed`);
      explain.forEach((l) => console.log(l));
    } else {
      failures.push("postgrest-exposure");
      console.log(`  ✗ PostgREST EXPOSED: ${detail}`);
      explain.forEach((l) => console.log(l));
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}

console.log("");
if (failures.length > 0) {
  console.log(`FAIL — ${failures.length} problem(s): ${failures.join(", ")}.`);
  console.log("This database is NOT fit to serve this checkout of the app.");
  console.log("Schema fixes go in fund_score scripts/pipeline/apply_serving_schema.py (the");
  console.log("authority), then get mirrored into src/lib/db/schema/serving.ts. Never the");
  console.log("other way round.");
  process.exit(1);
}
if (warnings.length > 0) {
  console.log(`PASS-RELAXED — ${warnings.length} failure(s) suppressed by flag: ${warnings.join(", ")}.`);
  console.log("This is NOT a serve-ready verdict. Re-run without the flags before the load");
  console.log("is considered done.");
  process.exit(0);
}
console.log("PASS — mirror matches the database and nothing is exposed.");
