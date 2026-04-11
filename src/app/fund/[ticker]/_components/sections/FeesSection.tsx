"use client";

import { FundDetail } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { formatExpenseRatio } from "@/lib/utils/format";
import { computeTrailingReturns } from "@/lib/utils/calculations";
import { ActiveShareBreakdown } from "@/components/fund/ActiveShareBreakdown";
import { PassiveRecipe } from "@/components/fund/PassiveRecipe";

interface FeesSectionProps {
  fund: FundDetail;
}

export function FeesSection({ fund }: FeesSectionProps) {
  const { fees } = fund;
  const feeLevelVariant =
    fees.feeLevel === "Low" || fees.feeLevel === "Below Average"
      ? "success"
      : fees.feeLevel === "Average"
        ? "warning"
        : "danger";

  const effectiveActiveCost = fund.trading.activeShare > 0
    ? fund.fees.expenseRatio / fund.trading.activeShare
    : fund.fees.expenseRatio;

  const passiveExpenseApprox = fund.expenseRatio < 0.15 ? 0.03 : 0.04;
  const feeGap = (fund.expenseRatio - passiveExpenseApprox) * 100;

  const passiveReturns = computeTrailingReturns(fund.performance.passiveAltMonthlyReturns);
  const fund3Y = fund.performance.trailingReturns.threeYear;
  const passive3Y = passiveReturns.threeYear;
  const netReturnDiff = fund3Y != null && passive3Y != null ? fund3Y - passive3Y : null;
  const grossSkill = netReturnDiff != null ? netReturnDiff + feeGap : null;

  return (
    <div className="space-y-8">
      {/* Can It Earn Its Fees? — relocated from hero */}
      {grossSkill != null && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Can This Manager Earn Their Fees?
          </h3>
          <div className="max-w-md space-y-2 text-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-gray-600">Manager&apos;s gross edge</span>
              <span className={`font-bold tabular-nums ${grossSkill >= 0 ? "text-green-700" : "text-red-700"}`}>
                {grossSkill >= 0 ? "+" : ""}{grossSkill.toFixed(2)}%/yr
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-gray-600">Extra fees vs {fund.passiveAltTicker}</span>
              <span className="font-bold tabular-nums text-red-700">
                &minus;{feeGap.toFixed(2)}%/yr
              </span>
            </div>
            <div className="border-t border-gray-300 my-1" />
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-gray-900">Net expected edge</span>
              <span className={`font-black text-base tabular-nums ${
                netReturnDiff != null && netReturnDiff >= 0 ? "text-green-700" : "text-red-700"
              }`}>
                {netReturnDiff != null ? `${netReturnDiff >= 0 ? "+" : ""}${netReturnDiff.toFixed(2)}%/yr` : "\u2014"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Based on 3-year annualized returns
          </p>
        </div>
      )}

      {/* Active Share Breakdown */}
      <ActiveShareBreakdown fund={fund} />

      {/* Fee overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Fee Overview</h3>
          <Badge variant={feeLevelVariant as "success" | "warning" | "danger"}>
            {fees.feeLevel}
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Net Expense Ratio
            </p>
            <p className="text-4xl font-bold text-gray-900">
              {formatExpenseRatio(fees.expenseRatio)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Peer group average: {formatExpenseRatio(fees.peerAvgExpenseRatio)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Effective Active Cost
            </p>
            <p className="text-4xl font-bold text-gray-900">
              {formatExpenseRatio(effectiveActiveCost)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Cost per dollar of active management
            </p>
          </div>
          <div className="flex items-center">
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Fund</span>
                <span>Category Avg</span>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute h-full rounded-full bg-[#1466b8]"
                  style={{
                    width: `${Math.min(100, (fees.expenseRatio / Math.max(fees.expenseRatio, fees.peerAvgExpenseRatio) * 1.2) * 100 / 1.2)}%`,
                  }}
                />
                <div
                  className="absolute h-full w-0.5 bg-gray-400"
                  style={{
                    left: `${Math.min(100, (fees.peerAvgExpenseRatio / Math.max(fees.expenseRatio, fees.peerAvgExpenseRatio) * 1.2) * 100 / 1.2)}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 text-center">(lower is better)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fee breakdown — collapsed */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Fee Breakdown
        </summary>
        <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fee Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 text-gray-900">Management Fee</td>
                <td className="px-4 py-3 text-right font-medium">{formatExpenseRatio(fees.managementFee)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-900">12b-1 Fee</td>
                <td className="px-4 py-3 text-right font-medium">
                  {fees.twelveBOneOne > 0 ? formatExpenseRatio(fees.twelveBOneOne) : "None"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-900">Other Expenses</td>
                <td className="px-4 py-3 text-right font-medium">{formatExpenseRatio(fees.otherExpenses)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-900">Total Expense Ratio</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">{formatExpenseRatio(fees.expenseRatio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      {/* Sales charges — collapsed */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Sales Charges
        </summary>
        <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 text-gray-900">Front-End Load</td>
                <td className="px-4 py-3 text-right font-medium">
                  {fees.frontLoad > 0 ? `${fees.frontLoad.toFixed(2)}%` : "None"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-900">Deferred Load</td>
                <td className="px-4 py-3 text-right font-medium">
                  {fees.deferredLoad > 0 ? `${fees.deferredLoad.toFixed(2)}%` : "None"}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-gray-900">Redemption Fee</td>
                <td className="px-4 py-3 text-right font-medium">
                  {fees.redemptionFee > 0 ? `${fees.redemptionFee.toFixed(2)}%` : "None"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      {/* Passive Clone Recipe */}
      <PassiveRecipe fund={fund} />
    </div>
  );
}
