"use client";

import { useState, useCallback } from "react";
import type { FundSummary, FundDetail } from "@/lib/types";
import {
  type AllocationMode,
  type XRayResult,
  normalizeAllocations,
  computeXRay,
} from "@/lib/utils/portfolio";
import { fetchXRayFunds } from "../_actions";
import { PortfolioBuilder } from "./PortfolioBuilder";
import { XRayAnalysis } from "./XRayAnalysis";

interface XRayPageContentProps {
  allFunds: FundSummary[];
}

export function XRayPageContent({ allFunds }: XRayPageContentProps) {
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Map<string, number>>(
    new Map(),
  );
  const [allocationMode, setAllocationMode] =
    useState<AllocationMode>("percent");
  const [xrayResult, setXrayResult] = useState<XRayResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const showCollapsed = xrayResult !== null && !isLoading && !isEditing;

  const equalSplit = useCallback(
    (tickers: string[]) => {
      const map = new Map<string, number>();
      const perFund =
        allocationMode === "percent"
          ? Math.round(100 / Math.max(1, tickers.length))
          : 10000;
      for (const t of tickers) map.set(t, perFund);
      return map;
    },
    [allocationMode],
  );

  const handleAddFund = useCallback(
    (ticker: string) => {
      if (selectedTickers.length >= 6 || selectedTickers.includes(ticker))
        return;
      const next = [...selectedTickers, ticker];
      setSelectedTickers(next);
      setAllocations(equalSplit(next));
      setXrayResult(null);
    },
    [selectedTickers, equalSplit],
  );

  const handleRemoveFund = useCallback(
    (ticker: string) => {
      const next = selectedTickers.filter((t) => t !== ticker);
      setSelectedTickers(next);
      setAllocations(equalSplit(next));
      setXrayResult(null);
    },
    [selectedTickers, equalSplit],
  );

  const handleAllocationChange = useCallback(
    (ticker: string, amount: number) => {
      setAllocations((prev) => {
        const next = new Map(prev);
        next.set(ticker, amount);
        return next;
      });
    },
    [],
  );

  const handleModeChange = useCallback(
    (mode: AllocationMode) => {
      setAllocationMode(mode);
      const map = new Map<string, number>();
      const perFund =
        mode === "percent"
          ? Math.round(100 / Math.max(1, selectedTickers.length))
          : 10000;
      for (const t of selectedTickers) map.set(t, perFund);
      setAllocations(map);
    },
    [selectedTickers],
  );

  const handleAnalyze = useCallback(async () => {
    if (selectedTickers.length === 0) return;
    setIsEditing(false);
    setIsLoading(true);
    try {
      const funds = await fetchXRayFunds(selectedTickers);
      const weights = normalizeAllocations(allocations);
      const result = computeXRay(funds, weights);
      setXrayResult(result);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTickers, allocations]);

  return (
    <div className="space-y-6">
      {showCollapsed ? (
        <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const normalized = normalizeAllocations(allocations);
              return selectedTickers.map((ticker) => {
                const pct = Math.round((normalized.get(ticker) ?? 0) * 100);
                return (
                  <span
                    key={ticker}
                    className="bg-blue-50 text-blue-700 text-sm font-medium px-2 py-0.5 rounded-full"
                  >
                    {ticker} {pct}%
                  </span>
                );
              });
            })()}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-[#1466b8] hover:text-[#0f4f8c] font-medium"
          >
            Edit
          </button>
        </div>
      ) : (
        <PortfolioBuilder
          allFunds={allFunds}
          selectedTickers={selectedTickers}
          allocations={allocations}
          allocationMode={allocationMode}
          onAddFund={handleAddFund}
          onRemoveFund={handleRemoveFund}
          onAllocationChange={handleAllocationChange}
          onModeChange={handleModeChange}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
        />
      )}

      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1466b8]" />
          <p className="text-sm text-gray-400 mt-3">
            Analyzing your portfolio...
          </p>
        </div>
      )}

      {xrayResult && !isLoading && <XRayAnalysis result={xrayResult} />}

      {!xrayResult && !isLoading && selectedTickers.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-400 text-lg">
            Select funds and allocations above, then click &ldquo;Analyze
            Portfolio&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
