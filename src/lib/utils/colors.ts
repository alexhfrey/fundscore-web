import { COLORS, SCORE_THRESHOLDS } from "../constants";
import { ScoreLabel } from "../types";

export function getScoreColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.strongBuy) return COLORS.score.excellent;
  if (score >= SCORE_THRESHOLDS.buy) return COLORS.score.good;
  if (score >= SCORE_THRESHOLDS.hold) return COLORS.score.average;
  if (score >= SCORE_THRESHOLDS.underperform) return COLORS.score.belowAverage;
  return COLORS.score.poor;
}

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= SCORE_THRESHOLDS.strongBuy) return "Strong Buy";
  if (score >= SCORE_THRESHOLDS.buy) return "Buy";
  if (score >= SCORE_THRESHOLDS.hold) return "Hold";
  if (score >= SCORE_THRESHOLDS.underperform) return "Underperform";
  return "Sell";
}

export function getScoreBgClass(score: number): string {
  if (score >= SCORE_THRESHOLDS.strongBuy) return "bg-green-100 text-green-800";
  if (score >= SCORE_THRESHOLDS.buy) return "bg-lime-100 text-lime-800";
  if (score >= SCORE_THRESHOLDS.hold) return "bg-yellow-100 text-yellow-800";
  if (score >= SCORE_THRESHOLDS.underperform)
    return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export function getReturnColor(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-gray-500";
}

export function getChartColor(index: number): string {
  return COLORS.chart[index % COLORS.chart.length];
}
