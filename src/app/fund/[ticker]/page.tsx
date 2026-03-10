import { notFound } from "next/navigation";
import { getFundByTicker, getFundSummaries } from "@/lib/data";
import { QuickGlanceSection } from "./_components/sections";
import { FundScrollPage } from "./_components/FundScrollPage";

interface FundPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateStaticParams() {
  const funds = await getFundSummaries();
  return funds.map((f) => ({ ticker: f.ticker }));
}

export async function generateMetadata({ params }: FundPageProps) {
  const { ticker } = await params;
  const fund = await getFundByTicker(ticker);
  if (!fund) return { title: "Fund Not Found" };
  return {
    title: `${fund.ticker} — ${fund.name} | FundScore.ai`,
    description: `${fund.name} has a FundScore of ${fund.fundScore} — ${fund.fundScore}% chance of beating ${fund.passiveAltTicker}. View performance, portfolio, and trading activity.`,
  };
}

export default async function FundPage({ params }: FundPageProps) {
  const { ticker } = await params;
  const fund = await getFundByTicker(ticker);

  if (!fund) {
    notFound();
  }

  return (
    <div>
      <QuickGlanceSection fund={fund} />
      <FundScrollPage fund={fund} />
    </div>
  );
}
