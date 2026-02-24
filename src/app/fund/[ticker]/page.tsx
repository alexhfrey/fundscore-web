import { notFound } from "next/navigation";
import { getFundByTicker, getFundSummaries } from "@/lib/data";
import { FundHero } from "./_components/FundHero";
import { FundTabs } from "./_components/FundTabs";

interface FundPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateStaticParams() {
  const funds = getFundSummaries();
  return funds.map((f) => ({ ticker: f.ticker }));
}

export async function generateMetadata({ params }: FundPageProps) {
  const { ticker } = await params;
  const fund = getFundByTicker(ticker);
  if (!fund) return { title: "Fund Not Found" };
  return {
    title: `${fund.ticker} — ${fund.name} | FundScore.ai`,
    description: `${fund.name} has a FundScore of ${fund.fundScore} — ${fund.fundScore}% chance of beating ${fund.passiveAltTicker}. View performance, portfolio, and trading activity.`,
  };
}

export default async function FundPage({ params }: FundPageProps) {
  const { ticker } = await params;
  const fund = getFundByTicker(ticker);

  if (!fund) {
    notFound();
  }

  return (
    <div>
      <FundHero fund={fund} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FundTabs fund={fund} />
      </div>
    </div>
  );
}
