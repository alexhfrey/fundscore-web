"use client";

import { FundDetail } from "@/lib/types";
import { FactorSensitivityChart } from "@/components/charts/FactorSensitivityChart";

import { RiskDecompositionChart } from "@/components/charts/RiskDecompositionChart";
import { DurationRiskChart } from "@/components/charts/DurationRiskChart";
import { getFundType } from "@/lib/utils/fundTypeHelpers";
import { maxDrawdown as computeMaxDrawdown } from "@/lib/utils/calculations";

interface RisksSectionProps {
  fund: FundDetail;
}

export function RisksSection({ fund }: RisksSectionProps) {
  const { factorRisk, risk } = fund;
  const fundType = getFundType(fund.assetClass);

  // Dollar-based drawdown for $10K investment
  const fundDD = risk.maxDrawdown; // already a percentage (e.g., 21.5 means -21.5%)
  const passiveDD = computeMaxDrawdown(fund.performance.passiveAltMonthlyReturns);
  const fundDollarLoss = 10000 * (fundDD / 100);
  const passiveDollarLoss = 10000 * (passiveDD.drawdown / 100);
  const fundLowPoint = 10000 - fundDollarLoss;
  const passiveLowPoint = 10000 - passiveDollarLoss;

  // Capture ratios
  const upside = risk.upsideCaptureRatio;
  const downside = risk.downsideCaptureRatio;
  const captureAsymmetry = upside - downside;

  // Volatility comparison
  const fundVol = risk.standardDeviation.threeYear;
  const catVol = risk.categoryAvg.standardDeviation;
  const volComparison = fundVol < catVol * 0.9
    ? "less volatile"
    : fundVol > catVol * 1.1
      ? "more volatile"
      : "about as volatile as";

  return (
    <div className="space-y-8">
      {/* 1. Plain-English Risk Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          How Much Can You Lose?
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          In the worst period on record, a{" "}
          <span className="font-bold text-gray-900">$10,000</span> investment in{" "}
          <span className="font-semibold">{fund.ticker}</span> would have dropped to{" "}
          <span className="font-bold text-red-700">
            ${fundLowPoint.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          {" "}(a {fundDD.toFixed(1)}% drawdown). The passive alternative{" "}
          <span className="font-semibold text-[#1466b8]">{fund.passiveAltTicker}</span>{" "}
          would have dropped to{" "}
          <span className="font-bold text-red-700">
            ${passiveLowPoint.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
          {" "}({passiveDD.drawdown.toFixed(1)}%).
        </p>

        {/* Visual drawdown comparison */}
        <div className="mt-4 space-y-2">
          <DrawdownBar
            label={fund.ticker}
            pct={fundDD}
            dollarValue={fundLowPoint}
            maxPct={Math.max(fundDD, passiveDD.drawdown)}
          />
          <DrawdownBar
            label={fund.passiveAltTicker}
            pct={passiveDD.drawdown}
            dollarValue={passiveLowPoint}
            maxPct={Math.max(fundDD, passiveDD.drawdown)}
            isPassive
          />
        </div>

        <p className="text-sm text-gray-600 mt-4">
          This fund is {volComparison} its peer group
          {" "}({fundVol.toFixed(1)}% vs {catVol.toFixed(1)}% annualized volatility).
        </p>
      </div>

      {/* 2. Up vs Down Markets (simplified capture ratios) */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          Up Markets vs Down Markets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <CaptureCard
            label="In up markets"
            pct={upside}
            description={
              upside >= 100
                ? `captures ${upside.toFixed(0)}% of gains \u2014 keeps pace or beats the market when things go well`
                : `captures ${upside.toFixed(0)}% of gains \u2014 gives up some upside when the market rises`
            }
            color="green"
          />
          <CaptureCard
            label="In down markets"
            pct={downside}
            description={
              downside < 100
                ? `absorbs ${downside.toFixed(0)}% of losses \u2014 provides some cushion in downturns`
                : `absorbs ${downside.toFixed(0)}% of losses \u2014 falls as much or more than the market`
            }
            color="red"
          />
        </div>
        <p className="text-sm text-gray-600 mt-4">
          {captureAsymmetry > 5
            ? `Net result: favorable asymmetry of +${captureAsymmetry.toFixed(0)}pp \u2014 this fund captures more of the upside than the downside.`
            : captureAsymmetry > -5
              ? `Net result: roughly symmetric \u2014 gains and losses track the market closely.`
              : `Net result: unfavorable asymmetry of ${captureAsymmetry.toFixed(0)}pp \u2014 this fund captures more of the downside than the upside.`}
        </p>
      </div>

      {/* 4. Technical Risk Metrics (collapsed) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Technical Risk Metrics
        </summary>
        <div className="mt-4 space-y-8">
          {/* Risk at a Glance */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quantitative Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <RiskMetric
                label="Std Dev (3Y)"
                value={`${risk.standardDeviation.threeYear.toFixed(1)}%`}
                catAvg={`${risk.categoryAvg.standardDeviation.toFixed(1)}%`}
              />
              <RiskMetric
                label="Sharpe (3Y)"
                value={risk.sharpeRatio.threeYear.toFixed(2)}
                catAvg={risk.categoryAvg.sharpeRatio.toFixed(2)}
              />
              <RiskMetric
                label="Beta (3Y)"
                value={risk.beta.threeYear.toFixed(2)}
                catAvg={risk.categoryAvg.beta.toFixed(2)}
              />
              <RiskMetric
                label="Max Drawdown"
                value={`${risk.maxDrawdown.toFixed(1)}%`}
                catAvg={`${risk.categoryAvg.maxDrawdown.toFixed(1)}%`}
              />
            </div>
          </div>

          {/* Factor Sensitivities or Duration Risk */}
          {fundType === "fixedIncome" && factorRisk.durationRisk ? (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Interest Rate Sensitivity
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <DurationRiskChart
                  impacts={factorRisk.durationRisk.rateShiftImpacts}
                  effectiveDuration={factorRisk.durationRisk.effectiveDuration}
                />
              </div>

              <div className="mt-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tenor</th>
                      {factorRisk.durationRisk.keyRateDurations.map((krd) => (
                        <th key={krd.tenor} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                          {krd.tenor}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 font-medium text-gray-900">Key Rate Duration</td>
                      {factorRisk.durationRisk.keyRateDurations.map((krd) => (
                        <td key={krd.tenor} className="px-4 py-3 text-right text-gray-700">
                          {krd.duration.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-sm text-gray-600">
                Credit spread sensitivity:{" "}
                <span className="font-semibold">{factorRisk.durationRisk.creditSpreadSensitivity.toFixed(2)}</span>
                {" "}&mdash; a 100bp widening in credit spreads would reduce NAV by approximately{" "}
                {factorRisk.durationRisk.creditSpreadSensitivity.toFixed(1)}%.
              </p>
            </div>
          ) : factorRisk.factorSensitivities.length > 0 ? (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Factor Sensitivity
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <FactorSensitivityChart sensitivities={factorRisk.factorSensitivities} />
              </div>
            </div>
          ) : null}

          {/* Risk Decomposition */}
          {factorRisk.riskDecomposition.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Risk Decomposition
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <RiskDecompositionChart data={factorRisk.riskDecomposition} />
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function DrawdownBar({
  label,
  pct,
  dollarValue,
  maxPct,
  isPassive = false,
}: {
  label: string;
  pct: number;
  dollarValue: number;
  maxPct: number;
  isPassive?: boolean;
}) {
  const width = maxPct > 0 ? (pct / maxPct) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`w-16 font-semibold flex-shrink-0 ${isPassive ? "text-[#1466b8]" : "text-gray-900"}`}>
        {label}
      </span>
      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
        <div
          className={`h-full rounded ${isPassive ? "bg-blue-300" : "bg-red-400"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-28 text-right flex-shrink-0">
        &minus;{pct.toFixed(1)}% &rarr; ${dollarValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}

function CaptureCard({
  label,
  pct,
  description,
  color,
}: {
  label: string;
  pct: number;
  description: string;
  color: "green" | "red";
}) {
  const barColor = color === "green" ? "bg-green-500" : "bg-red-400";
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold text-gray-900">{pct.toFixed(0)}%</span>
        <span className="text-xs text-gray-400">capture ratio</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, (pct / 140) * 100)}%` }}
        />
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function RiskMetric({
  label,
  value,
  catAvg,
}: {
  label: string;
  value: string;
  catAvg: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">Cat avg: {catAvg}</p>
    </div>
  );
}
