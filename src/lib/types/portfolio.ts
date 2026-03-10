export interface PortfolioData {
  holdings: Holding[];
  sectorWeights: SectorWeight[];
  assetAllocation: AssetAllocationItem[];
  creditQuality?: CreditQualityItem[];
  benchmarkSectorWeights?: SectorWeight[];
  maturityDistribution?: MaturityBucket[];
  totalHoldings: number;
  turnoverRate: number;
}

export interface MaturityBucket {
  range: string;
  weight: number;
}

export interface Holding {
  name: string;
  ticker: string | null;
  weight: number;
  shares?: number;
  marketValue?: number;
  sector: string;
  benchmarkWeight?: number;
}

export interface SectorWeight {
  sector: string;
  weight: number;
}

export interface AssetAllocationItem {
  type: string;
  weight: number;
}

export interface CreditQualityItem {
  rating: string;
  weight: number;
}
