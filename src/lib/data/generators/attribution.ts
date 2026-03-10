import { createSeededRandom } from "./seed";
import {
  PerformanceAttribution,
  EquityAttribution,
  FixedIncomeAttribution,
  AllocationAttribution,
  SectorBet,
  StockPick,
  Holding,
  SectorWeight,
  AssetClassCode,
} from "../../types";

function generateEquityAttribution(
  expenseRatio: number,
  beta: number,
  seed: number
): EquityAttribution {
  const rng = createSeededRandom(seed);
  const betaContribution = Math.round(rng.nextRange(-20, 40));
  const sectorExposure = Math.round(rng.nextRange(-15, 25));
  const sectorTiming = Math.round(rng.nextRange(-20, 20));
  const marketTiming = Math.round(rng.nextRange(-15, 15));
  const stockSelection = Math.round(rng.nextRange(-30, 50));
  const grossAlpha =
    betaContribution + sectorExposure + sectorTiming + marketTiming + stockSelection;
  const feesDrag = -Math.round(expenseRatio * 100);
  const netAlpha = grossAlpha + feesDrag;

  return {
    betaContribution,
    sectorExposure,
    sectorTiming,
    marketTiming,
    stockSelection,
    grossAlpha,
    feesDrag,
    netAlpha,
  };
}

function generateFIAttribution(
  expenseRatio: number,
  seed: number
): FixedIncomeAttribution {
  const rng = createSeededRandom(seed);
  const durationEffect = Math.round(rng.nextRange(-15, 20));
  const yieldCurveEffect = Math.round(rng.nextRange(-10, 15));
  const creditSpreadEffect = Math.round(rng.nextRange(-20, 25));
  const sectorAllocation = Math.round(rng.nextRange(-10, 15));
  const securitySelection = Math.round(rng.nextRange(-15, 20));
  const grossAlpha =
    durationEffect + yieldCurveEffect + creditSpreadEffect + sectorAllocation + securitySelection;
  const feesDrag = -Math.round(expenseRatio * 100);
  const netAlpha = grossAlpha + feesDrag;

  return {
    durationEffect,
    yieldCurveEffect,
    creditSpreadEffect,
    sectorAllocation,
    securitySelection,
    grossAlpha,
    feesDrag,
    netAlpha,
  };
}

function generateAllocationAttribution(
  expenseRatio: number,
  seed: number
): AllocationAttribution {
  const rng = createSeededRandom(seed);
  const assetClassAllocation = Math.round(rng.nextRange(-20, 30));
  const withinEquity = Math.round(rng.nextRange(-15, 25));
  const withinFixedIncome = Math.round(rng.nextRange(-10, 15));
  const withinAlternatives = Math.round(rng.nextRange(-5, 10));
  const grossAlpha =
    assetClassAllocation + withinEquity + withinFixedIncome + withinAlternatives;
  const feesDrag = -Math.round(expenseRatio * 100);
  const netAlpha = grossAlpha + feesDrag;

  return {
    assetClassAllocation,
    withinEquity,
    withinFixedIncome,
    withinAlternatives,
    grossAlpha,
    feesDrag,
    netAlpha,
  };
}

function generateSectorBets(
  sectorWeights: SectorWeight[],
  benchmarkSectorWeights: SectorWeight[],
  seed: number
): SectorBet[] {
  const rng = createSeededRandom(seed);
  return sectorWeights.map((sw) => {
    const bw = benchmarkSectorWeights.find((b) => b.sector === sw.sector);
    const benchmarkWeight = bw ? bw.weight : Number(rng.nextRange(1, 8).toFixed(2));
    const overUnderweight = Number((sw.weight - benchmarkWeight).toFixed(2));
    const contribution = Math.round(overUnderweight * rng.nextRange(-3, 5));
    return {
      sector: sw.sector,
      fundWeight: sw.weight,
      benchmarkWeight,
      overUnderweight,
      contribution,
    };
  });
}

function generateStockPicks(
  holdings: Holding[],
  seed: number
): StockPick[] {
  const rng = createSeededRandom(seed);
  return holdings.slice(0, 10).map((h) => {
    const benchmarkWeight = Number(
      Math.max(0, h.weight + rng.nextRange(-3, 1)).toFixed(2)
    );
    const contribution = Math.round((h.weight - benchmarkWeight) * rng.nextRange(1, 8));
    return {
      name: h.name,
      ticker: h.ticker,
      fundWeight: h.weight,
      benchmarkWeight,
      contribution,
    };
  });
}

export function generateAttribution(
  assetClass: AssetClassCode,
  expenseRatio: number,
  beta: number,
  holdings: Holding[],
  sectorWeights: SectorWeight[],
  benchmarkSectorWeights: SectorWeight[],
  seed: number
): PerformanceAttribution {
  const isFI = assetClass === "FI" || assetClass === "MU";
  const isMA = assetClass === "MA";

  const sectorBets = generateSectorBets(sectorWeights, benchmarkSectorWeights, seed + 10);
  const stockPicks = generateStockPicks(holdings, seed + 20);

  if (isMA) {
    return {
      type: "allocation",
      allocation: generateAllocationAttribution(expenseRatio, seed),
      sectorBets,
      stockPicks,
    };
  }

  if (isFI) {
    return {
      type: "fixedIncome",
      fixedIncome: generateFIAttribution(expenseRatio, seed),
      sectorBets,
      stockPicks,
    };
  }

  return {
    type: "equity",
    equity: generateEquityAttribution(expenseRatio, beta, seed),
    sectorBets,
    stockPicks,
  };
}
