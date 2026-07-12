import type { FactRow, UserState, Locked, TeRollupRow } from "./profile";

// ============================================================================
// Profile v2 (eight-section redesign) — payload types for the SEVEN data
// products specced in feature-pipeline/specs/queue/ (2026-07-01), plus the
// fixture-overlay used by the /preview route while the backend catches up.
// ----------------------------------------------------------------------------
// CONTRACT: these interfaces mirror the spec payloads exactly (snake_case inner
// keys, camelCase column names — same convention as profile.ts). When a spec
// ships, its section arrives on the real FactRow and the fixture overlay for
// that section is deleted; the type stays.
//
// Sample marking: every fixture-backed object carries `__sample: true`. The
// preview UI MUST render a visible "sample data" chip off isSample() and MUST
// NOT attach a methodology link to sample sections (the registry is a trust
// surface — anchors only exist for shipped data products).
// ============================================================================

/** Present on fixture-backed payloads only; never set by the real assembler. */
export interface SampleTag {
  __sample?: true;
  /** Optional visible provenance line for the sample (e.g. which real query fed it). */
  sample_label?: string;
}

export function isSample(v: unknown): boolean {
  return typeof v === "object" && v !== null && "__sample" in v;
}

// ---------------------------------------------------------------------------
// Preview-route tier gating for FIXTURE sections.
// ----------------------------------------------------------------------------
// The real fact-row sections are gated server-side by applyGates (profile.ts).
// The fixture-overlaid sections (nav series, positioning, family, …) carry no
// gate metadata, so the /preview page decides their tier here and only passes
// the entitled data to each component. Mirrors profile.ts's TIER_RANK/GATE_RANK
// so the two never drift. Used ONLY by src/app/preview/**.
// ---------------------------------------------------------------------------
const V2_TIER_RANK: Record<UserState, number> = {
  anonymous: 0,
  free: 1,
  paid: 2,
  pro: 3,
};
const V2_GATE_RANK: Record<string, number> = {
  public: 0,
  free: 1,
  paid: 2,
  pro: 3,
};

/** True when `userState` is entitled to a section gated at `requiredGate`. */
export function tierAllows(
  userState: UserState,
  requiredGate: "public" | "free" | "paid" | "pro",
): boolean {
  return (V2_TIER_RANK[userState] ?? 0) >= (V2_GATE_RANK[requiredGate] ?? 0);
}

// --- nav_series (SERVED — profile-nav-series, profile_nav_series_v1).
//     Matched-window monthly growth-of-$1000: both legs share ONE grid from the
//     common start (series_start is the COMMON PAIRED WINDOW start, NOT the
//     fund's inception — label it that way). Adjusted NAV ⇒ after-fee by
//     construction. Field-gated in applyGates: fund line public; the passive /
//     β-adjusted legs + β + the full period table are paid (free keeps ONE
//     proof-point row with its fund/passive/diff, β-adj diff nulled). ----------
export interface NavSeriesPoint {
  t: string; // "YYYY-MM" month key
  fund: number; // growth of $1000, after-fee (adjusted NAV)
  passive: number | null; // the passive blend leg (null when withheld below the paid gate)
  beta_adj_passive?: number | null;
}
export interface NavPeriodRow {
  period: string; // "1Y" | "3Y" | "5Y" | "SI" (SI = common-window start)
  fund_ann_pct: number | null;
  passive_ann_pct: number | null;
  diff_bps: number | null; // excess: fund − passive, annualized, after fees
  beta_adj_diff_bps: number | null; // alpha: fund − β·passive (same market risk)
}
export interface NavSeries {
  passive_label: string | null; // ALWAYS named beside the chart
  series_start: string | null; // common-window start month (NOT inception)
  as_of: string | null;
  beta?: number | null; // the β behind the β-adjusted leg (from value_score; paid)
  points: NavSeriesPoint[];
  period_table: NavPeriodRow[];
  method_version: string | null;
}

