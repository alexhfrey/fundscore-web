import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const holdings = pgTable(
  "holdings",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    ticker: varchar("ticker", { length: 20 }),
    weight: real("weight").notNull(),
    shares: real("shares"),
    marketValue: real("market_value"),
    sector: varchar("sector", { length: 100 }).notNull(),
    benchmarkWeight: real("benchmark_weight"),
  },
  (table) => [index("holdings_fund_id_idx").on(table.fundId)]
);
