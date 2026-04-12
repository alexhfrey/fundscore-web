import type { FundDetail, MonthlyReturn } from "@/lib/types";
import { computeTrailingReturns } from "@/lib/utils/calculations";

/* ── Types ──────────────────────────────────────────────── */

export type AllocationMode = "dollar" | "percent";

export interface BlendedHolding {
  name: string;
  ticker: string | null;
  effectiveWeight: number; // 0-100
  benchmarkWeight: number; // 0-100
  overUnderweight: number;
  fundCount: number;
  fundTickers: string[];
}

export interface BlendedSector {
  sector: string;
  weight: number; // 0-100
  benchmarkWeight: number; // 0-100
  overUnderweight: number;
}

export interface BlendedFactorTilt {
  factor: string;
  exposure: number;
  label: string;
}

export interface PassiveCloneETF {
  ticker: string;
  name: string;
  weight: number; // 0-100
  expenseRatio: number;
}

export interface XRayResult {
  blendedScore: number;
  blendedER: number;
  uniqueHoldingsCount: number;

  blendedHoldings: BlendedHolding[];
  top5Concentration: number;
  overlapCount: number;

  blendedSectors: BlendedSector[];

  blendedFactorTilts: BlendedFactorTilt[];
  dominantTilt: string;

  portfolioER: number;
  portfolioDollarCostPer10k: number;
  passiveER: number;
  passiveDollarCostPer10k: number;
  annualFeeSavings: number;

  passiveClone: PassiveCloneETF[];

  grossAlpha: number; // weighted avg gross skill before fees
  feeGap: number; // portfolioER - passiveER in pct points
  feeGapDollars: number; // annual fee gap per $10K
  netEdge: number; // grossAlpha - feeGap

  trackingError: number; // annualized TE vs passive clone
  netIR: number; // net information ratio (net alpha / TE)

  // Return series for growth chart
  cumulativeReturns: { date: string; portfolio: number; clone: number }[];

  // Dollar projections (on $100K)
  lifetimeCost10yr: number;
  lifetimeCost20yr: number;
  lifetimeCost30yr: number;

  verdictScore: number;
  verdictLabel: string;
  verdictSentiment: "positive" | "mixed" | "negative";
}

/* ── Normalization ──────────────────────────────────────── */

export function normalizeAllocations(
  allocations: Map<string, number>,
): Map<string, number> {
  const total = Array.from(allocations.values()).reduce((s, v) => s + v, 0);
  const weights = new Map<string, number>();
  if (total === 0) {
    // Fallback: equal weight
    const n = allocations.size;
    for (const ticker of allocations.keys()) {
      weights.set(ticker, n > 0 ? 1 / n : 0);
    }
  } else {
    for (const [ticker, amount] of allocations) {
      weights.set(ticker, amount / total);
    }
  }
  return weights;
}

/* ── Blending functions ─────────────────────────────────── */

export function blendHoldings(
  funds: FundDetail[],
  weights: Map<string, number>,
): BlendedHolding[] {
  const map = new Map<
    string,
    { name: string; ticker: string | null; weight: number; bmWeight: number; tickers: Set<string> }
  >();

  for (const fund of funds) {
    const w = weights.get(fund.ticker) ?? 0;
    for (const h of fund.portfolio.holdings) {
      const key = h.ticker ?? h.name;
      const existing = map.get(key);
      const contribution = h.weight * w;
      const bmContribution = (h.benchmarkWeight ?? 0) * w;
      if (existing) {
        existing.weight += contribution;
        existing.bmWeight += bmContribution;
        existing.tickers.add(fund.ticker);
      } else {
        map.set(key, {
          name: h.name,
          ticker: h.ticker,
          weight: contribution,
          bmWeight: bmContribution,
          tickers: new Set([fund.ticker]),
        });
      }
    }
  }

  return Array.from(map.values())
    .map((h) => ({
      name: h.name,
      ticker: h.ticker,
      effectiveWeight: h.weight,
      benchmarkWeight: h.bmWeight,
      overUnderweight: h.weight - h.bmWeight,
      fundCount: h.tickers.size,
      fundTickers: Array.from(h.tickers),
    }))
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight);
}

