"use client";

import { FundDetail } from "@/lib/types";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Badge } from "@/components/ui/Badge";
import { formatExpenseRatio } from "@/lib/utils/format";
import {
  computeTrailingReturns,
  maxDrawdown,
} from "@/lib/utils/calculations";

interface QuickGlanceSectionProps {
  fund: FundDetail;
}

export function QuickGlanceSection({ fund }: QuickGlanceSectionProps) {
  const passiveReturns = computeTrailingReturns(fund.performance.passiveAltMonthlyReturns);

  // 3Y return differential — the key comparison metric
  const fund3Y = fund.performance.trailingReturns.threeYear;
  const passive3Y = passiveReturns.threeYear;
  const returnDiff = fund3Y != null && passive3Y != null ? fund3Y - passive3Y : null;

  // Passive alt max drawdown from monthly returns
  const passiveMaxDD = maxDrawdown(fund.performance.passiveAltMonthlyReturns);

  // Passive alt expense ratio — well-known ETFs are very cheap
  // Approximate from fee level: passive ETFs typically 0.03-0.20%
  const passiveExpenseApprox = fund.expenseRatio < 0.15 ? 0.03 : 0.04;

  // Fee multiplier
  const feeMultiplier = passiveExpenseApprox > 0
    ? (fund.expenseRatio / passiveExpenseApprox).toFixed(0)
    : null;

  return (
    <section className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Fund name row */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{fund.name}</h1>
            <Badge variant="primary">{fund.ticker}</Badge>
          </div>
          <p className="text-sm text-gray-500">
            {fund.peerGroup} &middot; Managed by {fund.manager} (since {fund.managerStartYear})
          </p>
        </div>

        {/* Two-column: Score verdict | Quick comparison */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: The FundScore Verdict */}
          <div className="flex-1 bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-xl p-6">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-4">
              FundScore Forward-Looking Assessment
            </p>
            <div className="flex items-center gap-5">
              <ScoreRing score={fund.fundScore} size={110} strokeWidth={9} />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ScoreBadge score={fund.fundScore} size="lg" />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed max-w-sm">
                  <span className="font-bold text-gray-900">{fund.fundScore}% probability</span> of
                  beating <span className="font-semibold text-[#1466b8]">{fund.passiveAltTicker}</span> over
                  the next 3 years.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-200/60">
              <p className="text-xs text-gray-500 leading-relaxed">
                Based on statistical skill assessment, fee drag analysis, and factor decomposition — not just past returns.
                The passive alternative <span className="font-semibold">{fund.passiveAltTicker}</span> ({fund.passiveAltName})
                was matched by category, style, and factor exposure.
              </p>
            </div>
          </div>

          {/* RIGHT: Quick Comparison — 3 key metrics */}
          <div className="lg:w-80 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {fund.ticker} vs {fund.passiveAltTicker}
            </p>

            {/* 3Y Return comparison */}
            <ComparisonMetric
              label="3Y Annualized Return"
              fundValue={fund3Y != null ? `${fund3Y >= 0 ? "+" : ""}${fund3Y.toFixed(1)}%` : "—"}
              passiveValue={passive3Y != null ? `${passive3Y >= 0 ? "+" : ""}${passive3Y.toFixed(1)}%` : "—"}
              diff={returnDiff}
              diffLabel={returnDiff != null ? `${returnDiff >= 0 ? "+" : ""}${returnDiff.toFixed(1)}pp` : null}
            />

            {/* Expense Ratio */}
            <ComparisonMetric
              label="Annual Cost"
              fundValue={formatExpenseRatio(fund.expenseRatio)}
              passiveValue={formatExpenseRatio(passiveExpenseApprox)}
              diff={-(fund.expenseRatio - passiveExpenseApprox)}
              diffLabel={feeMultiplier ? `${feeMultiplier}× more` : null}
              note={`Peer avg: ${formatExpenseRatio(fund.fees.peerAvgExpenseRatio)}`}
            />

            {/* Max Drawdown */}
            <ComparisonMetric
              label="Worst Drawdown"
              fundValue={`${fund.risk.maxDrawdown.toFixed(1)}%`}
              passiveValue={`${passiveMaxDD.drawdown.toFixed(1)}%`}
              diff={fund.risk.maxDrawdown - passiveMaxDD.drawdown}
              diffLabel={
                fund.risk.maxDrawdown > passiveMaxDD.drawdown
                  ? `${(fund.risk.maxDrawdown - passiveMaxDD.drawdown).toFixed(1)}pp better`
                  : `${(passiveMaxDD.drawdown - fund.risk.maxDrawdown).toFixed(1)}pp worse`
              }
              note={null}
            />
          </div>
        </div>

        {/* Investment objective */}
        <p className="text-sm text-gray-500 mt-5 line-clamp-2" title={fund.investmentObjective}>
          {fund.investmentObjective}
        </p>
      </div>
    </section>
  );
}

function ComparisonMetric({
  label,
  fundValue,
  passiveValue,
  diff,
  diffLabel,
  note,
  favorableColor = "green",
}: {
  label: string;
  fundValue: string;
  passiveValue: string | null;
  diff: number | null;
  diffLabel: string | null;
  note?: string | null;
  favorableColor?: "green" | "red";
}) {
  const isPositive = diff != null && diff >= 0;
  const colorClass = diffLabel
    ? diffLabel.includes("better") || isPositive
      ? "text-green-600"
      : "text-red-600"
    : "text-gray-400";

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-bold text-gray-900">{fundValue}</span>
        {passiveValue && (
          <span className="text-sm text-gray-400">vs {passiveValue}</span>
        )}
        {diffLabel && (
          <span className={`text-sm font-semibold ${colorClass}`}>
            {diffLabel}
          </span>
        )}
      </div>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
    </div>
  );
}
