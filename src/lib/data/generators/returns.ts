import { createSeededRandom } from "./seed";
import {
  MonthlyReturn,
  CalendarYearReturn,
  TrailingReturns,
} from "../../types";

interface ReturnProfile {
  annualMean: number;
  annualVol: number;
  marketBeta: number;
}

const CATEGORY_PROFILES: Record<string, ReturnProfile> = {
  "Large Growth": { annualMean: 12, annualVol: 18, marketBeta: 1.15 },
  "Large Blend": { annualMean: 10, annualVol: 15, marketBeta: 1.0 },
  "Large Value": { annualMean: 9, annualVol: 14, marketBeta: 0.9 },
  "Mid-Cap Growth": { annualMean: 11, annualVol: 20, marketBeta: 1.2 },
  "Mid-Cap Blend": { annualMean: 10, annualVol: 17, marketBeta: 1.05 },
  "Small Blend": { annualMean: 10, annualVol: 20, marketBeta: 1.1 },
  "Foreign Large Blend": { annualMean: 7, annualVol: 16, marketBeta: 0.85 },
  "Diversified Emerging Markets": {
    annualMean: 8,
    annualVol: 22,
    marketBeta: 1.0,
  },
  "Intermediate Core Bond": {
    annualMean: 3,
    annualVol: 5,
    marketBeta: -0.1,
  },
  "Intermediate Core-Plus Bond": {
    annualMean: 4,
    annualVol: 6,
    marketBeta: 0.0,
  },
  "High Yield Bond": { annualMean: 6, annualVol: 10, marketBeta: 0.5 },
  "Short-Term Bond": { annualMean: 2.5, annualVol: 3, marketBeta: -0.05 },
  "Bank Loan": { annualMean: 5, annualVol: 7, marketBeta: 0.3 },
  "Moderate Allocation": { annualMean: 7, annualVol: 10, marketBeta: 0.6 },
  "Aggressive Allocation": { annualMean: 9, annualVol: 14, marketBeta: 0.8 },
  "Conservative Allocation": { annualMean: 5, annualVol: 7, marketBeta: 0.3 },
  "Real Estate": { annualMean: 8, annualVol: 18, marketBeta: 0.7 },
  Technology: { annualMean: 14, annualVol: 24, marketBeta: 1.3 },
  Health: { annualMean: 10, annualVol: 17, marketBeta: 0.8 },
};

function getMarketShock(date: string, beta: number): number {
  const [yearStr, monthStr] = date.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  if (year === 2020 && month === 3) return -12 * beta;
  if (year === 2020 && month >= 4 && month <= 6) return 5 * beta;
  if (year === 2022 && month >= 1 && month <= 6) return -2.5 * beta;
  if (year === 2022 && month >= 7 && month <= 10) return -1.5 * beta;
  if (year === 2023 && month >= 1 && month <= 6) return 1.5 * beta;
  if (year === 2024 && month >= 1 && month <= 6) return 1.0 * beta;
  return 0;
}

export function generateMonthlyReturns(
  category: string,
  seed: number,
  startYear = 2016,
  endYear = 2025
): MonthlyReturn[] {
  const rng = createSeededRandom(seed);
  const profile =
    CATEGORY_PROFILES[category] || CATEGORY_PROFILES["Large Blend"];
  const monthlyMean = profile.annualMean / 12;
  const monthlyVol = profile.annualVol / Math.sqrt(12);

  const returns: MonthlyReturn[] = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const date = `${year}-${String(month).padStart(2, "0")}`;
      const baseReturn = rng.nextNormal(monthlyMean, monthlyVol);
      const shock = getMarketShock(date, profile.marketBeta);
      const value = Number((baseReturn + shock).toFixed(4));
      returns.push({ date, value });
    }
  }
  return returns;
}

export function generateBenchmarkReturns(
  benchmarkName: string,
  startYear = 2016,
  endYear = 2025
): MonthlyReturn[] {
  const seeds: Record<string, number> = {
    "S&P 500": 99999,
    "Bloomberg US Agg": 99998,
    "MSCI EAFE": 99997,
    "MSCI EM": 99996,
  };
  const categories: Record<string, string> = {
    "S&P 500": "Large Blend",
    "Bloomberg US Agg": "Intermediate Core Bond",
    "MSCI EAFE": "Foreign Large Blend",
    "MSCI EM": "Diversified Emerging Markets",
  };
  const seed = seeds[benchmarkName] || 99999;
  const cat = categories[benchmarkName] || "Large Blend";
  return generateMonthlyReturns(cat, seed, startYear, endYear);
}

export function computeTrailingReturns(
  returns: MonthlyReturn[]
): TrailingReturns {
  const annualize = (months: MonthlyReturn[]): number => {
    if (months.length === 0) return 0;
    let cum = 1;
    for (const m of months) cum *= 1 + m.value / 100;
    const years = months.length / 12;
    if (years <= 1) return (cum - 1) * 100;
    return (Math.pow(cum, 1 / years) - 1) * 100;
  };

  const cumReturn = (months: MonthlyReturn[]): number => {
    let cum = 1;
    for (const m of months) cum *= 1 + m.value / 100;
    return (cum - 1) * 100;
  };

  const len = returns.length;
  return {
    oneMonth: len >= 1 ? returns[len - 1].value : 0,
    threeMonth: cumReturn(returns.slice(-3)),
    sixMonth: cumReturn(returns.slice(-6)),
    ytd: cumReturn(returns.slice(-12)),
    oneYear: annualize(returns.slice(-12)),
    threeYear: annualize(returns.slice(-36)),
    fiveYear: annualize(returns.slice(-60)),
    tenYear: len >= 120 ? annualize(returns.slice(-120)) : null,
    sinceInception: annualize(returns),
  };
}

export function computeCalendarYearReturns(
  fundReturns: MonthlyReturn[],
  benchmarkReturns: MonthlyReturn[],
  passiveAltReturns: MonthlyReturn[],
  categoryAvgReturns: MonthlyReturn[]
): CalendarYearReturn[] {
  const yearMap = new Map<
    number,
    { fund: number[]; bench: number[]; passive: number[]; catAvg: number[] }
  >();

  for (const r of fundReturns) {
    const year = parseInt(r.date.split("-")[0]);
    if (!yearMap.has(year))
      yearMap.set(year, { fund: [], bench: [], passive: [], catAvg: [] });
    yearMap.get(year)!.fund.push(r.value);
  }
  for (const r of benchmarkReturns) {
    const year = parseInt(r.date.split("-")[0]);
    yearMap.get(year)?.bench.push(r.value);
  }
  for (const r of passiveAltReturns) {
    const year = parseInt(r.date.split("-")[0]);
    yearMap.get(year)?.passive.push(r.value);
  }
  for (const r of categoryAvgReturns) {
    const year = parseInt(r.date.split("-")[0]);
    yearMap.get(year)?.catAvg.push(r.value);
  }

  const cumFromMonthly = (vals: number[]): number => {
    let cum = 1;
    for (const v of vals) cum *= 1 + v / 100;
    return (cum - 1) * 100;
  };

  return Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({
      year,
      fundReturn: Number(cumFromMonthly(data.fund).toFixed(2)),
      benchmarkReturn: Number(cumFromMonthly(data.bench).toFixed(2)),
      passiveAltReturn: Number(cumFromMonthly(data.passive).toFixed(2)),
      categoryAvgReturn: Number(cumFromMonthly(data.catAvg).toFixed(2)),
    }));
}
