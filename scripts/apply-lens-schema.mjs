// Apply the Lens save/share/change-tracking schema to local Supabase (T6).
// Idempotent + non-interactive (drizzle push is gated/hangs against Supabase's
// pooler, same rationale as fund_score's apply_*_schema.py). Mirrors schema.sql +
// src/lib/db/schema/serving.ts. Adds: lenses.lens_slug/note/change_tracking,
// the lens_snapshots table + RLS, and the get_shared_lens SECURITY-DEFINER RPC
// that serves the public shared read by slug.
//
//   node scripts/apply-lens-schema.mjs
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const sql = postgres(url);

const STATEMENTS = [
  // --- extend lenses (additive; existing rows keep defaults) ---
  `ALTER TABLE public.lenses ADD COLUMN IF NOT EXISTS lens_slug text`,
  `ALTER TABLE public.lenses ADD COLUMN IF NOT EXISTS note text`,
  `ALTER TABLE public.lenses ADD COLUMN IF NOT EXISTS change_tracking boolean NOT NULL DEFAULT true`,
  // backfill any pre-existing rows so the NOT NULL + UNIQUE can be enforced
  `UPDATE public.lenses SET lens_slug = COALESCE(lens_slug, slug || '-' || left(id::text, 8)) WHERE lens_slug IS NULL`,
  `ALTER TABLE public.lenses ALTER COLUMN lens_slug SET NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lenses_lens_slug_key ON public.lenses (lens_slug)`,
  `CREATE INDEX IF NOT EXISTS lenses_lens_slug_idx ON public.lenses (lens_slug)`,
  // --- lens_snapshots ---
  `CREATE TABLE IF NOT EXISTS public.lens_snapshots (
     id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     lens_id            uuid NOT NULL REFERENCES public.lenses(id) ON DELETE CASCADE,
     captured_at        timestamptz NOT NULL DEFAULT now(),
     result_as_of       text,
     member_count       integer NOT NULL,
     member_series_ids  jsonb NOT NULL,
     member_meta        jsonb NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS lens_snapshots_lens_id_idx ON public.lens_snapshots (lens_id)`,
  // --- RLS on snapshots (own through parent lens) ---
  `ALTER TABLE public.lens_snapshots ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS lens_snapshots_all_own ON public.lens_snapshots`,
  `CREATE POLICY lens_snapshots_all_own ON public.lens_snapshots FOR ALL
     USING (EXISTS (SELECT 1 FROM public.lenses l WHERE l.id = lens_snapshots.lens_id AND l.user_id = auth.uid()))
     WITH CHECK (EXISTS (SELECT 1 FROM public.lenses l WHERE l.id = lens_snapshots.lens_id AND l.user_id = auth.uid()))`,
  // --- public shared-lens read RPC (definition only; no owner id / note) ---
  `CREATE OR REPLACE FUNCTION public.get_shared_lens(p_lens_slug text)
   RETURNS TABLE (lens_slug text, slug text, name text, change_tracking boolean, definition jsonb, created_at timestamptz)
   LANGUAGE sql
   SECURITY DEFINER
   SET search_path = public
   AS $$
     SELECT l.lens_slug, l.slug, l.name, l.change_tracking, l.definition, l.created_at
     FROM public.lenses l
     WHERE l.lens_slug = p_lens_slug
     LIMIT 1;
   $$`,
  `GRANT EXECUTE ON FUNCTION public.get_shared_lens(text) TO anon, authenticated`,
];

try {
  for (const stmt of STATEMENTS) {
    await sql.unsafe(stmt);
  }
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lenses' ORDER BY ordinal_position`;
  console.log("lenses cols:", cols.map((r) => r.column_name).join(", "));
  const snap = await sql`SELECT to_regclass('public.lens_snapshots') AS t`;
  console.log("lens_snapshots:", snap[0].t);
  const fn = await sql`SELECT proname FROM pg_proc WHERE proname='get_shared_lens'`;
  console.log("get_shared_lens RPC:", fn.length ? "present" : "MISSING");
  console.log("lens schema applied.");
} catch (e) {
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
