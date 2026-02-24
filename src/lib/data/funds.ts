import {
  FundDetail,
  FundCategory,
  AssetClass,
  ScoreLabel,
  ScoreDriver,
  RiskData,
  FeeData,
  TradingActivity,
  Trade,
  SectorHitRate,
  FactorTilt,
  FundSummary,
} from "../types";
import { createSeededRandom } from "./generators/seed";
import {
  generateMonthlyReturns,
  generateBenchmarkReturns,
  computeTrailingReturns,
  computeCalendarYearReturns,
} from "./generators/returns";
import { generateHoldings } from "./generators/holdings";
import { generateAnalystNote } from "./generators/analystNote";

function scoreLabel(score: number): ScoreLabel {
  if (score >= 75) return "Strong Buy";
  if (score >= 60) return "Buy";
  if (score >= 40) return "Hold";
  if (score >= 25) return "Underperform";
  return "Sell";
}

function getBenchmark(assetClass: AssetClass, category: FundCategory): string {
  if (
    category.includes("Bond") ||
    category === "Bank Loan" ||
    category === "Short-Term Bond"
  )
    return "Bloomberg US Agg";
  if (category.includes("Emerging")) return "MSCI EM";
  if (category.includes("Foreign")) return "MSCI EAFE";
  return "S&P 500";
}

interface FundDef {
  ticker: string;
  name: string;
  category: FundCategory;
  assetClass: AssetClass;
  fundScore: number;
  passiveAltTicker: string;
  passiveAltName: string;
  expenseRatio: number;
  aum: number;
  seed: number;
  manager: string;
  managerStartYear: number;
}

