"use client";

import { FundDetail } from "@/lib/types";
import { AlphaWaterfallChart } from "@/components/charts/AlphaWaterfallChart";

interface AlphaDecompositionProps {
  fund: FundDetail;
}

export function AlphaDecomposition({ fund }: AlphaDecompositionProps) {
  const { battingAverage, avgWinSize, avgLossSize } = fund.trading;
  const { expenseRatio } = fund.fees;

  const hitContribution = Math.round(battingAverage * avgWinSize);
  const missContribution = Math.round((1 - battingAverage) * avgLossSize);
  const grossAlpha = hitContribution - missContribution;
  const feeDrag = Math.round(expenseRatio * 100);
  const netAlpha = grossAlpha - feeDrag;

  const chartData = [
    {
      name: "Wins",
      invisible: 0,
      value: hitContribution,
      fill: "#16a34a",
    },
    {
      name: "Losses",
      invisible: grossAlpha,
      value: missContribution,
      fill: "#dc2626",
    },
    {
      name: "Gross Alpha",
      invisible: 0,
      value: grossAlpha,
      fill: "#1466b8",
    },
    {
      name: "Fees",
      invisible: netAlpha,
      value: feeDrag,
      fill: "#dc2626",
    },
    {
      name: "Net Alpha",
      invisible: 0,
      value: netAlpha,
      fill: netAlpha > 0 ? "#16a34a" : "#dc2626",
    },
  ];

  const interpretiveText =
    netAlpha > 0
      ? `After fees, this fund generates approximately +${netAlpha} bps of annual alpha — the manager's stock picks more than offset costs.`
      : `After fees, this fund loses approximately ${netAlpha} bps annually — trading gains don't fully cover costs.`;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Alpha Decomposition
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <AlphaWaterfallChart data={chartData} />
        <p className="mt-3 text-sm text-gray-600">{interpretiveText}</p>
      </div>
    </div>
  );
}
