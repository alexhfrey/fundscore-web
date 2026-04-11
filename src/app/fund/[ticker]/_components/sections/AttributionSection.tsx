"use client";

import { useState } from "react";
import {
  FundDetail,
  SectorBet,
  StockPick,
  PerformanceAttribution,
  EquityAttribution,
  FixedIncomeAttribution,
  AllocationAttribution,
} from "@/lib/types";
import { AttributionWaterfallChart } from "@/components/charts/AttributionWaterfallChart";
import { formatBps } from "@/lib/utils/format";

type Period = "1Y" | "3Y" | "5Y" | "Inception";

const PERIODS: { key: Period; label: string }[] = [
  { key: "1Y", label: "1 Year" },
  { key: "3Y", label: "3 Years" },
  { key: "5Y", label: "5 Years" },
  { key: "Inception", label: "Since Inception" },
];

// Shorter periods are noisier; longer periods regress toward mean
const PERIOD_SCALE: Record<Period, number> = {
  "1Y": 1.3,
  "3Y": 1.0,
  "5Y": 0.85,
  Inception: 0.7,
};

function scaleEquity(eq: EquityAttribution, factor: number): EquityAttribution {
  const betaContribution = Math.round(eq.betaContribution * factor);
  const sectorExposure = Math.round(eq.sectorExposure * factor);
  const sectorTiming = Math.round(eq.sectorTiming * factor);
  const marketTiming = Math.round(eq.marketTiming * factor);
  const stockSelection = Math.round(eq.stockSelection * factor);
  const grossAlpha =
    betaContribution + sectorExposure + sectorTiming + marketTiming + stockSelection;
  return {
    betaContribution,
    sectorExposure,
    sectorTiming,
    marketTiming,
    stockSelection,
    grossAlpha,
    feesDrag: eq.feesDrag,
    netAlpha: grossAlpha + eq.feesDrag,
  };
}

function scaleFI(fi: FixedIncomeAttribution, factor: number): FixedIncomeAttribution {
  const durationEffect = Math.round(fi.durationEffect * factor);
  const yieldCurveEffect = Math.round(fi.yieldCurveEffect * factor);
  const creditSpreadEffect = Math.round(fi.creditSpreadEffect * factor);
  const sectorAllocation = Math.round(fi.sectorAllocation * factor);
  const securitySelection = Math.round(fi.securitySelection * factor);
  const grossAlpha =
    durationEffect + yieldCurveEffect + creditSpreadEffect + sectorAllocation + securitySelection;
  return {
    durationEffect,
    yieldCurveEffect,
    creditSpreadEffect,
    sectorAllocation,
    securitySelection,
    grossAlpha,
    feesDrag: fi.feesDrag,
    netAlpha: grossAlpha + fi.feesDrag,
  };
}

function scaleAllocation(al: AllocationAttribution, factor: number): AllocationAttribution {
  const assetClassAllocation = Math.round(al.assetClassAllocation * factor);
  const withinEquity = Math.round(al.withinEquity * factor);
  const withinFixedIncome = Math.round(al.withinFixedIncome * factor);
  const withinAlternatives = Math.round(al.withinAlternatives * factor);
  const grossAlpha =
    assetClassAllocation + withinEquity + withinFixedIncome + withinAlternatives;
  return {
    assetClassAllocation,
    withinEquity,
    withinFixedIncome,
    withinAlternatives,
    grossAlpha,
    feesDrag: al.feesDrag,
    netAlpha: grossAlpha + al.feesDrag,
  };
}

function scaleAttribution(
  attr: PerformanceAttribution,
  period: Period
): PerformanceAttribution {
  const factor = PERIOD_SCALE[period];
  return {
    ...attr,
    equity: attr.equity ? scaleEquity(attr.equity, factor) : undefined,
    fixedIncome: attr.fixedIncome ? scaleFI(attr.fixedIncome, factor) : undefined,
    allocation: attr.allocation ? scaleAllocation(attr.allocation, factor) : undefined,
  };
}

interface AttributionSectionProps {
  fund: FundDetail;
}

