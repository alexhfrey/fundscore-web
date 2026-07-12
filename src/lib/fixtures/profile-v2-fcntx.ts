// ============================================================================
// DESIGN-PREVIEW SAMPLE DATA — never import outside src/app/preview/**.
// ----------------------------------------------------------------------------
// One FCNTX-shaped fixture per not-yet-served v2 section. Numbers come from
// feature-pipeline/captures/fund_profile__FCNTX/_mock_data_v5.json (2026-07-01
// mock prep): REAL values computed read-only from fund_score gold parquets,
// except where a payload carries an explicit sample/prototype label. The JSON
// sidecar (profile-v2-fcntx.json) is generated from that canonical file.
//
// Every export carries `__sample: true` — the preview UI renders a visible
// "sample data" chip off isSample() and omits methodology links.
//
// Non-FCNTX tickers get null (honest Unavailable), not a generic fake fund.
// ============================================================================
import raw from "./profile-v2-fcntx.json";
import type {
  AiSummary,
  AttributionWindowSummary,
  FundFamilyPanel,
  NavSeries,
  PositioningBetBridges,
  PositioningContext,
  RecentChangesTe,
  Top10VsIwf,
} from "../serving/profile-v2";

export interface V2Fixtures {
  navSeries: NavSeries;
  positioningContext: PositioningContext;
  recentChangesTe: RecentChangesTe;
  fundFamily: FundFamilyPanel;
  aiSummary: AiSummary;
  attributionWindowSummary: AttributionWindowSummary;
  top10VsIwf: Top10VsIwf;
  positioningBetBridges: PositioningBetBridges;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = raw as any;

const navSeries: NavSeries = {
  __sample: true,
  sample_label:
    "real monthly series (Tiingo adjusted closes, FCNTX vs IWF) from the design-mock prep; pending spec profile-nav-series",
  passive_label: j.nav_series.passive_label,
  series_start: j.nav_series.series_start,
  as_of: j.nav_series.as_of,
  beta: j.nav_series.beta,
  points: j.nav_series.points,
  period_table: j.nav_series.period_table,
  hover_copy: j.nav_series.hover_copy,
  method_version: j.nav_series.method_version,
};

const positioningContext: PositioningContext = {
  __sample: true,
  sample_label:
    "real percentiles (value_score.parquet, IWF cohort) from the design-mock prep; pending spec positioning-context-percentiles",
  beta: j.positioning_context.beta.value,
  beta_percentile: j.positioning_context.beta.percentile,
  beta_cohort_median: j.positioning_context.beta.cohort_median,
  te_bps: Math.round(j.positioning_context.tracking_error.value_pct * 100),
  te_percentile: j.positioning_context.tracking_error.percentile,
  te_cohort_median_bps: Math.round(
    j.positioning_context.tracking_error.cohort_median_pct * 100,
  ),
  cohort: {
    kind: j.positioning_context.cohort.kind,
    label: j.positioning_context.cohort.label,
    n_funds: j.positioning_context.cohort.n_funds,
  },
  as_of: j.positioning_context.as_of,
};

// te_decomposition is now SERVED (te-decomposition-by-bet, te_decomp_v0.1) — its
// fixture was removed at the production flip; a fixture never coexists with a
// served section. The type lives in serving/profile-v2.ts.

const recentChangesTe: RecentChangesTe = {
  __sample: true,
  sample_label:
    "real y-o-y N-PORT shifts (positioning_changes_panel) from the design-mock prep; TE ranking pending spec recent-changes-te-ranked",
  eval_date: j.recent_changes.window.eval_date,
  holdings_as_of_current: j.recent_changes.window.current,
  holdings_as_of_prior: j.recent_changes.window.prior,
  ranking_note: j.recent_changes.ranking_note,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: j.recent_changes.rows.map((r: any) => ({
    change_name: r.name,
    classification: r.type,
    change_direction: r.direction,
    prior_value: r.prior_pp,
    current_value: r.current_pp,
    value_unit: "pp",
    change_magnitude: r.change_pp,
    te_impact_bps: null, // honest: no TE estimate until the backend spec ships
    te_rank: null,
  })),
};

const fundFamily: FundFamilyPanel = {
  __sample: true,
  sample_label:
    "real adviser-level aggregation (value_score × fund_metadata) from the design-mock prep; pending spec fund-family-panel",
  family: j.fund_family.family,
  family_display: j.fund_family.family_display,
  n_funds_scored: j.fund_family.n_funds_scored,
  total_scored_aum_usd: j.fund_family.total_scored_aum_bn * 1e9,
  avg_value_bps: j.fund_family.avg_value_bps,
  aum_weighted_value_bps: j.fund_family.aum_weighted_value_bps,
  avg_value_bps_3y: null, // pending profile-nav-series — do not invent
  aum_weighted_value_bps_3y: null,
  family_rank: j.fund_family.family_rank,
  n_families_ranked: j.fund_family.n_families_ranked,
  rank_basis: j.fund_family.rank_basis,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  funds: j.fund_family.fidelity_top_funds_by_aum.map((f: any) => ({
    ticker: f.ticker,
    name: f.name,
    value_bps: f.value_bps,
    aum_usd: f.aum_bn * 1e9,
    passive_alt_label: f.passive_alt,
    is_this_fund: f.is_this_fund === true,
  })),
  leaders: j.fund_family.leaders,
  as_of: j.fund_family.as_of,
};

const aiSummary: AiSummary = {
  __sample: true,
  sample_label: j.ai_summary.label,
  paragraphs: j.ai_summary.paragraphs,
  generated_at: null,
  model: null, // hand-written sample — no model claim
  facts_hash: null,
};

const attributionWindowSummary: AttributionWindowSummary = {
  __sample: true,
  sample_label:
    "real full-window decomposition (served riskAttribution basis); per-quarter recomputation pending specs attribution-quarter-blocks + attribution-factor-path-serving",
  window: j.combined_decomposition.window,
  quarter_grid: j.attribution_explorer.quarter_grid,
  default_window: j.attribution_explorer.default_window,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factor_contributions: j.combined_decomposition.factor_contributions.map((f: any) => ({
    factor_id: f.factor,
    factor_type: f.type,
    total_bps: f.total_bps,
    bias_bps: f.bias_bps,
    timing_bps: f.timing_bps,
    avg_active_beta: f.avg_active_beta,
  })),
  stock_selection_idio_bps: j.combined_decomposition.stock_selection_idio_bps,
  realised_active_bps: j.combined_decomposition.realised_active_bps,
  residual_reconciliation_bps: j.combined_decomposition.residual_reconciliation_bps,
  beta_tilt: j.attribution_explorer.beta_tilt ?? null,
  n_quarters: j.combined_decomposition.n_quarters,
  basis_migration_note: j.attribution_explorer.basis_migration_note ?? null,
  residual_explainer: j.attribution_explorer.residual_explainer ?? null,
};

const top10VsIwf: Top10VsIwf = {
  __sample: true,
  sample_label:
    "real same-date holdings snapshots (FCNTX vs IWF, 2025-09-30) from the design-mock prep; pending spec current-positioning serving",
  as_of: j.top10_vs_iwf.as_of,
  basis_note: j.top10_vs_iwf.basis_note,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: j.top10_vs_iwf.rows.map((r: any) => ({
    ticker: r.ticker,
    fund_pct: r.fund_pct,
    iwf_pct: r.iwf_pct,
    diff_pp: r.diff_pp,
    note: r.note ?? null,
  })),
};

const positioningBetBridges: PositioningBetBridges = {
  __sample: true,
  sample_label:
    "real risk-model cluster mapping from the design-mock prep; pending spec te-decomposition-by-bet",
  note: j.positioning_bet_bridges.note,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bridges: j.positioning_bet_bridges.bridges.map((b: any) => ({
    bet: b.bet,
    bridge: b.bridge,
  })),
};

// risk_explainers is now DERIVED COPY (buildRiskExplainers in serving/profile-v2)
// templated from the numbers the page displays — its fixture was removed at the
// production flip; a fixture never coexists with a live source. The riskBehavior
// 3Y risk detail was never a fixture: it renders the served risk_behavior section.

const FIXTURES: Record<string, V2Fixtures> = {
  FCNTX: {
    navSeries,
    positioningContext,
    recentChangesTe,
    fundFamily,
    aiSummary,
    attributionWindowSummary,
    top10VsIwf,
    positioningBetBridges,
  },
};

/** FCNTX only; other tickers render the honest Unavailable state per section. */
export function getV2Fixtures(ticker: string): V2Fixtures | null {
  return FIXTURES[ticker.toUpperCase()] ?? null;
}
