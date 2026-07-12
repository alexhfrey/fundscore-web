// ============================================================================
// Server-side tier gating for the /funds/[ticker] profile page — PURE + db-free.
// ----------------------------------------------------------------------------
// Gating runs in the React Server Component path — not in the browser. Gated
// fields are stripped from the payload server-side, so paid content (e.g. the
// 0-100 reframed value_index) never ships to an anon client. Locked sections are
// replaced with a {locked} marker so the UI can show an upgrade affordance
// without ever holding the underlying data.
//
// This module deliberately imports NO `db` / Drizzle — the DB read lives in
// `./profile.ts` (`getFundFactRow`), which re-exports everything here. Keeping
// the gating logic + types db-free lets the golden test (scripts/test/
// gating-golden.ts) import `applyGates` without a live Postgres client or
// DATABASE_URL in its import graph.
// ============================================================================

export type UserState = "anonymous" | "free" | "paid" | "pro";

// Null-prototype rank maps: a malformed gate/tier string must resolve ONLY
// against own properties — an inherited Object key ("toString", "constructor")
// would otherwise rank as a function and coerce comparisons to NaN, silently
// failing OPEN. This also makes `in` checks own-property-only.
const TIER_RANK: Record<UserState, number> = Object.assign(Object.create(null), {
  anonymous: 0,
  free: 1,
  paid: 2,
  pro: 3,
});
const GATE_RANK: Record<string, number> = Object.assign(Object.create(null), {
  public: 0,
  free: 1,
  paid: 2,
  pro: 3,
});

export interface Locked {
  locked: string; // tier required to view
  // When set, a small, explicitly-whitelisted proof-point subset of the gated
  // section is exposed for free while the full breakdown stays locked. The
  // object is STILL locked (it carries a `locked` key), so existing isLocked()
  // checks keep treating it as locked — components read getPreview() to render
  // the single proof point + an unlock affordance.
  preview?: unknown;
}

export type Section<T> = T | Locked | null;

export function isLocked(v: unknown): v is Locked {
  return typeof v === "object" && v !== null && "locked" in v;
}

/**
 * Read the whitelisted preview subset off a locked section, if present.
 * Returns null when the value isn't locked or carries no preview. The preview
 * is the only gated-section data a below-the-gate user ever holds; the full
 * breakdown is never serialized to that client.
 */
export function getPreview(v: unknown): unknown | null {
  if (!isLocked(v)) return null;
  return v.preview ?? null;
}

// --- Inline data-freshness: a typed reader over the already-served, public
// `source_inventory.source_stamps`. status ∈ {"available", "stale", "missing"}.
// A "missing" stamp always carries a null as_of_date, so consumers must treat
// "missing" exactly like an absent stamp (suppress the as-of affordance, fall
// back to base copy). Only "stale" prints a carried/older-than affordance.
export type StampStatus = "available" | "stale" | "missing";
export interface SourceStamp {
  source_domain: string;
  as_of_date: string | null;
  status: StampStatus | null;
}

/**
 * Read the source stamp for a domain from the served (public) source inventory.
 * Returns null when the inventory or the domain's stamp is absent. The
 * `source_inventory` section is public, so no gating concern.
 */
export function stampByDomain(
  src: { source_stamps?: SourceStamp[] } | null | undefined,
  domain: string,
): SourceStamp | null {
  const stamps = src?.source_stamps;
  if (!Array.isArray(stamps)) return null;
  return stamps.find((s) => s?.source_domain === domain) ?? null;
}

// --- shapes of the sections we actually render (others stay opaque) ---
export interface Identity {
  ticker: string | null;
  fund_name: string | null;
  fund_family: string | null;
  vehicle_type: string | null;
  management_style: string | null;
  asset_class: string | null;
  peer_group: string | null;
  inception_date: string | null;
  latest_nav: number | null;
  aum_usd: number | null;
  holdings_count: number | null;
  primary_benchmark: string | null;
  objective_text?: string | null;
  strategy_text?: string | null;
}

export interface PassiveBaseline {
  display_name: string | null;
  match_status: string | null;
  etf_weights: { etf: string; etf_name: string; weight: number; rank: number }[];
}

// --- value_offering_reframed (spec #7 v0.3) — the BADGE hero ---
export interface NamedBet {
  bet_id: string;
  bet_name: string;
  bet_type: string;
  etf_proxy: string | null;
  proxy_fee_bps: number | null;
  active_weight_pp: number | null;
  structural_or_tactical: string | null;
}

export interface ValueOfferingReframed {
  badge: string | null;
  bet_tag: string | null;
  status: string | null; // "scored" | "unsupported" | "building" | ...
  skill_band: string | null;
  value_index: number | null; // 0-100, paid-tier only
  eval_date: string | null;
  holdings_as_of: string | null;
  skill_as_of: string | null;
  method_version: string | null;
  methodology_link: string | null;
  suppression_reason: string | null;
  l2_blend_etfs: string | null;
  fee: {
    active_fee_bps: number | null;
    actual_fee_bps: number | null;
    fee_reasonableness: number | null;
    replicable_core_fee_bps: number | null;
  } | null;
  skill: {
    ir: number | null;
    ir_is_gross: boolean | null;
    gross_alpha_bps: number | null;
    p_positive_skill: number | null;
    p_negative_skill: number | null;
  } | null;
  replicability: {
    replica_r2: number | null;
    idio_te_bps: number | null;
    active_share: number | null;
    te_total_bps: number | null;
    idio_risk_share: number | null;
    low_replica_flag: boolean | null;
    theme_contrib_bps: number | null;
    theme_ride_delta_bps: number | null;
    replicable_risk_share: number | null;
  } | null;
  named_bets: NamedBet[] | null;
  locked_fields?: string[];
}

