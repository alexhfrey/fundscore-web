import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const stockPicks = pgTable(
  "stock_picks",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    ticker: varchar("ticker", { length: 20 }),
    fundWeight: real("fund_weight").notNull(),
    benchmarkWeight: real("benchmark_weight").notNull(),
    contribution: real("contribution").notNull(),
  },
  (table) => [index("stock_picks_fund_id_idx").on(table.fundId)]
);
