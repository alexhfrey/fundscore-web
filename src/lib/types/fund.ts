import { PerformanceData } from "./performance";
import { PortfolioData } from "./portfolio";
import { RiskData } from "./risk";
import { FeeData } from "./fees";
import { FundScoreDetail } from "./score";
import { TradingActivity } from "./trading";

export interface FundSummary {
  ticker: string;
  name: string;
  category: FundCategory;
  assetClass: AssetClass;
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
  analystNote: string;
  categoryAvgOneYearReturn: number;
  categoryAvgThreeYearReturn: number;
  categoryAumRank: number;
  categoryFundCount: number;
}

export type FundCategory =
  | "Large Growth"
  | "Large Blend"
  | "Large Value"
  | "Mid-Cap Growth"
  | "Mid-Cap Blend"
  | "Small Blend"
  | "Foreign Large Blend"
  | "Diversified Emerging Markets"
  | "Intermediate Core Bond"
  | "Intermediate Core-Plus Bond"
  | "High Yield Bond"
  | "Short-Term Bond"
  | "Bank Loan"
  | "Moderate Allocation"
  | "Aggressive Allocation"
  | "Conservative Allocation"
  | "Real Estate"
  | "Technology"
  | "Health";

export type AssetClass =
  | "US Equity"
  | "International Equity"
  | "Fixed Income"
  | "Allocation"
  | "Specialty";

export type ScoreLabel =
  | "Strong Buy"
  | "Buy"
  | "Hold"
  | "Underperform"
  | "Sell";