const FUND_DEFS: FundDef[] = [
  // 8 US Equity
  { ticker: "FCNTX", name: "Fidelity Contrafund", category: "Large Growth", assetClass: "US Equity", fundScore: 78, passiveAltTicker: "VUG", passiveAltName: "Vanguard Growth ETF", expenseRatio: 0.39, aum: 130000, seed: 1001, manager: "William Danoff", managerStartYear: 1990 },
  { ticker: "VWIGX", name: "Vanguard Intl Growth", category: "Large Growth", assetClass: "US Equity", fundScore: 65, passiveAltTicker: "SCHG", passiveAltName: "Schwab US Large-Cap Growth ETF", expenseRatio: 0.42, aum: 55000, seed: 1002, manager: "Matthew Dobbs", managerStartYear: 2016 },
  { ticker: "DODGX", name: "Dodge & Cox Stock", category: "Large Value", assetClass: "US Equity", fundScore: 72, passiveAltTicker: "VTV", passiveAltName: "Vanguard Value ETF", expenseRatio: 0.51, aum: 85000, seed: 1003, manager: "Dana Emery", managerStartYear: 2014 },
  { ticker: "TRBCX", name: "T. Rowe Price Blue Chip Growth", category: "Large Growth", assetClass: "US Equity", fundScore: 69, passiveAltTicker: "IWF", passiveAltName: "iShares Russell 1000 Growth ETF", expenseRatio: 0.56, aum: 42000, seed: 1004, manager: "Paul Greene", managerStartYear: 2019 },
  { ticker: "POAGX", name: "Primecap Odyssey Aggressive Growth", category: "Mid-Cap Growth", assetClass: "US Equity", fundScore: 81, passiveAltTicker: "IWP", passiveAltName: "iShares Russell Mid-Cap Growth ETF", expenseRatio: 0.62, aum: 12000, seed: 1005, manager: "Joel Fried", managerStartYear: 2004 },
  { ticker: "FLPSX", name: "Fidelity Low-Priced Stock", category: "Mid-Cap Blend", assetClass: "US Equity", fundScore: 55, passiveAltTicker: "VO", passiveAltName: "Vanguard Mid-Cap ETF", expenseRatio: 0.52, aum: 28000, seed: 1006, manager: "Joel Tillinghast", managerStartYear: 1989 },
  { ticker: "VSCIX", name: "Vanguard Small-Cap Index", category: "Small Blend", assetClass: "US Equity", fundScore: 42, passiveAltTicker: "IJR", passiveAltName: "iShares Core S&P Small-Cap ETF", expenseRatio: 0.04, aum: 96000, seed: 1007, manager: "Gerard O'Reilly", managerStartYear: 2016 },
  { ticker: "ANCFX", name: "American Funds Fundamental", category: "Large Blend", assetClass: "US Equity", fundScore: 58, passiveAltTicker: "SPY", passiveAltName: "SPDR S&P 500 ETF", expenseRatio: 0.61, aum: 110000, seed: 1008, manager: "Dina Perry", managerStartYear: 2015 },

  // 6 Fixed Income
  { ticker: "PIMIX", name: "PIMCO Income Fund", category: "Intermediate Core-Plus Bond", assetClass: "Fixed Income", fundScore: 85, passiveAltTicker: "BND", passiveAltName: "Vanguard Total Bond Market ETF", expenseRatio: 0.59, aum: 155000, seed: 2001, manager: "Daniel Ivascyn", managerStartYear: 2012 },
  { ticker: "MWHYX", name: "Metropolitan West High Yield", category: "High Yield Bond", assetClass: "Fixed Income", fundScore: 71, passiveAltTicker: "HYG", passiveAltName: "iShares iBoxx High Yield ETF", expenseRatio: 0.65, aum: 8500, seed: 2002, manager: "Laird Landmann", managerStartYear: 2009 },
  { ticker: "DODIX", name: "Dodge & Cox Income", category: "Intermediate Core Bond", assetClass: "Fixed Income", fundScore: 68, passiveAltTicker: "AGG", passiveAltName: "iShares Core US Aggregate Bond ETF", expenseRatio: 0.41, aum: 72000, seed: 2003, manager: "Thomas Dugan", managerStartYear: 2018 },
  { ticker: "VBTLX", name: "Vanguard Total Bond Market", category: "Intermediate Core Bond", assetClass: "Fixed Income", fundScore: 45, passiveAltTicker: "SCHZ", passiveAltName: "Schwab US Aggregate Bond ETF", expenseRatio: 0.05, aum: 320000, seed: 2004, manager: "Joshua Barrickman", managerStartYear: 2013 },
  { ticker: "BKLN", name: "Invesco Senior Loan ETF", category: "Bank Loan", assetClass: "Fixed Income", fundScore: 52, passiveAltTicker: "SRLN", passiveAltName: "SPDR Blackstone Senior Loan ETF", expenseRatio: 0.65, aum: 5200, seed: 2005, manager: "Kevin Egan", managerStartYear: 2011 },
  { ticker: "VFSUX", name: "Vanguard Short-Term Investment Grade", category: "Short-Term Bond", assetClass: "Fixed Income", fundScore: 47, passiveAltTicker: "VCSH", passiveAltName: "Vanguard Short-Term Corp Bond ETF", expenseRatio: 0.10, aum: 68000, seed: 2006, manager: "Samuel Martinez", managerStartYear: 2020 },

  // 3 International
  { ticker: "DODFX", name: "Dodge & Cox International Stock", category: "Foreign Large Blend", assetClass: "International Equity", fundScore: 74, passiveAltTicker: "VEA", passiveAltName: "Vanguard FTSE Developed Markets ETF", expenseRatio: 0.63, aum: 44000, seed: 3001, manager: "Diana Strandberg", managerStartYear: 2014 },
  { ticker: "ODVYX", name: "Oppenheimer Developing Markets", category: "Diversified Emerging Markets", assetClass: "International Equity", fundScore: 61, passiveAltTicker: "VWO", passiveAltName: "Vanguard FTSE Emerging Markets ETF", expenseRatio: 0.88, aum: 17000, seed: 3002, manager: "Justin Leverenz", managerStartYear: 2007 },
  { ticker: "TEPLX", name: "Templeton Growth Fund", category: "Foreign Large Blend", assetClass: "International Equity", fundScore: 38, passiveAltTicker: "IXUS", passiveAltName: "iShares Core MSCI Total Intl ETF", expenseRatio: 0.96, aum: 9500, seed: 3003, manager: "Peter Sartori", managerStartYear: 2019 },

  // 3 Allocation
  { ticker: "PRWCX", name: "T. Rowe Price Capital Appreciation", category: "Moderate Allocation", assetClass: "Allocation", fundScore: 82, passiveAltTicker: "AOR", passiveAltName: "iShares Core Growth Allocation ETF", expenseRatio: 0.70, aum: 53000, seed: 4001, manager: "David Giroux", managerStartYear: 2006 },
  { ticker: "OAKBX", name: "Oakmark Equity & Income", category: "Moderate Allocation", assetClass: "Allocation", fundScore: 64, passiveAltTicker: "AOM", passiveAltName: "iShares Core Moderate Allocation ETF", expenseRatio: 0.78, aum: 15000, seed: 4002, manager: "Adam Abbas", managerStartYear: 2020 },
  { ticker: "VWELX", name: "Vanguard Wellington", category: "Moderate Allocation", assetClass: "Allocation", fundScore: 76, passiveAltTicker: "AOR", passiveAltName: "iShares Core Growth Allocation ETF", expenseRatio: 0.24, aum: 100000, seed: 4003, manager: "Michael Stack", managerStartYear: 2017 },

  // 3 Specialty
  { ticker: "VGSIX", name: "Vanguard Real Estate Index", category: "Real Estate", assetClass: "Specialty", fundScore: 50, passiveAltTicker: "VNQ", passiveAltName: "Vanguard Real Estate ETF", expenseRatio: 0.12, aum: 63000, seed: 5001, manager: "Gerard O'Reilly", managerStartYear: 2016 },
  { ticker: "FOCPX", name: "Fidelity OTC Portfolio", category: "Technology", assetClass: "Specialty", fundScore: 70, passiveAltTicker: "QQQ", passiveAltName: "Invesco QQQ Trust", expenseRatio: 0.78, aum: 18000, seed: 5002, manager: "Christopher Lin", managerStartYear: 2018 },
  { ticker: "VGHCX", name: "Vanguard Health Care", category: "Health", assetClass: "Specialty", fundScore: 63, passiveAltTicker: "VHT", passiveAltName: "Vanguard Health Care ETF", expenseRatio: 0.32, aum: 42000, seed: 5003, manager: "Jean Hynes", managerStartYear: 2008 },

  // 2 Low-score funds
  { ticker: "LEXCX", name: "Legg Mason Value Trust", category: "Large Blend", assetClass: "US Equity", fundScore: 22, passiveAltTicker: "VOO", passiveAltName: "Vanguard S&P 500 ETF", expenseRatio: 1.15, aum: 3200, seed: 6001, manager: "Sam Peters", managerStartYear: 2017 },
  { ticker: "HSFAX", name: "Hussman Strategic Growth", category: "Large Blend", assetClass: "US Equity", fundScore: 15, passiveAltTicker: "SPY", passiveAltName: "SPDR S&P 500 ETF", expenseRatio: 1.02, aum: 420, seed: 6002, manager: "John Hussman", managerStartYear: 2000 },
];

