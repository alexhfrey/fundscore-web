import { ModelBacktest } from "../types";
import { createSeededRandom } from "./generators/seed";

let _modelData: ModelBacktest | null = null;

export function getModelStats(): ModelBacktest {
  if (_modelData) return _modelData;

  const rng = createSeededRandom(77777);

  const calibration = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((bucket) => ({
    predictedBucket: bucket,
    actualBeatRate: Number((bucket + rng.nextRange(-8, 8)).toFixed(1)),
    sampleSize: rng.nextInt(80, 300),
  }));

  const rollingAccuracy = [];
  let hitRate = 58;
  for (let year = 2018; year <= 2025; year++) {
    for (let q = 1; q <= 4; q++) {
      hitRate = Math.min(85, Math.max(50, hitRate + rng.nextRange(-5, 7)));
      rollingAccuracy.push({
        date: `${year}-Q${q}`,
        hitRate: Number(hitRate.toFixed(1)),
      });
    }
  }

  const quintileReturns = [
    {
      quintile: 1 as const,
      avgExcessReturn: Number(rng.nextRange(2.5, 4.5).toFixed(2)),
      fundCount: rng.nextInt(200, 350),
    },
    {
      quintile: 2 as const,
      avgExcessReturn: Number(rng.nextRange(0.8, 2.0).toFixed(2)),
      fundCount: rng.nextInt(200, 350),
    },
    {
      quintile: 3 as const,
      avgExcessReturn: Number(rng.nextRange(-0.5, 0.5).toFixed(2)),
      fundCount: rng.nextInt(200, 350),
    },
    {
      quintile: 4 as const,
      avgExcessReturn: Number(rng.nextRange(-2.0, -0.5).toFixed(2)),
      fundCount: rng.nextInt(200, 350),
    },
    {
      quintile: 5 as const,
      avgExcessReturn: Number(rng.nextRange(-4.5, -2.0).toFixed(2)),
      fundCount: rng.nextInt(200, 350),
    },
  ];

  const topVsBottomSpread = [];
  let spread = 4.0;
  for (let year = 2018; year <= 2025; year++) {
    for (let q = 1; q <= 4; q++) {
      spread = Math.max(1.0, spread + rng.nextRange(-1.5, 2.0));
      topVsBottomSpread.push({
        date: `${year}-Q${q}`,
        spread: Number(spread.toFixed(2)),
      });
    }
  }

  const categoryAccuracy = [
    {
      category: "US Equity",
      accuracy: Number(rng.nextRange(62, 72).toFixed(1)),
      sampleSize: rng.nextInt(500, 900),
    },
    {
      category: "Fixed Income",
      accuracy: Number(rng.nextRange(65, 75).toFixed(1)),
      sampleSize: rng.nextInt(300, 600),
    },
    {
      category: "International",
      accuracy: Number(rng.nextRange(58, 68).toFixed(1)),
      sampleSize: rng.nextInt(150, 350),
    },
    {
      category: "Allocation",
      accuracy: Number(rng.nextRange(60, 70).toFixed(1)),
      sampleSize: rng.nextInt(200, 400),
    },
    {
      category: "Specialty",
      accuracy: Number(rng.nextRange(55, 65).toFixed(1)),
      sampleSize: rng.nextInt(100, 250),
    },
  ];

  _modelData = {
    calibration,
    rollingAccuracy,
    quintileReturns,
    topVsBottomSpread,
    totalFundsScored: 1847,
    dataStartDate: "2016-01-01",
    lastUpdated: "2025-12-31",
    categoryAccuracy,
  };

  return _modelData;
}