/**
 * Plain-English hover explainers for the period table's Excess / Alpha columns
 * — DERIVED copy templated from the served β and passive label (the served
 * payload carries no hover strings). Nothing computed beyond formatting.
 */
export function buildNavHoverCopy({
  beta,
  passiveLabel,
}: {
  beta: number | null | undefined;
  passiveLabel: string | null | undefined;
}): { excess: string; alpha: string } {
  const pass = passiveLabel ?? "the index";
  const betaBit =
    beta != null && isFinite(beta) ? ` (β ${beta.toFixed(2)})` : "";
  return {
    excess: `Excess return = the fund minus ${pass}, both after fees. The raw scoreboard vs simply holding the index.`,
    alpha: `Alpha (beta-adjusted) = the fund minus a beta-scaled ${pass} position${betaBit}. A fund running less market risk than its index is understated by raw excess; alpha compares against a passive position with the SAME market risk.`,
  };
}

// --- positioning_context (SERVED — positioning-context-percentiles,
//     positioning_context_v0.1). Percentiles use the page-wide strictly-below
//     convention (cohort_percentiles.py, self-in-n, N_MIN=20); blend-baseline
//     funds get the blend-weighted definition-C percentile. `constituents` are
//     the COHORT constituents with weights RENORMALIZED over qualifying ETFs
//     (qualifying_weight < 1 ⇒ part of the true blend didn't qualify) — never
//     present them as the fund's full blend composition unless
//     qualifying_weight === 1. ---------------------------------------------------
export interface PositioningCohortConstituent {
  etf: string;
  weight: number; // renormalized over QUALIFYING constituents
  n: number | null; // that constituent-ETF cohort's size
}
export interface PositioningContext {
  beta: number | null;
  beta_percentile: number | null; // strictly-below convention
  te_bps: number | null;
  te_percentile: number | null;
  cohort: {
    kind: "same_passive_alt" | "peer_group";
    label: string; // lead ETF ("IWF") or peer-group code ("EQ.US.HEALTH.ALLCAP")
    n_funds: number;
    is_blend?: boolean | null;
    constituents?: PositioningCohortConstituent[] | null;
    qualifying_weight?: number | null;
  } | null;
  as_of: string | null;
  blend_asof?: string | null;
  method_version?: string | null;
}

// --- te_decomposition (spec: te-decomposition-by-bet, te_decomp_v0.1) --------
// SERVED contract (fund_profile_facts.te_decomposition JSONB). Per-bet rows are
// the fund's active factor bets ranked by tracking-error contribution; `rollup`
// is the grouped sleeve split (factor tilts vs stock selection) that leads the
// section. Negative te_alloc_bps are REAL diversifying bets — NEVER clamped.
// Only sleeve-scaled variance SHARES are meaningful (see basis_note); per-bet
// betas are single-factor (FWL) reads that double-count on collinear factor sets.
// TeRollupRow lives in gating.ts (re-exported via ./profile) so the free
// proof-point projector and this served type share one shape.
export interface TeBet {
  label: string;
  bet_type: "sector" | "theme" | "macro"; // v1 fakes no per-stock TE (stocks come from the X-ray)
  factor_id: string;
  beta: number | null; // single-factor (FWL) read on the standardized basis
  beta_tstat: number | null;
  var_share: number | null; // share of factor-explained variance (can be < 0)
  te_alloc_bps: number | null; // var_share × factor sleeve (negative = diversifying)
  diversifying: boolean;
  confidence_state: string | null;
}
export interface TeDecomposition {
  as_of: string | null;
  n_obs: number | null;
  n_bets: number | null;
  bets: TeBet[];
  rollup: TeRollupRow[]; // grouped sleeve split: sector / theme / macro / selection
  basis_note: string | null; // the basis disclosure (shares-not-levels honesty note)
  basis_source: string | null;
  te_total_bps: number | null; // anchors to the served te_current — one TE per page
  factor_sleeve_te_bps: number | null;
  selection_te_bps: number | null; // the idio (stock-selection) sleeve
  idio_risk_share: number | null; // fraction of active variance
  passive_alt_label: string | null;
  window_start: string | null;
  window_end: string | null;
  no_named_bets?: boolean;
  method_version: string | null;
}

