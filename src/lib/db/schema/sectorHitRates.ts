import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const sectorHitRates = pgTable(
  "sector_hit_rates",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    sector: varchar("sector", { length: 100 }).notNull(),
    hitRate: real("hit_rate").notNull(),
    tradeCount: integer("trade_count").notNull(),
  },
  (table) => [index("sector_hit_rates_fund_id_idx").on(table.fundId)]
);
