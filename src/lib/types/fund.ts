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

export type AssetClassCode = "EQ" | "FI" | "MU" | "MA" | "ALT" | "RE" | "OT";

export type ScoreLabel =
  | "Strong Buy"
  | "Buy"
  | "Hold"
  | "Underperform"
  | "Sell";
