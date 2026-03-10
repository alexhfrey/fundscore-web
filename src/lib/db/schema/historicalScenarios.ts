import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const historicalScenarios = pgTable(
  "historical_scenarios",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    period: varchar("period", { length: 50 }).notNull(),
    marketReturn: real("market_return").notNull(),
    fundReturn: real("fund_return").notNull(),
    passiveAltReturn: real("passive_alt_return").notNull(),
    recoveryMonths: integer("recovery_months").notNull(),
  },
  (table) => [index("historical_scenarios_fund_id_idx").on(table.fundId)]
);
