import { createSeededRandom } from "./seed";
import {
  FactorRiskProfile,
  FactorSensitivity,
  HistoricalScenario,
  RiskDecompositionItem,
  DurationRiskProfile,
  AssetClassCode,
} from "../../types";

function generateEquityFactorSensitivities(
  beta: number,
  seed: number
): FactorSensitivity[] {
  const rng = createSeededRandom(seed);
  return [
    {
      factor: "Broad Market",
      beta: Number(beta.toFixed(2)),
      shockLabel: "±10%",
      shockMagnitude: 10,
      estimatedImpactDown: Number((-beta * 10 + rng.nextRange(-1, 1)).toFixed(1)),
      estimatedImpactUp: Number((beta * 10 + rng.nextRange(-1, 1)).toFixed(1)),
    },
    {
      factor: "Oil Prices",
      beta: Number(rng.nextRange(-0.3, 0.4).toFixed(2)),
      shockLabel: "±20%",
      shockMagnitude: 20,
      estimatedImpactDown: Number(rng.nextRange(-4, 1).toFixed(1)),
      estimatedImpactUp: Number(rng.nextRange(-1, 4).toFixed(1)),
    },
    {
      factor: "Value Factor",
      beta: Number(rng.nextRange(-0.5, 0.6).toFixed(2)),
      shockLabel: "±1σ (~8%)",
      shockMagnitude: 8,
      estimatedImpactDown: Number(rng.nextRange(-5, 2).toFixed(1)),
      estimatedImpactUp: Number(rng.nextRange(-2, 5).toFixed(1)),
    },
    {
      factor: "Size Factor",
      beta: Number(rng.nextRange(-0.4, 0.5).toFixed(2)),
      shockLabel: "±1σ (~6%)",
      shockMagnitude: 6,
      estimatedImpactDown: Number(rng.nextRange(-3, 1).toFixed(1)),
      estimatedImpactUp: Number(rng.nextRange(-1, 3).toFixed(1)),
    },
    {
      factor: "Momentum",
      beta: Number(rng.nextRange(-0.3, 0.4).toFixed(2)),
      shockLabel: "±1σ (~10%)",
      shockMagnitude: 10,
      estimatedImpactDown: Number(rng.nextRange(-4, 1).toFixed(1)),
      estimatedImpactUp: Number(rng.nextRange(-1, 4).toFixed(1)),
    },
    {
      factor: "Commodities",
      beta: Number(rng.nextRange(-0.2, 0.3).toFixed(2)),
      shockLabel: "±15%",
      shockMagnitude: 15,
      estimatedImpactDown: Number(rng.nextRange(-3, 1).toFixed(1)),
      estimatedImpactUp: Number(rng.nextRange(-1, 3).toFixed(1)),
    },
  ];
}

function generateEquityScenarios(
  beta: number,
  seed: number
): HistoricalScenario[] {
  const rng = createSeededRandom(seed);
  return [
    {
      name: "2008 Global Financial Crisis",
      period: "Sep 2008 – Mar 2009",
      marketReturn: -46.1,
      fundReturn: Number((-46.1 * beta + rng.nextRange(-5, 5)).toFixed(1)),
      passiveAltReturn: Number((-46.1 + rng.nextRange(-3, 3)).toFixed(1)),
      recoveryMonths: rng.nextInt(18, 36),
    },
    {
      name: "2020 COVID Crash",
      period: "Feb 2020 – Mar 2020",
      marketReturn: -33.9,
      fundReturn: Number((-33.9 * beta + rng.nextRange(-4, 4)).toFixed(1)),
      passiveAltReturn: Number((-33.9 + rng.nextRange(-2, 2)).toFixed(1)),
      recoveryMonths: rng.nextInt(4, 8),
    },
    {
      name: "2022 Rate Shock",
      period: "Jan 2022 – Oct 2022",
      marketReturn: -25.4,
      fundReturn: Number((-25.4 * beta + rng.nextRange(-3, 3)).toFixed(1)),
      passiveAltReturn: Number((-25.4 + rng.nextRange(-2, 2)).toFixed(1)),
      recoveryMonths: rng.nextInt(10, 18),
    },
  ];
}

