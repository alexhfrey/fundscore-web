// Apply the beta-ops tables (errors / feedback / pageviews) to local, preview
// or production Supabase. Idempotent + non-interactive — drizzle push hangs
// against Supabase's pooler and would try to reconcile every serving table
// (same rationale as apply-early-access-schema.mjs / apply-waitlist-schema.mjs).
// Mirrors src/lib/db/schema/ops.ts.
//
// WHY THIS EXISTS: before beta invites go out we need to see what beta users
// see. These three tables are the whole of it — one error sink, one feedback
// channel, one pageview counter — all first-party, so the beta is observable
// without provisioning a third-party DSN or API key.
//
// RLS: enabled with NO policy on any of the three. Writes go through the app's
// direct postgres.js connection (DATABASE_URL), which is not subject to RLS;
// the anon/authenticated roles get nothing at all. A beta user must never be
// able to read other users' feedback, errors or browsing history, and none of
// this data is ever needed client-side.
//
//   node scripts/apply-ops-schema.mjs
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const sql = postgres(url);

const TABLES = ["ops_error_events", "ops_feedback", "ops_pageviews"];

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS public.ops_error_events (
     id           serial PRIMARY KEY,
     occurred_at  timestamptz NOT NULL DEFAULT now(),
     source       varchar(16) NOT NULL,
     route        text,
     digest       varchar(128),
     message      text,
     stack        text,
     user_email   varchar(320),
     user_agent   text
   )`,
  `CREATE INDEX IF NOT EXISTS ops_error_events_occurred_at_idx
     ON public.ops_error_events (occurred_at)`,

  `CREATE TABLE IF NOT EXISTS public.ops_feedback (
     id           serial PRIMARY KEY,
     created_at   timestamptz NOT NULL DEFAULT now(),
     message      text NOT NULL,
     path         text,
     user_email   varchar(320),
     user_agent   text
   )`,
  `CREATE INDEX IF NOT EXISTS ops_feedback_created_at_idx
     ON public.ops_feedback (created_at)`,

  `CREATE TABLE IF NOT EXISTS public.ops_pageviews (
     id           serial PRIMARY KEY,
     viewed_at    timestamptz NOT NULL DEFAULT now(),
     path         text NOT NULL,
     referrer     text,
     user_email   varchar(320),
     user_agent   text
   )`,
  `CREATE INDEX IF NOT EXISTS ops_pageviews_viewed_at_idx
     ON public.ops_pageviews (viewed_at)`,
  `CREATE INDEX IF NOT EXISTS ops_pageviews_path_idx
     ON public.ops_pageviews (path)`,

  // Locked down: RLS on, no policies, no grants. Only the app's direct
  // connection (and the service role) can touch these.
  ...TABLES.flatMap((t) => [
    `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`,
    `REVOKE ALL ON public.${t} FROM anon`,
    `REVOKE ALL ON public.${t} FROM authenticated`,
  ]),
];

try {
  for (const stmt of STATEMENTS) await sql.unsafe(stmt);

  for (const t of TABLES) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${t}
      ORDER BY ordinal_position`;
    const n = await sql.unsafe(`SELECT count(*)::int AS n FROM public.${t}`);
    console.log(
      `${t}: ${cols.map((r) => r.column_name).join(", ")} (${n[0].n} rows)`,
    );
  }

  const pol = await sql`
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename = ANY(${TABLES})`;
  console.log(
    "policies:",
    pol.map((p) => `${p.tablename}.${p.policyname}`).join(", ") ||
      "none (intended — direct-connection writes only)",
  );

  console.log("ops schema applied.");
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
