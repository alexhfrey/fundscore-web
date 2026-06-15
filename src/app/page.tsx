import { getFundSummaries } from "@/lib/data";
import { FundScreener } from "@/components/fund/FundScreener";

export default async function Home() {
  const funds = await getFundSummaries();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Fund Screener</h1>
        <p className="text-gray-500 mt-1">
          Most active funds underperform. FundScore tells you which ones won&apos;t.
        </p>
      </div>
      <FundScreener funds={funds} />
    </div>
  );
}
