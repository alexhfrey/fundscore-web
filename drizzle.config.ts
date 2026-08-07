import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { refuseIfSchemaMutatingCommand } from "./scripts/db-push-guard.cjs";

config({ path: ".env.local" });

// Refuse `drizzle-kit push` / `migrate` HERE, not in an npm script. drizzle-kit
// loads this config in-process for every subcommand, so the guard applies to a
// direct `npx drizzle-kit push` too — swapping the npm script alone left the
// binary a step away from re-creating all six serving tables with RLS off.
// Read-only subcommands (export, studio, generate, check) pass through.
refuseIfSchemaMutatingCommand(process.argv);

// Drizzle owns NO table in this project. Every one has a dedicated, idempotent
// apply script that expresses what Drizzle cannot — grants, RLS, policies, FKs
// into the auth schema, triggers:
//
//   serving tables      fund_score scripts/pipeline/apply_serving_schema.py
//   users, entitlements fund_score scripts/pipeline/apply_auth_schema.py
//   lenses, snapshots   scripts/apply-lens-schema.mjs
//   ops_*               scripts/apply-ops-schema.mjs
//   waitlist_signups    scripts/apply-waitlist-schema.mjs
//   early_access        scripts/apply-early-access-schema.mjs
//
// `drizzle-kit push` is therefore DISABLED, by the guard above and by the
// `npm run db:push` script — both print the one message in
// scripts/db-push-guard.cjs. Measured 2026-08-07: push against an empty database
// happily creates all six serving tables with RLS OFF, and `tablesFilter` does
// NOT prevent it (it only filters what push READS back). This config exists for
// db:studio and for `drizzle-kit export`, which is how db:check-serving reads the
// mirror. Verify a live database with `npm run db:check-serving`.
export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
