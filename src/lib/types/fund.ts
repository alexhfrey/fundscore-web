import { PerformanceData } from "./performance";
import { PortfolioData } from "./portfolio";
import { RiskData } from "./risk";
import { FeeData } from "./fees";
import { FundScoreDetail } from "./score";
import { TradingActivity } from "./trading";
import { PerformanceAttribution } from "./attribution";
import { FactorRiskProfile } from "./factorRisk";
import { PortfolioCharacteristics } from "./portfolioCharacteristics";
import { SkillAssessment } from "./skillAssessment";
import { AdministrativeDetails } from "./admin";

export interface FundSummary {
  ticker: string;
  name: string;
  assetClass: AssetClassCode;
  geography: string;
  focus: string;
  size: string;
  peerGroup: string;
  fundScore: number;
  scoreLabel: ScoreLabel;
  passiveAltTicker: string;
  passiveAltName: string;
  nav: number;
  ytdReturn: number;
  oneYearReturn: number;
  threeYearReturn: number;
  fiveYearReturn: number;
  tenYearReturn: number | null;
  expenseRatio: number;
  aum: number;
}

export interface FundDetail extends FundSummary {
  inceptionDate: string;
  manager: string;
  managerStartYear: number;
  investmentObjective: string;
  investmentStrategy: string;
  benchmark: string;
  minInvestment: number;
  score: FundScoreDetail;
  performance: PerformanceData;
  portfolio: PortfolioData;
  risk: RiskData;
  fees: FeeData;
  trading: TradingActivity;
  attribution: PerformanceAttribution;
  factorRisk: FactorRiskProfile;
  characteristics: PortfolioCharacteristics;
  skillAssessment: SkillAssessment;
  admin: AdministrativeDetails;
  analystNote: string;
  peerAvgOneYearReturn: number;
  peerAvgThreeYearReturn: number;
  peerAumRank: number;
  peerFundCount: number;
}

export type AssetClassCode = "EQ" | "FI" | "MU" | "MA" | "ALT" | "RE" | "OT";

export type ScoreLabel =
  | "Strong Buy"
  | "Buy"
  | "Hold"
  | "Underperform"
  | "Sell";
