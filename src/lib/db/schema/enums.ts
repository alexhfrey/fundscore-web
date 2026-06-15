import { pgEnum } from "drizzle-orm/pg-core";

export const assetClassCodeEnum = pgEnum("asset_class_code", [
  "EQ",
  "FI",
  "MU",
  "MA",
  "ALT",
  "RE",
  "OT",
]);

export const scoreLabelEnum = pgEnum("score_label", [
  "Strong Buy",
  "Buy",
  "Hold",
  "Underperform",
  "Sell",
]);

export const feeLevelEnum = pgEnum("fee_level", [
  "Low",
  "Below Average",
  "Average",
  "Above Average",
  "High",
]);

export const attributionTypeEnum = pgEnum("attribution_type", [
  "equity",
  "fixedIncome",
  "allocation",
]);

export const tradeActionEnum = pgEnum("trade_action", ["buy", "sell"]);

export const tradeOutcomeEnum = pgEnum("trade_outcome", [
  "winner",
  "loser",
  "pending",
]);
