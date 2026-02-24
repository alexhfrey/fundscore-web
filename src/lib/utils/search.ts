import { FundSummary } from "../types";

export interface FundFilters {
  assetClass?: string;
  category?: string;
  scoreMin?: number;
  scoreMax?: number;
  expenseRatioMax?: number;
}

export function searchFundsList(
  funds: FundSummary[],
  query: string,
  filters?: FundFilters
): FundSummary[] {
  let results = [...funds];

  if (query.trim()) {
    const q = query.toLowerCase().trim();
    results = results.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.ticker.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }

  if (filters) {
    if (filters.assetClass) {
      results = results.filter((f) => f.assetClass === filters.assetClass);
    }
    if (filters.category) {
      results = results.filter((f) => f.category === filters.category);
    }
    if (filters.scoreMin !== undefined) {
      results = results.filter((f) => f.fundScore >= filters.scoreMin!);
    }
    if (filters.scoreMax !== undefined) {
      results = results.filter((f) => f.fundScore <= filters.scoreMax!);
    }
    if (filters.expenseRatioMax !== undefined) {
      results = results.filter(
        (f) => f.expenseRatio <= filters.expenseRatioMax!
      );
    }
  }

  return results;
}

export function autocompleteFundsList(
  funds: FundSummary[],
  query: string
): { ticker: string; name: string }[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return funds
    .filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.ticker.toLowerCase().includes(q)
    )
    .slice(0, 8)
    .map((f) => ({ ticker: f.ticker, name: f.name }));
}
