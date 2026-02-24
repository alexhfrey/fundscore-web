import { FundSummary, FundDetail, ModelBacktest } from "../types";
import {
  getAllFunds,
  getFundSummaries as getSummaries,
} from "./funds";
import { getModelStats as getModel } from "./model";
import { searchFundsList, autocompleteFundsList, FundFilters } from "../utils/search";

export type { FundFilters };

export function getFundSummaries(): FundSummary[] {
  return getSummaries();
}

export function searchFunds(
  query: string,
  filters?: FundFilters
): FundSummary[] {
  return searchFundsList(getSummaries(), query, filters);
}

export function getFundByTicker(ticker: string): FundDetail | null {
  const funds = getAllFunds();
  return (
    funds.find((f) => f.ticker.toLowerCase() === ticker.toLowerCase()) || null
  );
}

export function compareFunds(tickers: string[]): FundDetail[] {
  const funds = getAllFunds();
  return tickers
    .map((t) => funds.find((f) => f.ticker.toLowerCase() === t.toLowerCase()))
    .filter((f): f is FundDetail => f !== null);
}

export function autocompleteFunds(
  query: string
): { ticker: string; name: string }[] {
  return autocompleteFundsList(getSummaries(), query);
}

export function getModelStats(): ModelBacktest {
  return getModel();
}
