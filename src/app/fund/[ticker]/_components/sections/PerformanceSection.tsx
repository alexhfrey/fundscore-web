"use client";

import { useState } from "react";
import { FundDetail } from "@/lib/types";
import { GrowthOfDollarChart } from "@/components/charts/GrowthOfDollarChart";
import { CalendarReturnGrid } from "@/components/charts/CalendarReturnGrid";
import { ReturnValue } from "@/components/ui/ReturnValue";
import {
  cumulativeReturnSeries,
  filterReturnsByRange,
  computeTrailingReturns,
} from "@/lib/utils/calculations";
import { TIME_RANGES, TimeRange } from "@/lib/constants";
import { formatNumber } from "@/lib/utils/format";

interface PerformanceSectionProps {
  fund: FundDetail;
}

export function PerformanceSection({ fund }: PerformanceSectionProps) {
  const [range, setRange] = useState<TimeRange>("Max");

  const filteredFund = filterReturnsByRange(fund.performance.monthlyReturns, range);
  const filteredPassive = filterReturnsByRange(fund.performance.passiveAltMonthlyReturns, range);

  const series = [
    { name: fund.ticker, data: cumulativeReturnSeries(filteredFund), color: "#1466b8" },
    { name: fund.passiveAltTicker, data: cumulativeReturnSeries(filteredPassive), color: "#9ca3af" },
  ];

  const { trailingReturns } = fund.performance;
  const { risk } = fund;

  const passiveTrailing = computeTrailingReturns(fund.performance.passiveAltMonthlyReturns);
  const catAvgTrailing = computeTrailingReturns(fund.performance.categoryAvgMonthlyReturns);

  return (
    <div className="space-y-8">
      {/* Growth of $10,000 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Growth of $10,000
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
          <GrowthOfDollarChart series={series} baseAmount={10000} height={380} />
        </div>
      </div>

      {/* Returns comparison — fund vs passive alt as primary, category avg as subtle reference */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Returns Comparison</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{fund.ticker}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{fund.passiveAltTicker}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Difference</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase text-[10px]">Cat Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <H2HRow label="1 Year" fund={trailingReturns.oneYear} passive={passiveTrailing.oneYear} catAvg={catAvgTrailing.oneYear} />
              <H2HRow label="3 Year (Ann.)" fund={trailingReturns.threeYear} passive={passiveTrailing.threeYear} catAvg={catAvgTrailing.threeYear} />
              <H2HRow label="5 Year (Ann.)" fund={trailingReturns.fiveYear} passive={passiveTrailing.fiveYear} catAvg={catAvgTrailing.fiveYear} />
              {trailingReturns.tenYear != null && (
                <H2HRow label="10 Year (Ann.)" fund={trailingReturns.tenYear} passive={passiveTrailing.tenYear} catAvg={catAvgTrailing.tenYear} />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk metrics comparison */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Risk Comparison</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Metric</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{fund.ticker}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{fund.passiveAltTicker}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase text-[10px]">Cat Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">Beta (3Y)</td>
                <td className="px-4 py-3 text-right">{formatNumber(risk.beta.threeYear)}</td>
                <td className="px-4 py-3 text-right text-gray-500">1.00</td>
                <td className="px-4 py-3 text-right text-gray-400">{formatNumber(risk.categoryAvg.beta)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  Value Added (3Y)
                  <span className="text-[10px] text-gray-400 ml-1">(higher = better)</span>
                </td>
                <td className="px-4 py-3 text-right">{formatNumber(risk.alpha.threeYear)}</td>
                <td className="px-4 py-3 text-right text-gray-500">0.00</td>
                <td className="px-4 py-3 text-right text-gray-400">{formatNumber(risk.categoryAvg.alpha)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  Information Ratio
                  <span className="text-[10px] text-gray-400 ml-1">(higher = more consistent)</span>
                </td>
                <td className="px-4 py-3 text-right">{formatNumber(risk.informationRatio)}</td>
                <td className="px-4 py-3 text-right text-gray-500">&mdash;</td>
                <td className="px-4 py-3 text-right text-gray-400">&mdash;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar year returns — collapsed */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Show annual returns
        </summary>
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <CalendarReturnGrid returns={fund.performance.calendarYearReturns} />
        </div>
      </details>
    </div>
  );
}

function H2HRow({
  label,
  fund,
  passive,
  catAvg,
}: {
  label: string;
  fund: number | null;
  passive: number | null;
  catAvg: number | null;
}) {
  if (fund == null) return null;
  const diff = passive != null ? fund - passive : null;
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
      <td className="px-4 py-3 text-right"><ReturnValue value={fund} /></td>
      <td className="px-4 py-3 text-right text-gray-500">
        {passive != null ? <ReturnValue value={passive} /> : <span className="text-gray-400">&mdash;</span>}
      </td>
      <td className={`px-4 py-3 text-right font-semibold ${
        diff == null ? "text-gray-400" : diff >= 0 ? "text-green-600" : "text-red-600"
      }`}>
        {diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp` : <span className="text-gray-400">&mdash;</span>}
      </td>
      <td className="px-4 py-3 text-right text-gray-400 text-xs">
        {catAvg != null ? <ReturnValue value={catAvg} className="text-xs text-gray-400" /> : <span>&mdash;</span>}
      </td>
    </tr>
  );
}
