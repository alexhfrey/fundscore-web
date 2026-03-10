import {
  pgTable,
  serial,
  integer,
  varchar,
  real,
  index,
} from "drizzle-orm/pg-core";
import { funds } from "./funds";

export const factorTilts = pgTable(
  "factor_tilts",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    factor: varchar("factor", { length: 50 }).notNull(),
    exposure: real("exposure").notNull(),
    label: varchar("label", { length: 100 }).notNull(),
  },
  (table) => [index("factor_tilts_fund_id_idx").on(table.fundId)]
);
