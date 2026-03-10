import { eq, ilike, or, and, gte, lte, inArray, asc } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import type {
  FundSummary,
  FundDetail,
  ModelBacktest,
  PerformanceData,
  MonthlyReturn,
  TrailingReturns,
  CalendarYearReturn,
  PortfolioData,
  RiskData,
  FeeData,
  FundScoreDetail,
  TradingActivity,
  PerformanceAttribution,
  FactorRiskProfile,
  PortfolioCharacteristics,
  SkillAssessment,
  AdministrativeDetails,
  ScoreDriver,
  ScoreTrendPoint,
  Trade,
  SectorHitRate,
  FactorTilt,
  Holding,
  SectorWeight,
  AssetAllocationItem,
  CreditQualityItem,
  SectorBet,
  StockPick,
  FactorSensitivity,
  HistoricalScenario,
  RiskDecompositionItem,
  QuintileReturn,
} from "../types";
import type { FundRow } from "../db/schema/funds";

export interface FundFilters {
  assetClass?: string;
  peerGroup?: string;
  scoreMin?: number;
  scoreMax?: number;
  expenseRatioMax?: number;
}

function rowToSummary(row: FundRow): FundSummary {
  return {
    ticker: row.ticker,
    name: row.name,
    assetClass: row.assetClass,
    geography: row.geography,
    focus: row.focus,
    size: row.size,
    peerGroup: row.peerGroup,
    fundScore: row.fundScore,
    scoreLabel: row.scoreLabel,
    passiveAltTicker: row.passiveAltTicker,
    passiveAltName: row.passiveAltName,
    nav: row.nav,
    ytdReturn: row.ytdReturn,
    oneYearReturn: row.oneYearReturn,
    threeYearReturn: row.threeYearReturn,
    fiveYearReturn: row.fiveYearReturn,
    tenYearReturn: row.tenYearReturn,
    expenseRatio: row.expenseRatio,
    aum: row.aum,
  };
}

function assembleFundDetail(
  row: FundRow,
  monthlyReturnRows: { series: string; date: string; value: number }[],
  calendarReturnRows: CalendarYearReturn[],
  holdingRows: Holding[],
  scoreDriverRows: ScoreDriver[],
  scoreTrendRows: ScoreTrendPoint[],
  tradeRows: Trade[],
  sectorHitRateRows: SectorHitRate[],
  factorTiltRows: FactorTilt[],
  factorSensitivityRows: FactorSensitivity[],
  historicalScenarioRows: HistoricalScenario[],
  riskDecompositionRows: RiskDecompositionItem[],
  sectorBetRows: SectorBet[],
  stockPickRows: StockPick[]
): FundDetail {
  const bySeries = (s: string): MonthlyReturn[] =>
    monthlyReturnRows
      .filter((r) => r.series === s)
      .map((r) => ({ date: r.date, value: r.value }));

  const performance: PerformanceData = {
    monthlyReturns: bySeries("fund"),
    trailingReturns: row.trailingReturns as TrailingReturns,
    calendarYearReturns: calendarReturnRows,
    benchmarkMonthlyReturns: bySeries("benchmark"),
    passiveAltMonthlyReturns: bySeries("passiveAlt"),
    categoryAvgMonthlyReturns: bySeries("categoryAvg"),
  };

  const tradingScalars = row.tradingScalars as Record<string, number>;
  const trading: TradingActivity = {
    battingAverage: tradingScalars.battingAverage,
    avgWinSize: tradingScalars.avgWinSize,
    avgLossSize: tradingScalars.avgLossSize,
    winLossRatio: tradingScalars.winLossRatio,
    activeShare: tradingScalars.activeShare,
    convictionScore: tradingScalars.convictionScore,
    tradeSizingEfficiency: tradingScalars.tradeSizingEfficiency,
    avgHoldingPeriodMonths: tradingScalars.avgHoldingPeriodMonths,
    numberOfIndependentDecisions: tradingScalars.numberOfIndependentDecisions,
    sectorHitRates: sectorHitRateRows,
    fundScoreTrend: scoreTrendRows,
    recentTrades: tradeRows,
    factorTilts: factorTiltRows,
  };

  const portfolio: PortfolioData = {
    holdings: holdingRows,
    sectorWeights: row.sectorWeights as SectorWeight[],
    assetAllocation: row.assetAllocation as AssetAllocationItem[],
    creditQuality: (row.creditQuality as CreditQualityItem[]) ?? undefined,
    benchmarkSectorWeights:
      (row.benchmarkSectorWeights as SectorWeight[]) ?? undefined,
    maturityDistribution:
      (row.maturityDistribution as { range: string; weight: number }[]) ??
      undefined,
    totalHoldings: row.totalHoldings,
    turnoverRate: row.turnoverRate,
  };

  const score: FundScoreDetail = {
    score: row.fundScore,
    scoreLabel: row.scoreLabel,
    passiveAlternative: {
      ticker: row.passiveAltTicker,
      name: row.passiveAltName,
    },
    drivers: scoreDriverRows,
    trend: scoreTrendRows,
  };

  const attributionDetail = row.attributionDetail as Record<string, number>;
  const attribution: PerformanceAttribution = {
    type: row.attributionType,
    ...(row.attributionType === "equity" && {
      equity: attributionDetail as unknown as PerformanceAttribution["equity"],
    }),
    ...(row.attributionType === "fixedIncome" && {
      fixedIncome:
        attributionDetail as unknown as PerformanceAttribution["fixedIncome"],
    }),
    ...(row.attributionType === "allocation" && {
      allocation:
        attributionDetail as unknown as PerformanceAttribution["allocation"],
    }),
    sectorBets: sectorBetRows,
    stockPicks: stockPickRows,
  };

  const factorRisk: FactorRiskProfile = {
    factorSensitivities: factorSensitivityRows,
    historicalScenarios: historicalScenarioRows,
    riskDecomposition: riskDecompositionRows,
    durationRisk:
      (row.durationRisk as FactorRiskProfile["durationRisk"]) ?? undefined,
  };

  const characteristics: PortfolioCharacteristics = {
    equity:
      (row.equityCharacteristics as PortfolioCharacteristics["equity"]) ??
      undefined,
    fixedIncome:
      (row.fixedIncomeCharacteristics as PortfolioCharacteristics["fixedIncome"]) ??
      undefined,
    styleBox:
      (row.styleBox as PortfolioCharacteristics["styleBox"]) ?? undefined,
    percentiles:
      row.peerPercentiles as PortfolioCharacteristics["percentiles"],
  };

  return {
    ...rowToSummary(row),
    inceptionDate: row.inceptionDate,
    manager: row.manager,
    managerStartYear: row.managerStartYear,
    investmentObjective: row.investmentObjective,
    investmentStrategy: row.investmentStrategy,
    benchmark: row.benchmark,
    minInvestment: row.minInvestment,
    analystNote: row.analystNote,
    peerAvgOneYearReturn: row.peerAvgOneYearReturn,
    peerAvgThreeYearReturn: row.peerAvgThreeYearReturn,
    peerAumRank: row.peerAumRank,
    peerFundCount: row.peerFundCount,
    score,
    performance,
    portfolio,
    risk: row.riskMetrics as RiskData,
    fees: row.fees as FeeData,
    trading,
    attribution,
    factorRisk,
    characteristics,
    skillAssessment: row.skillAssessment as SkillAssessment,
    admin: row.adminDetails as AdministrativeDetails,
  };
}

