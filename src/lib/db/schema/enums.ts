import { pgEnum } from "drizzle-orm/pg-core";

// The only enum the serving mirror uses (serving.ts). The five demo-era enums
// were retired with the fabricated `funds` table in F7 — nothing in the served
// pipeline emits them, and one of them encoded a buy/sell rating this product
// does not make. See scripts/drop-legacy-funds-table.mjs for the full list and
// the local-DB cleanup.
export const assetClassCodeEnum = pgEnum("asset_class_code", [
  "EQ",
  "FI",
  "MU",
  "MA",
  "ALT",
  "RE",
  "OT",
]);
