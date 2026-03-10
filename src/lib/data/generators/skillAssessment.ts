import { createSeededRandom } from "./seed";
import { SkillAssessment, BayesianSkillDistribution, AssetClassCode } from "../../types";

function betaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  const lnB =
    lnGamma(alpha) + lnGamma(beta) - lnGamma(alpha + beta);
  return Math.exp(
    (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - lnB
  );
}

function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaQuantile(p: number, alpha: number, beta: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const cdf = incompleteBeta(mid, alpha, beta);
    if (cdf < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const n = 200;
  const dx = x / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const xi = i * dx;
    const y = betaPDF(xi, a, b);
    sum += y * (i === 0 || i === n ? 0.5 : 1);
  }
  return sum * dx;
}

function generateBayesianDistribution(
  battingAverage: number,
  independentDecisions: number,
  seed: number
): BayesianSkillDistribution {
  const rng = createSeededRandom(seed);

  const priorAlpha = 2;
  const priorBeta = 2;

  const observedWins = Math.round(battingAverage * independentDecisions);
  const observedTotal = independentDecisions;

  const posteriorAlpha = priorAlpha + observedWins;
  const posteriorBeta = priorBeta + (observedTotal - observedWins);

  const posteriorMean = posteriorAlpha / (posteriorAlpha + posteriorBeta);
  const posteriorStdDev = Math.sqrt(
    (posteriorAlpha * posteriorBeta) /
      ((posteriorAlpha + posteriorBeta) ** 2 * (posteriorAlpha + posteriorBeta + 1))
  );

  const ci80Low = betaQuantile(0.10, posteriorAlpha, posteriorBeta);
  const ci80High = betaQuantile(0.90, posteriorAlpha, posteriorBeta);
  const ci95Low = betaQuantile(0.025, posteriorAlpha, posteriorBeta);
  const ci95High = betaQuantile(0.975, posteriorAlpha, posteriorBeta);

  const pdfPoints: { x: number; y: number }[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    pdfPoints.push({ x, y: betaPDF(x, posteriorAlpha, posteriorBeta) });
  }

  rng.next();

  return {
    priorAlpha,
    priorBeta,
    observedWins,
    observedTotal,
    posteriorMean: Number(posteriorMean.toFixed(4)),
    posteriorStdDev: Number(posteriorStdDev.toFixed(4)),
    credibleInterval80: [Number(ci80Low.toFixed(4)), Number(ci80High.toFixed(4))],
    credibleInterval95: [Number(ci95Low.toFixed(4)), Number(ci95High.toFixed(4))],
    pdfPoints,
  };
}

export function generateSkillAssessment(
  battingAverage: number,
  avgWinSize: number,
  avgLossSize: number,
  independentDecisions: number,
  informationRatio: number,
  assetClass: AssetClassCode,
  seed: number
): SkillAssessment {
  const rng = createSeededRandom(seed);
  const winLossRatio = Number((avgWinSize / avgLossSize).toFixed(2));
  const breadth = independentDecisions;
  const ic = breadth > 0 ? informationRatio / Math.sqrt(breadth) : 0;
  const estimatedIR = ic * Math.sqrt(breadth);

  const isFI = assetClass === "FI" || assetClass === "MU";

  const result: SkillAssessment = {
    battingAverage,
    bayesianDistribution: generateBayesianDistribution(
      battingAverage,
      independentDecisions,
      seed + 100
    ),
    avgWinSize,
    avgLossSize,
    winLossRatio,
    independentDecisions,
    informationCoefficient: Number(ic.toFixed(4)),
    breadth,
    estimatedIR: Number(estimatedIR.toFixed(2)),
  };

  if (isFI) {
    result.durationTimingSkill = Number(rng.nextRange(0.3, 0.7).toFixed(2));
    result.creditTimingSkill = Number(rng.nextRange(0.3, 0.7).toFixed(2));
  }

  return result;
}