export function blendSectors(
  funds: FundDetail[],
  weights: Map<string, number>,
): BlendedSector[] {
  const portMap = new Map<string, number>();
  const bmMap = new Map<string, number>();
  for (const fund of funds) {
    const w = weights.get(fund.ticker) ?? 0;
    for (const s of fund.portfolio.sectorWeights) {
      portMap.set(s.sector, (portMap.get(s.sector) ?? 0) + s.weight * w);
    }
    for (const s of fund.portfolio.benchmarkSectorWeights ?? []) {
      bmMap.set(s.sector, (bmMap.get(s.sector) ?? 0) + s.weight * w);
    }
  }
  const allSectors = new Set([...portMap.keys(), ...bmMap.keys()]);
  return Array.from(allSectors)
    .map((sector) => {
      const weight = portMap.get(sector) ?? 0;
      const benchmarkWeight = bmMap.get(sector) ?? 0;
      return { sector, weight, benchmarkWeight, overUnderweight: weight - benchmarkWeight };
    })
    .sort((a, b) => b.weight - a.weight);
}

export function blendFactorTilts(
  funds: FundDetail[],
  weights: Map<string, number>,
): BlendedFactorTilt[] {
  const map = new Map<string, number>();
  for (const fund of funds) {
    const w = weights.get(fund.ticker) ?? 0;
    for (const t of fund.trading.factorTilts) {
      map.set(t.factor, (map.get(t.factor) ?? 0) + t.exposure * w);
    }
  }
  return Array.from(map.entries())
    .map(([factor, exposure]) => ({
      factor,
      exposure,
      label:
        Math.abs(exposure) < 0.1
          ? "Neutral"
          : exposure > 0
            ? "Overweight"
            : "Underweight",
    }))
    .sort((a, b) => Math.abs(b.exposure) - Math.abs(a.exposure));
}

/* ── Statistical functions ───────────────────────────────── */

/** Standard normal CDF — Abramowitz & Stegun 26.2.17 rational approximation. */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
}

/** Project a vector onto the probability simplex (Duchi et al. 2008).
 *  Returns non-negative weights summing to 1. */
function projectOntoSimplex(v: number[]): number[] {
  const n = v.length;
  const sorted = [...v].sort((a, b) => b - a);
  let cumSum = 0;
  let tau = 0;
  for (let i = 0; i < n; i++) {
    cumSum += sorted[i];
    const candidate = (cumSum - 1) / (i + 1);
    if (sorted[i] - candidate > 0) {
      tau = candidate;
    }
  }
  return v.map((vi) => Math.max(vi - tau, 0));
}

/** Constrained regression: min ||y - Xw||² s.t. w >= 0, Σw = 1.
 *  Projected gradient descent on the simplex. */
function constrainedRegression(y: number[], X: number[][]): number[] {
  const T = y.length;
  const K = X[0].length;
  if (K === 1) return [1]; // trivial case

  let w = Array(K).fill(1 / K);
  const lr = 0.5; // step size (safe for normalized data)
  const maxIter = 500;

  for (let iter = 0; iter < maxIter; iter++) {
    // residual = y - X*w
    const grad = Array(K).fill(0);
    for (let t = 0; t < T; t++) {
      let pred = 0;
      for (let j = 0; j < K; j++) pred += X[t][j] * w[j];
      const resid = y[t] - pred;
      for (let j = 0; j < K; j++) {
        grad[j] -= (2 / T) * X[t][j] * resid;
      }
    }

    // gradient step + project onto simplex
    const wNew = w.map((wi, j) => wi - lr * grad[j]);
    w = projectOntoSimplex(wNew);
  }

  return w;
}

/* ── Passive alt ER estimation ──────────────────────────── */

const PASSIVE_ER_LOOKUP: Record<string, number> = {
  VOO: 0.03, SPY: 0.09, IVV: 0.03, VTI: 0.03, ITOT: 0.03,
  AGG: 0.03, BND: 0.03, VXUS: 0.07, VEA: 0.05, VWO: 0.08,
  IEMG: 0.09, EFA: 0.32, VNQ: 0.12, VCIT: 0.04, VCSH: 0.04,
  VTIP: 0.04, MUB: 0.05, HYG: 0.49, LQD: 0.14, TLT: 0.15,
};

