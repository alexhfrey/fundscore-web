"use client";

import { FundDetail } from "@/lib/types";
import { MetricCard } from "@/components/ui/MetricCard";
import { ReturnValue } from "@/components/ui/ReturnValue";
import { ScoreWaterfallChart } from "@/components/charts/ScoreWaterfallChart";
import { PerformanceLineChart } from "@/components/charts/PerformanceLineChart";
import { cumulativeReturnSeries, filterReturnsByRange } from "@/lib/utils/calculations";
import { formatAUM, formatExpenseRatio, formatPercent } from "@/lib/utils/format";
import { AnalystNote } from "@/components/fund/AnalystNote";
import { ExpectedOutcomeRange } from "@/components/fund/ExpectedOutcomeRange";
import { InvestmentReasons } from "@/components/fund/InvestmentReasons";
import { AlphaDecomposition } from "@/components/fund/AlphaDecomposition";

interface OverviewTabProps {
  fund: FundDetail;
}

export function OverviewTab({ fund }: OverviewTabProps) {
  const recentFundReturns = filterReturnsByRange(
    fund.performance.monthlyReturns,
    "3Y"
  );
  const recentPassiveReturns = filterReturnsByRange(
    fund.performance.passiveAltMonthlyReturns,
    "3Y"
  );

  const fundCumulative = cumulativeReturnSeries(recentFundReturns);
  const passiveCumulative = cumulativeReturnSeries(recentPassiveReturns);

  return (
    <div className="space-y-8">
      {/* FundScore callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <p className="text-sm text-blue-900">
          <span className="font-bold text-lg">{fund.fundScore}%</span>{" "}
          probability of outperforming{" "}
          <span className="font-semibold">
            {fund.passiveAltTicker} ({fund.passiveAltName})
          </span>{" "}
          over the next year. FundScore rated{" "}
          <span className="font-semibold">{fund.scoreLabel}</span>.
        </p>
      </div>

      {/* Expected Outcome Range */}
      <ExpectedOutcomeRange fund={fund} />

      {/* AI Analyst Note */}
      <AnalystNote note={fund.analystNote} />

      {/* Reasons to Invest / Avoid */}
      <InvestmentReasons fund={fund} />

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="1Y Return" value="" subtitle={`Peer avg: ${formatPercent(fund.peerAvgOneYearReturn)}`}>
          <ReturnValue value={fund.oneYearReturn} className="text-2xl font-bold" />
        </MetricCard>
        <MetricCard label="3Y Return (Ann.)" value="" subtitle={`Peer avg: ${formatPercent(fund.peerAvgThreeYearReturn)}`}>
          <ReturnValue value={fund.threeYearReturn} className="text-2xl font-bold" />
        </MetricCard>
        <MetricCard label="Expense Ratio" value={formatExpenseRatio(fund.expenseRatio)} subtitle={`Peer avg: ${formatExpenseRatio(fund.fees.peerAvgExpenseRatio)}`} />
        <MetricCard label="AUM" value={formatAUM(fund.aum)} subtitle={`Rank ${fund.peerAumRank} of ${fund.peerFundCount} funds`} />
      </div>

      {/* Score drivers */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Score Drivers
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <ScoreWaterfallChart drivers={fund.score.drivers} />
        </div>
      </div>

      {/* Performance chart */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {fund.ticker} vs {fund.passiveAltTicker} — 3 Year Performance
        </h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <PerformanceLineChart
            series={[
              { name: `${fund.ticker} (Fund)`, data: fundCumulative, color: "#1466b8" },
              {
                name: `${fund.passiveAltTicker} (Best Passive Alternative)`,
                data: passiveCumulative,
                color: "#9ca3af",
              },
            ]}
            height={300}
          />
        </div>
      </div>

      {/* Expected Alpha Decomposition */}
      <AlphaDecomposition fund={fund} />

      {/* Investment objective */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Investment Objective
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {fund.investmentObjective}
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Investment Strategy
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {fund.investmentStrategy}
          </p>
        </div>
      </div>
    </div>
  );
}
