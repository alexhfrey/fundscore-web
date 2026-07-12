// ============================================================================
// Attribution-blocks serving read (attribution-factor-path-serving).
// ----------------------------------------------------------------------------
// The per-quarter factor path lives in the LONG fund_attribution_blocks table
// (one JSONB payload per fund; paid, presence-gated by gates.attribution_blocks
// — present IFF a payload exists). The v1 Attribution Explorer needs only the
// QUARTER GRID + window scaffolding for its pinned range control — the full
// factor_path (hundreds of rows) never leaves the server here. Gated
// server-side BEFORE the query (sectionEntitled, fail-closed), so an
// unentitled tier triggers no read at all.
// ============================================================================
import { eq } from "drizzle-orm";
import { db } from "../db";
import { fundAttributionBlocks } from "../db/schema/serving";
import { sectionEntitled } from "./gating";
import type { UserState } from "./gating";

export interface AttributionBlocksMeta {
  quarter_grid: string[];
  holdings_window: string | null;
}

/**
 * Read the quarter grid + holdings window off a fund's served attribution
 * blocks payload — nothing else. Returns null when the fund has no served
 * payload (gate absent), the caller is below the gate, or the payload is
 * malformed (fail closed, never a fabricated grid).
 */
export async function getAttributionBlocksMeta(
  ticker: string,
  gates: Record<string, string> | null | undefined,
  userState: UserState,
): Promise<AttributionBlocksMeta | null> {
  if (!sectionEntitled(gates, "attribution_blocks", userState)) return null;
  const [row] = await db
    .select({ payload: fundAttributionBlocks.payload })
    .from(fundAttributionBlocks)
    .where(eq(fundAttributionBlocks.canonicalTicker, ticker.toUpperCase()))
    .limit(1);
  const payload = row?.payload as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== "object") return null;
  const grid = Array.isArray(payload.quarter_grid)
    ? (payload.quarter_grid as unknown[]).filter((q): q is string => typeof q === "string")
    : [];
  const hw = payload.holdings_window;
  return {
    quarter_grid: grid,
    holdings_window: typeof hw === "string" ? hw : null,
  };
}
