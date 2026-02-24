"use client";

import { FundDetail } from "@/lib/types";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { PercentBar } from "@/components/ui/PercentBar";
import { formatBps, formatPercent } from "@/lib/utils/format";
import { getScoreColor } from "@/lib/utils/colors";
import { SkillDecomposition } from "@/components/fund/SkillDecomposition";

interface TradingActivityTabProps {
  fund: FundDetail;
}

export function TradingActivityTab({ fund }: TradingActivityTabProps) {
  const { trading } = fund;

  return (
    <div className="space-y-8">
      {/* Key trading metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Batting Average"
          value={`${(trading.battingAverage * 100).toFixed(1)}%`}
          subtitle="of trades added value"
        />
        <MetricCard
          label="Avg Win Size"
          value={formatBps(trading.avgWinSize)}
          subtitle="outperformance on winners"
        />
        <MetricCard
          label="Avg Loss Size"
          value={formatBps(-trading.avgLossSize)}
          subtitle="underperformance on losers"
        />
        <MetricCard
          label="Win/Loss Ratio"
          value={`${trading.winLossRatio}x`}
          subtitle={
            trading.winLossRatio > 1
              ? "Wins bigger than losses"
              : "Losses bigger than wins"
          }
        />
      </div>

      {/* Win/Loss Asymmetry visual */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Win/Loss Asymmetry
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-end justify-center gap-8 h-40">
            <div className="flex flex-col items-center">
              <div
                className="w-16 bg-green-500 rounded-t-lg transition-all"
                style={{
                  height: `${Math.min(140, (trading.avgWinSize / 200) * 140)}px`,
                }}
              />
              <p className="text-sm font-semibold text-green-600 mt-2">
                +{trading.avgWinSize} bps
              </p>
              <p className="text-xs text-gray-500">Avg Win</p>
            </div>
            <div className="flex flex-col items-center">
              <div
                className="w-16 bg-red-500 rounded-t-lg transition-all"
                style={{
                  height: `${Math.min(140, (trading.avgLossSize / 200) * 140)}px`,
                }}
              />
              <p className="text-sm font-semibold text-red-600 mt-2">
                -{trading.avgLossSize} bps
              </p>
              <p className="text-xs text-gray-500">Avg Loss</p>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            {trading.winLossRatio > 1
              ? "This manager wins bigger than they lose — a sign of skilled position sizing."
              : "This manager's losses are larger than wins — a potential concern."}
          </p>
        </div>
      </div>

      {/* Active share + Conviction */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Active Share"
          value={`${(trading.activeShare * 100).toFixed(0)}%`}
          subtitle="Portfolio differs from passive ETF"
        >
          <PercentBar
            value={trading.activeShare * 100}
            className="mt-2"
            showLabel={false}
          />
        </MetricCard>
        <MetricCard
          label="Conviction Score"
          value={`${trading.convictionScore.toFixed(1)}%`}
          subtitle="Avg position size of new buys"
        />
        <MetricCard
          label="Trade Sizing Efficiency"
          value={trading.tradeSizingEfficiency.toFixed(2)}
          subtitle="Correlation: position size vs return"
        />
      </div>

      {/* Skill Decomposition */}
      <SkillDecomposition fund={fund} />

      {/* Sector hit rates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Sector Hit Rate
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="space-y-3">
            {trading.sectorHitRates.map((sh) => (
              <div key={sh.sector} className="flex items-center gap-4">
                <span className="text-sm text-gray-700 w-32 flex-shrink-0">
                  {sh.sector}
                </span>
                <div className="flex-1">
                  <PercentBar
                    value={sh.hitRate * 100}
                    color={sh.hitRate > 0.5 ? "#16a34a" : "#dc2626"}
                    showLabel={false}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 w-14 text-right">
                  {(sh.hitRate * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-gray-400 w-16">
                  {sh.tradeCount} trades
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FundScore trend */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          FundScore Trend
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-end gap-2 h-24">
            {trading.fundScoreTrend.map((point, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${(point.score / 100) * 80}px`,
                    backgroundColor: getScoreColor(point.score),
                    opacity: 0.7 + (i / trading.fundScoreTrend.length) * 0.3,
                  }}
                />
                <span className="text-[10px] text-gray-500 mt-1">
                  {point.quarter.replace("20", "'")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent trades */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Trades
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Quarter
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Size
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Return Since
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trading.recentTrades.map((trade, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">
                        {trade.name}
                      </span>
                      {trade.ticker && (
                        <span className="text-gray-400 ml-1">
                          ({trade.ticker})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={trade.action === "buy" ? "success" : "danger"}
                    >
                      {trade.action.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {trade.quarterAdded}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {trade.positionSize.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        trade.returnSince >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercent(trade.returnSince)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        trade.outcome === "winner"
                          ? "success"
                          : trade.outcome === "loser"
                            ? "danger"
                            : "default"
                      }
                    >
                      {trade.outcome}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
