import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-[#1466b8] rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">FS</span>
              </div>
              <span className="font-semibold text-gray-900">
                Fund<span className="text-[#1466b8]">Score</span>
                <span className="text-gray-400 font-normal">.ai</span>
              </span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs">
              See what you actually get for a fund&apos;s fee versus its closest
              passive alternative.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Navigate
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  Fund Screener
                </Link>
              </li>
              <li>
                <Link
                  href="/xray"
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  Portfolio X-Ray
                </Link>
              </li>
              <li>
                <Link
                  href="/methodology"
                  className="text-sm text-gray-500 hover:text-gray-900"
                >
                  Methodology
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">About</h3>
            <p className="text-sm text-gray-500">
              FundScore uses SEC N-PORT filings and reference data to show what a
              fund holds, what it charges, and how it compares with its passive
              alternative.{" "}
              <Link
                href="/methodology"
                className="text-gray-600 underline hover:text-gray-900"
              >
                See our methodology
              </Link>
              .
            </p>
            <p className="text-xs text-gray-400 mt-4">
              For informational purposes only — not investment advice and not a
              recommendation to buy or sell any fund. Data is derived from SEC
              filings and reference sources; holdings are filed with a lag. This
              is a pre-launch preview.
            </p>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-8 pt-6 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} FundScore.ai. All rights reserved.
            Not investment advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