async function loadFundChildren(fundId: number) {
  const [
    monthlyReturnRows,
    calendarReturnRows,
    holdingRows,
    scoreDriverRows,
    scoreTrendRows,
    tradeRows,
    sectorHitRateRows,
    factorTiltRows,
    factorSensitivityRows,
    historicalScenarioRows,
    riskDecompositionRows,
    sectorBetRows,
    stockPickRows,
  ] = await Promise.all([
    db
      .select({
        series: schema.monthlyReturns.series,
        date: schema.monthlyReturns.date,
        value: schema.monthlyReturns.value,
      })
      .from(schema.monthlyReturns)
      .where(eq(schema.monthlyReturns.fundId, fundId)),
    db
      .select({
        year: schema.calendarReturns.year,
        fundReturn: schema.calendarReturns.fundReturn,
        benchmarkReturn: schema.calendarReturns.benchmarkReturn,
        passiveAltReturn: schema.calendarReturns.passiveAltReturn,
        categoryAvgReturn: schema.calendarReturns.categoryAvgReturn,
      })
      .from(schema.calendarReturns)
      .where(eq(schema.calendarReturns.fundId, fundId))
      .orderBy(asc(schema.calendarReturns.year)),
    db
      .select({
        name: schema.holdings.name,
        ticker: schema.holdings.ticker,
        weight: schema.holdings.weight,
        shares: schema.holdings.shares,
        marketValue: schema.holdings.marketValue,
        sector: schema.holdings.sector,
        benchmarkWeight: schema.holdings.benchmarkWeight,
      })
      .from(schema.holdings)
      .where(eq(schema.holdings.fundId, fundId)),
    db
      .select({
        name: schema.scoreDrivers.name,
        score: schema.scoreDrivers.score,
        weight: schema.scoreDrivers.weight,
        weightedContribution: schema.scoreDrivers.weightedContribution,
        description: schema.scoreDrivers.description,
      })
      .from(schema.scoreDrivers)
      .where(eq(schema.scoreDrivers.fundId, fundId)),
    db
      .select({
        quarter: schema.scoreTrend.quarter,
        score: schema.scoreTrend.score,
      })
      .from(schema.scoreTrend)
      .where(eq(schema.scoreTrend.fundId, fundId)),
    db
      .select({
        name: schema.trades.name,
        ticker: schema.trades.ticker,
        action: schema.trades.action,
        quarterAdded: schema.trades.quarterAdded,
        positionSize: schema.trades.positionSize,
        returnSince: schema.trades.returnSince,
        outcome: schema.trades.outcome,
      })
      .from(schema.trades)
      .where(eq(schema.trades.fundId, fundId)),
    db
      .select({
        sector: schema.sectorHitRates.sector,
        hitRate: schema.sectorHitRates.hitRate,
        tradeCount: schema.sectorHitRates.tradeCount,
      })
      .from(schema.sectorHitRates)
      .where(eq(schema.sectorHitRates.fundId, fundId)),
    db
      .select({
        factor: schema.factorTilts.factor,
        exposure: schema.factorTilts.exposure,
        label: schema.factorTilts.label,
      })
      .from(schema.factorTilts)
      .where(eq(schema.factorTilts.fundId, fundId)),
    db
      .select({
        factor: schema.factorSensitivities.factor,
        beta: schema.factorSensitivities.beta,
        shockLabel: schema.factorSensitivities.shockLabel,
        shockMagnitude: schema.factorSensitivities.shockMagnitude,
        estimatedImpactDown: schema.factorSensitivities.estimatedImpactDown,
        estimatedImpactUp: schema.factorSensitivities.estimatedImpactUp,
      })
      .from(schema.factorSensitivities)
      .where(eq(schema.factorSensitivities.fundId, fundId)),
    db
      .select({
        name: schema.historicalScenarios.name,
        period: schema.historicalScenarios.period,
        marketReturn: schema.historicalScenarios.marketReturn,
        fundReturn: schema.historicalScenarios.fundReturn,
        passiveAltReturn: schema.historicalScenarios.passiveAltReturn,
        recoveryMonths: schema.historicalScenarios.recoveryMonths,
      })
      .from(schema.historicalScenarios)
      .where(eq(schema.historicalScenarios.fundId, fundId)),
    db
      .select({
        factor: schema.riskDecomposition.factor,
        percentOfRisk: schema.riskDecomposition.percentOfRisk,
      })
      .from(schema.riskDecomposition)
      .where(eq(schema.riskDecomposition.fundId, fundId)),
    db
      .select({
        sector: schema.sectorBets.sector,
        fundWeight: schema.sectorBets.fundWeight,
        benchmarkWeight: schema.sectorBets.benchmarkWeight,
        overUnderweight: schema.sectorBets.overUnderweight,
        contribution: schema.sectorBets.contribution,
      })
      .from(schema.sectorBets)
      .where(eq(schema.sectorBets.fundId, fundId)),
    db
      .select({
        name: schema.stockPicks.name,
        ticker: schema.stockPicks.ticker,
        fundWeight: schema.stockPicks.fundWeight,
        benchmarkWeight: schema.stockPicks.benchmarkWeight,
        contribution: schema.stockPicks.contribution,
      })
      .from(schema.stockPicks)
      .where(eq(schema.stockPicks.fundId, fundId)),
  ]);

  return {
    monthlyReturnRows,
    calendarReturnRows,
    holdingRows: holdingRows as Holding[],
    scoreDriverRows,
    scoreTrendRows,
    tradeRows: tradeRows as Trade[],
    sectorHitRateRows,
    factorTiltRows,
    factorSensitivityRows,
    historicalScenarioRows,
    riskDecompositionRows,
    sectorBetRows,
    stockPickRows,
  };
}

