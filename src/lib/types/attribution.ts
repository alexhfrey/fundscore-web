export interface EquityAttribution {
  betaContribution: number;
  sectorExposure: number;
  sectorTiming: number;
  marketTiming: number;
  stockSelection: number;
  grossAlpha: number;
  feesDrag: number;
  netAlpha: number;
}

export interface FixedIncomeAttribution {
  durationEffect: number;
  yieldCurveEffect: number;
  creditSpreadEffect: number;
  sectorAllocation: number;
  securitySelection: number;
  grossAlpha: number;
  feesDrag: number;
  netAlpha: number;
}

export interface AllocationAttribution {
  assetClassAllocation: number;
  withinEquity: number;
  withinFixedIncome: number;
  withinAlternatives: number;
  grossAlpha: number;
  feesDrag: number;
  netAlpha: number;
}

export interface SectorBet {
  sector: string;
  fundWeight: number;
  benchmarkWeight: number;
  overUnderweight: number;
  contribution: number;
}

export interface StockPick {
  name: string;
  ticker: string | null;
  fundWeight: number;
  benchmarkWeight: number;
  contribution: number;
}

export interface PerformanceAttribution {
  type: "equity" | "fixedIncome" | "allocation";
  equity?: EquityAttribution;
  fixedIncome?: FixedIncomeAttribution;
  allocation?: AllocationAttribution;
  sectorBets: SectorBet[];
  stockPicks: StockPick[];
}