export interface TheTake {
  assembled_text: string | null;
  tension_pattern_id: string | null;
  confidence_state: string | null;
  method_version: string | null;
  as_of_dates: { field_id: string; as_of_date: string | null }[] | null;
}

// --- value_score (CURRENT value verdict, 2026-06-29) — the hero ----------------
// Net active value over the passive alternative. RELATIVE/DIAGNOSTIC, never
// "beats passive". The verdict (coverage_state, breakeven_state, passive alt,
// confidence) is public/free; the precise figures + the gross/fee receipt are
// paid (verdict free, precision paid — nulled by applyGates below the paid tier).
export interface ValueScore {
  coverage_state: string | null; // scored | too_new | not_comparable | fee_unavailable
  scored: boolean | null;
  breakeven_state: "above" | "near" | "below" | null; // single-source 3-state (from score100)
  above_breakeven: boolean | null; // raw bps sign (internal; UI uses breakeven_state)
  confidence: string | null; // high | limited
  value_bps: number | null; // net active value over passive, bps/yr (paid)
  score100: number | null; // anchored 0-100, 50 = breakeven (paid)
  gross_alpha_bps: number | null; // gross excess vs the style index, before fee (paid)
  fee_bps: number | null; // the fund's net ER subtracted (paid)
  passive_alt_label: string | null; // ALWAYS shown beside the verdict
  passive_alt_fee_bps: number | null; // the index's OWN fee — symmetric comparison (paid)
  beta: number | null; // (paid)
  replica_r2: number | null; // replica quality (paid — confidence detail)
  n_weeks: number | null; // track-record length (paid — window detail)
  framing: string | null; // 'relative_diagnostic'
  method_version: string | null;
  as_of_date: string | null;
  locked_fields?: string[];
}

// --- risk_attribution (spec #13) — factor/theme betas + divergence + bias/timing/idio ---
export interface FactorBetaRow {
  target_id: string;
  target_kind: string; // "theme" | "style"
  // The active bet, stripped of the *named baseline*. `beta_active_headline` is the
  // correct lead: it is the L2-blend (passive-alternative) active beta when an L2
  // look-through exists, else the market-stripped beta. `active_baseline` names
  // which one it is. `beta_active_mkt`/`beta_active_l2` are kept for transparency.
  beta_active_headline: number | null;
  active_baseline: string | null; // "l2_blend" | "market_fallback"
  beta_active_l2: number | null; // active vs the L2 passive blend (null when no L2)
  beta_active_mkt: number | null; // active vs the market (always present)
  beta_active_tstat: number | null;
  beta_raw: number | null; // context: total exposure
  beta_raw_tstat: number | null;
  beta_incremental_ff6: number | null;
  r2_active: number | null;
  confidence_state: string | null;
}
export interface DivergenceRow {
  target_id: string;
  exposure_name: string;
  exposure_type: string;
  total_exposure_holdings: number | null; // % of AUM held
  // The active bet vs the *named baseline*. Divergence rows don't carry a
  // pre-computed `beta_active_headline`; the headline is `beta_active_l2_blend`
  // when `active_baseline === "l2_blend"`, else `beta_active_mkt` (see
  // divergenceHeadlineBeta()). Both kept for transparency.
  active_baseline: string | null; // "l2_blend" | "market_fallback"
  beta_active_l2_blend: number | null; // active vs the L2 passive blend (null when no L2)
  beta_active_mkt: number | null; // active vs the market
  beta_total: number | null;
  beta_incremental_ff6: number | null;
  beta_active_tstat: number | null;
  beta_active_r2: number | null;
  divergence_state: string; // active_bet | exposure_no_active_bet | active_bet_low_holdings | minimal
  is_active_bet: boolean | null;
  active_overweight_holdings: number | null;
  holdings_overweight_reliable: boolean | null;
  holdings_baseline_ref: string | null;
  confidence_state_holdings: string | null;
  confidence_state_factor: string | null;
  holdings_as_of: string | null;
  factor_eval_date: string | null;
}
export interface FactorContributionRow {
  factor_id: string;
  factor_type: string; // theme | sector | macro
  avg_active_beta: number | null;
  bias_bps: number | null; // persistent tilt — path, NOT skill
  timing_bps: number | null; // path contribution, NOT timing skill
  total_contribution_bps: number | null;
  n_quarters: number | null;
  low_coverage_flag: boolean | null;
  pricing_suspect_flag: boolean | null;
}
export interface RiskAttribution {
  factor_betas: {
    themes: FactorBetaRow[];
    styles: FactorBetaRow[];
    eval_date: string | null;
    window_weeks: number | null;
    target_version: string | null;
    method_version: string | null;
    active_beta_control_model: string | null;
    incremental_beta_control_model: string | null;
  } | null;
  exposure_divergence: {
    rows: DivergenceRow[];
    holdings_as_of: string | null;
    factor_eval_date: string | null;
    eval_date: string | null;
    method_version: string | null;
    holdings_method_version: string | null;
    factor_method_version: string | null;
  } | null;
  active_return_attribution:
    | {
        factor_contributions: FactorContributionRow[];
        idio: {
          idio_contribution_bps: number | null;
          realised_active_bps: number | null;
          reconciliation_gap_bps: number | null;
          n_quarters: number | null;
        } | null;
        window_start: string | null;
        window_end: string | null;
        holdings_window: string | null;
        basis_source: string | null;
        method_version: string | null;
        gate: string;
      }
    | Locked
    | null;
  copy_charter: Record<string, boolean>;
}

