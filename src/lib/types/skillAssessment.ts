export interface BayesianSkillDistribution {
  priorAlpha: number;
  priorBeta: number;
  observedWins: number;
  observedTotal: number;
  posteriorMean: number;
  posteriorStdDev: number;
  credibleInterval80: [number, number];
  credibleInterval95: [number, number];
  pdfPoints: { x: number; y: number }[];
}

export interface SkillAssessment {
  battingAverage: number;
  bayesianDistribution: BayesianSkillDistribution;
  avgWinSize: number;
  avgLossSize: number;
  winLossRatio: number;
  independentDecisions: number;
  informationCoefficient: number;
  breadth: number;
  estimatedIR: number;
  durationTimingSkill?: number;
  creditTimingSkill?: number;
}