// --- recent changes enrichment (spec: recent-changes-te-ranked) -------------
export interface RecentChangeRow {
  change_name: string;
  classification: "stock" | "sector" | "theme" | "concentration" | "cash";
  change_direction: string;
  prior_value: number | null;
  current_value: number | null;
  value_unit: string | null;
  change_magnitude: number | null;
  te_impact_bps: number | null; // ESTIMATE; null until the backend spec ships
  te_impact_basis?: string | null;
  te_rank: number | null;
}
export interface RecentChangesTe extends SampleTag {
  rows: RecentChangeRow[];
  eval_date: string | null;
  holdings_as_of_current: string | null; // dual as-of stamps are mandatory (staleness!)
  holdings_as_of_prior: string | null;
  ranking_note?: string | null;
  method_version?: string | null;
}

// --- fund_family_panel (SERVED — fund-family-panel, fund_family_panel_v0.1).
//     Adviser-level (N-CEN adviser, NOT the SEC trust) family aggregation.
//     Ranking needs ≥5 scored funds (ranking_status names the honest state);
//     the SI aggregates are Value Score bps (shrunk, net); the 3Y variants are
//     realized after-fee β-adjusted excess from the nav-series period table —
//     a REALIZED-return basis, related but not the same statistic. Two separate
//     columns, never blended. ---------------------------------------------------
export interface FamilyFundRow {
  ticker: string;
  name: string | null;
  value_bps: number | null; // vs the fund's OWN passive alternative (SI, Value Score)
  value_bps_3y?: number | null; // realized 3Y after-fee β-adj excess (nav-series basis)
  aum_usd: number | null;
  aum_as_of_date?: string | null;
  passive_alt_label: string | null;
  is_this_fund?: boolean;
}
export interface FamilyLeaderRow {
  rank: number;
  family: string;
  n_funds: number;
  aum_weighted_bps: number | null;
  avg_bps: number | null;
}
export interface FundFamilyPanel {
  family: string | null; // cleaned adviser name (grouping key)
  family_display: string | null; // short brand label for copy
  n_funds_scored: number | null;
  n_funds_3y?: number | null; // members with a 3Y matched window (never imputed)
  total_scored_aum_usd: number | null;
  avg_value_bps: number | null;
  aum_weighted_value_bps: number | null;
  avg_value_bps_3y: number | null;
  aum_weighted_value_bps_3y: number | null;
  family_rank: number | null; // null when the family is too small to rank
  n_families_ranked: number | null;
  rank_basis: string | null;
  ranking_status?: string | null; // "ranked" | "family_too_small_to_rank"
  funds: FamilyFundRow[]; // top-N by AUM; the fund's own row always present
  leaders?: FamilyLeaderRow[];
  as_of: string | null;
  aum_as_of_date_min?: string | null; // AUM stamps span a range — disclose it
  aum_as_of_date_max?: string | null;
  value_as_of_date_min?: string | null;
  value_as_of_date_max?: string | null;
  method_version?: string | null;
}

// --- ai_summary (spec: ai-summary-generation) --------------------------------
export interface AiSummary extends SampleTag {
  paragraphs: string[];
  generated_at: string | null;
  model: string | null;
  facts_hash: string | null;
  method_version?: string | null;
}

