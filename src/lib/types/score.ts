import { ScoreLabel } from "./fund";

export interface FundScoreDetail {
  score: number;
  scoreLabel: ScoreLabel;
  passiveAlternative: { ticker: string; name: string };
  drivers: ScoreDriver[];
  trend: ScoreTrendPoint[];
}

export interface ScoreDriver {
  name: string;
  score: number;
  weight: number;
  weightedContribution: number;
  description: string;
}

export interface ScoreTrendPoint {
  quarter: string;
  score: number;
}
