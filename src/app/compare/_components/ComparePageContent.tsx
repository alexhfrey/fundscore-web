"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FundSummary, FundDetail } from "@/lib/types";
import { fetchCompareFunds } from "../_actions";
import { FundSelector } from "./FundSelector";
import { ComparisonChart } from "./ComparisonChart";
import { ComparisonTable } from "./ComparisonTable";

interface ComparePageContentProps {
  allFunds: FundSummary[];
}

export function ComparePageContent({ allFunds }: ComparePageContentProps) {
  const searchParams = useSearchParams();
  const initialTickers = searchParams.get("funds")?.split(",").filter(Boolean) || [];

  const [selectedTickers, setSelectedTickers] = useState<string[]>(
    initialTickers.slice(0, 4)
  );
  const [selectedFunds, setSelectedFunds] = useState<FundDetail[]>([]);

  useEffect(() => {
    if (selectedTickers.length === 0) {
      setSelectedFunds([]);
      return;
    }
    fetchCompareFunds(selectedTickers).then(setSelectedFunds);
  }, [selectedTickers]);

  const addFund = (ticker: string) => {
    if (selectedTickers.length >= 4) return;
    if (selectedTickers.includes(ticker)) return;
    setSelectedTickers((prev) => [...prev, ticker]);
  };

  const removeFund = (ticker: string) => {
    setSelectedTickers((prev) => prev.filter((t) => t !== ticker));
  };

  return (
    <div className="space-y-6">
      <FundSelector
        allFunds={allFunds}
        selectedTickers={selectedTickers}
        onAdd={addFund}
        onRemove={removeFund}
        maxFunds={4}
      />

      {selectedFunds.length >= 2 && (
        <>
          <ComparisonChart funds={selectedFunds} />
          <ComparisonTable funds={selectedFunds} />
        </>
      )}

      {selectedFunds.length < 2 && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-400 text-lg">
            Select at least 2 funds to compare
          </p>
        </div>
      )}
    </div>
  );
}
