import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  text,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const scoreDrivers = pgTable(
  "score_drivers",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    score: integer("score").notNull(),
    weight: real("weight").notNull(),
    weightedContribution: real("weighted_contribution").notNull(),
    description: text("description").notNull(),
  },
  (table) => [index("score_drivers_fund_id_idx").on(table.fundId)]
);
