"use client";

import { FundDetail } from "@/lib/types";
import { BayesianSkillChart } from "@/components/charts/BayesianSkillChart";
import { PercentileIndicator } from "@/components/ui/PercentileIndicator";
import { SkillDecomposition } from "@/components/fund/SkillDecomposition";
import { ExpectedOutcomeRange } from "@/components/fund/ExpectedOutcomeRange";
import { formatBps } from "@/lib/utils/format";
import { getFundType } from "@/lib/utils/fundTypeHelpers";

interface SkillSectionProps {
  fund: FundDetail;
}

function getSkillVerdict(credibleInterval80: [number, number]): {
  label: string;
  verdictKey: "strong" | "mixed" | "weak";
  color: string;
  bgColor: string;
} {
  const lower = credibleInterval80[0];
  if (lower > 0.5) {
    return { label: "Strong Evidence of Skill", verdictKey: "strong", color: "text-green-700", bgColor: "bg-green-50 border-green-200" };
  }
  const upper = credibleInterval80[1];
  if (upper < 0.5) {
    return { label: "Weak Evidence of Skill", verdictKey: "weak", color: "text-red-700", bgColor: "bg-red-50 border-red-200" };
  }
  return { label: "Mixed Evidence", verdictKey: "mixed", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" };
}

export function SkillSection({ fund }: SkillSectionProps) {
  const { skillAssessment } = fund;
  const fundType = getFundType(fund.assetClass);
  const dist = skillAssessment.bayesianDistribution;
  const verdict = getSkillVerdict(dist.credibleInterval80);
  const battingPct = (skillAssessment.battingAverage * 100).toFixed(1);

  const confidence = Math.max(0, Math.min(100, Math.round((1 - dist.posteriorStdDev * 4) * 100)));
  const breakeven = (fund.expenseRatio - 0.04).toFixed(2);

  return (
    <div className="space-y-8">
      {/* A. Skill Verdict card */}
      <div className={`border rounded-xl p-5 ${verdict.bgColor}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-lg font-bold ${verdict.color}`}>{verdict.label}</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          This manager gets {battingPct}% of investment decisions right (vs. the benchmark), with
          an average win of {formatBps(skillAssessment.avgWinSize)} and average loss of {formatBps(-skillAssessment.avgLossSize)}.
          {skillAssessment.winLossRatio > 1
            ? ` The wins are ${skillAssessment.winLossRatio}x larger than losses — the manager cuts losers and lets winners run.`
            : ` Losses are larger than wins (${skillAssessment.winLossRatio}x ratio), which puts more pressure on the batting average.`}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          {verdict.verdictKey === "strong" && (
            <>What this means for you: This manager&apos;s demonstrated skill exceeds the fee hurdle. The active management premium appears justified by the evidence.</>
          )}
          {verdict.verdictKey === "mixed" && (
            <>What this means for you: When skill evidence is mixed, the fee structure matters more. At {fund.expenseRatio}% expense ratio, this fund needs to generate at least ~{breakeven}%/year above the passive alternative to justify its costs.</>
          )}
          {verdict.verdictKey === "weak" && (
            <>What this means for you: Without clear evidence of skill, the fee drag is likely to erode returns over time. Consider whether the passive alternative offers a better risk-adjusted outcome.</>
          )}
        </p>

        {/* Confidence bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Confidence</span>
            <span className="text-xs font-semibold text-gray-700">{confidence}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${verdict.verdictKey === "strong" ? "bg-green-500" : verdict.verdictKey === "weak" ? "bg-red-500" : "bg-amber-500"}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* Batting Average + Win/Loss */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Batting Average */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Winning Quarters
          </p>
          <p className="text-4xl font-bold text-gray-900">
            {battingPct}%
          </p>
          <p className="text-sm text-gray-500 mt-1 mb-3">of quarterly periods beat the passive alternative</p>
          <p className="text-xs text-gray-400">
            A coin flip gives you 50%. Top-quartile managers hit 60%+.
          </p>
        </div>

        {/* Win/Loss Asymmetry */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
            How Big Are the Wins vs Losses
          </p>
          <div className="flex items-end justify-center gap-6 h-28">
            <div className="flex flex-col items-center">
              <div
                className="w-14 bg-green-500 rounded-t"
                style={{
                  height: `${Math.min(100, (skillAssessment.avgWinSize / 200) * 100)}px`,
                }}
              />
              <p className="text-sm font-semibold text-green-600 mt-1">
                {formatBps(skillAssessment.avgWinSize)}
              </p>
              <p className="text-xs text-gray-500">Avg Win</p>
            </div>
            <div className="flex flex-col items-center">
              <div
                className="w-14 bg-red-500 rounded-t"
                style={{
                  height: `${Math.min(100, (skillAssessment.avgLossSize / 200) * 100)}px`,
                }}
              />
              <p className="text-sm font-semibold text-red-600 mt-1">
                {formatBps(-skillAssessment.avgLossSize)}
              </p>
              <p className="text-xs text-gray-500">Avg Loss</p>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">
            Ratio: <span className="font-semibold">{skillAssessment.winLossRatio}x</span>
            {skillAssessment.winLossRatio > 1
              ? " — wins bigger than losses"
              : " — losses bigger than wins"}
          </p>
        </div>
      </div>

      {/* FI-specific timing skills */}
      {fundType === "fixedIncome" &&
        skillAssessment.durationTimingSkill != null &&
        skillAssessment.creditTimingSkill != null && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Duration Timing
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {(skillAssessment.durationTimingSkill * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Credit Timing
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {(skillAssessment.creditTimingSkill * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        )}

      {/* Expected Outcome Range */}
      <ExpectedOutcomeRange fund={fund} />

      {/* C. Advanced analytics — collapsed */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Statistical methodology (for advanced users)
        </summary>
        <div className="mt-4 space-y-8">
          {/* Active Bets Per Year (moved from above) */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Active Bets Per Year
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {skillAssessment.independentDecisions}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              How many meaningful deviations from the index per year. More bets = more chances for skill to show.
            </p>
          </div>

          {/* Bayesian True Skill */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              Bayesian True Skill Estimate
            </h3>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <BayesianSkillChart distribution={dist} />
              <p className="text-sm text-gray-600 mt-3">
                Given {dist.observedTotal} observed decisions at{" "}
                {battingPct}% hit rate, there is an{" "}
                <span className="font-semibold">80% probability</span> the manager&apos;s
                true skill is between{" "}
                <span className="font-semibold">
                  {(dist.credibleInterval80[0] * 100).toFixed(1)}%
                </span>{" "}
                and{" "}
                <span className="font-semibold">
                  {(dist.credibleInterval80[1] * 100).toFixed(1)}%
                </span>
                .
              </p>
            </div>
          </div>

          {/* IR Formula */}
          <SkillDecomposition fund={fund} />
        </div>
      </details>
    </div>
  );
}
