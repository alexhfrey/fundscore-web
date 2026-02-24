import { useState, useMemo } from "react";
import { useDebounce } from "./useDebounce";
import { FundSummary } from "@/lib/types";
import { searchFundsList, FundFilters } from "@/lib/utils/search";

export function useFundSearch(allFunds: FundSummary[]) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FundFilters>({});
  const debouncedQuery = useDebounce(query, 200);

  const results = useMemo(() => {
    return searchFundsList(allFunds, debouncedQuery, filters);
  }, [allFunds, debouncedQuery, filters]);

  const updateFilter = (key: keyof FundFilters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const clearFilters = () => {
    setFilters({});
    setQuery("");
  };

  return {
    query,
    setQuery,
    filters,
    updateFilter,
    clearFilters,
    results,
    totalCount: allFunds.length,
  };
}
