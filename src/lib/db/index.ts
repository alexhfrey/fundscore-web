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
