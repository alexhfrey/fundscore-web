"use client";

import { useState } from "react";
import { HistoricalScenario } from "@/lib/types";

interface StressTestVisualizerProps {
  scenarios: HistoricalScenario[];
  ticker: string;
  passiveAltTicker: string;
  expenseRatio: number;
}

const CRISIS_DURATION_MONTHS: Record<string, number> = {
  "2008 Global Financial Crisis": 7,
  "2020 COVID Crash": 2,
  "2022 Rate Shock": 10,
  "2013 Taper Tantrum": 5,
};

type Verdict = "earned" | "not-earned" | "wash" | "low-fee";

function computeVerdict(
  fundReturn: number,
  passiveReturn: number,
  expenseRatio: number,
  crisisMonths: number,
): { verdict: Verdict; dollarDiff: number; feeCost: number } {
  const fundValue = 10000 * (1 + fundReturn / 100);
  const passiveValue = 10000 * (1 + passiveReturn / 100);
  const dollarDiff = fundValue - passiveValue;

  const passiveExpenseApprox = expenseRatio < 0.15 ? 0.03 : 0.04;
  const feePremium = expenseRatio - passiveExpenseApprox;
  const feeCost = 10000 * (feePremium / 100) * (crisisMonths / 12);

  if (feePremium < 0.05) {
    return { verdict: "low-fee", dollarDiff, feeCost };
  }
  if (Math.abs(dollarDiff) < 50) {
    return { verdict: "wash", dollarDiff, feeCost };
  }
  if (dollarDiff > 0 && dollarDiff > feeCost) {
    return { verdict: "earned", dollarDiff, feeCost };
  }
  return { verdict: "not-earned", dollarDiff, feeCost };
}

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; bg: string; border: string; text: string }
> = {
  earned: {
    label: "Earned its fees during this crisis",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
  },
  "not-earned": {
    label: "Didn\u2019t earn its fees during this crisis",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  wash: {
    label: "No meaningful difference during this crisis",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  "low-fee": {
    label: "Fees already near passive levels",
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-600",
  },
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function StressTestVisualizer({
  scenarios,
  ticker,
  passiveAltTicker,
  expenseRatio,
}: StressTestVisualizerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scenario = scenarios[selectedIndex];

  const crisisMonths =
    CRISIS_DURATION_MONTHS[scenario.name] ?? 6;
  const fundValue = 10000 * (1 + scenario.fundReturn / 100);
  const passiveValue = 10000 * (1 + scenario.passiveAltReturn / 100);
  const { verdict, dollarDiff, feeCost } = computeVerdict(
    scenario.fundReturn,
    scenario.passiveAltReturn,
    expenseRatio,
    crisisMonths,
  );
  const vConfig = VERDICT_CONFIG[verdict];

  const maxLoss = Math.max(
    Math.abs(scenario.fundReturn),
    Math.abs(scenario.passiveAltReturn),
  );

  const fundBetter = dollarDiff > 0;
  const absDiff = Math.abs(dollarDiff);

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {scenarios.map((s, i) => (
          <button
            key={s.name}
            onClick={() => setSelectedIndex(i)}
            className={`text-left rounded-lg p-4 transition-all ${
              i === selectedIndex
                ? "bg-white border-2 border-[#1466b8] shadow-sm"
                : "bg-gray-50 border border-gray-200 hover:border-gray-300"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                i === selectedIndex ? "text-[#1466b8]" : "text-gray-900"
              }`}
            >
              {s.name}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{s.period}</p>
            <p className="text-xs text-red-500 mt-1">
              Market {s.marketReturn > 0 ? "+" : ""}
              {s.marketReturn}%
            </p>
          </button>
        ))}
      </div>

      {/* Dollar Impact */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
          Impact on a $10,000 Investment
        </h3>

        <div className="space-y-3">
          <ImpactBar
            label={ticker}
            returnPct={scenario.fundReturn}
            dollarValue={fundValue}
            maxAbsPct={maxLoss}
          />
          <ImpactBar
            label={passiveAltTicker}
            returnPct={scenario.passiveAltReturn}
            dollarValue={passiveValue}
            maxAbsPct={maxLoss}
            isPassive
          />
        </div>

        {/* Narrative */}
        <p className="text-sm text-gray-700 leading-relaxed mt-5">
          During the {scenario.name}, your{" "}
          <span className="font-bold text-gray-900">$10,000</span> in{" "}
          <span className="font-semibold">{ticker}</span> would have{" "}
          {scenario.fundReturn < 0 ? "dropped" : "grown"} to{" "}
          <span
            className={`font-bold ${scenario.fundReturn < 0 ? "text-red-700" : "text-green-700"}`}
          >
            ${fmt(fundValue)}
          </span>
          . The passive alternative{" "}
          <span className="font-semibold text-[#1466b8]">
            {passiveAltTicker}
          </span>{" "}
          would have {scenario.passiveAltReturn < 0 ? "dropped" : "grown"} to{" "}
          <span
            className={`font-bold ${scenario.passiveAltReturn < 0 ? "text-red-700" : "text-green-700"}`}
          >
            ${fmt(passiveValue)}
          </span>
          .
          {absDiff >= 50 && (
            <>
              {" "}
              That&apos;s{" "}
              <span
                className={`font-bold ${fundBetter ? "text-green-700" : "text-red-700"}`}
              >
                ${fmt(absDiff)} {fundBetter ? "more" : "less"}
              </span>{" "}
              in your pocket with the active fund.
            </>
          )}
        </p>
      </div>

      {/* Fee Context + Verdict */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Fee Context */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Fee Premium
          </p>
          <p className="text-sm text-gray-700">
            Extra annual cost:{" "}
            <span className="font-bold text-gray-900">
              {(expenseRatio - (expenseRatio < 0.15 ? 0.03 : 0.04)).toFixed(2)}
              %
            </span>{" "}
            (${fmt(10000 * (expenseRatio - (expenseRatio < 0.15 ? 0.03 : 0.04)) / 100)}
            /yr per $10K)
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Over this {crisisMonths}-month crisis:{" "}
            <span className="font-semibold text-gray-700">
              ~${fmt(feeCost)} in extra fees
            </span>
          </p>
        </div>

        {/* Verdict */}
        <div
          className={`${vConfig.bg} border ${vConfig.border} rounded-lg p-4 flex items-center`}
        >
          <div>
            <p className={`text-sm font-bold ${vConfig.text}`}>
              {verdict === "earned" ? "\u2713" : verdict === "not-earned" ? "\u2717" : "\u2014"}{" "}
              {vConfig.label}
            </p>
            {verdict === "earned" && (
              <p className="text-xs text-gray-600 mt-1">
                The fund saved you ${fmt(absDiff)} vs the passive alt, more than
                the ~${fmt(feeCost)} in extra fees.
              </p>
            )}
            {verdict === "not-earned" && dollarDiff > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                The fund saved ${fmt(absDiff)}, but that didn&apos;t cover the ~$
                {fmt(feeCost)} in extra fees.
              </p>
            )}
            {verdict === "not-earned" && dollarDiff <= 0 && (
              <p className="text-xs text-gray-600 mt-1">
                The fund lost ${fmt(absDiff)} more than the passive alt — and
                charged higher fees.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recovery */}
      <p className="text-sm text-gray-500">
        Recovery time:{" "}
        <span className="font-semibold text-gray-700">
          {scenario.recoveryMonths <= 1
            ? "Recovered almost immediately"
            : `${scenario.recoveryMonths} months`}
        </span>
      </p>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function ImpactBar({
  label,
  returnPct,
  dollarValue,
  maxAbsPct,
  isPassive = false,
}: {
  label: string;
  returnPct: number;
  dollarValue: number;
  maxAbsPct: number;
  isPassive?: boolean;
}) {
  const absReturn = Math.abs(returnPct);
  const width = maxAbsPct > 0 ? (absReturn / maxAbsPct) * 100 : 0;
  const isLoss = returnPct < 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`w-16 font-semibold flex-shrink-0 ${isPassive ? "text-[#1466b8]" : "text-gray-900"}`}
      >
        {label}
      </span>
      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
        <div
          className={`h-full rounded transition-all duration-300 ${
            isLoss
              ? isPassive
                ? "bg-blue-300"
                : "bg-red-400"
              : isPassive
                ? "bg-blue-300"
                : "bg-green-400"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-32 text-right flex-shrink-0">
        {isLoss ? "\u2212" : "+"}
        {absReturn.toFixed(1)}% &rarr; ${fmt(dollarValue)}
      </span>
    </div>
  );
}

/* ── Exported verdict helper (used by StressTestSection) ── */

export { computeVerdict, CRISIS_DURATION_MONTHS };
export type { Verdict };
