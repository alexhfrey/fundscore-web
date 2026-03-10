"use client";

import { FundDetail } from "@/lib/types";
import { FactorSensitivityChart } from "@/components/charts/FactorSensitivityChart";
import { HistoricalScenarioTable } from "@/components/charts/HistoricalScenarioTable";
import { RiskDecompositionChart } from "@/components/charts/RiskDecompositionChart";
import { DurationRiskChart } from "@/components/charts/DurationRiskChart";
import { DownsideProtection } from "@/components/fund/DownsideProtection";
import { getFundType } from "@/lib/utils/fundTypeHelpers";

interface RisksSectionProps {
  fund: FundDetail;
}

export function RisksSection({ fund }: RisksSectionProps) {
  const { factorRisk } = fund;
  const fundType = getFundType(fund.assetClass);

  const { risk } = fund;

  return (
    <div className="space-y-8">
      {/* Risk at a Glance */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk at a Glance</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <RiskMetric
            label="Std Dev (3Y)"
            value={`${risk.standardDeviation.threeYear.toFixed(1)}%`}
            catAvg={`${risk.categoryAvg.standardDeviation.toFixed(1)}%`}
            hint="(lower = less volatile)"
          />
          <RiskMetric
            label="Sharpe (3Y)"
            value={risk.sharpeRatio.threeYear.toFixed(2)}
            catAvg={risk.categoryAvg.sharpeRatio.toFixed(2)}
            hint="(higher = better)"
          />
          <RiskMetric
            label="Beta (3Y)"
            value={risk.beta.threeYear.toFixed(2)}
            catAvg={risk.categoryAvg.beta.toFixed(2)}
            hint="(1.0 = market)"
          />
          <RiskMetric
            label="Max Drawdown"
            value={`${risk.maxDrawdown.toFixed(1)}%`}
            catAvg={`${risk.categoryAvg.maxDrawdown.toFixed(1)}%`}
            hint="(closer to 0 = better)"
          />
        </div>
      </div>

      {/* Primary: Factor Sensitivities or Duration Risk */}
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

          {/* Key rate durations */}
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

          {/* Credit spread sensitivity */}
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

      {/* Historical Scenarios */}
      {factorRisk.historicalScenarios.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Historical Stress Scenarios
          </h3>
          <HistoricalScenarioTable scenarios={factorRisk.historicalScenarios} />
        </div>
      )}

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

      {/* Capture Ratios */}
      <DownsideProtection fund={fund} />
    </div>
  );
}

function RiskMetric({
  label,
  value,
  catAvg,
  hint,
}: {
  label: string;
  value: string;
  catAvg: string;
  hint: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">Cat avg: {catAvg}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  );
}
