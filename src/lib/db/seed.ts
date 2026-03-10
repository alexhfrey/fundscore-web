import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { getAllFunds } from "../data/funds";
import { getModelStats } from "../data/model";
import type { FundDetail, MonthlyReturn, TradingActivity } from "../types";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  // Clear existing data
  await db.execute(sql`TRUNCATE TABLE model_peer_group_accuracy, model_spread, model_quintile_returns, model_rolling_accuracy, model_calibration, model_backtest CASCADE`);
  await db.execute(sql`TRUNCATE TABLE stock_picks, sector_bets, risk_decomposition, historical_scenarios, factor_sensitivities, factor_tilts, sector_hit_rates, trades, score_trend, score_drivers, holdings, calendar_year_returns, monthly_returns, funds CASCADE`);

  const allFunds = getAllFunds();
  console.log(`Seeding ${allFunds.length} funds...`);

  for (const fund of allFunds) {
    const fundId = await insertFund(fund);
    await insertChildRows(fundId, fund);
  }

  // Seed model data
  const model = getModelStats();
  console.log("Seeding model backtest data...");

  const [modelRow] = await db
    .insert(schema.modelBacktest)
    .values({
      totalFundsScored: model.totalFundsScored,
      dataStartDate: model.dataStartDate,
      lastUpdated: model.lastUpdated,
    })
    .returning({ id: schema.modelBacktest.id });

  await db.insert(schema.modelCalibration).values(
    model.calibration.map((c) => ({ modelId: modelRow.id, ...c }))
  );
  await db.insert(schema.modelRollingAccuracy).values(
    model.rollingAccuracy.map((r) => ({ modelId: modelRow.id, ...r }))
  );
  await db.insert(schema.modelQuintileReturns).values(
    model.quintileReturns.map((q) => ({ modelId: modelRow.id, ...q }))
  );
  await db.insert(schema.modelSpread).values(
    model.topVsBottomSpread.map((s) => ({ modelId: modelRow.id, ...s }))
  );
  await db.insert(schema.modelPeerGroupAccuracy).values(
    model.peerGroupAccuracy.map((c) => ({ modelId: modelRow.id, ...c }))
  );

  console.log("Seed complete!");
  await client.end();
}

async function insertFund(fund: FundDetail): Promise<number> {
  const trading: TradingActivity = fund.trading;

  const tradingScalars = {
    battingAverage: trading.battingAverage,
    avgWinSize: trading.avgWinSize,
    avgLossSize: trading.avgLossSize,
    winLossRatio: trading.winLossRatio,
    activeShare: trading.activeShare,
    convictionScore: trading.convictionScore,
    tradeSizingEfficiency: trading.tradeSizingEfficiency,
    avgHoldingPeriodMonths: trading.avgHoldingPeriodMonths,
    numberOfIndependentDecisions: trading.numberOfIndependentDecisions,
  };

  const attributionDetail =
    fund.attribution.type === "equity"
      ? fund.attribution.equity
      : fund.attribution.type === "fixedIncome"
        ? fund.attribution.fixedIncome
        : fund.attribution.allocation;

  const [row] = await db
    .insert(schema.funds)
    .values({
      ticker: fund.ticker,
      name: fund.name,
      assetClass: fund.assetClass,
      geography: fund.geography,
      focus: fund.focus,
      size: fund.size,
      peerGroup: fund.peerGroup,
      fundScore: fund.fundScore,
      scoreLabel: fund.scoreLabel,
      passiveAltTicker: fund.passiveAltTicker,
      passiveAltName: fund.passiveAltName,
      nav: fund.nav,
      ytdReturn: fund.ytdReturn,
      oneYearReturn: fund.oneYearReturn,
      threeYearReturn: fund.threeYearReturn,
      fiveYearReturn: fund.fiveYearReturn,
      tenYearReturn: fund.tenYearReturn,
      expenseRatio: fund.expenseRatio,
      aum: fund.aum,
      inceptionDate: fund.inceptionDate,
      manager: fund.manager,
      managerStartYear: fund.managerStartYear,
      investmentObjective: fund.investmentObjective,
      investmentStrategy: fund.investmentStrategy,
      benchmark: fund.benchmark,
      minInvestment: fund.minInvestment,
      analystNote: fund.analystNote,
      peerAvgOneYearReturn: fund.peerAvgOneYearReturn,
      peerAvgThreeYearReturn: fund.peerAvgThreeYearReturn,
      peerAumRank: fund.peerAumRank,
      peerFundCount: fund.peerFundCount,
      totalHoldings: fund.portfolio.totalHoldings,
      turnoverRate: fund.portfolio.turnoverRate,
      trailingReturns: fund.performance.trailingReturns,
      riskMetrics: fund.risk,
      fees: fund.fees,
      feeLevel: fund.fees.feeLevel,
      tradingScalars,
      attributionType: fund.attribution.type,
      attributionDetail,
      sectorWeights: fund.portfolio.sectorWeights,
      assetAllocation: fund.portfolio.assetAllocation,
      creditQuality: fund.portfolio.creditQuality ?? null,
      benchmarkSectorWeights: fund.portfolio.benchmarkSectorWeights ?? null,
      maturityDistribution: fund.portfolio.maturityDistribution ?? null,
      equityCharacteristics: fund.characteristics.equity ?? null,
      fixedIncomeCharacteristics: fund.characteristics.fixedIncome ?? null,
      styleBox: fund.characteristics.styleBox ?? null,
      peerPercentiles: fund.characteristics.percentiles,
      skillAssessment: fund.skillAssessment,
      durationRisk: fund.factorRisk.durationRisk ?? null,
      adminDetails: fund.admin,
    })
    .returning({ id: schema.funds.id });

  return row.id;
}

