"use client";

import { FundSummary } from "@/lib/types";
import { useFundSearch } from "@/hooks";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterPanel } from "./FilterPanel";
import { FundTable } from "./FundTable";

interface FundScreenerProps {
  funds: FundSummary[];
}

export function FundScreener({ funds }: FundScreenerProps) {
  const {
    query,
    setQuery,
    filters,
    updateFilter,
    clearFilters,
    results,
    totalCount,
  } = useFundSearch(funds);

  return (
    <div className="space-y-4">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by fund name, ticker, or category..."
        className="max-w-xl"
      />
      <FilterPanel
        filters={filters}
        onFilterChange={updateFilter}
        onClear={() => {
          clearFilters();
        }}
        resultCount={results.length}
        totalCount={totalCount}
      />
      <FundTable funds={results} />
    </div>
  );
}
