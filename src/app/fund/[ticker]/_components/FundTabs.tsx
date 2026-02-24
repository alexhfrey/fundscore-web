"use client";

import { FundDetail } from "@/lib/types";
import { Tabs } from "@/components/ui/Tabs";
import { OverviewTab } from "./OverviewTab";
import { PerformanceTab } from "./PerformanceTab";
import { TradingActivityTab } from "./TradingActivityTab";
import { PortfolioTab } from "./PortfolioTab";
import { RiskTab } from "./RiskTab";
import { FeesTab } from "./FeesTab";

const FUND_TABS = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "trading", label: "Trading Activity" },
  { id: "portfolio", label: "Portfolio" },
  { id: "risk", label: "Risk" },
  { id: "fees", label: "Fees" },
];

interface FundTabsProps {
  fund: FundDetail;
}

export function FundTabs({ fund }: FundTabsProps) {
  return (
    <Tabs tabs={FUND_TABS} defaultTab="overview">
      {(activeTab) => {
        switch (activeTab) {
          case "overview":
            return <OverviewTab fund={fund} />;
          case "performance":
            return <PerformanceTab fund={fund} />;
          case "trading":
            return <TradingActivityTab fund={fund} />;
          case "portfolio":
            return <PortfolioTab fund={fund} />;
          case "risk":
            return <RiskTab fund={fund} />;
          case "fees":
            return <FeesTab fund={fund} />;
          default:
            return null;
        }
      }}
    </Tabs>
  );
}
