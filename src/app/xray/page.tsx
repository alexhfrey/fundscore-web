export const metadata = {
  title: "Portfolio X-Ray — FundScore.ai",
  description:
    "See what you actually own, what you're actually paying, and whether it's worth it.",
};

export default function XRayPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Portfolio X-Ray</h1>
        <p className="text-gray-500 mt-1">
          See what you actually own, what you&apos;re actually paying, and
          whether it&apos;s worth it.
        </p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <p className="text-sm font-medium text-amber-800">
          Portfolio X-Ray — wiring in progress
        </p>
        <p className="text-sm text-amber-700 mt-1">
          This tool is being rebuilt against live data.
        </p>
      </div>
    </div>
  );
}
