// Apply the early-access allowlist table to local/remote Supabase.
// Idempotent + non-interactive (drizzle push hangs against Supabase's pooler —
// same rationale as apply-lens-schema.mjs / apply-waitlist-schema.mjs).
// Mirrors src/lib/db/schema/waitlist.ts.
//
// WHY THIS EXISTS: the pre-launch gate lets any SIGNED-IN user through, but
// Supabase signup is self-serve — so without an allowlist, "gated to logged-in
// users" means "gated to anyone willing to make an account". This table is the
// actual lock.
//
// RLS: a signed-in user may read ONLY their own row (that's all the middleware
// needs, to answer "am I allowed in?"). They must never be able to enumerate
// the allowlist. Nobody but the service role can write.
//
//   node scripts/apply-early-access-schema.mjs
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const sql = postgres(url);

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS public.early_access (
     id          serial PRIMARY KEY,
     email       varchar(320) NOT NULL UNIQUE,
     note        text,
     granted_at  timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS early_access_email_idx ON public.early_access (email)`,

  `ALTER TABLE public.early_access ENABLE ROW LEVEL SECURITY`,

  // Read-your-own-row only. The middleware asks "is MY email in here?" — it
  // never needs to see anyone else's, and an anon key must not enumerate it.
  `DROP POLICY IF EXISTS early_access_read_own ON public.early_access`,
  `CREATE POLICY early_access_read_own ON public.early_access
     FOR SELECT TO authenticated
     USING (lower(email) = lower(auth.jwt() ->> 'email'))`,

  // No INSERT/UPDATE/DELETE policy: writes are service-role / direct-connection
  // only. Granting access is deliberately an owner action, not a user action.
  `GRANT SELECT ON public.early_access TO authenticated`,
  `REVOKE ALL ON public.early_access FROM anon`,
];

try {
  for (const stmt of STATEMENTS) await sql.unsafe(stmt);

  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='early_access'
    ORDER BY ordinal_position`;
  console.log("early_access cols:", cols.map((r) => r.column_name).join(", "));

  const pol = await sql`
    SELECT policyname, cmd FROM pg_policies
    WHERE schemaname='public' AND tablename='early_access'`;
  console.log(
    "policies:",
    pol.map((p) => `${p.policyname}(${p.cmd})`).join(", ") || "none",
  );

  const n = await sql`SELECT count(*)::int AS n FROM public.early_access`;
  console.log("granted:", n[0].n);
  console.log("early-access schema applied.");
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
