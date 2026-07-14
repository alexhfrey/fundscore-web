// ============================================================================
// CITED FACTS — every figure on the marketing surface, with its provenance.
//
// Rule: nothing appears on this page that is not traceable to a shipped
// artifact. If a number cannot be cited here, it does not go on the page.
//
// Verified 2026-07-13/14 against the real lakehouse and the serving DB, NOT
// from src/lib/methodology/registry.ts — the registry's as-of dates are stale
// (HOLDINGS_FRONTIER still says 2025-10-31 while the N-PORT refresh advanced
// most funds to 2026-03/04).
// ============================================================================

// --- Universe -------------------------------------------------------------

/**
 * Actively-managed funds a user can look up by ticker.
 * NOTE: 13,550 share classes (11,455 active) sit behind these, which would
 * clear "10,000+". We do NOT claim that — the fund profile resolves one
 * canonical ticker per series, so a share-class ticker (FCNKX…) 404s. The claim
 * has to survive a user typing their own ticker into the box.
 */
export const ACTIVE_FUNDS = "4,004";

/** All funds with a served profile (active + passive). */
export const FUNDS_SERVED = "5,706";

/** Raw SEC fund series ingested into the lakehouse. */
export const SEC_SERIES = "26,155";

/** As-filed SEC N-PORT position rows served. */
export const HOLDINGS_ROWS = "1.4 million";

// --- Exposure -------------------------------------------------------------

/**
 * Distinct exposure dimensions in gold/exposure_xray_panel.parquet:
 *   116 country/region + 28 theme + 11 sector + 6 style (FF6) + 5 concentration
 *   + 3 asset_class = 169. (Excludes the 9,598 individual stock holdings.)
 *
 * IMPORTANT — this is a PER-FUND read, not a portfolio one. The Portfolio X-Ray
 * maps a PORTFOLIO on companies, sectors and geography only. Portfolio-level
 * themes/factors/macro are NOT buildable from the serving DB: the per-fund
 * panels are served as top-N lists (FCNTX carries 6 theme rows, 12 TE bets), so
 * aggregating them would silently read "not in this fund's top N" as zero.
 *
 * Only the 6 style axes (MKT/SMB/HML/RMW/CMA/MOM) are "risk factors" in the
 * academic sense — never call all 169 "risk factors".
 */
export const EXPOSURE_DIMENSIONS = "169";
export const COUNTRIES = "116";
export const THEMES = "28";
export const SECTORS = "11";
export const STYLE_FACTORS = "6";

/** Real theme names from the served basis — used as concrete examples. */
export const THEME_EXAMPLES = [
  "Magnificent 7",
  "AI Infrastructure",
  "Cloud Hyperscalers",
  "Semiconductors",
  "US Onshoring",
  "GLP-1 / Weight-Loss",
];

/**
 * The 8 macro bets in the TE decomposition, verified by querying the served
 * bets. There is NO inflation factor and NO growth factor — do not claim them.
 * Credit (IG + HY) we DO have, and it's worth naming.
 */
export const MACRO_FACTORS =
  "rates, credit, the dollar, gold, oil and broad commodities";

// --- Evidence -------------------------------------------------------------

/** Brinson attribution: sector_allocation_bps vs stock_selection_bps. */
export const BRINSON_FUNDS = "2,496";

/**
 * The base rate. Backward-looking description of the scored universe — never a
 * forecast, and never applied to an individual fund.
 * Source: pipeline_status.md — median −80 bps/yr, ~18% clear breakeven.
 */
export const BREAKEVEN_SHARE = "about 1 in 5";
export const MEDIAN_SHORTFALL_BPS = "80";

/** The breakeven pictogram: 20 marks, each = 5% of scored funds; 4 above. */
export const PICTOGRAM_MARKS = 20;
export const PICTOGRAM_ABOVE = 4;

// --- Concentration --------------------------------------------------------
// Verified against fund_holdings_full (1.38M as-filed SEC positions), and every
// figure independently recomputed in SQL against the served output.

/**
 * The S&P 500's own weight in the mega-cap complex, read from FXAIX's filed
 * positions: 503 stocks, weights summing to 99.9%, as of 2026-02-28. Its whole
 * top TEN is 36.4% — the complex essentially IS the top of the index.
 */
export const SP500_MEGACAP_PCT = "34.8%";

/**
 * Median weight in that same complex across 802 US large-cap ACTIVE funds with
 * served holdings (funds holding none counted as zero — no survivorship trick).
 */
export const ACTIVE_MEDIAN_MEGACAP_PCT = "20%";

/** The 7 most widely held stocks across every active equity fund we serve. */
export const MOST_HELD = ["MSFT", "AMZN", "META", "NVDA", "GOOGL", "AVGO", "AAPL"];

/** FCNTX's own Magnificent 7 exposure, from its served exposure panel. */
export const FCNTX_MAG7_PCT = "34.7%";

// --- The worked example ---------------------------------------------------
// ONE portfolio is walked through the whole page: FXAIX 40 / FCNTX 35 /
// VWIGX 25 — an S&P 500 index fund, an active growth fund, and an international
// fund. A page that follows one real book end-to-end is far more credible than
// one that cherry-picks a different example per section.
//
// Live solver output, captured 2026-07-13. If either product screenshot is
// regenerated, these must be updated with it.

export const DEMO_PORTFOLIO_FEE_BPS = "36";
export const DEMO_BLEND_FEE_BPS = "13";
export const DEMO_FEE_GAP_BPS = "23";
export const DEMO_COST_PER_100K = "$227";
export const DEMO_BLEND = "IWF 64.7% + VEU 35.3%";

export const DEMO_LT_TOP10_PCT = "29.9%";
export const DEMO_LT_BLEND_TOP10_PCT = "35.8%";
export const DEMO_LT_NVDA_PCT = "6.46%";
export const DEMO_LT_TECH_TILT = "9.8";
export const DEMO_FUNDS_HOLDING_NVDA = "all three";

// Real output from /funds/FCNTX, same capture.
export const DEMO_FUND_AUM = "$140.6B";
export const DEMO_FUND_PSKILL = "11%";
