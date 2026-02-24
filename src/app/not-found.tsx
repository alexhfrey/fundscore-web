import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Fund Not Found
      </h2>
      <p className="text-gray-500 mb-8">
        The page you&apos;re looking for doesn&apos;t exist or the fund ticker
        is invalid.
      </p>
      <Link
        href="/"
        className="inline-flex items-center px-6 py-3 bg-[#1466b8] text-white text-sm font-medium rounded-lg hover:bg-[#0f4f8c] transition-colors"
      >
        Back to Screener
      </Link>
    </div>
  );
}
