import { FundDetail } from "@/lib/types";

export function SkillDecomposition({ fund }: { fund: FundDetail }) {
  const BR = (fund.portfolio.totalHoldings * fund.portfolio.turnoverRate) / 100;
  const IC = fund.risk.informationRatio / Math.sqrt(BR);
  const IR = fund.risk.informationRatio;

  const interpretiveText =
    Math.abs(IC) >= 0.05
      ? "High skill per decision — this manager makes fewer but more impactful bets."
      : Math.abs(IC) >= 0.02
        ? "Moderate skill per decision — consistent edge across a reasonable number of bets."
        : "Low skill per decision — relies on high breadth (many bets) rather than deep conviction.";

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Skill Decomposition
      </h3>
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase">Decisions / Year</p>
            <p className="text-2xl font-bold text-gray-900">
              {Math.round(BR)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Skill / Decision</p>
            <p className="text-2xl font-bold text-gray-900">{IC.toFixed(3)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Information Ratio</p>
            <p className="text-2xl font-bold text-gray-900">{IR.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 mb-1 font-mono">IR = IC × √BR</p>
          <p className="text-sm text-gray-500 font-mono">
            {IR.toFixed(2)} = {IC.toFixed(3)} × √{Math.round(BR)}
          </p>
        </div>

        <p className="text-sm text-gray-600 mt-4">{interpretiveText}</p>
      </div>
    </div>
  );
}