function generateScoreDrivers(score: number, seed: number): ScoreDriver[] {
  const rng = createSeededRandom(seed + 500);
  const driverNames = [
    { name: "Performance", weight: 0.25, desc: "Historical risk-adjusted returns vs passive alternative" },
    { name: "Credit Quality", weight: 0.20, desc: "Portfolio credit risk and default probability" },
    { name: "Liquidity", weight: 0.15, desc: "Fund liquidity and redemption risk" },
    { name: "Portfolio Structure", weight: 0.10, desc: "Diversification and concentration measures" },
    { name: "Fees", weight: 0.10, desc: "Total cost of ownership vs peers" },
    { name: "Underwriting", weight: 0.10, desc: "Quality of security selection process" },
    { name: "Concentration", weight: 0.10, desc: "Position-level concentration risk" },
  ];

  return driverNames.map((d) => {
    const driverScore = Math.min(
      100,
      Math.max(0, Math.round(score + rng.nextRange(-20, 20)))
    );
    return {
      name: d.name,
      score: driverScore,
      weight: d.weight,
      weightedContribution: Number((driverScore * d.weight).toFixed(1)),
      description: d.desc,
    };
  });
}

function generateScoreTrend(
  score: number,
  seed: number
): { quarter: string; score: number }[] {
  const rng = createSeededRandom(seed + 600);
  const quarters = [
    "2024 Q1", "2024 Q2", "2024 Q3", "2024 Q4",
    "2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4",
  ];
  let current = score + rng.nextRange(-15, -5);
  return quarters.map((q) => {
    current = Math.min(100, Math.max(0, current + rng.nextRange(-5, 8)));
    return { quarter: q, score: Math.round(current) };
  });
}

