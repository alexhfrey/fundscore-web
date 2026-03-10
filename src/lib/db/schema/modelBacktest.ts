import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";

export const modelBacktest = pgTable("model_backtest", {
  id: serial("id").primaryKey(),
  totalFundsScored: integer("total_funds_scored").notNull(),
  dataStartDate: varchar("data_start_date", { length: 20 }).notNull(),
  lastUpdated: varchar("last_updated", { length: 20 }).notNull(),
});

export const modelCalibration = pgTable(
  "model_calibration",
  {
    id: serial("id").primaryKey(),
    modelId: integer("model_id")
      .notNull()
      .references(() => modelBacktest.id, { onDelete: "cascade" }),
    predictedBucket: integer("predicted_bucket").notNull(),
    actualBeatRate: real("actual_beat_rate").notNull(),
    sampleSize: integer("sample_size").notNull(),
  },
  (table) => [index("model_calibration_model_id_idx").on(table.modelId)]
);

export const modelRollingAccuracy = pgTable(
  "model_rolling_accuracy",
  {
    id: serial("id").primaryKey(),
    modelId: integer("model_id")
      .notNull()
      .references(() => modelBacktest.id, { onDelete: "cascade" }),
    date: varchar("date", { length: 20 }).notNull(),
    hitRate: real("hit_rate").notNull(),
  },
  (table) => [
    index("model_rolling_accuracy_model_id_idx").on(table.modelId),
  ]
);

export const modelQuintileReturns = pgTable(
  "model_quintile_returns",
  {
    id: serial("id").primaryKey(),
    modelId: integer("model_id")
      .notNull()
      .references(() => modelBacktest.id, { onDelete: "cascade" }),
    quintile: integer("quintile").notNull(),
    avgExcessReturn: real("avg_excess_return").notNull(),
    fundCount: integer("fund_count").notNull(),
  },
  (table) => [
    index("model_quintile_returns_model_id_idx").on(table.modelId),
  ]
);

export const modelSpread = pgTable(
  "model_spread",
  {
    id: serial("id").primaryKey(),
    modelId: integer("model_id")
      .notNull()
      .references(() => modelBacktest.id, { onDelete: "cascade" }),
    date: varchar("date", { length: 20 }).notNull(),
    spread: real("spread").notNull(),
  },
  (table) => [index("model_spread_model_id_idx").on(table.modelId)]
);

export const modelPeerGroupAccuracy = pgTable(
  "model_peer_group_accuracy",
  {
    id: serial("id").primaryKey(),
    modelId: integer("model_id")
      .notNull()
      .references(() => modelBacktest.id, { onDelete: "cascade" }),
    peerGroup: varchar("peer_group", { length: 100 }).notNull(),
    accuracy: real("accuracy").notNull(),
    sampleSize: integer("sample_size").notNull(),
  },
  (table) => [
    index("model_peer_group_accuracy_model_id_idx").on(table.modelId),
  ]
);
