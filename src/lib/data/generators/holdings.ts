import { createSeededRandom } from "./seed";
import {
  Holding,
  SectorWeight,
  AssetAllocationItem,
  CreditQualityItem,
  MaturityBucket,
  AssetClassCode,
} from "../../types";

const EQUITY_HOLDINGS: { name: string; ticker: string; sector: string }[] = [
  { name: "Apple Inc.", ticker: "AAPL", sector: "Technology" },
  { name: "Microsoft Corp.", ticker: "MSFT", sector: "Technology" },
  { name: "Amazon.com Inc.", ticker: "AMZN", sector: "Consumer Cyclical" },
  { name: "NVIDIA Corp.", ticker: "NVDA", sector: "Technology" },
  { name: "Alphabet Inc.", ticker: "GOOGL", sector: "Communication Services" },
  { name: "Meta Platforms Inc.", ticker: "META", sector: "Communication Services" },
  { name: "Berkshire Hathaway", ticker: "BRK.B", sector: "Financial Services" },
  { name: "Tesla Inc.", ticker: "TSLA", sector: "Consumer Cyclical" },
  { name: "UnitedHealth Group", ticker: "UNH", sector: "Healthcare" },
  { name: "Johnson & Johnson", ticker: "JNJ", sector: "Healthcare" },
  { name: "JPMorgan Chase", ticker: "JPM", sector: "Financial Services" },
  { name: "Visa Inc.", ticker: "V", sector: "Financial Services" },
  { name: "Procter & Gamble", ticker: "PG", sector: "Consumer Defensive" },
  { name: "Mastercard Inc.", ticker: "MA", sector: "Financial Services" },
  { name: "Eli Lilly", ticker: "LLY", sector: "Healthcare" },
  { name: "Costco Wholesale", ticker: "COST", sector: "Consumer Defensive" },
  { name: "Home Depot", ticker: "HD", sector: "Consumer Cyclical" },
  { name: "Chevron Corp.", ticker: "CVX", sector: "Energy" },
  { name: "AbbVie Inc.", ticker: "ABBV", sector: "Healthcare" },
  { name: "Merck & Co.", ticker: "MRK", sector: "Healthcare" },
  { name: "PepsiCo Inc.", ticker: "PEP", sector: "Consumer Defensive" },
  { name: "Broadcom Inc.", ticker: "AVGO", sector: "Technology" },
  { name: "Adobe Inc.", ticker: "ADBE", sector: "Technology" },
  { name: "Salesforce Inc.", ticker: "CRM", sector: "Technology" },
  { name: "Walt Disney Co.", ticker: "DIS", sector: "Communication Services" },
  { name: "Nike Inc.", ticker: "NKE", sector: "Consumer Cyclical" },
  { name: "Caterpillar Inc.", ticker: "CAT", sector: "Industrials" },
  { name: "Deere & Company", ticker: "DE", sector: "Industrials" },
  { name: "NextEra Energy", ticker: "NEE", sector: "Utilities" },
  { name: "Duke Energy", ticker: "DUK", sector: "Utilities" },
];

const BOND_HOLDINGS: { name: string; sector: string }[] = [
  { name: "US Treasury 2Y", sector: "Government" },
  { name: "US Treasury 5Y", sector: "Government" },
  { name: "US Treasury 10Y", sector: "Government" },
  { name: "US Treasury 30Y", sector: "Government" },
  { name: "FHLMC Gold 30Y", sector: "Securitized" },
  { name: "FNMA 30Y", sector: "Securitized" },
  { name: "GNMA 30Y", sector: "Securitized" },
  { name: "Apple Inc. 3.25% 2029", sector: "Corporate" },
  { name: "Microsoft 2.40% 2027", sector: "Corporate" },
  { name: "JPMorgan 4.50% 2028", sector: "Corporate" },
  { name: "Goldman Sachs 3.85% 2030", sector: "Corporate" },
  { name: "AT&T 4.35% 2029", sector: "Corporate" },
  { name: "Verizon 3.15% 2030", sector: "Corporate" },
  { name: "CVS Health 5.05% 2028", sector: "Corporate" },
  { name: "Bank of America 3.95% 2031", sector: "Corporate" },
  { name: "Ford Motor 6.10% 2028", sector: "High Yield" },
  { name: "T-Mobile 3.75% 2027", sector: "Corporate" },
  { name: "Comcast 4.15% 2028", sector: "Corporate" },
  { name: "Target Corp. 3.90% 2029", sector: "Corporate" },
  { name: "Walmart 2.85% 2029", sector: "Corporate" },
];

const EQUITY_SECTORS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer Cyclical",
  "Communication Services",
  "Industrials",
  "Consumer Defensive",
  "Energy",
  "Utilities",
  "Real Estate",
];
const BOND_SECTORS = [
  "Government",
  "Corporate",
  "Securitized",
  "High Yield",
  "Municipal",
];

