import { FundDetail } from "@/lib/types";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatAUM } from "@/lib/utils/format";

interface FundHeroProps {
  fund: FundDetail;
}

export function FundHero({ fund }: FundHeroProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Left: Fund info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {fund.name}
              </h1>
              <Badge variant="primary">{fund.ticker}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-4">
              <span>{fund.peerGroup}</span>
              <span>&middot;</span>
              <span>Managed by {fund.manager}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  NAV
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(fund.nav)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  AUM
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatAUM(fund.aum)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Expense Ratio
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {fund.expenseRatio.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Min Investment
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(fund.minInvestment)}
                </p>
              </div>
            </div>
          </div>

          {/* Right: FundScore */}
          <div className="flex flex-col items-center lg:items-end gap-3">
            <ScoreRing score={fund.fundScore} size={130} strokeWidth={10} />
            <div className="text-center lg:text-right">
              <ScoreBadge score={fund.fundScore} size="lg" />
              <p className="text-sm text-gray-500 mt-2 max-w-xs">
                <span className="font-semibold text-gray-700">
                  {fund.fundScore}% chance
                </span>{" "}
                of beating{" "}
                <span className="font-medium text-[#1466b8]">
                  {fund.passiveAltTicker}
                </span>{" "}
                ({fund.passiveAltName})
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
