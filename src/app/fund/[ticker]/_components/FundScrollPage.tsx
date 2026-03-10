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
  { id: "why-this-rating", label: "Why This Rating" },
  { id: "head-to-head", label: "Head-to-Head" },
  { id: "skill", label: "Manager Skill" },
  { id: "returns", label: "Where Returns Come From" },
  { id: "fees", label: "Where Your Money Goes" },
  { id: "holdings", label: "What's Inside" },
  { id: "risks", label: "Risk Reality Check" },
  { id: "details", label: "Details" },
];

interface FundScrollPageProps {
  fund: FundDetail;
}

export function FundScrollPage({ fund }: FundScrollPageProps) {
  return (
    <>
      <StickyNav sections={NAV_SECTIONS} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
        <ScrollSection id="why-this-rating" title="Why This Rating">
          <AnalystNoteSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="head-to-head"
          title={`Head-to-Head: ${fund.ticker} vs ${fund.passiveAltTicker}`}
          description="Complete performance comparison against the passive alternative"
        >
          <PerformanceSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="skill"
          title="Is This Manager Actually Skilled?"
          description="Statistical evidence of manager skill"
        >
          <SkillSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="returns"
          title="Where the Returns Come From"
          description="What drove performance — and what the manager actually added"
        >
          <AttributionSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="fees"
          title="Where Your Money Goes"
          description="Fee analysis and your passive alternative"
        >
          <FeesSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="holdings"
          title="What's Inside This Fund"
          description={`${fund.portfolio.totalHoldings} positions, ${fund.portfolio.turnoverRate}% annual turnover`}
        >
          <HoldingsSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="risks"
          title="Risk Reality Check"
          description="How this fund behaves in different market environments"
        >
          <RisksSection fund={fund} />
        </ScrollSection>

        <ScrollSection
          id="details"
          title="Details & Fine Print"
        >
          <AdminSection fund={fund} />
        </ScrollSection>
      </div>
    </>
  );
}