// --- attribution explorer (specs: attribution-quarter-blocks +
//     attribution-factor-path-serving; served via the fund_attribution_blocks
//     table, fetched only when the section renders) --------------------------
export interface FactorPathBlock {
  quarter_end: string;
  factor_id: string;
  factor_label: string;
  factor_type: "sector" | "theme" | "macro";
  beta: number | null;
  fwd_factor_ret_bps: number | null;
  contribution_bps: number | null;
}
export interface BrinsonBlock {
  quarter_end: string;
  dimension: "stock" | "sector" | "theme";
  member_id: string;
  member_label: string; // includes the "other" residual bucket
  contribution_bps: number | null;
  fund_weight_avg: number | null;
  passive_weight_avg: number | null;
}
export interface AttributionBlocks extends SampleTag {
  holdings_window: string | null;
  quarter_grid: string[]; // quarter-end dates the range selects snap to
  quarter_returns: { quarter_end: string; fund_ret_bps: number | null; passive_ret_bps: number | null }[];
  factor_path: FactorPathBlock[];
  market_beta_path: { quarter_end: string; beta_mkt: number | null; beta_effect_bps: number | null }[];
  idio_by_quarter: { quarter_end: string; idio_bps: number | null }[];
  brinson: BrinsonBlock[];
  method_version: string | null;
}

// The full-window aggregate view — SERVED: built verbatim from
// riskAttribution.active_return_attribution (exposure_path_v0.2) by
// buildAttributionWindowSummary below, with the quarter grid from the lazy
// fund_attribution_blocks payload. The Explorer keeps its range control pinned
// to the full window until attribution-quarter-blocks ships — no sub-window
// number is ever invented.
export interface AttributionWindowSummary {
  window: string | null; // e.g. "2020-12-31 to 2025-09-30"
  quarter_grid: string[];
  default_window: { start: string; end: string } | null;
  factor_contributions: {
    factor_id: string;
    factor_type: "sector" | "theme" | "macro";
    total_bps: number | null;
    bias_bps: number | null; // rendered as "steady tilt" — NEVER "timing skill"
    timing_bps: number | null; // rendered as "tilt variation"
    avg_active_beta: number | null;
  }[];
  stock_selection_idio_bps: number | null;
  realised_active_bps: number | null;
  // The frozen-vs-NAV reconciliation gap (fees + intra-quarter trading — the
  // decomposition is gross, on frozen filed holdings; NAV is net). NOT a
  // decomposition residual: bets + selection == realised_active by construction.
  residual_reconciliation_bps: number | null;
  /** Context bar: (β−1) × baseline return — measured OUTSIDE the beta-adjusted
   *  decomposition basis; render separately, never summed into the chain. */
  beta_tilt?: {
    beta: number;
    est_bps_per_year: number;
    window: string;
    note: string;
  } | null;
  n_quarters: number | null;
  /** Cross-generation basis note: why some Positioning bets fold into a factor here. */
  basis_migration_note?: string | null;
  /** Why there is no residual inside the decomposition (frozen-vs-NAV gap). */
  residual_explainer?: string | null;
}

/**
 * Build the Attribution Explorer's window summary from the SERVED
 * riskAttribution.active_return_attribution (exposure_path_v0.2) — a pure
 * field mapping plus derived explainer COPY quoting served values. The served
 * factor list is truncated to the top rows by the assembler; the gold identity
 * (idio = realised − Σ ALL factor totals) makes the un-listed remainder exactly
 * `realised − idio − Σ listed` — the Explorer renders that as an explicit
 * "smaller factor bets" line rather than letting the chain silently not sum.
 * beta_tilt is intentionally null: the old fixture bar was a labeled PROTOTYPE
 * estimate; the real per-quarter beta-effect series is served in the blocks and
 * its integrated bar ships with attribution-quarter-blocks — nothing is
 * estimated in the meantime.
 */
