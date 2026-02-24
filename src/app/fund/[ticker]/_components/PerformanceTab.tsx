"use client";

import { useState } from "react";
import { FundDetail } from "@/lib/types";
import { PerformanceLineChart } from "@/components/charts/PerformanceLineChart";
import { CalendarReturnGrid } from "@/components/charts/CalendarReturnGrid";
import { ReturnValue } from "@/components/ui/ReturnValue";
import {
  cumulativeReturnSeries,
  filterReturnsByRange,
} from "@/lib/utils/calculations";
import { TIME_RANGES, TimeRange } from "@/lib/constants";
import { ConsistencyHeatmap } from "@/components/charts/ConsistencyHeatmap";

interface PerformanceTabProps {
  fund: FundDetail;
}

export function PerformanceTab({ fund }: PerformanceTabProps) {
  const [range, setRange] = useState<TimeRange>("5Y");

  const filteredFund = filterReturnsByRange(
    fund.performance.monthlyReturns,
    range
  );
  const filteredPassive = filterReturnsByRange(
    fund.performance.passiveAltMonthlyReturns,
    range
  );
  const filteredCatAvg = filterReturnsByRange(
    fund.performance.categoryAvgMonthlyReturns,
    range
  );

  const series = [
    {
      name: fund.ticker,
      data: cumulativeReturnSeries(filteredFund),
      color: "#1466b8",
    },
    {
      name: fund.passiveAltTicker,
      data: cumulativeReturnSeries(filteredPassive),
      color: "#9ca3af",
    },
    {
      name: "Category Avg",
      data: cumulativeReturnSeries(filteredCatAvg),
      color: "#f97316",
    },
  ];

  const { trailingReturns } = fund.performance;

  return (
    <div className="space-y-8">
      {/* Cumulative return chart */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Cumulative Returns
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

      {/* Trailing returns */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Trailing Returns
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  1M
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  3M
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  6M
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  YTD
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  1Y
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  3Y
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  5Y
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  10Y
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {fund.ticker}
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.oneMonth} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.threeMonth} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.sixMonth} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.ytd} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.oneYear} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.threeYear} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.fiveYear} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnValue value={trailingReturns.tenYear} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar year returns */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Calendar Year Returns
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <CalendarReturnGrid returns={fund.performance.calendarYearReturns} />
        </div>
      </div>
      {/* Consistency Heatmap */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Monthly Consistency vs Passive Alternative
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <ConsistencyHeatmap
            fundReturns={fund.performance.monthlyReturns}
            passiveReturns={fund.performance.passiveAltMonthlyReturns}
          />
        </div>
      </div>
    </div>
  );
}
