"use client";

import { FundDetail } from "@/lib/types";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatNumber } from "@/lib/utils/format";
import { DownsideProtection } from "@/components/fund/DownsideProtection";

interface RiskTabProps {
  fund: FundDetail;
}

export function RiskTab({ fund }: RiskTabProps) {
  const { risk } = fund;

  return (
    <div className="space-y-8">
      {/* Key risk metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Max Drawdown"
          value={`${risk.maxDrawdown.toFixed(1)}%`}
          subtitle={`Peak: ${risk.maxDrawdownDate}`}
        />
        <MetricCard
          label="Sharpe Ratio (3Y)"
          value={formatNumber(risk.sharpeRatio.threeYear)}
          subtitle={`Cat avg: ${formatNumber(risk.categoryAvg.sharpeRatio)}`}
        />
        <MetricCard
          label="Sortino Ratio"
          value={formatNumber(risk.sortinoRatio)}
        />
        <MetricCard
          label="Tracking Error"
          value={`${formatNumber(risk.trackingError)}%`}
        />
      </div>

      {/* Downside Protection (replaces Capture Ratios) */}
      <DownsideProtection fund={fund} />

      {/* Risk statistics table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Risk Statistics
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Metric
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  3 Year
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  5 Year
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  10 Year
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Cat Avg (3Y)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  Standard Deviation
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.standardDeviation.threeYear)}%
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.standardDeviation.fiveYear)}%
                </td>
                <td className="px-4 py-3 text-right">
                  {risk.standardDeviation.tenYear != null
                    ? `${formatNumber(risk.standardDeviation.tenYear)}%`
                    : "--"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(risk.categoryAvg.standardDeviation)}%
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  Sharpe Ratio
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.sharpeRatio.threeYear)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.sharpeRatio.fiveYear)}
                </td>
                <td className="px-4 py-3 text-right">
                  {risk.sharpeRatio.tenYear != null
                    ? formatNumber(risk.sharpeRatio.tenYear)
                    : "--"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(risk.categoryAvg.sharpeRatio)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  Alpha
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.alpha.threeYear)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.alpha.fiveYear)}
                </td>
                <td className="px-4 py-3 text-right">
                  {risk.alpha.tenYear != null
                    ? formatNumber(risk.alpha.tenYear)
                    : "--"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(risk.categoryAvg.alpha)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  Beta
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.beta.threeYear)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.beta.fiveYear)}
                </td>
                <td className="px-4 py-3 text-right">
                  {risk.beta.tenYear != null
                    ? formatNumber(risk.beta.tenYear)
                    : "--"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {formatNumber(risk.categoryAvg.beta)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  R-Squared
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.rSquared.threeYear, 1)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatNumber(risk.rSquared.fiveYear, 1)}
                </td>
                <td className="px-4 py-3 text-right">
                  {risk.rSquared.tenYear != null
                    ? formatNumber(risk.rSquared.tenYear, 1)
                    : "--"}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">--</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-gray-900">
                  Information Ratio
                </td>
                <td className="px-4 py-3 text-right" colSpan={3}>
                  {formatNumber(risk.informationRatio)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  --
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
