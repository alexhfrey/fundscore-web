import { FundDetail } from "@/lib/types";

export function ActiveShareBreakdown({ fund }: { fund: FundDetail }) {
  const activeShare = fund.trading.activeShare;
  const activePercent = activeShare * 100;
  const passivePercent = 100 - activePercent;
  const effectiveCost = fund.fees.expenseRatio / activeShare;
  const activeDollars = Math.round(activePercent);
  const passiveDollars = 100 - activeDollars;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Share Breakdown</h3>
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        {/* Horizontal stacked bar */}
        <div className="relative h-8 rounded-full overflow-hidden flex">
          <div style={{ width: `${activePercent}%` }} className="bg-[#1466b8] flex items-center justify-center">
            {activePercent > 15 && <span className="text-xs font-medium text-white">Active {activePercent.toFixed(0)}%</span>}
          </div>
          <div style={{ width: `${passivePercent}%` }} className="bg-gray-200 flex items-center justify-center">
            {passivePercent > 15 && <span className="text-xs font-medium text-gray-600">Passive Overlap {passivePercent.toFixed(0)}%</span>}
          </div>
        </div>

        {/* Explanatory text */}
        <p className="text-sm text-gray-600 mt-4">
          For every $100 invested, <span className="font-semibold">${passiveDollars}</span> mirrors the benchmark — only <span className="font-semibold text-[#1466b8]">${activeDollars}</span> is truly active management.
        </p>

        {/* Effective cost callout */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Effective active cost:</span>{" "}
            {effectiveCost.toFixed(2)}% — the true price you pay for the active portion, vs the stated {fund.fees.expenseRatio.toFixed(2)}% expense ratio.
          </p>
        </div>
      </div>
    </div>
  );
}
