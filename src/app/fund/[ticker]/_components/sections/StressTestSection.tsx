"use client";

import { FundDetail } from "@/lib/types";
import {
  StressTestVisualizer,
  computeVerdict,
  CRISIS_DURATION_MONTHS,
} from "@/components/charts/StressTestVisualizer";

interface StressTestSectionProps {
  fund: FundDetail;
}

export function StressTestSection({ fund }: StressTestSectionProps) {
  const scenarios = fund.factorRisk.historicalScenarios;
  if (scenarios.length === 0) return null;

  // Overall verdict: how many crises did the fund earn its fees?
  const earnedCount = scenarios.filter((s) => {
    const months = CRISIS_DURATION_MONTHS[s.name] ?? 6;
    const { verdict } = computeVerdict(
      s.fundReturn,
      s.passiveAltReturn,
      fund.expenseRatio,
      months,
    );
    return verdict === "earned";
  }).length;

  const ratio = earnedCount / scenarios.length;
  const overall = getOverallVerdict(ratio);

  return (
    <div className="space-y-8">
      <StressTestVisualizer
        scenarios={scenarios}
        ticker={fund.ticker}
        passiveAltTicker={fund.passiveAltTicker}
        expenseRatio={fund.expenseRatio}
      />

      {/* Overall Verdict Card */}
      <div
        className={`${overall.bg} border ${overall.border} rounded-lg p-5 flex items-center gap-5`}
      >
        <div className="flex-shrink-0 text-center">
          <p className={`text-4xl font-black ${overall.text}`}>
            {earnedCount} of {scenarios.length}
          </p>
        </div>
        <div>
          <p className={`text-sm font-bold ${overall.text}`}>{overall.label}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            Historic crises where {fund.ticker} earned its fee premium over{" "}
            {fund.passiveAltTicker}.
          </p>
        </div>
      </div>
    </div>
  );
}

function getOverallVerdict(ratio: number): {
  label: string;
  bg: string;
  border: string;
  text: string;
} {
  if (ratio >= 0.67)
    return {
      label: "Consistent crisis protection",
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
    };
  if (ratio >= 0.34)
    return {
      label: "Inconsistent crisis protection",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
    };
  return {
    label: "Poor crisis protection",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  };
}
