import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Global singleton to prevent connection pool exhaustion during Next.js HMR
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

// `prepare: false` is REQUIRED in production: Vercel talks to Supabase through
// the TRANSACTION pooler (port 6543), which multiplexes many clients onto few
// backends and therefore cannot support session-scoped prepared statements —
// postgres.js would otherwise fail with "prepared statement already exists"
// under concurrency. It is harmless on a direct local connection (it only
// forgoes statement caching), so we set it unconditionally rather than branch.
const client =
  globalForDb.pgClient ?? postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });

/**
 * The database this process is actually pointed at, as `host:port/dbname` —
 * never the credentials. Exists so a failure can say WHICH database it could
 * not reach: `.env` precedence makes that genuinely ambiguous (Next loads
 * `.env.production.local` ahead of `.env.local`, so for a long time every local
 * `npm run build` silently opened queries against the production pooler).
 * `scripts/build.mjs` prints the same string before the build starts.
 */
export function describeDbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL is unset)";
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(DATABASE_URL is not a parseable URL)";
  }
}
