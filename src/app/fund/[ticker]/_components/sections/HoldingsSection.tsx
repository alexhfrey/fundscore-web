"use client";

import { useState } from "react";
import { FundDetail } from "@/lib/types";
import { PercentBar } from "@/components/ui/PercentBar";
import { CreditQualityChart } from "@/components/charts/CreditQualityChart";
import { MaturityDistributionChart } from "@/components/charts/MaturityDistributionChart";
import { getFundType } from "@/lib/utils/fundTypeHelpers";
import { formatAUM } from "@/lib/utils/format";

interface HoldingsSectionProps {
  fund: FundDetail;
}

export function HoldingsSection({ fund }: HoldingsSectionProps) {
  const { portfolio, characteristics } = fund;
  const fundType = getFundType(fund.assetClass);
  const holdings = portfolio.holdings;

  // Compute overweights and underweights
  const holdingsWithDiff = holdings
    .filter((h) => h.benchmarkWeight != null)
    .map((h) => ({
      ...h,
      difference: Number((h.weight - (h.benchmarkWeight ?? 0)).toFixed(2)),
    }));

  const overweights = [...holdingsWithDiff]
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 5);
  const underweights = [...holdingsWithDiff]
    .sort((a, b) => a.difference - b.difference)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Key Characteristics */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Key Characteristics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {fundType === "fixedIncome" && characteristics.fixedIncome ? (
            <>
              <CharCard label="SEC 30-Day Yield" value={`${characteristics.fixedIncome.sec30DayYield.toFixed(2)}%`} />
              <CharCard label="Duration" value={`${characteristics.fixedIncome.effectiveDuration.toFixed(1)} yrs`} hint="(higher = more rate risk)" />
              <CharCard label="Avg Credit Quality" value={characteristics.fixedIncome.avgCreditQuality} />
              <CharCard label="Yield to Maturity" value={`${characteristics.fixedIncome.yieldToMaturity.toFixed(2)}%`} />
              <CharCard label="AUM" value={formatAUM(fund.aum)} />
              <CharCard label="Avg Coupon" value={`${characteristics.fixedIncome.avgCoupon.toFixed(2)}%`} />
            </>
          ) : (
            <>
              {characteristics.equity && (
                <>
                  <CharCard label="Div Yield" value={`${characteristics.equity.dividendYield.toFixed(2)}%`} />
                  <CharCard label="P/E Ratio" value={characteristics.equity.peRatio.toFixed(1)} />
                </>
              )}
              <CharCard label="Active Share" value={`${(fund.trading.activeShare * 100).toFixed(0)}%`} hint="(higher = more active)" />
              <CharCard label="AUM" value={formatAUM(fund.aum)} />
              <CharCard label="Turnover" value={`${portfolio.turnoverRate}%`} hint="(higher = more trading)" />
              <CharCard label="Holdings" value={String(portfolio.totalHoldings)} />
            </>
          )}
        </div>
      </div>

      {/* Three tables (responsive: stacks on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Overall */}
        <HoldingsTable
          title="Top 5 Holdings"
          items={holdings.slice(0, 5).map((h) => ({
            name: h.name,
            ticker: h.ticker,
            col1: `${h.weight.toFixed(2)}%`,
            col2: h.sector,
          }))}
          col1Label="Weight"
          col2Label="Sector"
        />

        {/* Top 5 Overweights */}
        <HoldingsTable
          title="Top 5 Overweights"
          items={overweights.map((h) => ({
            name: h.name,
            ticker: h.ticker,
            col1: `${h.weight.toFixed(2)}%`,
            col2: `+${h.difference.toFixed(2)}%`,
            col2Color: "text-green-600",
          }))}
          col1Label="Fund Wt"
          col2Label="vs Bench"
        />

        {/* Top 5 Underweights */}
        <HoldingsTable
          title="Top 5 Underweights"
          items={underweights.map((h) => ({
            name: h.name,
            ticker: h.ticker,
            col1: `${h.weight.toFixed(2)}%`,
            col2: `${h.difference.toFixed(2)}%`,
            col2Color: "text-red-600",
          }))}
          col1Label="Fund Wt"
          col2Label="vs Bench"
        />
      </div>

      {/* Sector concentration */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Sector Concentration
        </h3>
        <SectorConcentrationTable fund={fund} />
      </div>

      {/* FI-specific: credit quality + maturity distribution */}
      {fundType === "fixedIncome" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {portfolio.creditQuality && portfolio.creditQuality.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Credit Quality
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <CreditQualityChart data={portfolio.creditQuality} />
              </div>
            </div>
          )}
          {portfolio.maturityDistribution && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Maturity Distribution
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <MaturityDistributionChart data={portfolio.maturityDistribution} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HoldingsTable({
  title,
  items,
  col1Label,
  col2Label,
}: {
  title: string;
  items: {
    name: string;
    ticker: string | null;
    col1: string;
    col2: string;
    col2Color?: string;
  }[];
  col1Label: string;
  col2Label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? items : items.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-3 py-2 text-left text-xs text-gray-500">Name</th>
            <th className="px-3 py-2 text-right text-xs text-gray-500">{col1Label}</th>
            <th className="px-3 py-2 text-right text-xs text-gray-500">{col2Label}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {display.map((item, i) => (
            <tr key={i}>
              <td className="px-3 py-2">
                <span className="text-gray-900 text-xs font-medium">{item.name}</span>
                {item.ticker && (
                  <span className="text-gray-400 text-xs ml-1">({item.ticker})</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-xs text-gray-700">{item.col1}</td>
              <td className={`px-3 py-2 text-right text-xs font-medium ${item.col2Color || "text-gray-500"}`}>
                {item.col2}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs font-medium text-[#1466b8] hover:bg-blue-50 border-t border-gray-200"
        >
          {expanded ? "Show less" : `Show all (${items.length})`}
        </button>
      )}
    </div>
  );
}

function CharCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">
        {label}
        {hint && <span className="text-gray-400 ml-1">{hint}</span>}
      </p>
      <p className="text-base font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function SectorConcentrationTable({ fund }: { fund: FundDetail }) {
  const { sectorWeights, benchmarkSectorWeights } = fund.portfolio;
  const maxWeight = Math.max(...sectorWeights.map((s) => s.weight), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sector</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Fund</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Passive Alt</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">O/U</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">&nbsp;</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sectorWeights.map((sw) => {
            const bw = benchmarkSectorWeights?.find((b) => b.sector === sw.sector);
            const benchWeight = bw?.weight ?? 0;
            const diff = sw.weight - benchWeight;
            return (
              <tr key={sw.sector}>
                <td className="px-4 py-2 font-medium text-gray-900">{sw.sector}</td>
                <td className="px-4 py-2 text-right">{sw.weight.toFixed(1)}%</td>
                <td className="px-4 py-2 text-right text-gray-400">{benchWeight.toFixed(1)}%</td>
                <td className={`px-4 py-2 text-right font-medium ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
                </td>
                <td className="px-4 py-2">
                  <PercentBar value={sw.weight} maxValue={maxWeight * 1.2} showLabel={false} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