function generateRiskData(category: string, seed: number): RiskData {
  const rng = createSeededRandom(seed + 700);
  const isEquity = ![
    "Intermediate Core Bond",
    "Intermediate Core-Plus Bond",
    "High Yield Bond",
    "Short-Term Bond",
    "Bank Loan",
  ].includes(category);

  const baseVol = isEquity ? rng.nextRange(12, 22) : rng.nextRange(3, 10);
  const baseSharpe = rng.nextRange(0.3, 1.2);
  const baseAlpha = rng.nextRange(-2, 4);
  const baseBeta = isEquity
    ? rng.nextRange(0.7, 1.3)
    : rng.nextRange(-0.2, 0.6);
  const baseR2 = isEquity ? rng.nextRange(75, 98) : rng.nextRange(40, 85);

  return {
    standardDeviation: {
      threeYear: Number(baseVol.toFixed(2)),
      fiveYear: Number((baseVol + rng.nextRange(-2, 2)).toFixed(2)),
      tenYear: Number((baseVol + rng.nextRange(-3, 3)).toFixed(2)),
    },
    sharpeRatio: {
      threeYear: Number(baseSharpe.toFixed(2)),
      fiveYear: Number((baseSharpe + rng.nextRange(-0.2, 0.2)).toFixed(2)),
      tenYear: Number((baseSharpe + rng.nextRange(-0.3, 0.3)).toFixed(2)),
    },
    alpha: {
      threeYear: Number(baseAlpha.toFixed(2)),
      fiveYear: Number((baseAlpha + rng.nextRange(-1, 1)).toFixed(2)),
      tenYear: Number((baseAlpha + rng.nextRange(-2, 2)).toFixed(2)),
    },
    beta: {
      threeYear: Number(baseBeta.toFixed(2)),
      fiveYear: Number((baseBeta + rng.nextRange(-0.1, 0.1)).toFixed(2)),
      tenYear: Number((baseBeta + rng.nextRange(-0.15, 0.15)).toFixed(2)),
    },
    rSquared: {
      threeYear: Number(baseR2.toFixed(1)),
      fiveYear: Number((baseR2 + rng.nextRange(-5, 5)).toFixed(1)),
      tenYear: Number((baseR2 + rng.nextRange(-8, 8)).toFixed(1)),
    },
    maxDrawdown: Number(
      (-rng.nextRange(isEquity ? 15 : 5, isEquity ? 40 : 15)).toFixed(2)
    ),
    maxDrawdownDate: "2020-03",
    upsideCaptureRatio: Number(rng.nextRange(80, 120).toFixed(1)),
    downsideCaptureRatio: Number(rng.nextRange(70, 110).toFixed(1)),
    sortinoRatio: Number(rng.nextRange(0.3, 1.8).toFixed(2)),
    trackingError: Number(rng.nextRange(1, 8).toFixed(2)),
    informationRatio: Number(rng.nextRange(-0.5, 1.0).toFixed(2)),
    categoryAvg: {
      standardDeviation: Number(
        (baseVol + rng.nextRange(-2, 2)).toFixed(2)
      ),
      sharpeRatio: Number(
        (baseSharpe + rng.nextRange(-0.3, 0)).toFixed(2)
      ),
      alpha: Number((baseAlpha - rng.nextRange(0, 2)).toFixed(2)),
      beta: Number(rng.nextRange(0.9, 1.1).toFixed(2)),
      maxDrawdown: Number(
        (-rng.nextRange(isEquity ? 18 : 6, isEquity ? 35 : 12)).toFixed(2)
      ),
    },
  };
}

