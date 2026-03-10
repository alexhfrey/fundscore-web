import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const factorSensitivities = pgTable(
  "factor_sensitivities",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    factor: varchar("factor", { length: 100 }).notNull(),
    beta: real("beta").notNull(),
    shockLabel: varchar("shock_label", { length: 100 }).notNull(),
    shockMagnitude: real("shock_magnitude").notNull(),
    estimatedImpactDown: real("estimated_impact_down").notNull(),
    estimatedImpactUp: real("estimated_impact_up").notNull(),
  },
  (table) => [index("factor_sensitivities_fund_id_idx").on(table.fundId)]
);
