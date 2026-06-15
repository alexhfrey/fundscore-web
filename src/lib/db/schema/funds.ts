import {
  pgTable,
  serial,
  varchar,
  real,
  integer,
  text,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import {
  assetClassCodeEnum,
  scoreLabelEnum,
  feeLevelEnum,
  attributionTypeEnum,
} from "./enums";

export const funds = pgTable(
  "funds",
  {
    id: serial("id").primaryKey(),
    ticker: varchar("ticker", { length: 10 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    assetClass: assetClassCodeEnum("asset_class").notNull(),
    geography: varchar("geography", { length: 10 }).notNull(),
    focus: varchar("focus", { length: 20 }).notNull(),
    size: varchar("size", { length: 20 }).notNull(),
    peerGroup: varchar("peer_group", { length: 40 }).notNull(),
    fundScore: integer("fund_score").notNull(),
    scoreLabel: scoreLabelEnum("score_label").notNull(),
    passiveAltTicker: varchar("passive_alt_ticker", { length: 10 }).notNull(),
    passiveAltName: varchar("passive_alt_name", { length: 200 }).notNull(),
    nav: real("nav").notNull(),
    ytdReturn: real("ytd_return").notNull(),
    oneYearReturn: real("one_year_return").notNull(),
    threeYearReturn: real("three_year_return").notNull(),
    fiveYearReturn: real("five_year_return").notNull(),
    tenYearReturn: real("ten_year_return"),
    expenseRatio: real("expense_ratio").notNull(),
    aum: real("aum").notNull(),

    // FundDetail scalars
    inceptionDate: varchar("inception_date", { length: 20 }).notNull(),
    manager: varchar("manager", { length: 100 }).notNull(),
    managerStartYear: integer("manager_start_year").notNull(),
    investmentObjective: text("investment_objective").notNull(),
    investmentStrategy: text("investment_strategy").notNull(),
    benchmark: varchar("benchmark", { length: 100 }).notNull(),
    minInvestment: integer("min_investment").notNull(),
    analystNote: text("analyst_note").notNull(),
    peerAvgOneYearReturn: real("peer_avg_one_year_return").notNull(),
    peerAvgThreeYearReturn: real("peer_avg_three_year_return").notNull(),
    peerAumRank: integer("peer_aum_rank").notNull(),
    peerFundCount: integer("peer_fund_count").notNull(),

    // Portfolio scalars
    totalHoldings: integer("total_holdings").notNull(),
    turnoverRate: real("turnover_rate").notNull(),

    // JSONB blobs (always read as a unit, never queried independently)
    trailingReturns: jsonb("trailing_returns").notNull(), // TrailingReturns
    riskMetrics: jsonb("risk_metrics").notNull(), // RiskData
    fees: jsonb("fees").notNull(), // FeeData
    feeLevel: feeLevelEnum("fee_level").notNull(),
    tradingScalars: jsonb("trading_scalars").notNull(), // scalar fields from TradingActivity
    attributionType: attributionTypeEnum("attribution_type").notNull(),
    attributionDetail: jsonb("attribution_detail").notNull(), // equity/fixedIncome/allocation detail
    sectorWeights: jsonb("sector_weights").notNull(), // SectorWeight[]
    assetAllocation: jsonb("asset_allocation").notNull(), // AssetAllocationItem[]
    creditQuality: jsonb("credit_quality"), // CreditQualityItem[] | null
    benchmarkSectorWeights: jsonb("benchmark_sector_weights"), // SectorWeight[] | null
    maturityDistribution: jsonb("maturity_distribution"), // MaturityBucket[] | null
    equityCharacteristics: jsonb("equity_characteristics"), // EquityCharacteristics | null
    fixedIncomeCharacteristics: jsonb("fixed_income_characteristics"), // FixedIncomeCharacteristics | null
    styleBox: jsonb("style_box"), // StyleBoxPosition | null
    peerPercentiles: jsonb("peer_percentiles").notNull(), // CategoryPercentiles
    skillAssessment: jsonb("skill_assessment").notNull(), // SkillAssessment
    durationRisk: jsonb("duration_risk"), // DurationRiskProfile | null
    adminDetails: jsonb("admin_details").notNull(), // AdministrativeDetails
  },
  (table) => [
    uniqueIndex("funds_ticker_idx").on(table.ticker),
    index("funds_peer_group_idx").on(table.peerGroup),
    index("funds_asset_class_idx").on(table.assetClass),
    index("funds_fund_score_idx").on(table.fundScore),
  ]
);

export type FundRow = typeof funds.$inferSelect;
export type NewFundRow = typeof funds.$inferInsert;
