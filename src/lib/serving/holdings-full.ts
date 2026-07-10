import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { fundHoldingsFull, fundProfileFacts } from "../db/schema/serving";
import { gateHoldingsFull, hasHoldingsFullList, holdingsFullEntitled } from "./gating";
import type { FactRow, UserState } from "./gating";
import type { HoldingRow, HoldingsFullTeaser } from "./profile-v2";

// ============================================================================
// Full-holdings serving read (serve-full-holdings).
// ----------------------------------------------------------------------------
// The DB access for the filed full-holdings list lives here (not in gating.ts,
// which stays db-free). Two reads:
//   • readHoldingsFullTeaser — the free count + as-of, off the PUBLIC holdings
//     section already on the fact row (no extra query). Present iff a list
//     exists (loader keeps gate ⇔ teaser coherent).
//   • getHoldingsFullRows — the paid rows from the long serving table, fetched
//     lazily when the drawer opens and gated server-side BEFORE the query so an
//     unentitled tier never even reads the rows.
// ============================================================================

/**
 * Read the free teaser (served count + as-of) for a fund's full-holdings list.
 * Keyed off the SAME `gates.holdings_full` marker the row gate uses (one source
 * of truth: present IFF rows exist) — NOT off the holdings JSON metadata — so a
 * fund is never teased with a list its drawer would fetch zero rows for. The
 * count/as-of are then read from the public holdings section; returns null when
 * there is no served list, or when the count metadata is missing (can't tease
 * without an N). No drawer and no locked teaser in that case.
 */
export function readHoldingsFullTeaser(row: FactRow): HoldingsFullTeaser | null {
  if (!hasHoldingsFullList(row.gates)) return null;
  const holdings = row.holdings;
  if (!holdings || typeof holdings !== "object") return null;
  const hf = (holdings as Record<string, unknown>)["holdings_full"];
  if (!hf || typeof hf !== "object") return null;
  const n = (hf as Record<string, unknown>).n_positions;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const asOf = (hf as Record<string, unknown>).as_of;
  return { n_positions: n, as_of: typeof asOf === "string" ? asOf : null };
}

/**
 * Lazily read the filed full-holdings rows for a fund, paid-gated server-side.
 *
 * The gate is enforced against the fact row's `gates.holdings_full` + the
 * caller's tier BEFORE the long-table read, so an unentitled tier triggers no
 * row read and zero rows leave the server. Rows come straight from the serving
 * table, AS FILED: ordered by filed-weight rank, no rescaling, no row filtering,
 * multi-line issuers kept separate. `sector` is null where the cusip join didn't
 * resolve; `ticker` is null for private/cash instruments — both surface honestly
 * in the UI (em-dash / name-first), never imputed.
 */
export async function getHoldingsFullRows(
  ticker: string,
  userState: UserState,
): Promise<HoldingRow[]> {
  const [fact] = await db
    .select({
      seriesId: fundProfileFacts.seriesId,
      gates: fundProfileFacts.gates,
    })
    .from(fundProfileFacts)
    .where(eq(fundProfileFacts.canonicalTicker, ticker.toUpperCase()))
    .limit(1);
  if (!fact) return [];

  const gates = fact.gates as Record<string, string>;
  // Gate before the row read: unentitled tiers (and funds with no list) stop here.
  if (!holdingsFullEntitled(gates, userState)) return [];

  const rows = await db
    .select({
      positionRank: fundHoldingsFull.positionRank,
      securityName: fundHoldingsFull.securityName,
      securityTicker: fundHoldingsFull.securityTicker,
      weightPct: fundHoldingsFull.weightPct,
      valueUsd: fundHoldingsFull.valueUsd,
      country: fundHoldingsFull.country,
      sector: fundHoldingsFull.sector,
      assetCat: fundHoldingsFull.assetCat,
    })
    .from(fundHoldingsFull)
    .where(eq(fundHoldingsFull.seriesId, fact.seriesId))
    .orderBy(asc(fundHoldingsFull.positionRank));

  const mapped: HoldingRow[] = rows.map((r) => ({
    position_id: r.positionRank,
    name: r.securityName,
    ticker: r.securityTicker,
    weight_pct: r.weightPct,
    value_usd: r.valueUsd,
    country: r.country,
    sector: r.sector,
    asset_cat: r.assetCat,
  }));

  // Belt-and-suspenders: re-run the same pure gate over the mapped rows so the
  // returned payload can never carry rows the tier isn't entitled to.
  return gateHoldingsFull(gates, userState, mapped);
}
