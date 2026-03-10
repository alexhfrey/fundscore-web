import { createSeededRandom } from "./seed";
import {
  PortfolioCharacteristics,
  EquityCharacteristics,
  FixedIncomeCharacteristics,
  StyleBoxPosition,
  CategoryPercentiles,
  AssetClassCode,
} from "../../types";

function generateEquityCharacteristics(seed: number): EquityCharacteristics {
  const rng = createSeededRandom(seed);
  return {
    peRatio: Number(rng.nextRange(14, 32).toFixed(1)),
    pbRatio: Number(rng.nextRange(1.5, 6.0).toFixed(1)),
    weightedAvgMarketCap: Number(rng.nextRange(30, 400).toFixed(0)),
    earningsGrowth: Number(rng.nextRange(5, 25).toFixed(1)),
    dividendYield: Number(rng.nextRange(0.5, 3.5).toFixed(2)),
    roe: Number(rng.nextRange(12, 35).toFixed(1)),
  };
}

function generateFICharacteristics(
  seed: number
): FixedIncomeCharacteristics {
  const rng = createSeededRandom(seed);

  return {
    effectiveDuration: Number(rng.nextRange(3, 7).toFixed(2)),
    avgCreditQuality: rng.pick(["AA", "AA-", "A+", "A"]),
    yieldToMaturity: Number(rng.nextRange(3, 5.5).toFixed(2)),
    sec30DayYield: Number(rng.nextRange(2.5, 5).toFixed(2)),
    avgCoupon: Number(rng.nextRange(2.5, 5.5).toFixed(2)),
    avgMaturity: Number(rng.nextRange(4, 10).toFixed(1)),
  };
}

function generateStyleBox(seed: number): StyleBoxPosition {
  const rng = createSeededRandom(seed);

  const size = rng.pick(["Large", "Mid", "Small"] as const);
  const style = rng.pick(["Value", "Blend", "Growth"] as const);

  const posMap = {
    Large: { Value: 1, Blend: 2, Growth: 3 },
    Mid: { Value: 4, Blend: 5, Growth: 6 },
    Small: { Value: 7, Blend: 8, Growth: 9 },
  };
  const position = posMap[size][style];

  return { size, style, position };
}

function generatePercentiles(score: number, seed: number): CategoryPercentiles {
  const rng = createSeededRandom(seed);
  const bias = (100 - score) / 100;

  return {
    fee: Math.round(rng.nextRange(10, 90)),
    activeShare: Math.round(rng.nextRange(20 * bias, 60 + 40 * bias)),
    trackingError: Math.round(rng.nextRange(20, 80)),
    return1Y: Math.round(rng.nextRange(5 * bias, 40 + 60 * bias)),
    return3Y: Math.round(rng.nextRange(10 * bias, 45 + 55 * bias)),
    return5Y: Math.round(rng.nextRange(10 * bias, 50 + 50 * bias)),
    returnInception: Math.round(rng.nextRange(15 * bias, 50 + 50 * bias)),
  };
}

export function generateCharacteristics(
  assetClass: AssetClassCode,
  score: number,
  seed: number
): PortfolioCharacteristics {
  const isFI = assetClass === "FI" || assetClass === "MU";
  const isMA = assetClass === "MA";

  const result: PortfolioCharacteristics = {
    percentiles: generatePercentiles(score, seed + 40),
  };

  if (isFI) {
    result.fixedIncome = generateFICharacteristics(seed + 10);
  } else if (isMA) {
    result.equity = generateEquityCharacteristics(seed);
    result.fixedIncome = generateFICharacteristics(seed + 10);
  } else {
    result.equity = generateEquityCharacteristics(seed);
    result.styleBox = generateStyleBox(seed + 20);
  }

  return result;
}
