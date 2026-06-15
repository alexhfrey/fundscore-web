import { notFound } from "next/navigation";
import { getFundByTicker, getFundSummaries } from "@/lib/data";
import { formatExpenseRatio } from "@/lib/utils/format";

interface FundPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateStaticParams() {
  const funds = await getFundSummaries();
  return funds.map((f) => ({ ticker: f.ticker }));
}

export async function generateMetadata({ params }: FundPageProps) {
  const { ticker } = await params;
  const fund = await getFundByTicker(ticker);
  if (!fund) return { title: "Fund Not Found" };
  return {
    title: `${fund.ticker} — ${fund.name} | FundScore.ai`,
    description: `${fund.name} (${fund.ticker}) — fund profile on FundScore.ai.`,
  };
}

export default async function FundPage({ params }: FundPageProps) {
  const { ticker } = await params;
  const fund = await getFundByTicker(ticker);

  if (!fund) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold text-gray-900">{fund.ticker}</h1>
          <span className="text-xl text-gray-500">{fund.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Asset Class
          </div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {fund.assetClass}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Expense Ratio
          </div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {formatExpenseRatio(fund.expenseRatio)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Passive Alternative
          </div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {fund.passiveAltTicker}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <p className="text-sm font-medium text-amber-800">
          Profile wiring in progress
        </p>
        <p className="text-sm text-amber-700 mt-1">
          The full fund profile is being rebuilt against live data.
        </p>
      </div>
    </div>
  );
}