export function buildAttributionWindowSummary(
  // The served sub-panel (snake_case JSONB) — typed loosely at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ara: any,
  blocksMeta: { quarter_grid: string[]; holdings_window: string | null } | null,
): AttributionWindowSummary | null {
  if (!ara || typeof ara !== "object") return null;
  const idio = ara.idio ?? null;
  const rows: unknown[] = Array.isArray(ara.factor_contributions)
    ? ara.factor_contributions
    : [];
  // The bets-to-net chain NEEDS the idio aggregates (idio / realised): without
  // them the waterfall would zero-fill selection, realised, net and the
  // remainder line — fabricated values. Fail honest instead (codex P2).
  if (
    idio == null ||
    idio.idio_contribution_bps == null ||
    idio.realised_active_bps == null ||
    rows.length === 0
  ) {
    return null;
  }
  const windowStart = (ara.window_start as string | null) ?? null;
  const windowEnd = (ara.window_end as string | null) ?? null;
  return {
    window: windowStart && windowEnd ? `${windowStart} to ${windowEnd}` : null,
    quarter_grid: blocksMeta?.quarter_grid ?? [],
    default_window:
      windowStart && windowEnd ? { start: windowStart, end: windowEnd } : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    factor_contributions: rows.map((r: any) => ({
      factor_id: String(r.factor_id ?? ""),
      factor_type: r.factor_type as "sector" | "theme" | "macro",
      total_bps: r.total_contribution_bps ?? null,
      bias_bps: r.bias_bps ?? null,
      timing_bps: r.timing_bps ?? null,
      avg_active_beta: r.avg_active_beta ?? null,
    })),
    stock_selection_idio_bps: idio?.idio_contribution_bps ?? null,
    realised_active_bps: idio?.realised_active_bps ?? null,
    residual_reconciliation_bps: idio?.reconciliation_gap_bps ?? null,
    beta_tilt: null,
    n_quarters: idio?.n_quarters ?? null,
    // v0.2 IS the standardized basis (one bet universe with Positioning / the
    // TE table) — the old "two model generations" migration note is retired.
    basis_migration_note: null,
    residual_explainer:
      "Within the decomposition there is no residual: stock selection (idio) is defined as the frozen-portfolio active return minus the factor bets, so bets + selection equals the realised figure exactly (the table lists the top factor rows; the “smaller factor bets” line collects the rest, so the chain always sums). The separate reconciliation gap is frozen-vs-NAV: the decomposition prices quarterly FROZEN filed holdings GROSS of fees, while real NAV is net and includes intra-quarter trading — labeled “fees + trading”, never forced to zero.",
  };
}

// --- holdings_full (spec: serve-full-holdings) -------------------------------
// One row per filed N-PORT position line at the fund's latest canonical
// accession, AS FILED: multi-line issuers stay separate rows, weights are the
// filed pctVal (% of net assets) and are never rescaled. Rows are lazily fetched
// (paid-gated) when the drawer opens — never carried on the profile fact row.
export interface HoldingRow {
  // Stable position key = the filed-weight rank (1-based). Used as the React
  // row key, NOT the ticker: ~40% of rows universe-wide have no resolvable
  // ticker (private placements, cash instruments) yet still appear.
  position_id: number;
  name: string | null; // security name — often the only identifier
  ticker: string | null; // resolved US ticker; null where unresolved
  weight_pct: number | null; // filed pctVal (% of net assets), exactly as filed
  value_usd: number | null; // filed valUSD
  country: string | null; // filed invCountry
  sector: string | null; // cusip_reference join; null where unresolved
  asset_cat: string | null; // filed assetCat raw code (labeled in the UI)
}
/** Free teaser for the locked drawer — the served count + as-of, read off the
 *  PUBLIC holdings section (present iff the fund has a served list). */
export interface HoldingsFullTeaser {
  n_positions: number;
  as_of: string | null;
}
export interface HoldingsFull extends SampleTag {
  as_of: string | null;
  basis: string | null;
  n_positions: number | null;
  rows: HoldingRow[];
}

// --- top10_vs_iwf (spec: current-positioning holdings block) -----------------
export interface Top10Row {
  ticker: string;
  fund_pct: number | null;
  iwf_pct: number | null;
  diff_pp: number | null;
  note?: string | null;
}
export interface Top10VsIwf extends SampleTag {
  as_of: string | null;
  basis_note: string | null;
  rows: Top10Row[];
}