function generateFeeData(
  expenseRatio: number,
  category: string,
  seed: number
): FeeData {
  const rng = createSeededRandom(seed + 800);
  const mgmtFee = Number((expenseRatio * rng.nextRange(0.6, 0.8)).toFixed(2));
  const twelveB1 =
    expenseRatio > 0.5
      ? Number(rng.nextRange(0.0, 0.25).toFixed(2))
      : 0;
  const other = Number(
    Math.max(0, expenseRatio - mgmtFee - twelveB1).toFixed(2)
  );

  const categoryAvgs: Record<string, number> = {
    "Large Growth": 0.82,
    "Large Blend": 0.75,
    "Large Value": 0.78,
    "Mid-Cap Growth": 0.95,
    "Mid-Cap Blend": 0.88,
    "Small Blend": 0.92,
    "Foreign Large Blend": 0.90,
    "Diversified Emerging Markets": 1.10,
    "Intermediate Core Bond": 0.55,
    "Intermediate Core-Plus Bond": 0.62,
    "High Yield Bond": 0.75,
    "Short-Term Bond": 0.45,
    "Bank Loan": 0.80,
    "Moderate Allocation": 0.72,
    "Aggressive Allocation": 0.85,
    "Conservative Allocation": 0.65,
    "Real Estate": 0.90,
    Technology: 1.05,
    Health: 0.95,
  };

  const catAvg = categoryAvgs[category] || 0.8;
  let feeLevel: FeeData["feeLevel"];
  const ratio = expenseRatio / catAvg;
  if (ratio < 0.5) feeLevel = "Low";
  else if (ratio < 0.8) feeLevel = "Below Average";
  else if (ratio < 1.2) feeLevel = "Average";
  else if (ratio < 1.5) feeLevel = "Above Average";
  else feeLevel = "High";

  return {
    expenseRatio,
    managementFee: mgmtFee,
    twelveBOneOne: twelveB1,
    otherExpenses: other,
    frontLoad:
      expenseRatio > 0.7
        ? Number(rng.nextRange(0, 5.75).toFixed(2))
        : 0,
    deferredLoad: 0,
    redemptionFee: 0,
    categoryAvgExpenseRatio: catAvg,
    feeLevel,
  };
}

function generateTradingActivity(
  score: number,
  category: string,
  seed: number
): TradingActivity {
  const rng = createSeededRandom(seed + 900);
  const scoreMultiplier = score / 100;

  const battingAverage = Number(
    rng
      .nextRange(
        0.35 + scoreMultiplier * 0.2,
        0.45 + scoreMultiplier * 0.25
      )
      .toFixed(3)
  );
  const avgWinSize = Math.round(
    rng.nextRange(50, 150) * (0.8 + scoreMultiplier * 0.4)
  );
  const avgLossSize = Math.round(rng.nextRange(40, 120));

  const sectors = [
    "Technology",
    "Healthcare",
    "Financial Services",
    "Consumer",
    "Industrials",
    "Energy",
  ];
  const sectorHitRates: SectorHitRate[] = sectors.map((sector) => ({
    sector,
    hitRate: Number(rng.nextRange(0.3, 0.75).toFixed(2)),
    tradeCount: rng.nextInt(5, 30),
  }));

  const tradeNames = [
    { name: "NVIDIA Corp.", ticker: "NVDA" },
    { name: "Eli Lilly", ticker: "LLY" },
    { name: "Broadcom Inc.", ticker: "AVGO" },
    { name: "CrowdStrike Holdings", ticker: "CRWD" },
    { name: "ServiceNow Inc.", ticker: "NOW" },
    { name: "Palantir Technologies", ticker: "PLTR" },
    { name: "Coinbase Global", ticker: "COIN" },
    { name: "Palo Alto Networks", ticker: "PANW" },
  ];

  const recentTrades: Trade[] = rng
    .shuffle([...tradeNames])
    .slice(0, 6)
    .map((t) => {
      const action = rng.next() > 0.4 ? ("buy" as const) : ("sell" as const);
      const returnSince = Number(rng.nextRange(-15, 25).toFixed(2));
      return {
        name: t.name,
        ticker: t.ticker,
        action,
        quarterAdded: "2025 Q3",
        positionSize: Number(rng.nextRange(0.5, 4.5).toFixed(2)),
        returnSince,
        outcome:
          returnSince > 2
            ? ("winner" as const)
            : returnSince < -2
              ? ("loser" as const)
              : ("pending" as const),
      };
    });

  const quarters = [
    "2024 Q1", "2024 Q2", "2024 Q3", "2024 Q4",
    "2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4",
  ];
  let trendScore = score + rng.nextRange(-15, -5);
  const fundScoreTrend = quarters.map((q) => {
    trendScore = Math.min(
      100,
      Math.max(0, trendScore + rng.nextRange(-5, 8))
    );
    return { quarter: q, score: Math.round(trendScore) };
  });

  const avgHoldingPeriodMonths = Math.round(rng.nextRange(6, 36));

  const factorDefs: { factor: string; labels: [string, string, string] }[] = [
    { factor: "Growth", labels: ["Strong Growth Tilt", "Moderate Growth Bias", "Slight Growth Lean"] },
    { factor: "Value", labels: ["Strong Value Tilt", "Moderate Value Bias", "Slight Value Lean"] },
    { factor: "Quality", labels: ["Strong Quality Tilt", "Moderate Quality Bias", "Slight Quality Lean"] },
    { factor: "Momentum", labels: ["Strong Momentum Tilt", "Moderate Momentum Bias", "Slight Momentum Lean"] },
    { factor: "Size", labels: ["Strong Small-Cap Tilt", "Moderate Small-Cap Bias", "Slight Small-Cap Lean"] },
    { factor: "Yield", labels: ["Strong Yield Tilt", "Moderate Yield Bias", "Slight Yield Lean"] },
  ];

  const factorTilts: FactorTilt[] = rng.shuffle([...factorDefs]).map((fd) => {
    const exposure = Number(rng.nextRange(-0.8, 0.8).toFixed(2));
    const absExp = Math.abs(exposure);
    const labelIdx = absExp >= 0.5 ? 0 : absExp >= 0.25 ? 1 : 2;
    return { factor: fd.factor, exposure, label: fd.labels[labelIdx] };
  });

  return {
    battingAverage,
    avgWinSize,
    avgLossSize,
    winLossRatio: Number((avgWinSize / avgLossSize).toFixed(2)),
    activeShare: Number(rng.nextRange(0.3, 0.95).toFixed(2)),
    convictionScore: Number(rng.nextRange(1.5, 5.0).toFixed(2)),
    sectorHitRates,
    tradeSizingEfficiency: Number(rng.nextRange(0.1, 0.8).toFixed(2)),
    fundScoreTrend,
    recentTrades,
    avgHoldingPeriodMonths,
    factorTilts,
  };
}

