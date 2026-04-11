"use client";

import { FundDetail } from "@/lib/types";
import { StickyNav } from "./StickyNav";
import { ScrollSection } from "./ScrollSection";
import {
  AnalystNoteSection,
  PerformanceSection,
  AttributionSection,
  HoldingsSection,
  RisksSection,
  SkillSection,
  FeesSection,
  AdminSection,
} from "./sections";

const NAV_SECTIONS = [
  { id: "analyst-take", label: "Analyst Take" },
  { id: "risks", label: "Risk Profile" },
  { id: "track-record", label: "Track Record" },
  { id: "skill", label: "Skill or Luck?" },
  { id: "fees", label: "True Cost" },
  { id: "returns", label: "What Drove Returns" },
  { id: "holdings", label: "Holdings" },
  { id: "details", label: "Details" },
];

interface FundScrollPageProps {
  fund: FundDetail;
}

export function FundScrollPage({ fund }: FundScrollPageProps) {
  return (
    <>
      <StickyNav sections={NAV_SECTIONS} fundScore={fund.fundScore} ticker={fund.ticker} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        <ScrollSection id="analyst-take" title="Analyst Take">
          <AnalystNoteSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="risks"
          title="Risk Profile"
          description="How this fund behaves in different market environments"
        >
          <RisksSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="track-record"
          title={`Track Record: ${fund.ticker} vs ${fund.passiveAltTicker}`}
          description="Complete performance comparison against the passive alternative"
        >
          <PerformanceSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="skill"
          title="Is This Manager Actually Skilled?"
          description="Statistical evidence of manager skill"
          tier="evidence"
          badge="FundScore Exclusive"
        >
          <SkillSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="fees"
          title="True Cost of Active Management"
          description="Fee analysis and your passive alternative"
          tier="evidence"
          badge="FundScore Exclusive"
        >
          <FeesSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="returns"
          title="What Drove the Returns"
          description="What drove performance — and what the manager actually added"
          tier="evidence"
          badge="FundScore Exclusive"
        >
          <AttributionSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="holdings"
          title="Holdings"
          description={`${fund.portfolio.totalHoldings} positions, ${fund.portfolio.turnoverRate}% annual turnover`}
        >
          <HoldingsSection fund={fund} />
        </ScrollSection>

        <ScrollSection id="details" title="Details & Fine Print">
          <AdminSection fund={fund} />
        </ScrollSection>
      </div>
    </>
  );
}
