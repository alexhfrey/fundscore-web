"use client";

import { FundDetail } from "@/lib/types";
import {
  AlphaWaterfallChart,
  WaterfallDataPoint,
} from "@/components/charts/AlphaWaterfallChart";

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

  const chartData: WaterfallDataPoint[] = [
    { name: "Wins", start: 0, end: hitContribution, fill: "#16a34a" },
    {
      name: "Losses",
      start: hitContribution,
      end: grossAlpha,
      fill: "#dc2626",
    },
    {
      name: "Gross Alpha",
      start: 0,
      end: grossAlpha,
      fill: "#1466b8",
      isSummary: true,
    },
    { name: "Fees", start: grossAlpha, end: netAlpha, fill: "#dc2626" },
    {
      name: "Net Alpha",
      start: 0,
      end: netAlpha,
      fill: netAlpha >= 0 ? "#16a34a" : "#dc2626",
      isSummary: true,
    },
  ];

  const interpretiveText =
    netAlpha > 0
      ? `After fees, this fund generates approximately +${netAlpha} bps of annual alpha — the manager's stock picks more than offset costs.`
      : `After fees, this fund loses approximately ${netAlpha} bps annually — trading gains don't fully cover costs.`;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Expected Alpha Decomposition
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <AlphaWaterfallChart data={chartData} />
        <p className="mt-3 text-sm text-gray-600">{interpretiveText}</p>
      </div>
    </div>
  );
}
