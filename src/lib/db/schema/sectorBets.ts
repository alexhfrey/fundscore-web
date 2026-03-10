import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const sectorBets = pgTable(
  "sector_bets",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    sector: varchar("sector", { length: 100 }).notNull(),
    fundWeight: real("fund_weight").notNull(),
    benchmarkWeight: real("benchmark_weight").notNull(),
    overUnderweight: real("over_underweight").notNull(),
    contribution: real("contribution").notNull(),
  },
  (table) => [index("sector_bets_fund_id_idx").on(table.fundId)]
);
