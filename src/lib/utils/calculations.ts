import { MonthlyReturn } from "../types";

export function cumulativeReturn(returns: MonthlyReturn[]): number {
  if (returns.length === 0) return 0;
  let cumulative = 1;
  for (const r of returns) {
    cumulative *= 1 + r.value / 100;
  }
  return (cumulative - 1) * 100;
}

export function annualizedReturn(returns: MonthlyReturn[]): number {
  if (returns.length === 0) return 0;
  const totalReturn = cumulativeReturn(returns);
  const years = returns.length / 12;
  if (years <= 0) return totalReturn;
  return (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
}

export function standardDeviation(returns: MonthlyReturn[]): number {
  if (returns.length < 2) return 0;
  const values = returns.map((r) => r.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

export function maxDrawdown(
  returns: MonthlyReturn[]
): { drawdown: number; date: string } {
  if (returns.length === 0) return { drawdown: 0, date: "" };
  let peak = 1;
  let cumulative = 1;
  let maxDD = 0;
  let maxDDDate = returns[0].date;

  for (const r of returns) {
    cumulative *= 1 + r.value / 100;
    if (cumulative > peak) peak = cumulative;
    const dd = (peak - cumulative) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDDate = r.date;
    }
  }
  return { drawdown: -maxDD * 100, date: maxDDDate };
}

export function sharpeRatio(
  returns: MonthlyReturn[],
  riskFreeRate = 0.04
): number {
  const annReturn = annualizedReturn(returns);
  const stdDev = standardDeviation(returns);
  if (stdDev === 0) return 0;
  return (annReturn / 100 - riskFreeRate) / (stdDev / 100);
}

export function cumulativeReturnSeries(
  returns: MonthlyReturn[]
): { date: string; value: number }[] {
  let cumulative = 0;
  return returns.map((r) => {
    cumulative = (1 + cumulative / 100) * (1 + r.value / 100) - 1;
    cumulative *= 100;
    return { date: r.date, value: Number(cumulative.toFixed(4)) };
  });
}

export interface ComputedTrailingReturns {
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
  tenYear: number | null;
}

export function computeTrailingReturns(
  returns: MonthlyReturn[]
): ComputedTrailingReturns {
  const compute = (months: number) => {
    if (returns.length < months) return null;
    return annualizedReturn(returns.slice(-months));
  };
  return {
    oneYear: returns.length >= 12 ? cumulativeReturn(returns.slice(-12)) : null,
    threeYear: compute(36),
    fiveYear: compute(60),
    tenYear: compute(120),
  };
}

export function filterReturnsByRange(
  returns: MonthlyReturn[],
  range: string
): MonthlyReturn[] {
  let months: number;
  switch (range) {
    case "1Y":
      months = 12;
      break;
    case "3Y":
      months = 36;
      break;
    case "5Y":
      months = 60;
      break;
    case "10Y":
      months = 120;
      break;
    default:
      return returns;
  }
  return returns.slice(-months);
}