// NOTE: Drizzle returns columns by their camelCase TS property names
// (passiveBaseline, riskAttribution, …). The keys *inside* each JSONB section are
// snake_case (built in Python). So column accessors are camelCase; nested-field
// accessors are snake_case.
export interface FactRow {
  seriesId: string;
  canonicalTicker: string | null;
  profileBuildVersion: string;
  fundName: string | null;
  valueOfferingStatus: string;
  dataCompletenessState: string;
  gates: Record<string, string>;
  identity: Identity;
  valueOfferingReframed: ValueOfferingReframed | null;
  valueScore: ValueScore | null; // CURRENT value verdict (the hero)
  valueScoreBps: number | null; // denormalized scalar (paid)
  valueScore100: number | null; // denormalized scalar (paid)
  valueCoverageState: string | null; // denormalized scalar (public verdict)
  theTake: TheTake | null;
  fees: Record<string, unknown> | null;
  passiveBaseline: PassiveBaseline | null;
  performance: Record<string, unknown> | null;
  // navSeries (profile-nav-series) arrives on the served row; its full typed
  // shape lives on FactRowV2 (profile-v2.ts NavSeries). Accessed here via the
  // index signature for the field-level paid strip in applyGates below.
  riskBehavior: Record<string, unknown> | null;
  holdings: Record<string, unknown> | null;
  managerParent: Record<string, unknown> | null;
  sourceInventory: Record<string, unknown>;
  exposureXray: Record<string, unknown> | null;
  returnAttribution: Record<string, unknown> | null;
  riskAttribution: RiskAttribution | null;
  positioningChanges: Record<string, unknown> | null;
  // fundFamilyPanel (fund-family-panel) arrives on the served row; its typed
  // shape lives on FactRowV2 (profile-v2.ts FundFamilyPanel). Like navSeries,
  // it is reached via the index signature here so the V2 narrowing compiles.
  alternatives: Record<string, unknown> | null;
  takeaways: unknown[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Each gated section: `col` is the Drizzle (camelCase) column; `gate` is the
// section_id key inside the `gates` JSONB (snake_case, from the Python loader).
// `defaultGate`: tier assumed when the row's `gates` JSONB lacks the key.
// Legacy sections keep the historical "public" default (their gates are always
// emitted); a section whose CONTRACT is paid must fail CLOSED if its gate key
// ever goes missing (load drift) — data must never outrun its gate (codex P2).
const GATED_SECTIONS: { col: string; gate: string; defaultGate?: string }[] = [
  { col: "identity", gate: "identity" },
  { col: "valueOfferingReframed", gate: "value_offering_reframed" },
  { col: "theTake", gate: "the_take" },
  { col: "fees", gate: "fees" },
  { col: "passiveBaseline", gate: "passive_baseline" },
  { col: "performance", gate: "performance" },
  { col: "navSeries", gate: "nav_series" },
  { col: "riskBehavior", gate: "risk_behavior" },
  { col: "holdings", gate: "holdings" },
  { col: "managerParent", gate: "manager_parent" },
  { col: "sourceInventory", gate: "source_inventory" },
  { col: "exposureXray", gate: "exposure_xray" },
  { col: "returnAttribution", gate: "return_attribution" },
  { col: "riskAttribution", gate: "risk_attribution" },
  { col: "positioningChanges", gate: "positioning_changes" },
  // positioning-context-percentiles — contract gate is "free"; fail CLOSED to
  // free (never public) if the gates key ever goes missing on a load drift.
  { col: "positioningContext", gate: "positioning_context", defaultGate: "free" },
  { col: "fundFamilyPanel", gate: "fund_family_panel" },
  { col: "teDecomposition", gate: "te_decomposition", defaultGate: "paid" },
  { col: "alternatives", gate: "alternatives" },
  { col: "takeaways", gate: "takeaways" },
];

// ============================================================================
// Preview projectors — the free proof point per gated section.
// ----------------------------------------------------------------------------
// When a section is gated above the user's tier, instead of nuking the whole
// section to `{ locked }` we surface ONE concrete, already-computed proof point
// for free and gate the rest. Each projector copies ONLY the named, whitelisted
// proof-point fields into the preview — it NEVER spreads the full section, so
// the full row arrays / detail tables never reach a below-the-gate client.
// A projector returns null when its section has no proof-point-eligible row, so
// the component falls back to the honest LockedNotice / Unavailable state.
// ============================================================================

export interface ExposurePreview {
  kind: "exposure";
  exposure_name: string;
  exposure_type: string;
  difference: number;
  holdings_as_of: string | null;
}
export interface DivergencePreview {
  kind: "divergence";
  exposure_name: string;
  total_exposure_holdings: number | null;
  beta_active_headline: number | null; // active beta vs the named baseline
  active_baseline: string | null; // "l2_blend" | "market_fallback"
  divergence_state: string;
  holdings_as_of: string | null;
  factor_eval_date: string | null;
}
export interface ThemeBetaPreview {
  kind: "theme_beta";
  exposure_name: string;
  beta_active_headline: number; // active beta vs the named baseline
  active_baseline: string | null; // "l2_blend" | "market_fallback"
  beta_active_tstat: number | null;
  factor_eval_date: string | null;
}
export interface SkillPreview {
  kind: "skill";
  label: string | null;
  p_skill: number | null;
  alpha_ir: number | null;
  ir_is_gross: boolean | null;
  t_years: number | null;
}
export interface DetractorPreview {
  kind: "detractor";
  member_label: string;
  period: string;
  contribution_to_active_return_bps: number;
  period_start_date: string | null;
  period_end_date: string | null;
}
export interface ShiftPreview {
  kind: "shift";
  change_name: string;
  change_type: string;
  change_direction: string;
  change_magnitude: number | null;
  value_unit: string | null;
  holdings_as_of_current: string | null;
  holdings_as_of_prior: string | null;
}
export interface AlternativePreview {
  kind: "alternative";
  ticker: string;
  name: string | null;
  alternative_type: string;
  expense_ratio_bps: number | null;
  annual_dollar_savings_10k: number | null;
  wrapper_alternative: string | null;
}

// --- te_decomposition (te-decomposition-by-bet) ------------------------------
// A grouped-sleeve rollup row (factor tilts vs stock selection). Shared shape:
// the served TeDecomposition (profile-v2.ts) imports THIS type for its `rollup`,
// so the free proof point and the full section never drift.
export interface TeRollupRow {
  bet_type: string; // "sector" | "theme" | "macro" | "selection"
  n_bets: number | null;
  var_share: number | null;
  te_alloc_bps: number | null; // negative = a diversifying sleeve — never clamped
  share_of_te_var: number | null;
  confidence_state: string | null;
}
/** One bet row, carried into the free proof point (the single top contributor). */
export interface TeTopBet {
  label: string;
  bet_type: string;
  factor_id: string | null;
  beta: number | null;
  beta_tstat: number | null;
  var_share: number | null;
  te_alloc_bps: number | null;
  diversifying: boolean;
  confidence_state: string | null;
}
/**
 * The FREE proof point for the paid TE-decomposition table: the grouped sleeve
 * rollup + the single top bet + the anchor scalars/basis note. It NEVER carries
 * the full per-bet array — the 11 other bets stay server-side below the gate.
 */
export interface TeProofPreview {
  kind: "te";
  rollup: TeRollupRow[];
  top_bet: TeTopBet | null;
  te_total_bps: number | null;
  factor_sleeve_te_bps: number | null;
  selection_te_bps: number | null;
  idio_risk_share: number | null;
  basis_note: string | null;
  passive_alt_label: string | null;
  as_of: string | null;
  // Returns window end — the honest freshness stamp ("returns through X ·
  // built as_of"); the build as_of alone overstates freshness (~2 weeks).
  window_end: string | null;
}

export type Preview =
  | ExposurePreview
  | DivergencePreview
  | ThemeBetaPreview
  | SkillPreview
  | DetractorPreview
  | ShiftPreview
  | AlternativePreview
  | TeProofPreview;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;
function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

// --- Risk & Attribution baseline helpers ------------------------------------
// The "active bet" is measured relative to a baseline. When the fund has a real
// L2 passive blend (look-through of its closest index alternative), the headline
// active beta is stripped of THAT blend, not the broad market — naming the
// baseline correctly is the whole point of the headline-beta fix. Index funds /
// funds with no L2 blend fall back to the market.

/** The headline (named-baseline) active beta for a factor-beta theme row. */
export function factorBetaHeadline(t: {
  beta_active_headline?: number | null;
  beta_active_mkt?: number | null;
}): number | null {
  // Server pre-computes `beta_active_headline` on theme rows; fall back to the
  // market-stripped beta only if it's missing.
  return num(t.beta_active_headline) ?? num(t.beta_active_mkt);
}

/**
 * The headline (named-baseline) active beta for a divergence row. Divergence
 * rows don't carry a pre-computed headline — derive it from the named baseline:
 * the L2-blend active beta when `active_baseline === "l2_blend"`, else market.
 */
export function divergenceHeadlineBeta(r: {
  active_baseline?: string | null;
  beta_active_l2_blend?: number | null;
  beta_active_mkt?: number | null;
}): number | null {
  if (r.active_baseline === "l2_blend") {
    return num(r.beta_active_l2_blend) ?? num(r.beta_active_mkt);
  }
  return num(r.beta_active_mkt);
}

/** True when the active bet is measured vs the fund's passive alternative (L2). */
export function isPassiveAltBaseline(activeBaseline: string | null | undefined): boolean {
  return activeBaseline === "l2_blend";
}

/** Short noun phrase naming the baseline, for inline copy. */
export function baselineNoun(activeBaseline: string | null | undefined): string {
  return isPassiveAltBaseline(activeBaseline) ? "its passive alternative" : "the market";
}

/**
 * Whether the served active-β / divergence "active bet" reading is a real,
 * fund-specific measurement that can be shown as a verdict.
 *
 * It is NOT assessable when the fund is ACTIVELY managed AND its factor-beta
 * baseline fell back to the broad market (`market_fallback`). These ~280 active
 * funds (mostly new ETFs) have an L2-blend passive match but no L2-blend return
 * history, so the served β is the market-baseline number — for an active fund
 * that misleads even though it's labeled "vs the market." Suppress the active-bet
 * verdict for them and show an honest "not enough shared history" state instead.
 *
 * The two correct cases stay assessable:
 *  • Index/passive funds on `market_fallback` (e.g. VOO) — market IS the right
 *    reference, so "vs the market" is honest.
 *  • Active funds on `l2_blend` (e.g. FCNTX) — the headline β is the real,
 *    passive-alternative-stripped bet.
 */
export function activeBetAssessable(
  managementStyle: string | null | undefined,
  activeBaseline: string | null | undefined,
): boolean {
  const isActive = managementStyle === "active";
  return !(isActive && activeBaseline === "market_fallback");
}

/** Top |difference| sector/theme row (skip concentration pseudo-rows). */
function pickTopExposureDiff(s: AnyObj): ExposurePreview | null {
  const rows: AnyObj[] = Array.isArray(s?.rows) ? s.rows : [];
  const cands = rows.filter(
    (r) =>
      (r?.exposure_type === "sector" || r?.exposure_type === "theme") &&
      num(r?.difference) != null,
  );
  if (cands.length === 0) return null;
  const top = cands.reduce((a, b) =>
    Math.abs(num(b.difference) ?? 0) > Math.abs(num(a.difference) ?? 0) ? b : a,
  );
  return {
    kind: "exposure",
    exposure_name: String(top.exposure_name ?? ""),
    exposure_type: String(top.exposure_type ?? ""),
    difference: num(top.difference) as number,
    holdings_as_of:
      (top.holdings_as_of as string | null) ??
      (s.fund_holdings_date as string | null) ??
      null,
  };
}

/** Divergence headline (top sorted row), else top theme active beta. */
function pickDivergenceHeadline(
  s: AnyObj,
): DivergencePreview | ThemeBetaPreview | null {
  const div = s?.exposure_divergence;
  const drows: AnyObj[] = Array.isArray(div?.rows) ? div.rows : [];
  if (drows.length > 0) {
    const r = drows[0]; // assembler sorts headline states to the front
    return {
      kind: "divergence",
      exposure_name: String(r.exposure_name ?? ""),
      total_exposure_holdings: num(r.total_exposure_holdings),
      beta_active_headline: divergenceHeadlineBeta(r),
      active_baseline: (r.active_baseline as string | null) ?? null,
      divergence_state: String(r.divergence_state ?? "minimal"),
      holdings_as_of:
        (r.holdings_as_of as string | null) ??
        (div?.holdings_as_of as string | null) ??
        null,
      factor_eval_date:
        (r.factor_eval_date as string | null) ??
        (div?.factor_eval_date as string | null) ??
        null,
    };
  }
  const themes: AnyObj[] = Array.isArray(s?.factor_betas?.themes)
    ? s.factor_betas.themes
    : [];
  const cands = themes.filter((t) => factorBetaHeadline(t) != null);
  if (cands.length === 0) return null;
  const top = cands.reduce((a, b) =>
    Math.abs(factorBetaHeadline(b) ?? 0) > Math.abs(factorBetaHeadline(a) ?? 0) ? b : a,
  );
  return {
    kind: "theme_beta",
    exposure_name: themeLabelFor(String(top.target_id ?? "")),
    beta_active_headline: factorBetaHeadline(top) as number,
    active_baseline: (top.active_baseline as string | null) ?? null,
    beta_active_tstat: num(top.beta_active_tstat),
    factor_eval_date: (s?.factor_betas?.eval_date as string | null) ?? null,
  };
}

/** theme::ai_infrastructure → "Ai Infrastructure" (label-only, no exposure_name carried). */
function themeLabelFor(targetId: string): string {
  return targetId
    .replace(/^theme::/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Returns-based skill proof point from skill_evidence. */
function pickSkillProofPoint(s: AnyObj): SkillPreview | null {
  const se = s?.skill_evidence;
  if (!se || typeof se !== "object" || se.label == null) return null;
  return {
    kind: "skill",
    label: (se.label as string | null) ?? null,
    p_skill: num(se.p_skill),
    alpha_ir: num(se.alpha_ir),
    ir_is_gross: typeof se.ir_is_gross === "boolean" ? se.ir_is_gross : null,
    t_years: num(se.t_years),
  };
}

/** Top 3Y stock detractor (else best available period), vs passive. */
function pickTopDetractor(s: AnyObj): DetractorPreview | null {
  const rows: AnyObj[] = Array.isArray(s?.rows) ? s.rows : [];
  const negatives = rows.filter(
    (r) => r?.rank_direction === "negative" && num(r?.contribution_to_active_return_bps) != null,
  );
  if (negatives.length === 0) return null;
  const period =
    ["3Y", "5Y", "1Y"].find((p) =>
      negatives.some((r) => r.period === p && r.dimension === "stock"),
    ) ?? negatives[0].period;
  const dim = negatives.some((r) => r.period === period && r.dimension === "stock")
    ? "stock"
    : "sector";
  const scoped = negatives.filter((r) => r.period === period && r.dimension === dim);
  if (scoped.length === 0) return null;
  const top = scoped.reduce((a, b) =>
    (num(b.contribution_to_active_return_bps) ?? 0) <
    (num(a.contribution_to_active_return_bps) ?? 0)
      ? b
      : a,
  );
  return {
    kind: "detractor",
    member_label: String(top.member_label ?? ""),
    period: String(top.period ?? period),
    contribution_to_active_return_bps: num(top.contribution_to_active_return_bps) as number,
    period_start_date: (top.period_start_date as string | null) ?? null,
    period_end_date: (top.period_end_date as string | null) ?? null,
  };
}

/** Top surfaced_rank positioning shift. */
function pickTopShift(s: AnyObj): ShiftPreview | null {
  const rows: AnyObj[] = Array.isArray(s?.rows) ? s.rows : [];
  if (rows.length === 0) return null;
  const top = [...rows].sort(
    (a, b) => (a.surfaced_rank ?? 9e9) - (b.surfaced_rank ?? 9e9),
  )[0];
  return {
    kind: "shift",
    change_name: String(top.change_name ?? ""),
    change_type: String(top.change_type ?? ""),
    change_direction: String(top.change_direction ?? ""),
    change_magnitude: num(top.change_magnitude),
    value_unit: (top.value_unit as string | null) ?? null,
    holdings_as_of_current: (top.holdings_as_of_current as string | null) ?? null,
    holdings_as_of_prior: (top.holdings_as_of_prior as string | null) ?? null,
  };
}

/** Cheapest TRUE substitute: cheaper_share_class first, then cross_wrapper.
 *  Never the global-cheapest row (that is often a passive same_category index,
 *  a misleading proof point for an active fund). */
function pickCheapestSubstitute(s: AnyObj): AlternativePreview | null {
  const rows: AnyObj[] = Array.isArray(s?.rows) ? s.rows : [];
  for (const type of ["cheaper_share_class", "cross_wrapper"]) {
    const cands = rows
      .filter((r) => r?.alternative_type === type)
      .sort(
        (a, b) =>
          (num(a.expense_ratio_bps) ?? Number.POSITIVE_INFINITY) -
          (num(b.expense_ratio_bps) ?? Number.POSITIVE_INFINITY),
      );
    if (cands.length > 0) {
      const r = cands[0];
      return {
        kind: "alternative",
        ticker: String(r.ticker ?? ""),
        name: (r.name as string | null) ?? null,
        alternative_type: String(r.alternative_type ?? type),
        expense_ratio_bps: num(r.expense_ratio_bps),
        annual_dollar_savings_10k: num(r.annual_dollar_savings_10k),
        wrapper_alternative: (r.wrapper_alternative as string | null) ?? null,
      };
    }
  }
  return null;
}

/** Grouped sleeve rollup + the single top bet — the free TE proof point. Copies
 *  ONLY named fields (rollup rows + one bet + anchor scalars); the full per-bet
 *  array never leaves the server below the paid gate. Negatives are preserved
 *  (a diversifying sleeve/bet). Returns null when the section has no bets to
 *  headline, so the component falls back to the honest locked state. */
function pickTeProofPoint(s: AnyObj): TeProofPreview | null {
  const bets: AnyObj[] = Array.isArray(s?.bets) ? s.bets : [];
  const rollup: AnyObj[] = Array.isArray(s?.rollup) ? s.rollup : [];
  if (bets.length === 0 && rollup.length === 0) return null;
  // Top bet = the single largest tracking-error contributor (already ranked in
  // the served payload; re-max here so ordering is never assumed).
  const withTe = bets.filter((b) => num(b?.te_alloc_bps) != null);
  const top =
    withTe.length > 0
      ? withTe.reduce((a, b) =>
          (num(b.te_alloc_bps) ?? 0) > (num(a.te_alloc_bps) ?? 0) ? b : a,
        )
      : null;
  const top_bet: TeTopBet | null = top
    ? {
        label: String(top.label ?? ""),
        bet_type: String(top.bet_type ?? ""),
        factor_id: (top.factor_id as string | null) ?? null,
        beta: num(top.beta),
        beta_tstat: num(top.beta_tstat),
        var_share: num(top.var_share),
        te_alloc_bps: num(top.te_alloc_bps),
        diversifying: top.diversifying === true,
        confidence_state: (top.confidence_state as string | null) ?? null,
      }
    : null;
  return {
    kind: "te",
    rollup: rollup.map((r) => ({
      bet_type: String(r.bet_type ?? ""),
      n_bets: num(r.n_bets),
      var_share: num(r.var_share),
      te_alloc_bps: num(r.te_alloc_bps),
      share_of_te_var: num(r.share_of_te_var),
      confidence_state: (r.confidence_state as string | null) ?? null,
    })),
    top_bet,
    te_total_bps: num(s.te_total_bps),
    factor_sleeve_te_bps: num(s.factor_sleeve_te_bps),
    selection_te_bps: num(s.selection_te_bps),
    idio_risk_share: num(s.idio_risk_share),
    basis_note: (s.basis_note as string | null) ?? null,
    passive_alt_label: (s.passive_alt_label as string | null) ?? null,
    as_of: (s.as_of as string | null) ?? null,
    window_end: (s.window_end as string | null) ?? null,
  };
}

// section col -> (fullSection) => previewObject (null if no proof point available)
const PREVIEW_PROJECTORS: Record<string, (s: AnyObj) => Preview | null> = {
  exposureXray: pickTopExposureDiff,
  riskAttribution: pickDivergenceHeadline,
  managerParent: pickSkillProofPoint,
  returnAttribution: pickTopDetractor,
  positioningChanges: pickTopShift,
  alternatives: pickCheapestSubstitute,
  teDecomposition: pickTeProofPoint,
};

/**
 * Strip sections/fields the user_state isn't entitled to, server-side.
 * - Section-level: per the `gates` map (section_id -> required tier).
 * - Field-level: the reframed value_index needs >= paid even though its hero
 *   section is public; the Value Score precise figures need >= paid; the manager
 *   moves bps needs >= paid; the active_return_attribution sub-panel needs >= paid.
 */
export function applyGates(row: FactRow, userState: UserState): FactRow {
  const rank = TIER_RANK[userState];
  const out: FactRow = { ...row };
  const o = out as unknown as Record<string, unknown>;

  for (const { col, gate: gateKey, defaultGate } of GATED_SECTIONS) {
    const gate = row.gates?.[gateKey] ?? defaultGate ?? "public";
    // An unknown/malformed gate value fails CLOSED (section stripped for every
    // tier, HARD lock — no preview proof point either: a malformed gate has no
    // valid tier policy to preview against). Live gates carry only
    // public/free/paid (verified 2026-07-10), so this is behavior-neutral
    // hardening of the serving boundary.
    const required = GATE_RANK[gate] ?? Number.POSITIVE_INFINITY;
    if (rank < required && o[col] != null) {
      // Surface ONE whitelisted proof point per gated section (free), gate the
      // rest. The projector copies only named fields — the full breakdown never
      // ships below the gate. Sections without a projector keep the hard lock.
      const projector = Number.isFinite(required) ? PREVIEW_PROJECTORS[col] : undefined;
      if (projector) {
        o[col] = { preview: projector(o[col] as AnyObj) ?? null, locked: gate };
      } else {
        o[col] = { locked: gate };
      }
    }
  }

  // Field-level: the reframed BADGE hero is public (badge + bet_tag + take),
  // but the 0-100 value_index is paid/pro only (data-products README: label-only
  // for anon/free, label + 0-100 for paid/pro).
  if (
    out.valueOfferingReframed &&
    !isLocked(out.valueOfferingReframed) &&
    rank < TIER_RANK.paid
  ) {
    const vr = out.valueOfferingReframed as ValueOfferingReframed;
    out.valueOfferingReframed = {
      ...vr,
      value_index: null,
      locked_fields: ["value_index"],
    };
  }

  // Field-level: the Value Score VERDICT is public/free — coverage_state,
  // breakeven_state (above/≈/below the passive alternative), the passive alt
  // label, confidence, and framing. The PRECISE figures (exact 0-100, net bps,
  // the gross/fee receipt, the index's own fee, replica R²/window/beta) are
  // paid/pro: withhold the noisiest digits from the least-sophisticated tier
  // (verdict free, precision paid). Mirrors the legacy value_index paid-gate.
  if (out.valueScore && !isLocked(out.valueScore) && rank < TIER_RANK.paid) {
    const vs = out.valueScore as ValueScore;
    out.valueScore = {
      ...vs,
      value_bps: null,
      score100: null,
      gross_alpha_bps: null,
      fee_bps: null,
      passive_alt_fee_bps: null,
      replica_r2: null,
      n_weeks: null,
      beta: null,
      locked_fields: [
        "value_bps",
        "score100",
        "gross_alpha_bps",
        "fee_bps",
        "passive_alt_fee_bps",
        "replica_r2",
        "n_weeks",
        "beta",
      ],
    };
    // Denormalized scalars carry the same precise figures — strip them too.
    out.valueScoreBps = null;
    out.valueScore100 = null;
  }

  // Field-level: the growth-of-$1000 chart is public (the FUND line + shape), but
  // the vs-passive comparison is paid — null the passive + beta-adjusted legs on
  // every point, and collapse the after-fee period table to ONE free proof-point
  // row (prefer 3Y, else the longest window) keeping only its fund/passive
  // annualized return + diff (beta-adjusted diff stays paid). Mirrors the
  // value_score "verdict free, precision paid" field-gate; the passive_label stays
  // so the proof point can name the alternative ("3Y: −40 bps/yr vs IWF"). The
  // full typed shape lives on FactRowV2 (profile-v2.ts); here we reach it via the
  // index-signature accessor `o.navSeries`.
  const nav = o.navSeries;
  if (nav && typeof nav === "object" && !isLocked(nav) && rank < TIER_RANK.paid) {
    const ns = nav as AnyObj;
    const points: AnyObj[] = Array.isArray(ns.points) ? ns.points : [];
    const table: AnyObj[] = Array.isArray(ns.period_table) ? ns.period_table : [];
    const proof =
      ["3Y", "SI", "5Y", "1Y"]
        .map((p) => table.find((r) => r?.period === p))
        .find((r) => r != null) ??
      table[0] ??
      null;
    o.navSeries = {
      ...ns,
      beta: null, // the β behind the (paid) beta-adjusted leg — paid, like value_score.beta
      points: points.map((p) => ({ ...p, passive: null, beta_adj_passive: null })),
      period_table: proof ? [{ ...proof, beta_adj_diff_bps: null }] : [],
      locked_fields: [
        "beta",
        "points.passive",
        "points.beta_adj_passive",
        "period_table.beta_adj_diff_bps",
        "period_table[full]",
      ],
    };
  }

  // Field-level: Manager Moves direction-of-impact label is public, but the
  // annualized bps figure is paid-tier (spec #10/#11 + contract ManagerMoves).
  // manager_parent section gate is already 'free'; this strips bps below 'paid'.
  if (out.managerParent && !isLocked(out.managerParent) && rank < TIER_RANK.paid) {
    const mp = out.managerParent as Record<string, unknown>;
    const se = mp.skill_evidence as Record<string, unknown> | null | undefined;
    const mm = se?.manager_moves as Record<string, unknown> | null | undefined;
    if (mm && typeof mm === "object") {
      out.managerParent = {
        ...mp,
        skill_evidence: {
          ...se,
          manager_moves: {
            ...mm,
            impact_bps_per_year: null,
            impact_bps_se: null,
            locked_fields: ["impact_bps_per_year", "impact_bps_se"],
          },
        },
      };
    }
  }

  // Field-level: the Risk & Attribution section is gated 'free' (the factor-beta
  // + divergence sub-panels are returns-complement content), but its
  // active_return_attribution sub-panel carries its own 'paid' gate in metadata
  // (spec #13 § serving). Strip it to a {locked} marker below 'paid' so free/anon
  // never hold the bias/timing/idio numbers but still see the upgrade affordance.
  if (out.riskAttribution && !isLocked(out.riskAttribution)) {
    const ra = out.riskAttribution as RiskAttribution;
    const attr = ra.active_return_attribution;
    if (attr != null && !isLocked(attr) && rank < TIER_RANK.paid) {
      out.riskAttribution = {
        ...ra,
        active_return_attribution: { locked: "paid" },
      };
    }
  }

  return out;
}

// ============================================================================
// Full-holdings list gate (serve-full-holdings) — PURE, db-free, generic.
// ----------------------------------------------------------------------------
// The filed positions live in a separate LONG serving table and are fetched
// lazily when the profile drawer opens. This is the ONE server-side gate on
// that fetch path: the rows are served only when the caller's tier meets the
// fund's `gates.holdings_full` requirement (the loader sets it to "paid" and
// present IFF the fund has a served list — verified gate ⇔ teaser coherent).
// Below the gate, or when the fund has no served list at all (gate absent),
// BOTH helpers yield zero access — so paid holdings never ship to an anon/free
// session and a fund without a list is never teased. Kept in this db-free module
// (imported by the gating golden test) and generic over the row shape so it has
// no coupling to the row contract in profile-v2.ts.
// ============================================================================

/** The SINGLE source of truth for "this fund has a served full-holdings list":
 *  the `gates.holdings_full` marker (backend contract: present IFF rows exist).
 *  The teaser and the row gate both key off THIS — never off the holdings JSON
 *  metadata — so a fund is never teased with rows its drawer can't fetch.
 *  A malformed/unknown gate value fails CLOSED here (treated as no served
 *  list), so teaser, entitlement, and rows stay coherent under bad data. */
export function hasHoldingsFullList(
  gates: Record<string, string> | null | undefined,
): boolean {
  const gate = gates?.["holdings_full"];
  return gate != null && GATE_RANK[gate] != null;
}

/** True when `userState` is entitled to the fund's full-holdings list. False
 *  when the fund has no served list (gate absent) — never tease/serve rows.
 *  This is the only gate on a public server-action path, so an unknown gate
 *  value must never widen access: hasHoldingsFullList already rejects it. */
export function holdingsFullEntitled(
  gates: Record<string, string> | null | undefined,
  userState: UserState,
): boolean {
  if (!hasHoldingsFullList(gates)) return false;
  return TIER_RANK[userState] >= GATE_RANK[gates!["holdings_full"]];
}

/** Return the rows only when entitled, else an empty array. Runs on the lazy
 *  fetch path before any row reaches the client. Generic so this module stays
 *  db-free and contract-free. */
export function gateHoldingsFull<T>(
  gates: Record<string, string> | null | undefined,
  userState: UserState,
  rows: readonly T[],
): T[] {
  return holdingsFullEntitled(gates, userState) ? [...rows] : [];
}

/**
 * Resolve the tier the full-holdings fetch is gated against, inside the server
 * action. The REAL session tier always wins in production, so a forged / replayed
 * server-action POST cannot supply `userState='paid'` to exfiltrate paid rows —
 * server actions are public endpoints and their bound args are only encrypted on
 * the normal UI path, so the tier is NEVER trusted from the client. A /preview
 * reviewer `?tier=` override is honored ONLY outside production (env-gated), and
 * only when it names a real tier. Pure + testable (reads NODE_ENV at call time).
 */
export function effectiveHoldingsTier(
  sessionTier: UserState,
  previewOverride: string | null | undefined,
): UserState {
  if (
    process.env.NODE_ENV !== "production" &&
    typeof previewOverride === "string" &&
    previewOverride in TIER_RANK
  ) {
    return previewOverride as UserState;
  }
  return sessionTier;
}

/** Tickers to pre-render at build (the Phase-0 dossier set); rest are on-demand ISR. */
export const SEED_TICKERS = [
  "FCNTX", "DODGX", "FBGRX", "SEQUX", "VDIGX", "VOO", "FXAIX",
];
