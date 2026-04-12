"use client";

import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { XRayResult } from "@/lib/utils/portfolio";
import { MetricCard } from "@/components/ui/MetricCard";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { Badge } from "@/components/ui/Badge";
import { FactorExposureChart } from "@/components/charts/FactorExposureChart";
import { formatExpenseRatio } from "@/lib/utils/format";
import { COLORS } from "@/lib/constants";

interface XRayAnalysisProps {
  result: XRayResult;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function signedPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function XRayAnalysis({ result }: XRayAnalysisProps) {
  const [showAllHoldings, setShowAllHoldings] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const verdictRef = useRef<HTMLDivElement>(null);

  const displayedHoldings = showAllHoldings
    ? result.blendedHoldings
    : result.blendedHoldings.slice(0, 15);

  // Sticky bar appears when verdict scrolls out of view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    if (verdictRef.current) observer.observe(verdictRef.current);
    return () => observer.disconnect();
  }, []);

  const isPositive = result.verdictSentiment === "positive";
  const isMixed = result.verdictSentiment === "mixed";

  return (
    <div className="space-y-6">
      {/* Sticky Summary Bar */}
      <div
        className={`fixed top-16 left-0 right-0 z-40 transition-all duration-200 ${
          showStickyBar
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-b-lg shadow-sm px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ScoreBadge score={result.verdictScore} showLabel size="sm" />
              <span className="text-sm text-gray-500">
                Net Edge:{" "}
                <span
                  className={`font-bold ${result.netEdge >= 0 ? "text-green-700" : "text-red-700"}`}
                >
                  {signedPct(result.netEdge)}/yr
                </span>
              </span>
            </div>
            <div>
              {result.verdictSentiment === "positive" && (
                <Badge variant="success">Active Adding Value</Badge>
              )}
              {result.verdictSentiment === "mixed" && (
                <Badge variant="warning">Mixed Results</Badge>
              )}
              {result.verdictSentiment === "negative" && (
                <Badge variant="danger">Consider Passive</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1. Your Passive Clone */}
      <div className="bg-white border-2 border-[#1466b8] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-gray-900">
            Your Passive Clone
          </h3>
          <Badge variant="primary">Benchmark</Badge>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          This is the low-cost portfolio we&apos;re measuring your funds
          against. Built via constrained regression on your portfolio&apos;s
          actual return series.
        </p>
        <table className="min-w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                Ticker
              </th>
              <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                ETF
              </th>
              <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                Weight
              </th>
              <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                Expense Ratio
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {result.passiveClone.map((r) => (
              <tr key={r.ticker}>
                <td className="py-2 font-medium text-[#1466b8]">{r.ticker}</td>
                <td className="py-2 text-gray-700">{r.name}</td>
                <td className="py-2 text-right text-gray-900">
                  {r.weight.toFixed(1)}%
                </td>
                <td className="py-2 text-right text-gray-500">
                  {r.expenseRatio.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bg-blue-50 rounded-lg p-3 text-sm flex items-center justify-between">
          <span className="text-gray-600">Blended passive cost</span>
          <span className="font-bold text-[#1466b8]">
            {formatExpenseRatio(result.passiveER)}/yr
          </span>
        </div>
      </div>

      {/* 2. Hero Verdict Banner */}
      <div
        ref={verdictRef}
        className={`rounded-lg p-6 text-center ${
          isPositive
            ? "bg-green-50 border border-green-200"
            : isMixed
              ? "bg-amber-50 border border-amber-200"
              : "bg-red-50 border border-red-200"
        }`}
      >
        <p
          className={`text-3xl font-black ${
            isPositive
              ? "text-green-700"
              : isMixed
                ? "text-amber-700"
                : "text-red-700"
          }`}
        >
          {result.netEdge >= 0 ? "+" : ""}
          {result.netEdge.toFixed(2)}%/yr net edge
        </p>
        <p className="text-sm text-gray-700 mt-2 max-w-md mx-auto">
          {isPositive
            ? "Your active managers are generating enough alpha to justify their fees."
            : isMixed
              ? "Your portfolio is borderline \u2014 the extra fees roughly offset the alpha."
              : "Your active managers are not generating enough alpha to cover their extra fees."}
        </p>
        <div className="mt-3">
          {isPositive && (
            <Badge variant="success">Active Management Adding Value</Badge>
          )}
          {isMixed && <Badge variant="warning">Mixed Results</Badge>}
          {!isPositive && !isMixed && (
            <Badge variant="danger">Consider Passive</Badge>
          )}
        </div>
      </div>

      {/* 3. Verdict Metrics (supporting evidence) */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
          The Evidence
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* FundScore */}
          <div className="text-center">
            <ScoreRing
              score={result.verdictScore}
              size={100}
              strokeWidth={8}
              textVariant="default"
              label="FundScore"
            />
            <p className="text-xs text-gray-500 mt-2">
              Chance of beating passive over 5 years
            </p>
          </div>

          {/* Fee Premium */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Fee Premium
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Your portfolio</span>
                <span className="font-semibold">
                  {formatExpenseRatio(result.portfolioER)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Passive clone</span>
                <span className="font-semibold text-[#1466b8]">
                  {formatExpenseRatio(result.passiveER)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-1 flex justify-between">
                <span className="font-semibold text-red-700">Extra cost</span>
                <span className="font-bold text-red-700">
                  {result.feeGap.toFixed(2)}%/yr
                </span>
              </div>
            </div>
          </div>

          {/* Gross Alpha */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Gross Alpha
            </p>
            <p
              className={`text-3xl font-bold ${result.grossAlpha >= 0 ? "text-green-700" : "text-red-700"}`}
            >
              {signedPct(result.grossAlpha)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Manager edge before fees (3Y ann.)
            </p>
          </div>

          {/* Net Edge */}
          <div
            className={`rounded-lg p-4 ${
              result.netEdge >= 0
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Net Edge
            </p>
            <p
              className={`text-3xl font-bold ${result.netEdge >= 0 ? "text-green-700" : "text-red-700"}`}
            >
              {signedPct(result.netEdge)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              After subtracting extra fees
            </p>
          </div>
        </div>
        {result.trackingError > 0 && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            Tracking error: {result.trackingError.toFixed(1)}% &middot; Net IR:{" "}
            {result.netIR >= 0 ? "+" : ""}
            {result.netIR.toFixed(2)} &middot; Projection horizon: 5 years
          </p>
        )}
      </div>

      {/* 4. Dollar Impact */}
      {result.lifetimeCost10yr > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            The Cost of Extra Fees on $100,000
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">10 Years</p>
              <p className="text-2xl font-black text-red-700">
                ${fmt(result.lifetimeCost10yr)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">20 Years</p>
              <p className="text-2xl font-black text-red-700">
                ${fmt(result.lifetimeCost20yr)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">30 Years</p>
              <p className="text-2xl font-black text-red-700">
                ${fmt(result.lifetimeCost30yr)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Assumes 7% gross return, compounded annually. Shows the cumulative
            drag from the fee gap between your portfolio (
            {formatExpenseRatio(result.portfolioER)}) and the passive clone (
            {formatExpenseRatio(result.passiveER)}).
          </p>
        </div>
      )}

      {/* 5. Growth of $10K Chart */}
      {result.cumulativeReturns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Growth of $10,000: Your Portfolio vs Passive Clone
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={result.cumulativeReturns}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                interval={Math.max(
                  1,
                  Math.floor(result.cumulativeReturns.length / 8),
                )}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  `$${(v / 1000).toFixed(0)}K`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number | undefined) =>
                  value != null ? [`$${fmt(value)}`] : ""
                }
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                name="Your Portfolio"
                stroke="#111827"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="clone"
                name="Passive Clone"
                stroke={COLORS.primary}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 6. What You Actually Own */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
          What You Actually Own
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase w-8">
                  #
                </th>
                <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                  Holding
                </th>
                <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                  Weight
                </th>
                <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                  Benchmark
                </th>
                <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                  <span title="How much more or less you own compared to the passive benchmark">
                    vs Bench
                  </span>
                </th>
                <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                  # Funds
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedHoldings.map((h, i) => (
                <tr key={h.ticker ?? h.name}>
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="py-2">
                    <span className="font-medium text-gray-900">{h.name}</span>
                    {h.ticker && (
                      <span className="text-gray-400 text-xs ml-1.5">
                        {h.ticker}
                      </span>
                    )}
                    {h.fundCount >= 2 && (
                      <Badge variant="warning" className="ml-2">
                        Overlap
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-900">
                    {h.effectiveWeight.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right text-gray-500">
                    {h.benchmarkWeight.toFixed(1)}%
                  </td>
                  <td
                    className={`py-2 text-right font-medium ${
                      h.overUnderweight > 0.05
                        ? "text-green-700"
                        : h.overUnderweight < -0.05
                          ? "text-red-700"
                          : "text-gray-400"
                    }`}
                  >
                    {Math.abs(h.overUnderweight) > 0.05
                      ? `${h.overUnderweight > 0 ? "+" : ""}${h.overUnderweight.toFixed(1)}%`
                      : "\u2014"}
                  </td>
                  <td className="py-2 text-right text-gray-500">
                    {h.fundCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.blendedHoldings.length > 15 && (
          <button
            onClick={() => setShowAllHoldings(!showAllHoldings)}
            className="text-sm text-[#1466b8] hover:text-[#0f4f8c] font-medium mt-3 transition-colors"
          >
            {showAllHoldings
              ? "Show top 15"
              : `Show all ${result.blendedHoldings.length} holdings`}
          </button>
        )}

        <div className="bg-gray-50 rounded-lg p-3 mt-4 text-sm text-gray-600">
          Top 5 concentration:{" "}
          <span className="font-bold text-gray-900">
            {result.top5Concentration.toFixed(1)}%
          </span>
          {result.overlapCount > 0 && (
            <span className="ml-3">
              &middot;{" "}
              <span className="font-semibold">{result.overlapCount}</span>{" "}
              holdings overlap across funds
            </span>
          )}
        </div>
      </div>

      {/* 7. Sector Exposure — divergence chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-1">
          Sector Exposure
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Active bets vs passive benchmark
        </p>
        <div className="space-y-2">
          {result.blendedSectors
            .filter((s) => Math.abs(s.overUnderweight) > 0.5)
            .map((s) => {
              const maxDelta = Math.max(
                ...result.blendedSectors.map((x) =>
                  Math.abs(x.overUnderweight),
                ),
              );
              return (
                <DivergenceBar
                  key={s.sector}
                  label={s.sector}
                  delta={s.overUnderweight}
                  maxDelta={maxDelta}
                  portfolioWeight={s.weight}
                />
              );
            })}
          {result.blendedSectors.filter((s) => Math.abs(s.overUnderweight) <= 0.5)
            .length > 0 && (
            <p className="text-xs text-gray-400 pt-1">
              {
                result.blendedSectors.filter(
                  (s) => Math.abs(s.overUnderweight) <= 0.5,
                ).length
              }{" "}
              other sectors within 0.5% of benchmark
            </p>
          )}
        </div>
      </div>

      {/* 8. Factor Risk Profile — collapsible */}
      {result.blendedFactorTilts.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2">
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            Factor Risk Profile (Advanced)
          </summary>
          <div className="mt-3 bg-white border border-gray-200 rounded-lg p-5">
            <FactorExposureChart
              factors={result.blendedFactorTilts}
              height={250}
            />
            <div className="bg-blue-50 rounded-lg p-3 mt-4 text-sm text-gray-700">
              {result.dominantTilt}
            </div>
          </div>
        </details>
      )}

      {/* 9. What To Do Next */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
          What To Do Next
        </h3>
        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
              1
            </span>
            <span>
              <span className="font-semibold text-gray-900">
                Check unrealized gains.
              </span>{" "}
              Selling active funds may trigger capital gains taxes. Check your
              brokerage for tax lot details.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
              2
            </span>
            <span>
              <span className="font-semibold text-gray-900">
                Start in tax-advantaged accounts.
              </span>{" "}
              IRAs and 401(k)s have no tax impact on switches. Move those first.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
              3
            </span>
            <span>
              <span className="font-semibold text-gray-900">
                Buy the passive clone.
              </span>{" "}
              The ETFs listed above are available at most brokerages
              commission-free.
            </span>
          </li>
        </ol>
        <p className="text-xs text-gray-400 mt-4">
          This is informational only, not investment advice. Consider consulting
          a tax advisor before making changes.
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function DivergenceBar({
  label,
  delta,
  maxDelta,
  portfolioWeight,
}: {
  label: string;
  delta: number;
  maxDelta: number;
  portfolioWeight: number;
}) {
  const pct = maxDelta > 0 ? (Math.abs(delta) / maxDelta) * 45 : 0;
  const isOver = delta > 0;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 text-gray-700 flex-shrink-0 text-right">
        {label}
      </span>
      <div className="flex-1 flex items-center h-5">
        {/* Left side (underweight) */}
        <div className="w-1/2 flex justify-end">
          {!isOver && (
            <div
              className="h-4 bg-red-300 rounded-l"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        {/* Center line */}
        <div className="w-px h-5 bg-gray-300 flex-shrink-0" />
        {/* Right side (overweight) */}
        <div className="w-1/2">
          {isOver && (
            <div
              className="h-4 bg-green-400 rounded-r"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>
      <span
        className={`w-16 text-xs text-right flex-shrink-0 font-medium ${
          isOver ? "text-green-700" : "text-red-700"
        }`}
      >
        {delta > 0 ? "+" : ""}
        {delta.toFixed(1)}%
      </span>
      <span className="w-14 text-xs text-gray-400 text-right flex-shrink-0">
        ({portfolioWeight.toFixed(1)}%)
      </span>
    </div>
  );
}
