"use client";

import { FundDetail } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { formatExpenseRatio } from "@/lib/utils/format";
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

  return (
    <div className="space-y-8">
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

      {/* Active Share Breakdown */}
      <ActiveShareBreakdown fund={fund} />

      {/* Fee breakdown */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Fee Breakdown</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
      </div>

      {/* Sales charges */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Sales Charges</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
      </div>

      {/* Passive Clone Recipe */}
      <PassiveRecipe fund={fund} />
    </div>
  );
}