function estimatePassiveER(ticker: string): number {
  return PASSIVE_ER_LOOKUP[ticker] ?? 0.05;
}

/* ── Regression-based passive clone ─────────────────────── */

interface PassiveCloneResult {
  clone: PassiveCloneETF[];
  blendedER: number;
  cloneReturns: number[];
  portfolioReturns: number[];
  dates: string[]; // aligned dates for the return series
}

function buildPassiveCloneRegression(
  funds: FundDetail[],
  allocWeights: Map<string, number>,
): PassiveCloneResult {
  // 1. Collect unique passive alts
  const passiveAlts = new Map<
    string,
    { name: string; returns: MonthlyReturn[] }
  >();
  for (const fund of funds) {
    if (!passiveAlts.has(fund.passiveAltTicker)) {
      passiveAlts.set(fund.passiveAltTicker, {
        name: fund.passiveAltName,
        returns: fund.performance.passiveAltMonthlyReturns,
      });
    }
  }

  // 2. Build date-aligned return matrices
  // Find common dates across all fund returns and passive alt returns
  const dateSets: Set<string>[] = [];
  for (const fund of funds) {
    dateSets.push(new Set(fund.performance.monthlyReturns.map((r) => r.date)));
  }
  for (const [, alt] of passiveAlts) {
    dateSets.push(new Set(alt.returns.map((r) => r.date)));
  }
  // Inner join: only dates present in ALL series
  let commonDates = dateSets[0];
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = new Set([...commonDates].filter((d) => dateSets[i].has(d)));
  }
  const sortedDates = [...commonDates].sort();

  if (sortedDates.length < 12) {
    // Insufficient data — fall back to allocation-weighted blend
    return buildFallbackClone(funds, allocWeights);
  }

  // 3. Build portfolio return vector (y)
  const portfolioReturns = sortedDates.map((date) => {
    let ret = 0;
    for (const fund of funds) {
      const w = allocWeights.get(fund.ticker) ?? 0;
      const mr = fund.performance.monthlyReturns.find((r) => r.date === date);
      ret += (mr?.value ?? 0) * w;
    }
    return ret;
  });

  // 4. Build passive alt return matrix (X)
  const altTickers = [...passiveAlts.keys()];
  const altData = altTickers.map((ticker) => {
    const alt = passiveAlts.get(ticker)!;
    const returnMap = new Map(alt.returns.map((r) => [r.date, r.value]));
    return sortedDates.map((date) => returnMap.get(date) ?? 0);
  });

  // X[t][j] = passive alt j's return at time t
  const X = sortedDates.map((_, t) => altTickers.map((_, j) => altData[j][t]));

  // 5. Run constrained regression
  const weights = constrainedRegression(portfolioReturns, X);

  // 6. Compute clone returns
  const cloneReturns = sortedDates.map((_, t) =>
    weights.reduce((sum, wj, j) => sum + wj * X[t][j], 0),
  );

  // 7. Build output
  const clone: PassiveCloneETF[] = altTickers
    .map((ticker, j) => ({
      ticker,
      name: passiveAlts.get(ticker)!.name,
      weight: weights[j] * 100,
      expenseRatio: estimatePassiveER(ticker),
    }))
    .filter((c) => c.weight > 0.5) // drop negligible weights
    .sort((a, b) => b.weight - a.weight);

  // Renormalize displayed weights after filtering
  const displayTotal = clone.reduce((s, c) => s + c.weight, 0);
  if (displayTotal > 0) {
    for (const c of clone) c.weight = (c.weight / displayTotal) * 100;
  }

  const blendedER = clone.reduce(
    (sum, c) => sum + (c.weight / 100) * c.expenseRatio,
    0,
  );

  return { clone, blendedER, cloneReturns, portfolioReturns, dates: sortedDates };
}