async function insertChildRows(fundId: number, fund: FundDetail) {
  const seriesData = (series: string, returns: MonthlyReturn[]) =>
    returns.map((r) => ({ fundId, series, date: r.date, value: r.value }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertIfNotEmpty = (table: any, rows: any[]) =>
    rows.length > 0 ? db.insert(table).values(rows) : Promise.resolve();

  await Promise.all([
    db.insert(schema.monthlyReturns).values([
      ...seriesData("fund", fund.performance.monthlyReturns),
      ...seriesData("benchmark", fund.performance.benchmarkMonthlyReturns),
      ...seriesData("passiveAlt", fund.performance.passiveAltMonthlyReturns),
      ...seriesData("categoryAvg", fund.performance.categoryAvgMonthlyReturns),
    ]),

    insertIfNotEmpty(
      schema.calendarReturns,
      fund.performance.calendarYearReturns.map((c) => ({
        fundId,
        year: c.year,
        fundReturn: c.fundReturn,
        benchmarkReturn: c.benchmarkReturn,
        passiveAltReturn: c.passiveAltReturn,
        categoryAvgReturn: c.categoryAvgReturn,
      }))
    ),

    insertIfNotEmpty(
      schema.holdings,
      fund.portfolio.holdings.map((h) => ({
        fundId,
        name: h.name,
        ticker: h.ticker,
        weight: h.weight,
        shares: h.shares ?? null,
        marketValue: h.marketValue ?? null,
        sector: h.sector,
        benchmarkWeight: h.benchmarkWeight ?? null,
      }))
    ),

    insertIfNotEmpty(
      schema.scoreDrivers,
      fund.score.drivers.map((d) => ({
        fundId,
        name: d.name,
        score: d.score,
        weight: d.weight,
        weightedContribution: d.weightedContribution,
        description: d.description,
      }))
    ),

    insertIfNotEmpty(
      schema.scoreTrend,
      fund.score.trend.map((t) => ({
        fundId,
        quarter: t.quarter,
        score: t.score,
      }))
    ),

    insertIfNotEmpty(
      schema.trades,
      fund.trading.recentTrades.map((t) => ({
        fundId,
        name: t.name,
        ticker: t.ticker,
        action: t.action,
        quarterAdded: t.quarterAdded,
        positionSize: t.positionSize,
        returnSince: t.returnSince,
        outcome: t.outcome,
      }))
    ),

    insertIfNotEmpty(
      schema.sectorHitRates,
      fund.trading.sectorHitRates.map((s) => ({
        fundId,
        sector: s.sector,
        hitRate: s.hitRate,
        tradeCount: s.tradeCount,
      }))
    ),

    insertIfNotEmpty(
      schema.factorTilts,
      fund.trading.factorTilts.map((f) => ({
        fundId,
        factor: f.factor,
        exposure: f.exposure,
        label: f.label,
      }))
    ),

    insertIfNotEmpty(
      schema.factorSensitivities,
      fund.factorRisk.factorSensitivities.map((f) => ({
        fundId,
        factor: f.factor,
        beta: f.beta,
        shockLabel: f.shockLabel,
        shockMagnitude: f.shockMagnitude,
        estimatedImpactDown: f.estimatedImpactDown,
        estimatedImpactUp: f.estimatedImpactUp,
      }))
    ),

    insertIfNotEmpty(
      schema.historicalScenarios,
      fund.factorRisk.historicalScenarios.map((h) => ({
        fundId,
        name: h.name,
        period: h.period,
        marketReturn: h.marketReturn,
        fundReturn: h.fundReturn,
        passiveAltReturn: h.passiveAltReturn,
        recoveryMonths: h.recoveryMonths,
      }))
    ),

    insertIfNotEmpty(
      schema.riskDecomposition,
      fund.factorRisk.riskDecomposition.map((r) => ({
        fundId,
        factor: r.factor,
        percentOfRisk: r.percentOfRisk,
      }))
    ),

    insertIfNotEmpty(
      schema.sectorBets,
      fund.attribution.sectorBets.map((s) => ({
        fundId,
        sector: s.sector,
        fundWeight: s.fundWeight,
        benchmarkWeight: s.benchmarkWeight,
        overUnderweight: s.overUnderweight,
        contribution: s.contribution,
      }))
    ),

    insertIfNotEmpty(
      schema.stockPicks,
      fund.attribution.stockPicks.map((s) => ({
        fundId,
        name: s.name,
        ticker: s.ticker,
        fundWeight: s.fundWeight,
        benchmarkWeight: s.benchmarkWeight,
        contribution: s.contribution,
      }))
    ),
  ]);

  console.log(`  Seeded ${fund.ticker}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
