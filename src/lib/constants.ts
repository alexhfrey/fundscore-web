export const SITE_NAME = "FundScore.ai";
export const SITE_DESCRIPTION =
  "Most active funds underperform. FundScore tells you which ones won't.";
export const SITE_TAGLINE =
  "Forward-looking fund ratings powered by data science";

export const COLORS = {
  primary: "#1466b8",
  primaryDark: "#0f4f8c",
  primaryLight: "#e8f0fe",
  score: {
    excellent: "#16a34a",
    good: "#65a30d",
    average: "#ca8a04",
    belowAverage: "#ea580c",
    poor: "#dc2626",
  },
  chart: ["#1466b8", "#6366f1", "#8b5cf6", "#ec4899", "#f97316"],
  positive: "#16a34a",
  negative: "#dc2626",
  neutral: "#6b7280",
} as const;

export const SCORE_THRESHOLDS = {
  strongBuy: 75,
  buy: 60,
  hold: 40,
  underperform: 25,
} as const;

export const ASSET_CLASS_CODES = [
  "EQ",
  "FI",
  "MU",
  "MA",
  "ALT",
  "RE",
  "OT",
] as const;

export const ASSET_CLASS_LABELS: Record<string, string> = {
  EQ: "Equity",
  FI: "Fixed Income",
  MU: "Multi-Sector FI",
  MA: "Multi-Asset",
  ALT: "Alternatives",
  RE: "Real Estate",
  OT: "Other",
};

export const GEOGRAPHY_LABELS: Record<string, string> = {
  US: "US",
  INTL: "International",
  EM: "Emerging Markets",
  GLOBAL: "Global",
  BROAD: "Broad",
};

export const FOCUS_LABELS: Record<string, string> = {
  BROAD: "Broad Market",
  TECH: "Technology",
  HEALTH: "Healthcare",
  IG_BROAD: "Investment Grade",
  HY: "High Yield",
  BANK_LOAN: "Bank Loan",
  SHORT_IG: "Short-Term IG",
  BALANCED: "Balanced",
  AGGRESSIVE: "Aggressive",
  CONSERVATIVE: "Conservative",
};

export const TIME_RANGES = ["1Y", "3Y", "5Y", "10Y", "Max"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const FACTOR_ETF_MAP: Record<
  string,
  { ticker: string; name: string; expenseRatio: number }
> = {
  Growth: { ticker: "VUG", name: "Vanguard Growth ETF", expenseRatio: 0.04 },
  Value: { ticker: "VTV", name: "Vanguard Value ETF", expenseRatio: 0.04 },
  Quality: { ticker: "QUAL", name: "iShares MSCI USA Quality Factor ETF", expenseRatio: 0.15 },
  Momentum: { ticker: "MTUM", name: "iShares MSCI USA Momentum Factor ETF", expenseRatio: 0.15 },
  Size: { ticker: "VB", name: "Vanguard Small-Cap ETF", expenseRatio: 0.05 },
  Yield: { ticker: "VYM", name: "Vanguard High Dividend Yield ETF", expenseRatio: 0.06 },
} as const;
