import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const riskDecomposition = pgTable(
  "risk_decomposition",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    factor: varchar("factor", { length: 100 }).notNull(),
    percentOfRisk: real("percent_of_risk").notNull(),
  },
  (table) => [index("risk_decomposition_fund_id_idx").on(table.fundId)]
);
