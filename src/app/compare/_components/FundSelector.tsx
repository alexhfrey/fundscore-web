"use client";

import { useState } from "react";
import { FundSummary } from "@/lib/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { autocompleteFundsList } from "@/lib/utils/search";

interface FundSelectorProps {
  allFunds: FundSummary[];
  selectedTickers: string[];
  onAdd: (ticker: string) => void;
  onRemove: (ticker: string) => void;
  maxFunds: number;
}

export function FundSelector({
  allFunds,
  selectedTickers,
  onAdd,
  onRemove,
  maxFunds,
}: FundSelectorProps) {
  const [query, setQuery] = useState("");

  const suggestions =
    query.length > 0
      ? autocompleteFundsList(allFunds, query).filter(
          (f) => !selectedTickers.includes(f.ticker)
        )
      : [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap gap-2 mb-3">
        {selectedTickers.map((ticker) => {
          const fund = allFunds.find((f) => f.ticker === ticker);
          return (
            <span
              key={ticker}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full"
            >
              <span className="font-bold">{ticker}</span>
              {fund && (
                <span className="text-blue-500 hidden sm:inline">
                  {fund.name}
                </span>
              )}
              <button
                onClick={() => onRemove(ticker)}
                className="ml-1 hover:text-blue-900"
              >
                <svg
                  className="w-3.5 h-3.5"
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
            </span>
          );
        })}
      </div>

      {selectedTickers.length < maxFunds && (
        <div className="relative">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={`Add fund (${selectedTickers.length}/${maxFunds})...`}
            className="max-w-sm"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => {
                    onAdd(s.ticker);
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
    </div>
  );
}