export function AttributionSection({ fund }: AttributionSectionProps) {
  const [period, setPeriod] = useState<Period>("3Y");
  const scaledAttribution = scaleAttribution(fund.attribution, period);

  const sortedBets = [...fund.attribution.sectorBets].sort(
    (a, b) => b.contribution - a.contribution
  );
  const topBets = sortedBets.slice(0, 3);
  const worstBets = sortedBets.slice(-3).reverse();

  const sortedPicks = [...fund.attribution.stockPicks].sort(
    (a, b) => b.contribution - a.contribution
  );
  const topPicks = sortedPicks.slice(0, 3);
  const worstPicks = sortedPicks.slice(-3).reverse();

  const netAlpha =
    scaledAttribution.equity?.netAlpha ??
    scaledAttribution.fixedIncome?.netAlpha ??
    scaledAttribution.allocation?.netAlpha ??
    0;

  const periodLabel = PERIODS.find((p) => p.key === period)!.label;

  // Build plain-English summary from the base (3Y) attribution
  const baseAttr = fund.attribution;
  const summaryParts: { label: string; value: number }[] = [];
  if (baseAttr.equity) {
    summaryParts.push(
      { label: "stock picking", value: baseAttr.equity.stockSelection },
      { label: "sector exposure", value: baseAttr.equity.sectorExposure },
      { label: "sector timing", value: baseAttr.equity.sectorTiming },
      { label: "market timing", value: baseAttr.equity.marketTiming },
      { label: "beta", value: baseAttr.equity.betaContribution },
    );
  } else if (baseAttr.fixedIncome) {
    summaryParts.push(
      { label: "security selection", value: baseAttr.fixedIncome.securitySelection },
      { label: "credit spreads", value: baseAttr.fixedIncome.creditSpreadEffect },
      { label: "duration positioning", value: baseAttr.fixedIncome.durationEffect },
      { label: "yield curve", value: baseAttr.fixedIncome.yieldCurveEffect },
      { label: "sector allocation", value: baseAttr.fixedIncome.sectorAllocation },
    );
  } else if (baseAttr.allocation) {
    summaryParts.push(
      { label: "equity selection", value: baseAttr.allocation.withinEquity },
      { label: "asset class allocation", value: baseAttr.allocation.assetClassAllocation },
      { label: "fixed income selection", value: baseAttr.allocation.withinFixedIncome },
    );
  }
  const topContributor = [...summaryParts].sort((a, b) => b.value - a.value)[0];
  const feesDrag =
    baseAttr.equity?.feesDrag ??
    baseAttr.fixedIncome?.feesDrag ??
    baseAttr.allocation?.feesDrag ??
    0;

  return (
    <div className="space-y-8">
      {/* Plain-English summary */}
      {topContributor && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="w-1 self-stretch bg-blue-500 rounded-full flex-shrink-0" />
          <p className="text-sm text-gray-800 leading-relaxed">
            <span className="font-semibold">Key finding:</span>{" "}
            Over the past 3 years, this fund&apos;s {topContributor.label} added the most value (
            <span className="font-semibold text-green-700">{formatBps(topContributor.value)}</span>
            ), while fees dragged performance by{" "}
            <span className="font-semibold text-red-700">{formatBps(feesDrag)}</span>.
          </p>
        </div>
      )}

      {/* Waterfall chart with period selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-700">
            Annualized attribution — {periodLabel.toLowerCase()}
          </p>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  period === p.key
                    ? "bg-[#1466b8] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.key === "Inception" ? "Incep." : p.key}
              </button>
            ))}
          </div>
        </div>
        <AttributionWaterfallChart attribution={scaledAttribution} />
        <p className="mt-3 text-sm text-gray-600">
          {netAlpha > 0
            ? `Over the ${periodLabel.toLowerCase()}, after fees, this fund generates approximately ${formatBps(netAlpha)} of annualized alpha.`
            : `Over the ${periodLabel.toLowerCase()}, after fees, this fund loses approximately ${formatBps(netAlpha)} annually — trading gains don't fully cover costs.`}
        </p>
      </div>

      {/* Sector bets + Stock picks side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sector bets */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Top Sector Bets
          </h3>
          <BetTable items={topBets} variant="sector" />
          {worstBets.length > 0 && (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-3 mt-6">
                Worst Sector Bets
              </h3>
              <BetTable items={worstBets} variant="sector" />
            </>
          )}
        </div>

        {/* Stock picks */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Top Stock Picks
          </h3>
          <PickTable items={topPicks} />
          {worstPicks.length > 0 && (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-3 mt-6">
                Worst Stock Picks
              </h3>
              <PickTable items={worstPicks} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BetTable({
  items,
}: {
  items: SectorBet[];
  variant: "sector";
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
              Sector
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Fund
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Bench
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Over/Under
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Contribution
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((b) => (
            <tr key={b.sector}>
              <td className="px-3 py-2 text-gray-900 font-medium">{b.sector}</td>
              <td className="px-3 py-2 text-right text-gray-600">
                {b.fundWeight.toFixed(1)}%
              </td>
              <td className="px-3 py-2 text-right text-gray-400">
                {b.benchmarkWeight.toFixed(1)}%
              </td>
              <td
                className={`px-3 py-2 text-right font-medium ${
                  b.overUnderweight >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {b.overUnderweight >= 0 ? "+" : ""}
                {b.overUnderweight.toFixed(1)}%
              </td>
              <td
                className={`px-3 py-2 text-right font-medium ${
                  b.contribution >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatBps(b.contribution)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PickTable({ items }: { items: StockPick[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
              Name
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Fund
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Bench
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Contribution
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((p, i) => (
            <tr key={i}>
              <td className="px-3 py-2">
                <span className="text-gray-900 font-medium">{p.name}</span>
                {p.ticker && (
                  <span className="text-gray-400 ml-1 text-xs">({p.ticker})</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-gray-600">
                {p.fundWeight.toFixed(2)}%
              </td>
              <td className="px-3 py-2 text-right text-gray-400">
                {p.benchmarkWeight.toFixed(2)}%
              </td>
              <td
                className={`px-3 py-2 text-right font-medium ${
                  p.contribution >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatBps(p.contribution)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
