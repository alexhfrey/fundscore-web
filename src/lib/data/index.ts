import { eq, ilike, or, and, gte, lte } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import type { FundSummary } from "../types";
import type { FundRow } from "../db/schema/funds";

export interface FundFilters {
  assetClass?: string;
  peerGroup?: string;
  scoreMin?: number;
  scoreMax?: number;
  expenseRatioMax?: number;
}

function rowToSummary(row: FundRow): FundSummary {
  return {
    ticker: row.ticker,
    name: row.name,
    assetClass: row.assetClass,
    geography: row.geography,
    focus: row.focus,
    size: row.size,
    peerGroup: row.peerGroup,
    fundScore: row.fundScore,
    scoreLabel: row.scoreLabel,
    passiveAltTicker: row.passiveAltTicker,
    passiveAltName: row.passiveAltName,
    nav: row.nav,
    ytdReturn: row.ytdReturn,
    oneYearReturn: row.oneYearReturn,
    threeYearReturn: row.threeYearReturn,
    fiveYearReturn: row.fiveYearReturn,
    tenYearReturn: row.tenYearReturn,
    expenseRatio: row.expenseRatio,
    aum: row.aum,
  };
}

export async function getFundSummaries(): Promise<FundSummary[]> {
  const rows = await db.select().from(schema.funds);
  return rows.map(rowToSummary);
}

export async function getFundByTicker(
  ticker: string
): Promise<FundSummary | null> {
  const [row] = await db
    .select()
    .from(schema.funds)
    .where(eq(schema.funds.ticker, ticker.toUpperCase()));

  if (!row) return null;

  return rowToSummary(row);
}

export async function searchFunds(
  query: string,
  filters?: FundFilters
): Promise<FundSummary[]> {
  const conditions = [];

  if (query.trim()) {
    const q = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(schema.funds.name, q),
        ilike(schema.funds.ticker, q),
        ilike(schema.funds.peerGroup, q)
      )
    );
  }

  if (filters?.assetClass) {
    conditions.push(
      eq(
        schema.funds.assetClass,
        filters.assetClass as (typeof schema.funds.assetClass.enumValues)[number]
      )
    );
  }
  if (filters?.peerGroup) {
    conditions.push(
      ilike(schema.funds.peerGroup, `${filters.peerGroup}%`)
    );
  }
  if (filters?.scoreMin !== undefined) {
    conditions.push(gte(schema.funds.fundScore, filters.scoreMin));
  }
  if (filters?.scoreMax !== undefined) {
    conditions.push(lte(schema.funds.fundScore, filters.scoreMax));
  }
  if (filters?.expenseRatioMax !== undefined) {
    conditions.push(lte(schema.funds.expenseRatio, filters.expenseRatioMax));
  }

  const rows = await db
    .select()
    .from(schema.funds)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(rowToSummary);
}

export async function autocompleteFunds(
  query: string
): Promise<{ ticker: string; name: string }[]> {
  if (!query.trim()) return [];
  const q = `%${query.trim()}%`;
  const rows = await db
    .select({ ticker: schema.funds.ticker, name: schema.funds.name })
    .from(schema.funds)
    .where(or(ilike(schema.funds.name, q), ilike(schema.funds.ticker, q)))
    .limit(8);
  return rows;
}
