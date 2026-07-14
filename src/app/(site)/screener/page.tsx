import { getFundSummaries } from "@/lib/data";
import { FundScreener } from "@/components/fund/FundScreener";

// Rendered per request, not at build. The build host (Vercel) has no serving
// data, and this page is behind the pre-launch gate anyway — prerendering it
// would only make the build depend on a database it cannot reach.
export const dynamic = "force-dynamic";

export default async function Home() {
  const funds = await getFundSummaries();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Fund Screener</h1>
        <p className="text-gray-500 mt-1">
          What you actually get for a fund&apos;s fee, versus its closest passive
          alternative.
        </p>
      </div>
      <FundScreener funds={funds} />
    </div>
  );
}
