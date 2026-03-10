export interface FactorTilt {
  factor: string;
  exposure: number;
  label: string;
}

export interface TradingActivity {
  battingAverage: number;
  avgWinSize: number;
  avgLossSize: number;
  winLossRatio: number;
  activeShare: number;
  convictionScore: number;
  sectorHitRates: SectorHitRate[];
  tradeSizingEfficiency: number;
  fundScoreTrend: { quarter: string; score: number }[];
  recentTrades: Trade[];
  avgHoldingPeriodMonths: number;
  factorTilts: FactorTilt[];
  numberOfIndependentDecisions: number;
}

export interface SectorHitRate {
  sector: string;
  hitRate: number;
  tradeCount: number;
}

export interface Trade {
  name: string;
  ticker: string | null;
  action: "buy" | "sell";
  quarterAdded: string;
  positionSize: number;
  returnSince: number;
  outcome: "winner" | "loser" | "pending";
}
