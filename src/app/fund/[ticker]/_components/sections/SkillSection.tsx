"use client";

import { FundDetail } from "@/lib/types";
import { BayesianSkillChart } from "@/components/charts/BayesianSkillChart";
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
  const ci80Low = (dist.credibleInterval80[0] * 100).toFixed(0);
  const ci80High = (dist.credibleInterval80[1] * 100).toFixed(0);
  const posteriorPct = (dist.posteriorMean * 100).toFixed(0);

  return (
    <div className="space-y-8">
      {/* 1. Distribution Plot — the centerpiece */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Where Does This Manager Fall?
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Estimated chance of beating the passive alternative, based on {dist.observedTotal} observed decisions.
        </p>

        <BayesianSkillChart distribution={dist} />

        {/* X-axis label */}
        <p className="text-xs text-gray-400 text-center mt-1">
          Chance of beating {fund.passiveAltTicker} in any given period
        </p>

        {/* Plain-English interpretation */}
        <div className={`mt-5 border rounded-lg p-4 ${verdict.bgColor}`}>
          <p className={`font-semibold ${verdict.color}`}>{verdict.label}</p>
          <p className="text-sm text-gray-700 mt-1">
            {verdict.verdictKey === "strong" && (
              <>
                There&apos;s an 80% probability this manager&apos;s true skill is between{" "}
                <span className="font-semibold">{ci80Low}%</span> and{" "}
                <span className="font-semibold">{ci80High}%</span> &mdash;
                comfortably above the 50% coin-flip line. This manager appears to
                genuinely add value.
              </>
            )}
            {verdict.verdictKey === "mixed" && (
              <>
                There&apos;s an 80% probability this manager&apos;s true skill is between{" "}
                <span className="font-semibold">{ci80Low}%</span> and{" "}
                <span className="font-semibold">{ci80High}%</span>.
                The range straddles the 50% coin-flip line, so we can&apos;t
                confidently say this is skill rather than luck.
              </>
            )}
            {verdict.verdictKey === "weak" && (
              <>
                There&apos;s an 80% probability this manager&apos;s true skill is between{" "}
                <span className="font-semibold">{ci80Low}%</span> and{" "}
                <span className="font-semibold">{ci80High}%</span> &mdash;
                mostly below the 50% coin-flip line. The evidence suggests this
                manager does not consistently add value.
              </>
            )}
          </p>
        </div>
      </div>

      {/* 2. Supporting evidence: Batting Avg + Win/Loss */}
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

      {/* 3. Expected Outcome Range */}
      <ExpectedOutcomeRange fund={fund} />

      {/* 4. FI-specific timing skills */}
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

      {/* 5. Advanced analytics — collapsed */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Statistical methodology
        </summary>
        <div className="mt-4 space-y-8">
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
          <SkillDecomposition fund={fund} />
        </div>
      </details>
    </div>
  );
}
