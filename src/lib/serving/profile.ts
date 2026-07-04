import { eq } from "drizzle-orm";
import { db } from "../db";
import { fundProfileFacts } from "../db/schema/serving";
import type { FactRow } from "./gating";

// ============================================================================
// Serving read for the /funds/[ticker] profile page.
// ----------------------------------------------------------------------------
// The DB read lives here; the pure, db-free tier-gating logic + types live in
// `./gating.ts` and are re-exported below so existing consumers keep importing
// them from `@/lib/serving/profile`. Splitting the gating logic out of this
// module keeps it importable (e.g. by the gating golden test) without dragging
// in a live Postgres client / DATABASE_URL via `../db`.
// ============================================================================

// Re-export the full gating surface (types + applyGates + helpers) so callers
// can continue to `import { ... } from "@/lib/serving/profile"`.
export * from "./gating";

/** Read the fact row for a ticker. Gating is applied separately. */
export async function getFundFactRow(ticker: string): Promise<FactRow | null> {
  const [row] = await db
    .select()
    .from(fundProfileFacts)
    .where(eq(fundProfileFacts.canonicalTicker, ticker.toUpperCase()))
    .limit(1);
  return (row as unknown as FactRow) ?? null;
}
