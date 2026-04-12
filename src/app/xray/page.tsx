import { Suspense } from "react";
import { getFundSummaries } from "@/lib/data";
import { XRayPageContent } from "./_components/XRayPageContent";

export const metadata = {
  title: "Portfolio X-Ray \u2014 FundScore.ai",
  description:
    "See what you actually own, what you're actually paying, and whether it's worth it.",
};

export default async function XRayPage() {
  const allFunds = await getFundSummaries();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Portfolio X-Ray</h1>
        <p className="text-gray-500 mt-1">
          See what you actually own, what you&apos;re actually paying, and
          whether it&apos;s worth it.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-12 text-gray-400">Loading...</div>
        }
      >
        <XRayPageContent allFunds={allFunds} />
      </Suspense>
    </div>
  );
}