export function generateHoldings(
  assetClass: AssetClassCode,
  seed: number
): {
  holdings: Holding[];
  sectorWeights: SectorWeight[];
  assetAllocation: AssetAllocationItem[];
  creditQuality?: CreditQualityItem[];
  benchmarkSectorWeights?: SectorWeight[];
  maturityDistribution?: MaturityBucket[];
} {
  const rng = createSeededRandom(seed);
  const isFI = assetClass === "FI" || assetClass === "MU";
  const isMA = assetClass === "MA";

  const holdingPool = isFI
    ? BOND_HOLDINGS.map((h) => ({ ...h, ticker: null as string | null }))
    : EQUITY_HOLDINGS.map((h) => ({ ...h, ticker: h.ticker as string | null }));
  const sectorPool = isFI ? BOND_SECTORS : EQUITY_SECTORS;

  const numHoldings = rng.nextInt(10, 15);
  const shuffled = rng.shuffle([...holdingPool]);
  const selectedHoldings = shuffled.slice(0, numHoldings);

  let weights: number[] = [];
  for (let i = 0; i < numHoldings; i++) {
    weights.push(rng.nextRange(1, 10));
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const targetTotal = rng.nextRange(85, 95);
  weights = weights.map((w) =>
    Number(((w / totalWeight) * targetTotal).toFixed(2))
  );
  weights.sort((a, b) => b - a);

  const holdings: Holding[] = selectedHoldings.map((h, i) => ({
    name: h.name,
    ticker: h.ticker,
    weight: weights[i],
    sector: h.sector,
    benchmarkWeight: Number(Math.max(0, weights[i] + rng.nextRange(-3, 1.5)).toFixed(2)),
  }));

  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    sectorMap.set(h.sector, (sectorMap.get(h.sector) || 0) + h.weight);
  }
  for (const s of sectorPool) {
    if (!sectorMap.has(s)) {
      sectorMap.set(s, Number(rng.nextRange(0.5, 3).toFixed(2)));
    }
  }
  const sectorWeights: SectorWeight[] = Array.from(sectorMap.entries())
    .map(([sector, weight]) => ({ sector, weight: Number(weight.toFixed(2)) }))
    .sort((a, b) => b.weight - a.weight);

  let assetAllocation: AssetAllocationItem[];
  if (isMA) {
    const equityPct = rng.nextRange(50, 65);
    const bondPct = rng.nextRange(90 - equityPct, 95 - equityPct);
    const cashPct = 100 - equityPct - bondPct;
    assetAllocation = [
      { type: "Equity", weight: Number(equityPct.toFixed(1)) },
      { type: "Fixed Income", weight: Number(bondPct.toFixed(1)) },
      { type: "Cash", weight: Number(cashPct.toFixed(1)) },
    ];
  } else if (isFI) {
    const fiWeight = rng.nextRange(92, 98);
    assetAllocation = [
      { type: "Fixed Income", weight: Number(fiWeight.toFixed(1)) },
      { type: "Cash", weight: Number((100 - fiWeight).toFixed(1)) },
    ];
  } else {
    const eqWeight = rng.nextRange(94, 99);
    assetAllocation = [
      { type: "Equity", weight: Number(eqWeight.toFixed(1)) },
      { type: "Cash", weight: Number((100 - eqWeight).toFixed(1)) },
    ];
  }

  let creditQuality: CreditQualityItem[] | undefined;
  if (isFI) {
    creditQuality = [
      { rating: "AAA", weight: Number(rng.nextRange(25, 40).toFixed(1)) },
      { rating: "AA", weight: Number(rng.nextRange(10, 20).toFixed(1)) },
      { rating: "A", weight: Number(rng.nextRange(15, 25).toFixed(1)) },
      { rating: "BBB", weight: Number(rng.nextRange(15, 25).toFixed(1)) },
      {
        rating: "Below BBB",
        weight: Number(rng.nextRange(2, 8).toFixed(1)),
      },
    ];
  }

  // Generate benchmark sector weights (slightly different from fund)
  const benchmarkSectorWeights: SectorWeight[] = sectorWeights.map((sw) => ({
    sector: sw.sector,
    weight: Number(Math.max(0.5, sw.weight + rng.nextRange(-4, 3)).toFixed(2)),
  }));

  // Generate maturity distribution for FI funds
  let maturityDistribution: MaturityBucket[] | undefined;
  if (isFI) {
    maturityDistribution = [
      { range: "0-1Y", weight: Number(rng.nextRange(5, 15).toFixed(1)) },
      { range: "1-3Y", weight: Number(rng.nextRange(10, 25).toFixed(1)) },
      { range: "3-5Y", weight: Number(rng.nextRange(15, 30).toFixed(1)) },
      { range: "5-10Y", weight: Number(rng.nextRange(15, 25).toFixed(1)) },
      { range: "10-20Y", weight: Number(rng.nextRange(5, 15).toFixed(1)) },
      { range: "20+Y", weight: Number(rng.nextRange(2, 10).toFixed(1)) },
    ];
  }

  return { holdings, sectorWeights, assetAllocation, creditQuality, benchmarkSectorWeights, maturityDistribution };
}
