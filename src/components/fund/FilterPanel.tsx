"use client";

import { ASSET_CLASSES, CATEGORIES } from "@/lib/constants";
import { FundFilters } from "@/lib/utils/search";

interface FilterPanelProps {
  filters: FundFilters;
  onFilterChange: (key: keyof FundFilters, value: string | number | undefined) => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
}

export function FilterPanel({
  filters,
  onFilterChange,
  onClear,
  resultCount,
  totalCount,
}: FilterPanelProps) {
  const hasFilters =
    filters.assetClass ||
    filters.category ||
    filters.scoreMin !== undefined ||
    filters.scoreMax !== undefined ||
    filters.expenseRatioMax !== undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
        {hasFilters && (
          <button
            onClick={onClear}
            className="text-xs text-[#1466b8] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.assetClass || ""}
          onChange={(e) => onFilterChange("assetClass", e.target.value || undefined)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1466b8] focus:border-transparent"
        >
          <option value="">All Asset Classes</option>
          {ASSET_CLASSES.map((ac) => (
            <option key={ac} value={ac}>
              {ac}
            </option>
          ))}
        </select>

        <select
          value={filters.category || ""}
          onChange={(e) => onFilterChange("category", e.target.value || undefined)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1466b8] focus:border-transparent"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={
            filters.scoreMin !== undefined
              ? `${filters.scoreMin}-${filters.scoreMax || 100}`
              : ""
          }
          onChange={(e) => {
            if (!e.target.value) {
              onFilterChange("scoreMin", undefined);
              onFilterChange("scoreMax", undefined);
            } else {
              const [min, max] = e.target.value.split("-").map(Number);
              onFilterChange("scoreMin", min);
              onFilterChange("scoreMax", max);
            }
          }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1466b8] focus:border-transparent"
        >
          <option value="">Any Score</option>
          <option value="75-100">Strong Buy (75+)</option>
          <option value="60-100">Buy+ (60+)</option>
          <option value="40-59">Hold (40-59)</option>
          <option value="0-39">Underperform (&lt;40)</option>
        </select>

        <select
          value={filters.expenseRatioMax !== undefined ? String(filters.expenseRatioMax) : ""}
          onChange={(e) =>
            onFilterChange(
              "expenseRatioMax",
              e.target.value ? Number(e.target.value) : undefined
            )
          }
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1466b8] focus:border-transparent"
        >
          <option value="">Any Expense Ratio</option>
          <option value="0.25">Under 0.25%</option>
          <option value="0.50">Under 0.50%</option>
          <option value="0.75">Under 0.75%</option>
          <option value="1.00">Under 1.00%</option>
        </select>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Showing {resultCount} of {totalCount} funds
      </p>
    </div>
  );
}