function buildFallbackClone(
  funds: FundDetail[],
  allocWeights: Map<string, number>,
): PassiveCloneResult {
  // Simple allocation-weighted blend of each fund's passive alt
  const altMap = new Map<string, { name: string; weight: number }>();
  for (const fund of funds) {
    const w = allocWeights.get(fund.ticker) ?? 0;
    const existing = altMap.get(fund.passiveAltTicker);
    if (existing) {
      existing.weight += w;
    } else {
      altMap.set(fund.passiveAltTicker, { name: fund.passiveAltName, weight: w });
    }
  }
  const clone = [...altMap.entries()]
    .map(([ticker, { name, weight }]) => ({
      ticker,
      name,
      weight: weight * 100,
      expenseRatio: estimatePassiveER(ticker),
    }))
    .sort((a, b) => b.weight - a.weight);

  const blendedER = clone.reduce(
    (sum, c) => sum + (c.weight / 100) * c.expenseRatio,
    0,
  );

  return { clone, blendedER, cloneReturns: [], portfolioReturns: [], dates: [] };
}

/* ── Portfolio FundScore ────────────────────────────────── */

/** Compute portfolio FundScore from tracking difference vs passive clone.
 *  P(beat over T years) = Φ(√T × net_IR)
 *  where net_IR = annualized_mean(TD) / annualized_std(TD) */
function computePortfolioScore(
  portfolioReturns: number[],
  cloneReturns: number[],
  T: number = 5,
): { score: number; trackingError: number; netIR: number } {
  const n = portfolioReturns.length;
  if (n < 12) return { score: 50, trackingError: 0, netIR: 0 };

  // Tracking difference series
  const td = portfolioReturns.map((r, i) => r - cloneReturns[i]);

  // Monthly stats
  const mean = td.reduce((s, v) => s + v, 0) / n;
  const variance = td.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdMonth = Math.sqrt(variance);

  // Annualize
  const netAlpha = mean * 12; // annualized mean tracking diff
  const te = Math.max(stdMonth * Math.sqrt(12), 0.005 * 100); // floor at 50bp, in return % units
  const netIR = netAlpha / te;

  // P(beat) = Φ(√T × net_IR)
  const score = Math.round(
    Math.min(99, Math.max(1, 100 * normalCDF(Math.sqrt(T) * netIR))),
  );

  return { score, trackingError: te, netIR };
}

/* ── Scalar blends ──────────────────────────────────────── */

function portfolioER(
  funds: FundDetail[],
  weights: Map<string, number>,
): number {
  return funds.reduce(
    (sum, f) => sum + f.expenseRatio * (weights.get(f.ticker) ?? 0),
    0,
  );
}

/* ── Verdict ────────────────────────────────────────────── */

function getVerdictLabel(score: number): string {
  if (score >= 60)
    return `Your portfolio has a ${score}% probability of outperforming its passive clone. The active management appears to be adding value.`;
  if (score >= 40)
    return `Your portfolio has a ${score}% probability of outperforming. It\u2019s a coin-toss \u2014 consider whether the fees are justified.`;
  return `Your portfolio has only a ${score}% probability of outperforming. You may want to consider the passive clone.`;
}

function getVerdictSentiment(
  score: number,
): "positive" | "mixed" | "negative" {
  if (score >= 60) return "positive";
  if (score >= 40) return "mixed";
  return "negative";
}

function getDominantTilt(tilts: BlendedFactorTilt[]): string {
  const significant = tilts.filter((t) => Math.abs(t.exposure) >= 0.1);
  if (significant.length === 0)
    return "Your portfolio has no dominant factor tilt.";
  const top = significant[0]; // already sorted by |exposure|
  const direction = top.exposure > 0 ? "overweight" : "underweight";
  return `Your portfolio tilts toward ${top.factor} (${direction}).`;
}

/* ── Growth chart & dollar projections ───────────────────── */

function buildCumulativeReturns(
  dates: string[],
  portfolioReturns: number[],
  cloneReturns: number[],
): { date: string; portfolio: number; clone: number }[] {
  if (dates.length === 0) return [];
  let cumPort = 10000;
  let cumClone = 10000;
  return dates.map((date, i) => {
    cumPort *= 1 + portfolioReturns[i] / 100;
    cumClone *= 1 + cloneReturns[i] / 100;
    return {
      date,
      portfolio: Math.round(cumPort),
      clone: Math.round(cumClone),
    };
  });
}

