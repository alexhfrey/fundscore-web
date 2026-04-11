"use client";

import { FundDetail } from "@/lib/types";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Badge } from "@/components/ui/Badge";
import { formatExpenseRatio } from "@/lib/utils/format";
import { SCORE_THRESHOLDS } from "@/lib/constants";

function getActionLine(
  score: number,
  passiveAltTicker: string,
  passiveAltName: string
): string {
  if (score >= SCORE_THRESHOLDS.strongBuy)
    return "This fund\u2019s skill justifies its fees. Hold.";
  if (score >= SCORE_THRESHOLDS.buy)
    return "Likely to outperform. Monitor fee drag.";
  if (score >= SCORE_THRESHOLDS.hold)
    return `Mixed evidence. Consider monitoring or partial switch to ${passiveAltTicker}.`;
  if (score >= SCORE_THRESHOLDS.underperform)
    return `Likely to underperform. Consider switching to ${passiveAltTicker}.`;
  return `Strong case for switching to ${passiveAltTicker} (${passiveAltName}).`;
}

interface QuickGlanceSectionProps {
  fund: FundDetail;
}

export function QuickGlanceSection({ fund }: QuickGlanceSectionProps) {
  const actionLine = getActionLine(fund.fundScore, fund.passiveAltTicker, fund.passiveAltName);

  // Passive alt expense ratio — well-known ETFs are very cheap
  const passiveExpenseApprox = fund.expenseRatio < 0.15 ? 0.03 : 0.04;

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

        {/* Matchup infographic */}
        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 sm:p-8">
          {/* 3-column matchup: Fund | Score | Passive Alt */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
            {/* LEFT — Your Fund */}
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Your Fund
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {fund.ticker}
              </p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {fund.name}
              </p>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Expense ratio</p>
              <p className="text-base font-semibold text-gray-800">
                {formatExpenseRatio(fund.expenseRatio)}
                <span className="text-xs font-normal text-gray-400">/yr</span>
              </p>
            </div>

            {/* CENTER — FundScore */}
            <div className="flex flex-col items-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                FundScore
              </p>
              <ScoreRing score={fund.fundScore} size={160} strokeWidth={12} textVariant="hero" />
              <div className="mt-3">
                <ScoreBadge score={fund.fundScore} size="lg" />
              </div>
            </div>

            {/* RIGHT — Passive Alternative */}
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Passive Alternative
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#1466b8]">
                {fund.passiveAltTicker}
              </p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {fund.passiveAltName}
              </p>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Expense ratio</p>
              <p className="text-base font-semibold text-gray-800">
                {formatExpenseRatio(passiveExpenseApprox)}
                <span className="text-xs font-normal text-gray-400">/yr</span>
              </p>
            </div>
          </div>

          {/* Probability sentence + action line */}
          <div className="text-center mt-6 pt-5 border-t border-gray-200">
            <p className="text-lg text-gray-700">
              <span className="font-bold text-gray-900">{fund.fundScore}% chance</span> this fund
              earns its fees vs{" "}
              <span className="font-semibold text-[#1466b8]">{fund.passiveAltTicker}</span>{" "}
              over the next 3 years.
            </p>
            <p className="text-sm font-semibold text-gray-600 mt-2">
              \u2192 {actionLine}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
