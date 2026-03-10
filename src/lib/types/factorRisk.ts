export interface FactorSensitivity {
  factor: string;
  beta: number;
  shockLabel: string;
  shockMagnitude: number;
  estimatedImpactDown: number;
  estimatedImpactUp: number;
}

export interface HistoricalScenario {
  name: string;
  period: string;
  marketReturn: number;
  fundReturn: number;
  passiveAltReturn: number;
  recoveryMonths: number;
}

export interface RiskDecompositionItem {
  factor: string;
  percentOfRisk: number;
}

export interface DurationRiskProfile {
  effectiveDuration: number;
  keyRateDurations: { tenor: string; duration: number }[];
  rateShiftImpacts: { shift: string; impact: number }[];
  creditSpreadSensitivity: number;
}

export interface FactorRiskProfile {
  factorSensitivities: FactorSensitivity[];
  historicalScenarios: HistoricalScenario[];
  riskDecomposition: RiskDecompositionItem[];
  durationRisk?: DurationRiskProfile;
}
