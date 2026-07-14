// Apply the pre-launch waitlist table to local/remote Supabase.
// Idempotent + non-interactive (drizzle push is gated/hangs against Supabase's
// pooler — same rationale as apply-lens-schema.mjs). Mirrors
// src/lib/db/schema/waitlist.ts.
//
// SECURITY: Supabase exposes every `public` table through PostgREST under the
// anon key. Signup emails must never be readable that way, so the table gets
// RLS enabled with NO policies (deny-all for anon/authenticated) and its grants
// revoked. The server action writes over the direct postgres connection, whose
// role bypasses RLS — so writes keep working while the REST surface stays shut.
//
//   node scripts/apply-waitlist-schema.mjs
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const sql = postgres(url);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS public.waitlist_signups (
     id          serial PRIMARY KEY,
     email       varchar(320) NOT NULL UNIQUE,
     source      text,
     created_at  timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS waitlist_signups_created_at_idx
     ON public.waitlist_signups (created_at)`,
  // Deny-all to the API roles: RLS on, zero policies.
  `ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY`,
  `REVOKE ALL ON public.waitlist_signups FROM anon, authenticated`,
  `REVOKE ALL ON SEQUENCE public.waitlist_signups_id_seq FROM anon, authenticated`,
];

try {
  for (const stmt of STATEMENTS) {
    await sql.unsafe(stmt);
  }

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='waitlist_signups'
    ORDER BY ordinal_position`;
  console.log("waitlist_signups cols:", cols.map((r) => r.column_name).join(", "));

  const rls = await sql`
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.waitlist_signups'::regclass`;
  const pol = await sql`
    SELECT count(*)::int AS n FROM pg_policies
    WHERE schemaname='public' AND tablename='waitlist_signups'`;
  console.log(
    `RLS enabled: ${rls[0].relrowsecurity}, policies: ${pol[0].n} (0 = deny-all to anon)`,
  );

  const n = await sql`SELECT count(*)::int AS n FROM public.waitlist_signups`;
  console.log("rows:", n[0].n);
  console.log("waitlist schema applied.");
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