function generateFIScenarios(seed: number): HistoricalScenario[] {
  const rng = createSeededRandom(seed);
  return [
    {
      name: "2013 Taper Tantrum",
      period: "May 2013 – Sep 2013",
      marketReturn: -3.5,
      fundReturn: Number((-3.5 + rng.nextRange(-2, 2)).toFixed(1)),
      passiveAltReturn: Number((-3.5 + rng.nextRange(-1, 1)).toFixed(1)),
      recoveryMonths: rng.nextInt(6, 12),
    },
    {
      name: "2020 COVID Crash",
      period: "Feb 2020 – Mar 2020",
      marketReturn: -6.2,
      fundReturn: Number((-6.2 + rng.nextRange(-3, 3)).toFixed(1)),
      passiveAltReturn: Number((-6.2 + rng.nextRange(-1, 1)).toFixed(1)),
      recoveryMonths: rng.nextInt(2, 6),
    },
    {
      name: "2022 Rate Shock",
      period: "Jan 2022 – Oct 2022",
      marketReturn: -15.7,
      fundReturn: Number((-15.7 + rng.nextRange(-3, 4)).toFixed(1)),
      passiveAltReturn: Number((-15.7 + rng.nextRange(-1, 1)).toFixed(1)),
      recoveryMonths: rng.nextInt(12, 24),
    },
  ];
}

function generateEquityRiskDecomposition(seed: number): RiskDecompositionItem[] {
  const rng = createSeededRandom(seed);
  const market = rng.nextRange(45, 65);
  const value = rng.nextRange(5, 15);
  const size = rng.nextRange(3, 12);
  const momentum = rng.nextRange(2, 8);
  const sector = rng.nextRange(5, 12);
  const total = market + value + size + momentum + sector;
  const residual = 100 - total;

  return [
    { factor: "Market", percentOfRisk: Number(market.toFixed(1)) },
    { factor: "Value/Growth", percentOfRisk: Number(value.toFixed(1)) },
    { factor: "Size", percentOfRisk: Number(size.toFixed(1)) },
    { factor: "Momentum", percentOfRisk: Number(momentum.toFixed(1)) },
    { factor: "Sector", percentOfRisk: Number(sector.toFixed(1)) },
    { factor: "Residual (Stock-Specific)", percentOfRisk: Number(Math.max(5, residual).toFixed(1)) },
  ];
}

function generateFIRiskDecomposition(seed: number): RiskDecompositionItem[] {
  const rng = createSeededRandom(seed);
  const duration = rng.nextRange(35, 55);
  const credit = rng.nextRange(15, 30);
  const curve = rng.nextRange(5, 15);
  const spread = rng.nextRange(5, 12);
  const total = duration + credit + curve + spread;
  const residual = 100 - total;

  return [
    { factor: "Duration", percentOfRisk: Number(duration.toFixed(1)) },
    { factor: "Credit", percentOfRisk: Number(credit.toFixed(1)) },
    { factor: "Yield Curve", percentOfRisk: Number(curve.toFixed(1)) },
    { factor: "Spread", percentOfRisk: Number(spread.toFixed(1)) },
    { factor: "Residual (Security-Specific)", percentOfRisk: Number(Math.max(5, residual).toFixed(1)) },
  ];
}

function generateDurationRiskProfile(seed: number): DurationRiskProfile {
  const rng = createSeededRandom(seed);
  const effectiveDuration = Number(rng.nextRange(2, 8).toFixed(2));

  return {
    effectiveDuration,
    keyRateDurations: [
      { tenor: "1Y", duration: Number(rng.nextRange(0.1, 0.8).toFixed(2)) },
      { tenor: "2Y", duration: Number(rng.nextRange(0.2, 1.2).toFixed(2)) },
      { tenor: "5Y", duration: Number(rng.nextRange(0.5, 2.5).toFixed(2)) },
      { tenor: "10Y", duration: Number(rng.nextRange(0.8, 3.0).toFixed(2)) },
      { tenor: "30Y", duration: Number(rng.nextRange(0.2, 1.5).toFixed(2)) },
    ],
    rateShiftImpacts: [
      { shift: "+50 bps", impact: Number((-effectiveDuration * 0.5).toFixed(2)) },
      { shift: "+100 bps", impact: Number((-effectiveDuration * 1.0).toFixed(2)) },
      { shift: "+200 bps", impact: Number((-effectiveDuration * 2.0).toFixed(2)) },
    ],
    creditSpreadSensitivity: Number(rng.nextRange(0.5, 3.0).toFixed(2)),
  };
}

export function generateFactorRiskProfile(
  assetClass: AssetClassCode,
  beta: number,
  seed: number
): FactorRiskProfile {
  const isFI = assetClass === "FI" || assetClass === "MU";

  if (isFI) {
    return {
      factorSensitivities: [], // FI uses duration risk instead
      historicalScenarios: generateFIScenarios(seed + 50),
      riskDecomposition: generateFIRiskDecomposition(seed + 60),
      durationRisk: generateDurationRiskProfile(seed + 70),
    };
  }

  return {
    factorSensitivities: generateEquityFactorSensitivities(beta, seed),
    historicalScenarios: generateEquityScenarios(beta, seed + 50),
    riskDecomposition: generateEquityRiskDecomposition(seed + 60),
  };
}
