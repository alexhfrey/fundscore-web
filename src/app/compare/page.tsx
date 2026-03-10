import { Suspense } from "react";
import { getFundSummaries } from "@/lib/data";
import { ComparePageContent } from "./_components/ComparePageContent";

export const metadata = {
  title: "Compare Funds — FundScore.ai",
  description:
    "Compare up to 4 mutual funds side by side. See performance, risk, fees, and FundScore ratings compared.",
};

export default async function ComparePage() {
  const allFunds = await getFundSummaries();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Compare Funds</h1>
        <p className="text-gray-500 mt-1">
          Compare up to 4 funds side by side to find the best option.
        </p>
      </div>
      <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
        <ComparePageContent allFunds={allFunds} />
      </Suspense>
    </div>
  );
}
