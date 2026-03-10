import {
  pgTable,
  serial,
  integer,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const scoreTrend = pgTable(
  "score_trend",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    quarter: varchar("quarter", { length: 20 }).notNull(),
    score: integer("score").notNull(),
  },
  (table) => [index("score_trend_fund_id_idx").on(table.fundId)]
);
