import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const monthlyReturns = pgTable(
  "monthly_returns",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    series: varchar("series", { length: 20 }).notNull(), // 'fund' | 'benchmark' | 'passiveAlt' | 'categoryAvg'
    date: varchar("date", { length: 10 }).notNull(), // 'YYYY-MM'
    value: real("value").notNull(),
  },
  (table) => [
    index("monthly_returns_fund_id_series_idx").on(table.fundId, table.series),
  ]
);
