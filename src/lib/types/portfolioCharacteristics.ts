export interface EquityCharacteristics {
  peRatio: number;
  pbRatio: number;
  weightedAvgMarketCap: number;
  earningsGrowth: number;
  dividendYield: number;
  roe: number;
}

export interface FixedIncomeCharacteristics {
  effectiveDuration: number;
  avgCreditQuality: string;
  yieldToMaturity: number;
  sec30DayYield: number;
  avgCoupon: number;
  avgMaturity: number;
}

export interface StyleBoxPosition {
  size: "Large" | "Mid" | "Small";
  style: "Value" | "Blend" | "Growth";
  position: number;
}

export interface CategoryPercentiles {
  fee: number;
  activeShare: number;
  trackingError: number;
  return1Y: number;
  return3Y: number;
  return5Y: number;
  returnInception: number;
}

export interface PortfolioCharacteristics {
  equity?: EquityCharacteristics;
  fixedIncome?: FixedIncomeCharacteristics;
  styleBox?: StyleBoxPosition;
  percentiles: CategoryPercentiles;
}