// --- positioning_bet_bridges (spec: bets table, non-attributed bridge rows) --
export interface BetBridge {
  bet: string;
  bridge: string;
}
export interface PositioningBetBridges extends SampleTag {
  note: string | null;
  bridges: BetBridge[];
}

// --- risk_behavior (SERVED on the base fact row; assembled from fund_metadata
//     risk fields — computed in fund_score build_gold_metadata from Tiingo daily
//     adjusted NAV: monthly grid, 3Y = 36 months (min 30), SHY risk-free proxy;
//     max drawdown from full-history daily closes. Benchmark-relative fields are
//     measured vs an ETF proxy of the fund's STATED prospectus benchmark
//     (`benchmark_relative_to`) — a DIFFERENT basis from the page's passive-alt
//     framing; label them with the served benchmark name, never the passive alt.
//     Fractions: std_dev_3y / alpha_3y / tracking_error / max_drawdown.
//     Percents (0–100+): r_squared_3y / upside_capture / downside_capture. ------
export interface RiskBehavior {
  std_dev_3y: number | null;
  sharpe_3y: number | null;
  sortino_3y: number | null;
  alpha_3y: number | null;
  beta_3y: number | null;
  r_squared_3y: number | null;
  tracking_error: number | null;
  information_ratio: number | null;
  upside_capture: number | null;
  downside_capture: number | null;
  max_drawdown: number | null;
  max_drawdown_date: string | null;
  benchmark_relative_to: string | null;
}

// --- risk_explainers (ⓘ plain-language explainers) ---------------------------
// DERIVED COPY, no longer a fixture: the strings are templated server-side from
// the SAME numbers the section displays (buildRiskExplainers below), so the
// educational copy can never contradict the gauges. No fund-specific sentence is
// emitted when its number is absent — the definition alone remains.
export interface RiskExplainers {
  beta: string | null;
  tracking_error: string | null;
  beta_tilt_plain: string | null;
}

/**
 * Build the plain-language ⓘ explainers from the numbers the page displays
 * (positioning gauges / nav-series beta). Pure copy templating — every figure
 * in the output is one of the inputs, formatted; nothing is computed here
 * beyond `beta × 10` movement phrasing and unit conversion of te_bps to %/yr.
 */
export function buildRiskExplainers({
  beta,
  teBps,
  passiveLabel,
}: {
  beta: number | null | undefined;
  teBps: number | null | undefined;
  passiveLabel: string | null | undefined;
}): RiskExplainers {
  const pass = passiveLabel ?? "its index";
  const betaDef = `Beta measures how much the fund moves when its index (${pass}) moves. Beta 1.00 = moves one-for-one.`;
  const betaFund =
    beta != null && isFinite(beta)
      ? ` This fund's ${beta.toFixed(2)} means a 10% ${pass} move typically moves the fund about ${(beta * 10).toFixed(1)}% — it holds ${
          beta < 0.97 ? "LESS" : beta > 1.03 ? "MORE" : "about the same"
        } market risk ${beta < 0.97 || beta > 1.03 ? "than" : "as"} the index.`
      : "";
  const teDef = `Tracking error measures how differently the fund behaves from its index, in %/yr. Zero = an index hugger.`;
  const tePct = teBps != null && isFinite(teBps) ? (teBps / 100).toFixed(1) : null;
  const teFund = tePct
    ? ` This fund's ${tePct}%/yr means its returns typically land within ±${tePct} points of the (beta-adjusted) index in a normal year — that spread is what active management buys you, for better or worse.`
    : "";
  const tiltDir =
    beta != null && isFinite(beta)
      ? beta < 0.97
        ? `The fund holds less market risk than its index (beta ${beta.toFixed(2)} vs 1.00).`
        : beta > 1.03
          ? `The fund holds more market risk than its index (beta ${beta.toFixed(2)} vs 1.00).`
          : `The fund holds about the same market risk as its index (beta ${beta.toFixed(2)}).`
      : `A fund can hold more or less market risk than its index (beta above or below 1.00).`;
  return {
    beta: betaDef + betaFund,
    tracking_error: teDef + teFund,
    beta_tilt_plain: `${tiltDir} This is a POSITIONING choice, not a stock-picking result — so the bets are measured AFTER removing it, and it is shown here as its own line, never summed into the chain.`,
  };
}