/** Compound fee drag: how much more you pay in fees over N years on $X. */
function feeDragDollars(
  activeER: number,
  passiveER: number,
  principal: number,
  years: number,
): number {
  // Assume 7% gross return, subtract respective ERs
  const gross = 7;
  const activeGrowth = principal * Math.pow(1 + (gross - activeER) / 100, years);
  const passiveGrowth = principal * Math.pow(1 + (gross - passiveER) / 100, years);
  return Math.round(passiveGrowth - activeGrowth);
}

/* ── Main computation ───────────────────────────────────── */

function computeGrossAlpha(
  funds: FundDetail[],
  allocWeights: Map<string, number>,
): number {
  let totalAlpha = 0;
  for (const fund of funds) {
    const w = allocWeights.get(fund.ticker) ?? 0;
    const fund3Y = fund.performance.trailingReturns.threeYear;
    const passiveReturns = computeTrailingReturns(
      fund.performance.passiveAltMonthlyReturns,
    );
    const passive3Y = passiveReturns.threeYear;
    if (fund3Y != null && passive3Y != null) {
      const passiveExpenseApprox = fund.expenseRatio < 0.15 ? 0.03 : 0.04;
      const feeGapPct = fund.expenseRatio - passiveExpenseApprox;
      const netDiff = fund3Y - passive3Y;
      const grossSkill = netDiff + feeGapPct;
      totalAlpha += grossSkill * w;
    }
  }
  return totalAlpha;
}

export function computeXRay(
  funds: FundDetail[],
  allocWeights: Map<string, number>,
): XRayResult {
  const holdings = blendHoldings(funds, allocWeights);
  const sectors = blendSectors(funds, allocWeights);
  const factorTilts = blendFactorTilts(funds, allocWeights);

  // Regression-based passive clone
  const { clone, blendedER: passiveER, cloneReturns, portfolioReturns, dates } =
    buildPassiveCloneRegression(funds, allocWeights);

  // Portfolio FundScore from tracking difference
  const { score, trackingError, netIR } = computePortfolioScore(
    portfolioReturns,
    cloneReturns,
  );

  // Cumulative return series for growth chart
  const cumulativeReturns = buildCumulativeReturns(dates, portfolioReturns, cloneReturns);

  const portER = portfolioER(funds, allocWeights);
  const grossAlpha = computeGrossAlpha(funds, allocWeights);
  const feeGap = portER - passiveER;
  const netEdge = grossAlpha - feeGap;

  const top5 = holdings
    .slice(0, 5)
    .reduce((s, h) => s + h.effectiveWeight, 0);
  const overlapCount = holdings.filter((h) => h.fundCount >= 2).length;

  return {
    blendedScore: score,
    blendedER: portER,
    uniqueHoldingsCount: holdings.length,

    blendedHoldings: holdings,
    top5Concentration: top5,
    overlapCount,

    blendedSectors: sectors,

    blendedFactorTilts: factorTilts,
    dominantTilt: getDominantTilt(factorTilts),

    portfolioER: portER,
    portfolioDollarCostPer10k: (portER / 100) * 10000,
    passiveER,
    passiveDollarCostPer10k: (passiveER / 100) * 10000,
    annualFeeSavings: ((portER - passiveER) / 100) * 10000,

    passiveClone: clone,

    cumulativeReturns,

    lifetimeCost10yr: feeDragDollars(portER, passiveER, 100000, 10),
    lifetimeCost20yr: feeDragDollars(portER, passiveER, 100000, 20),
    lifetimeCost30yr: feeDragDollars(portER, passiveER, 100000, 30),

    grossAlpha,
    feeGap,
    feeGapDollars: (feeGap / 100) * 10000,
    netEdge,

    trackingError,
    netIR,

    verdictScore: score,
    verdictLabel: getVerdictLabel(score),
    verdictSentiment: getVerdictSentiment(score),
  };
}
