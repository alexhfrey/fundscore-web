import { FundDetail } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils/format";

interface AdminSectionProps {
  fund: FundDetail;
}

export function AdminSection({ fund }: AdminSectionProps) {
  const { admin } = fund;

  const details = [
    { label: "Fund Family", value: admin.fundFamily },
    { label: "Share Class", value: admin.shareClass },
    { label: "Inception Date", value: formatDate(fund.inceptionDate) },
    { label: "Manager", value: `${fund.manager} (since ${fund.managerStartYear})` },
    { label: "Benchmark", value: fund.benchmark },
    { label: "Total Holdings", value: String(fund.portfolio.totalHoldings) },
    { label: "Turnover Rate", value: `${fund.portfolio.turnoverRate}%` },
    { label: "Min Investment", value: formatCurrency(fund.minInvestment) },
    { label: "Distribution Frequency", value: admin.distributionFrequency },
    { label: "Fiscal Year End", value: admin.fiscalYearEnd },
    { label: "Legal Structure", value: admin.legalStructure },
    { label: "CUSIP", value: admin.cusip },
  ];

  const currentYear = new Date().getFullYear();
  const tenureYears = currentYear - fund.managerStartYear;
  const showTenureWarning = tenureYears >= 25;

  return (
    <div className="space-y-8">
      {/* Manager tenure warning */}
      {showTenureWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Extended single-manager tenure ({tenureYears} years).</span>{" "}
            Consider succession risk — what happens when this manager departs?
          </p>
        </div>
      )}

      {/* Two-column detail grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
          <div className="divide-y divide-gray-100">
            {details.slice(0, Math.ceil(details.length / 2)).map((d) => (
              <div key={d.label} className="flex justify-between px-4 py-3">
                <span className="text-sm text-gray-500">{d.label}</span>
                <span className="text-sm font-medium text-gray-900">{d.value}</span>
              </div>
            ))}
          </div>
          <div className="divide-y divide-gray-100">
            {details.slice(Math.ceil(details.length / 2)).map((d) => (
              <div key={d.label} className="flex justify-between px-4 py-3">
                <span className="text-sm text-gray-500">{d.label}</span>
                <span className="text-sm font-medium text-gray-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Investment objective + strategy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Investment Objective
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {fund.investmentObjective}
          </p>
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Investment Strategy
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {fund.investmentStrategy}
          </p>
        </div>
      </div>
    </div>
  );
}