export async function getFundSummaries(): Promise<FundSummary[]> {
  const rows = await db.select().from(schema.funds);
  return rows.map(rowToSummary);
}

export async function getFundByTicker(
  ticker: string
): Promise<FundDetail | null> {
  const [row] = await db
    .select()
    .from(schema.funds)
    .where(eq(schema.funds.ticker, ticker.toUpperCase()));

  if (!row) return null;

  const children = await loadFundChildren(row.id);
  return assembleFundDetail(
    row,
    children.monthlyReturnRows,
    children.calendarReturnRows,
    children.holdingRows,
    children.scoreDriverRows,
    children.scoreTrendRows,
    children.tradeRows,
    children.sectorHitRateRows,
    children.factorTiltRows,
    children.factorSensitivityRows,
    children.historicalScenarioRows,
    children.riskDecompositionRows,
    children.sectorBetRows,
    children.stockPickRows
  );
}

export async function searchFunds(
  query: string,
  filters?: FundFilters
): Promise<FundSummary[]> {
  const conditions = [];

  if (query.trim()) {
    const q = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(schema.funds.name, q),
        ilike(schema.funds.ticker, q),
        ilike(schema.funds.peerGroup, q)
      )
    );
  }

  if (filters?.assetClass) {
    conditions.push(
      eq(
        schema.funds.assetClass,
        filters.assetClass as (typeof schema.funds.assetClass.enumValues)[number]
      )
    );
  }
  if (filters?.peerGroup) {
    conditions.push(
      ilike(schema.funds.peerGroup, `${filters.peerGroup}%`)
    );
  }
  if (filters?.scoreMin !== undefined) {
    conditions.push(gte(schema.funds.fundScore, filters.scoreMin));
  }
  if (filters?.scoreMax !== undefined) {
    conditions.push(lte(schema.funds.fundScore, filters.scoreMax));
  }
  if (filters?.expenseRatioMax !== undefined) {
    conditions.push(lte(schema.funds.expenseRatio, filters.expenseRatioMax));
  }

  const rows = await db
    .select()
    .from(schema.funds)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(rowToSummary);
}

