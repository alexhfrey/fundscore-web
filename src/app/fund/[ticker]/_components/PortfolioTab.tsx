"use client";

import { FundDetail } from "@/lib/types";
import { PercentBar } from "@/components/ui/PercentBar";
import { SectorDonutChart } from "@/components/charts/SectorDonutChart";
import { CreditQualityChart } from "@/components/charts/CreditQualityChart";
import { FactorExposureChart } from "@/components/charts/FactorExposureChart";

interface PortfolioTabProps {
  fund: FundDetail;
}

export function PortfolioTab({ fund }: PortfolioTabProps) {
  const { portfolio } = fund;

  return (
    <div className="space-y-8">
      {/* Portfolio summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Total Holdings
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {portfolio.totalHoldings}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Turnover Rate
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {portfolio.turnoverRate}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Asset Allocation
          </p>
          <div className="space-y-1 mt-2">
            {portfolio.assetAllocation.map((a) => (
              <div
                key={a.type}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-600">{a.type}</span>
                <span className="font-medium text-gray-900">
                  {a.weight.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top holdings */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top Holdings
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Ticker
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Sector
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-40">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {portfolio.holdings.slice(0, 10).map((h, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {h.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {h.ticker || "--"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {h.sector}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {h.weight.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    <PercentBar
                      value={h.weight}
                      maxValue={portfolio.holdings[0].weight * 1.2}
                      showLabel={false}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector allocation */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Sector Allocation
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <SectorDonutChart sectors={portfolio.sectorWeights} />
        </div>
      </div>

      {/* Factor Exposure */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Factor Exposure
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <FactorExposureChart factors={fund.trading.factorTilts} />
        </div>
      </div>

      {/* Credit quality (fixed income only) */}
      {portfolio.creditQuality && portfolio.creditQuality.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Credit Quality
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <CreditQualityChart data={portfolio.creditQuality} />
          </div>
        </div>
      )}
    </div>
  );
}
