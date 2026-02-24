export interface RiskData {
  standardDeviation: RiskPeriodValues;
  sharpeRatio: RiskPeriodValues;
  alpha: RiskPeriodValues;
  beta: RiskPeriodValues;
  rSquared: RiskPeriodValues;
  maxDrawdown: number;
  maxDrawdownDate: string;
  upsideCaptureRatio: number;
  downsideCaptureRatio: number;
  sortinoRatio: number;
  trackingError: number;
  informationRatio: number;
  categoryAvg: {
    standardDeviation: number;
    sharpeRatio: number;
    alpha: number;
    beta: number;
    maxDrawdown: number;
  };
}

export interface RiskPeriodValues {
  threeYear: number;
  fiveYear: number;
  tenYear: number | null;
}
