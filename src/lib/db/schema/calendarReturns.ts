import {
  pgTable,
  serial,
  integer,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const calendarReturns = pgTable(
  "calendar_year_returns",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    fundReturn: real("fund_return").notNull(),
    benchmarkReturn: real("benchmark_return").notNull(),
    passiveAltReturn: real("passive_alt_return").notNull(),
    categoryAvgReturn: real("category_avg_return").notNull(),
  },
  (table) => [index("calendar_returns_fund_id_idx").on(table.fundId)]
);