export async function autocompleteFunds(
  query: string
): Promise<{ ticker: string; name: string }[]> {
  if (!query.trim()) return [];
  const q = `%${query.trim()}%`;
  const rows = await db
    .select({ ticker: schema.funds.ticker, name: schema.funds.name })
    .from(schema.funds)
    .where(or(ilike(schema.funds.name, q), ilike(schema.funds.ticker, q)))
    .limit(8);
  return rows;
}

export async function compareFunds(tickers: string[]): Promise<FundDetail[]> {
  if (tickers.length === 0) return [];

  const upperTickers = tickers.map((t) => t.toUpperCase());
  const rows = await db
    .select()
    .from(schema.funds)
    .where(inArray(schema.funds.ticker, upperTickers));

  const results = await Promise.all(
    rows.map(async (row) => {
      const children = await loadFundChildren(row.id);
      return assembleFundDetail(
        row,
        children.monthlyReturnRows,
        children.calendarReturnRows,
        children.holdingRows,
        children.scoreDriverRows,
        children.scoreTrendRows,
        children.tradeRows,
        children.sectorHitRateRows,
        children.factorTiltRows,
        children.factorSensitivityRows,
        children.historicalScenarioRows,
        children.riskDecompositionRows,
        children.sectorBetRows,
        children.stockPickRows
      );
    })
  );

  // Preserve requested order
  return upperTickers
    .map((t) => results.find((f) => f.ticker === t))
    .filter((f): f is FundDetail => f !== null && f !== undefined);
}

export async function getModelStats(): Promise<ModelBacktest> {
  const [modelRow] = await db.select().from(schema.modelBacktest).limit(1);
  if (!modelRow) throw new Error("No model backtest data found");

  const [calibration, rollingAccuracy, quintileReturns, spread, peerGroupAccuracy] =
    await Promise.all([
      db
        .select({
          predictedBucket: schema.modelCalibration.predictedBucket,
          actualBeatRate: schema.modelCalibration.actualBeatRate,
          sampleSize: schema.modelCalibration.sampleSize,
        })
        .from(schema.modelCalibration)
        .where(eq(schema.modelCalibration.modelId, modelRow.id)),
      db
        .select({
          date: schema.modelRollingAccuracy.date,
          hitRate: schema.modelRollingAccuracy.hitRate,
        })
        .from(schema.modelRollingAccuracy)
        .where(eq(schema.modelRollingAccuracy.modelId, modelRow.id)),
      db
        .select({
          quintile: schema.modelQuintileReturns.quintile,
          avgExcessReturn: schema.modelQuintileReturns.avgExcessReturn,
          fundCount: schema.modelQuintileReturns.fundCount,
        })
        .from(schema.modelQuintileReturns)
        .where(eq(schema.modelQuintileReturns.modelId, modelRow.id)),
      db
        .select({
          date: schema.modelSpread.date,
          spread: schema.modelSpread.spread,
        })
        .from(schema.modelSpread)
        .where(eq(schema.modelSpread.modelId, modelRow.id)),
      db
        .select({
          peerGroup: schema.modelPeerGroupAccuracy.peerGroup,
          accuracy: schema.modelPeerGroupAccuracy.accuracy,
          sampleSize: schema.modelPeerGroupAccuracy.sampleSize,
        })
        .from(schema.modelPeerGroupAccuracy)
        .where(eq(schema.modelPeerGroupAccuracy.modelId, modelRow.id)),
    ]);

  return {
    calibration,
    rollingAccuracy,
    quintileReturns: quintileReturns as QuintileReturn[],
    topVsBottomSpread: spread,
    totalFundsScored: modelRow.totalFundsScored,
    dataStartDate: modelRow.dataStartDate,
    lastUpdated: modelRow.lastUpdated,
    peerGroupAccuracy,
  };
}