let _allFunds: FundDetail[] | null = null;

function buildFundDetail(def: FundDef): FundDetail {
  const benchmark = getBenchmark(def.assetClass, def.category);
  const monthlyReturns = generateMonthlyReturns(def.category, def.seed);
  const benchmarkReturns = generateBenchmarkReturns(benchmark);
  const passiveAltReturns = generateMonthlyReturns(
    def.category,
    def.seed + 100
  );
  const categoryAvgReturns = generateMonthlyReturns(
    def.category,
    def.seed + 200
  );
  const trailingReturns = computeTrailingReturns(monthlyReturns);
  const categoryAvgTrailing = computeTrailingReturns(categoryAvgReturns);
  const calendarYearReturns = computeCalendarYearReturns(
    monthlyReturns,
    benchmarkReturns,
    passiveAltReturns,
    categoryAvgReturns
  );

  const holdingsData = generateHoldings(def.category, def.seed);
  const riskData = generateRiskData(def.category, def.seed);
  const feeData = generateFeeData(def.expenseRatio, def.category, def.seed);
  const tradingData = generateTradingActivity(
    def.fundScore,
    def.category,
    def.seed
  );
  const scoreDrivers = generateScoreDrivers(def.fundScore, def.seed);
  const scoreTrend = generateScoreTrend(def.fundScore, def.seed);

  const rng = createSeededRandom(def.seed + 300);

  const objectives: Record<string, string> = {
    "US Equity":
      "The fund seeks long-term capital appreciation by investing primarily in common stocks of U.S. companies.",
    "International Equity":
      "The fund seeks long-term capital growth by investing in equity securities of companies located outside the United States.",
    "Fixed Income":
      "The fund seeks to maximize total return, consistent with preservation of capital and prudent investment management.",
    Allocation:
      "The fund seeks to provide long-term capital appreciation and current income through a diversified portfolio of equity and fixed-income securities.",
    Specialty:
      "The fund seeks to provide long-term capital appreciation by investing in companies within its target sector.",
  };

  const strategies: Record<string, string> = {
    "US Equity":
      "The fund invests primarily in common stocks. The fund manager uses fundamental analysis to identify companies with strong competitive positions, experienced management, and attractive valuations relative to their intrinsic value.",
    "International Equity":
      "The fund invests in a diversified portfolio of stocks of companies domiciled outside the U.S. The manager employs a bottom-up, value-oriented approach to identify undervalued opportunities across developed and emerging markets.",
    "Fixed Income":
      "The fund invests in a diversified portfolio of fixed-income instruments. The manager actively manages duration, sector allocation, and security selection to generate alpha relative to the benchmark.",
    Allocation:
      "The fund uses a flexible allocation approach, shifting between equity and fixed-income securities based on the manager's assessment of relative value, economic outlook, and market conditions.",
    Specialty:
      "The fund concentrates its investments in its target sector, using deep industry expertise and fundamental research to identify the most promising opportunities.",
  };

  const fundWithoutNote = {
    ticker: def.ticker,
    name: def.name,
    category: def.category,
    assetClass: def.assetClass,
    fundScore: def.fundScore,
    scoreLabel: scoreLabel(def.fundScore),
    passiveAltTicker: def.passiveAltTicker,
    passiveAltName: def.passiveAltName,
    nav: Number(rng.nextRange(15, 180).toFixed(2)),
    ytdReturn: Number(trailingReturns.ytd.toFixed(2)),
    oneYearReturn: Number(trailingReturns.oneYear.toFixed(2)),
    threeYearReturn: Number(trailingReturns.threeYear.toFixed(2)),
    fiveYearReturn: Number(trailingReturns.fiveYear.toFixed(2)),
    tenYearReturn: trailingReturns.tenYear
      ? Number(trailingReturns.tenYear.toFixed(2))
      : null,
    expenseRatio: def.expenseRatio,
    aum: def.aum,
    inceptionDate: `${rng.nextInt(1985, 2015)}-${String(rng.nextInt(1, 12)).padStart(2, "0")}-01`,
    manager: def.manager,
    managerStartYear: def.managerStartYear,
    investmentObjective:
      objectives[def.assetClass] || objectives["US Equity"],
    investmentStrategy:
      strategies[def.assetClass] || strategies["US Equity"],
    benchmark,
    minInvestment: rng.pick([1000, 2500, 3000, 5000, 10000]),
    score: {
      score: def.fundScore,
      scoreLabel: scoreLabel(def.fundScore),
      passiveAlternative: {
        ticker: def.passiveAltTicker,
        name: def.passiveAltName,
      },
      drivers: scoreDrivers,
      trend: scoreTrend,
    },
    performance: {
      monthlyReturns,
      trailingReturns,
      calendarYearReturns,
      benchmarkMonthlyReturns: benchmarkReturns,
      passiveAltMonthlyReturns: passiveAltReturns,
      categoryAvgMonthlyReturns: categoryAvgReturns,
    },
    portfolio: {
      ...holdingsData,
      totalHoldings: rng.nextInt(50, 500),
      turnoverRate: Number(rng.nextRange(15, 120).toFixed(0)),
    },
    risk: riskData,
    fees: feeData,
    trading: tradingData,
    categoryAvgOneYearReturn: Number(categoryAvgTrailing.oneYear.toFixed(2)),
    categoryAvgThreeYearReturn: Number(categoryAvgTrailing.threeYear.toFixed(2)),
    categoryAumRank: rng.nextInt(1, Math.max(2, Math.round(def.aum / 500))),
    categoryFundCount: rng.nextInt(80, 350),
  };

  return {
    ...fundWithoutNote,
    analystNote: generateAnalystNote(fundWithoutNote),
  };
}

export function getAllFunds(): FundDetail[] {
  if (!_allFunds) {
    _allFunds = FUND_DEFS.map(buildFundDetail);
  }
  return _allFunds;
}

export function getFundSummaries(): FundSummary[] {
  return getAllFunds().map((f) => ({
    ticker: f.ticker,
    name: f.name,
    category: f.category,
    assetClass: f.assetClass,
    fundScore: f.fundScore,
    scoreLabel: f.scoreLabel,
    passiveAltTicker: f.passiveAltTicker,
    passiveAltName: f.passiveAltName,
    nav: f.nav,
    ytdReturn: f.ytdReturn,
    oneYearReturn: f.oneYearReturn,
    threeYearReturn: f.threeYearReturn,
    fiveYearReturn: f.fiveYearReturn,
    tenYearReturn: f.tenYearReturn,
    expenseRatio: f.expenseRatio,
    aum: f.aum,
  }));
}
