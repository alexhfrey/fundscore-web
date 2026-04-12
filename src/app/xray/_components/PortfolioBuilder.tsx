"use client";

import { useState } from "react";
import type { FundSummary } from "@/lib/types";
import type { AllocationMode } from "@/lib/utils/portfolio";
import { SearchInput } from "@/components/ui/SearchInput";
import { autocompleteFundsList } from "@/lib/utils/search";

interface PortfolioBuilderProps {
  allFunds: FundSummary[];
  selectedTickers: string[];
  allocations: Map<string, number>;
  allocationMode: AllocationMode;
  onAddFund: (ticker: string) => void;
  onRemoveFund: (ticker: string) => void;
  onAllocationChange: (ticker: string, amount: number) => void;
  onModeChange: (mode: AllocationMode) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

export function PortfolioBuilder({
  allFunds,
  selectedTickers,
  allocations,
  allocationMode,
  onAddFund,
  onRemoveFund,
  onAllocationChange,
  onModeChange,
  onAnalyze,
  isLoading,
}: PortfolioBuilderProps) {
  const [query, setQuery] = useState("");

  const suggestions =
    query.length > 0
      ? autocompleteFundsList(allFunds, query).filter(
          (f) => !selectedTickers.includes(f.ticker),
        )
      : [];

  const total = selectedTickers.reduce(
    (s, t) => s + (allocations.get(t) ?? 0),
    0,
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
      {/* Header with privacy badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Build Your Portfolio
        </h2>
        <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Nothing is saved
        </span>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-0">
        <button
          onClick={() => onModeChange("dollar")}
          className={`px-4 py-2 text-sm font-medium rounded-l-lg border transition-colors ${
            allocationMode === "dollar"
              ? "bg-[#1466b8] text-white border-[#1466b8]"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          $ Amount
        </button>
        <button
          onClick={() => onModeChange("percent")}
          className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b transition-colors ${
            allocationMode === "percent"
              ? "bg-[#1466b8] text-white border-[#1466b8]"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          % Allocation
        </button>
      </div>

      {/* Fund search */}
      {selectedTickers.length < 6 && (
        <div className="relative">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={`Search funds to add (${selectedTickers.length}/6)...`}
            className="max-w-md"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => {
                    onAddFund(s.ticker);
                    setQuery("");
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                >
                  <span className="font-semibold text-gray-900">
                    {s.ticker}
                  </span>
                  <span className="text-gray-500 ml-2">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Allocation rows */}
      {selectedTickers.length > 0 && (
        <div className="space-y-2">
          {selectedTickers.map((ticker) => {
            const fund = allFunds.find((f) => f.ticker === ticker);
            return (
              <div
                key={ticker}
                className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-900">{ticker}</span>
                  {fund && (
                    <span className="text-gray-500 text-sm ml-2 hidden sm:inline">
                      {fund.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">
                    {allocationMode === "dollar" ? "$" : ""}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={allocationMode === "dollar" ? 1000 : 1}
                    value={allocations.get(ticker) ?? 0}
                    onChange={(e) =>
                      onAllocationChange(
                        ticker,
                        Math.max(0, Number(e.target.value)),
                      )
                    }
                    className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1466b8] focus:border-[#1466b8]"
                  />
                  <span className="text-sm text-gray-400">
                    {allocationMode === "percent" ? "%" : ""}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveFund(ticker)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            );
          })}

          {/* Total */}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
            <span className="text-gray-500">
              Total:{" "}
              {allocationMode === "dollar"
                ? `$${total.toLocaleString("en-US")}`
                : `${total.toFixed(0)}%`}
            </span>
            {allocationMode === "percent" && Math.abs(total - 100) > 0.5 && (
              <span className="text-amber-600 text-xs">
                Allocations will be normalized to 100%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Analyze button */}
      <button
        onClick={onAnalyze}
        disabled={selectedTickers.length === 0 || isLoading}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-colors ${
          selectedTickers.length === 0 || isLoading
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-[#1466b8] hover:bg-[#0f4f8c] text-white"
        }`}
      >
        {isLoading ? "Analyzing..." : "Analyze Portfolio"}
      </button>
    </div>
  );
}
