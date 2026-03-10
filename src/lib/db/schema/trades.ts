import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";
import { tradeActionEnum, tradeOutcomeEnum } from "./enums";

export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    ticker: varchar("ticker", { length: 20 }),
    action: tradeActionEnum("action").notNull(),
    quarterAdded: varchar("quarter_added", { length: 20 }).notNull(),
    positionSize: real("position_size").notNull(),
    returnSince: real("return_since").notNull(),
    outcome: tradeOutcomeEnum("outcome").notNull(),
  },
  (table) => [index("trades_fund_id_idx").on(table.fundId)]
);
