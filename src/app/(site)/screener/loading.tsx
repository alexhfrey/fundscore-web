// Route-level skeleton. /screener is force-dynamic and every filter change is a
// fresh server read, so this is what a reader sees between navigations. It shows
// STRUCTURE only — never placeholder numbers, tickers or chips, which on a page
// whose whole point is "no fabricated values" would be exactly the wrong tell.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Fund Screener</h1>
        <p className="mt-1 text-gray-500">
          What you actually get for a fund&apos;s fee, versus its closest passive
          alternative.
        </p>
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="h-11 min-w-[16rem] flex-1 animate-pulse rounded-lg bg-gray-100" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-36 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="h-11 border-b border-gray-200 bg-gray-50" />
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
