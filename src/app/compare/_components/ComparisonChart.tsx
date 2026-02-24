"use client";

import { useState } from "react";
import { FundDetail } from "@/lib/types";
import { PerformanceLineChart } from "@/components/charts/PerformanceLineChart";
import {
  cumulativeReturnSeries,
  filterReturnsByRange,
} from "@/lib/utils/calculations";
import { COLORS, TIME_RANGES, TimeRange } from "@/lib/constants";

interface ComparisonChartProps {
  funds: FundDetail[];
}

export function ComparisonChart({ funds }: ComparisonChartProps) {
  const [range, setRange] = useState<TimeRange>("5Y");

  const series = funds.map((fund, i) => ({
    name: fund.ticker,
    data: cumulativeReturnSeries(
      filterReturnsByRange(fund.performance.monthlyReturns, range)
    ),
    color: COLORS.chart[i % COLORS.chart.length],
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Performance Comparison
        </h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                range === r
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <PerformanceLineChart series={series} height={400} />
      </div>
    </div>
  );
}
