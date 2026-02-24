import { getModelStats } from "@/lib/data";
import { ModelPageContent } from "./ModelPageContent";

export const metadata = {
  title: "Model Details — FundScore.ai",
  description:
    "How FundScore works: methodology, historical accuracy, and backtest performance. See how our predictions hold up against real results.",
};

export default function ModelPage() {
  const modelData = getModelStats();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Model Details</h1>
        <p className="text-gray-500 mt-1">
          How FundScore predicts which active funds will beat their passive
          alternatives.
        </p>
      </div>
      <ModelPageContent data={modelData} />
    </div>
  );
}