// --- the extended row ---------------------------------------------------------
// Optional columns: absent until the matching backend spec ships its Drizzle
// column + assembler section. The preview route overlays fixtures for FCNTX.
export interface FactRowV2 extends FactRow {
  navSeries?: NavSeries | null;
  // SERVED + tier-gated (positioning_context=free): applyGates leaves the full
  // object for free+ and a { locked } marker for anon.
  positioningContext?: PositioningContext | Locked | null;
  // SERVED + tier-gated (te_decomposition=paid): applyGates leaves the full
  // object for paid and a { preview, locked } marker for free/anon — so the
  // narrowed type includes Locked.
  teDecomposition?: TeDecomposition | Locked | null;
  recentChangesTe?: RecentChangesTe | null;
  // SERVED + tier-gated (fund_family_panel=free): applyGates leaves the full
  // object for free+ and a { locked } marker for anon. (`fundFamily` on the
  // base row is the SEC-trust STRING scalar — not this panel.)
  fundFamilyPanel?: FundFamilyPanel | Locked | null;
  aiSummary?: AiSummary | null;
  attributionBlocks?: AttributionBlocks | null;
  attributionWindowSummary?: AttributionWindowSummary | null;
  top10VsIwf?: Top10VsIwf | null;
  positioningBetBridges?: PositioningBetBridges | null;
  // riskBehavior is SERVED on the base FactRow (gate: free; typed loosely there
  // as Record<string, unknown>) — the page narrows it to RiskBehavior | Locked
  // at the read site. riskExplainers is DERIVED copy (buildRiskExplainers),
  // computed in-page from displayed numbers — neither rides this overlay type.
}

/**
 * Overlay fixture payloads for sections the backend doesn't serve yet.
 * PREVIEW-ONLY: imported by src/app/preview/** and nowhere else. Real served
 * sections always win — a fixture never shadows real data. Non-fixture tickers
 * get nulls (the honest Unavailable state), not a generic fake fund.
 */
export async function overlayV2Fixtures(
  row: FactRow,
  ticker: string,
): Promise<FactRowV2> {
  const { getV2Fixtures } = await import("../fixtures/profile-v2-fcntx");
  const fx = getV2Fixtures(ticker);
  const out: FactRowV2 = { ...row };
  if (!fx) return out;
  // navSeries is SERVED (profile-nav-series shipped) — no fixture overlay; the
  // applyGates field-gate owns its public/paid split on the base row.
  // positioningContext is SERVED (positioning-context-percentiles shipped) — no
  // fixture overlay; applyGates owns its free gate on the base row.
  // teDecomposition is SERVED (te-decomposition-by-bet shipped) — no fixture
  // overlay; applyGates already resolved the row's full/locked/absent value.
  out.recentChangesTe = out.recentChangesTe ?? fx.recentChangesTe;
  // fundFamilyPanel is SERVED (fund-family-panel shipped) — no fixture overlay;
  // applyGates owns its free gate on the base row. (The base row's fundFamily
  // STRING — the SEC trust name — is untouched and unrelated.)
  out.aiSummary = out.aiSummary ?? fx.aiSummary;
  // attributionWindowSummary is SERVED (built in-page from the served
  // riskAttribution sub-panel + blocks meta) — no fixture overlay.
  out.top10VsIwf = out.top10VsIwf ?? fx.top10VsIwf;
  out.positioningBetBridges = out.positioningBetBridges ?? fx.positioningBetBridges;
  // riskExplainers: DERIVED copy now (buildRiskExplainers) — no fixture overlay;
  // riskBehavior is served on the base row and never had a fixture.
  return out;
}
