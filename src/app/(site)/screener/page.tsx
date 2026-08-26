import type { Metadata } from "next";
import Link from "next/link";
import {
  PAGE_SIZE,
  getScreenerPage,
  type ScreenerParams,
} from "@/lib/serving/screener-universe";
import { Pagination, ScreenerControls, ScreenerTable } from "@/components/screener";

// Rendered per request, not at build. The build host (Vercel) has no serving
// data, and this page is behind the pre-launch gate anyway — prerendering it
// would only make the build depend on a database it cannot reach. It is also
// genuinely dynamic: every filter/sort/page combination is a distinct read.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fund Screener — FundScore",
  description:
    "Screen the funds we serve by what you get for the fee versus the fund's closest passive alternative.",
};

interface ScreenerPageProps {
  searchParams: Promise<ScreenerParams>;
}

export default async function ScreenerPage({ searchParams }: ScreenerPageProps) {
  const params = await searchParams;
  const { rows, total, filters, universe } = await getScreenerPage(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Fund Screener</h1>
        <p className="mt-1 text-gray-500">
          What you actually get for a fund&apos;s fee, versus its closest passive
          alternative.
        </p>
        {/* Universe caption — every number computed live from the served table on
            this request. Never hardcoded: a serving reload moves all four, and a
            caption that misstates its own denominator is the same class of
            defect this page was rebuilt to remove. The unroutable exclusion is
            disclosed rather than silently shrinking the total. */}
        <p className="mt-3 text-sm text-gray-500">
          {universe.routable.toLocaleString()} US equity funds served
          {" · "}
          {universe.scored.toLocaleString()} carry a Value Score verdict; the rest
          show why they don&apos;t.
          {universe.excludedNoTicker > 0 && (
            <>
              {" "}
              <span className="text-gray-400">
                {universe.excludedNoTicker.toLocaleString()} insurance-trust series
                without a public ticker are not listed (
                {universe.served.toLocaleString()} rows served in total).
              </span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Every figure here is a filed or observed value from the fund&apos;s own
          served record — no ratings, no recommendations, no projections. A blank
          cell means we have no value to show. Asking a question instead?{" "}
          <Link href="/search" className="text-[#1466b8] hover:underline">
            Search by question
          </Link>
          .
        </p>
      </div>

      <ScreenerControls filters={filters} />
      <ScreenerTable rows={rows} filters={filters} />
      <Pagination
        filters={filters}
        total={total}
        pageSize={PAGE_SIZE}
        shown={rows.length}
      />
    </div>
  );
}
