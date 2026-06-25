import { eq } from "drizzle-orm";
import { db } from "../db";
import { fundProfileFacts } from "../db/schema/serving";

// ============================================================================
// Serving read + server-side tier gating for the /funds/[ticker] profile page.
// ----------------------------------------------------------------------------
// Gating runs HERE, in the React Server Component path — not in the browser.
// Gated fields are stripped from the payload server-side, so paid content
// (e.g. the 0-100 Value Offering score) never ships to an anon client. Locked
// sections are replaced with a {locked} marker so the UI can show an upgrade
// affordance without ever holding the underlying data.
// ============================================================================

export type UserState = "anonymous" | "free" | "paid" | "pro";

const TIER_RANK: Record<UserState, number> = {
  anonymous: 0,
  free: 1,
  paid: 2,
  pro: 3,
};
const GATE_RANK: Record<string, number> = {
  public: 0,
  free: 1,
  paid: 2,
  pro: 3,
};

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

export interface ValueOffering {
  value_offering_score: number | null;
  value_offering_label: string | null;
  value_offering_status: string | null;
  confidence_state: string | null;
  available_legs: string[];
  suppressed_legs: string[];
  legs: Record<string, number | null> | null;
  leg_provenance: unknown;
  method_version: string | null;
  methodology_link: string | null;
  suppression_reason: string | null;
  eval_date: string | null;
  locked_fields?: string[];
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
    idio_alpha_bps: number | null;
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
// (valueOffering, passiveBaseline, …). The keys *inside* each JSONB section are
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
  valueOffering: ValueOffering | null;
  valueOfferingReframed: ValueOfferingReframed | null;
  theTake: TheTake | null;
  fees: Record<string, unknown> | null;
  passiveBaseline: PassiveBaseline | null;
  performance: Record<string, unknown> | null;
  riskBehavior: Record<string, unknown> | null;
  holdings: Record<string, unknown> | null;
  managerParent: Record<string, unknown> | null;
  sourceInventory: Record<string, unknown>;
  exposureXray: Record<string, unknown> | null;
  returnAttribution: Record<string, unknown> | null;
  riskAttribution: RiskAttribution | null;
  positioningChanges: Record<string, unknown> | null;
  alternatives: Record<string, unknown> | null;
  takeaways: unknown[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Each gated section: `col` is the Drizzle (camelCase) column; `gate` is the
// section_id key inside the `gates` JSONB (snake_case, from the Python loader).
const GATED_SECTIONS: { col: string; gate: string }[] = [
  { col: "identity", gate: "identity" },
  { col: "valueOffering", gate: "value_offering" },
  { col: "valueOfferingReframed", gate: "value_offering_reframed" },
  { col: "theTake", gate: "the_take" },
  { col: "fees", gate: "fees" },
  { col: "passiveBaseline", gate: "passive_baseline" },
  { col: "performance", gate: "performance" },
  { col: "riskBehavior", gate: "risk_behavior" },
  { col: "holdings", gate: "holdings" },
  { col: "managerParent", gate: "manager_parent" },
  { col: "sourceInventory", gate: "source_inventory" },
  { col: "exposureXray", gate: "exposure_xray" },
  { col: "returnAttribution", gate: "return_attribution" },
  { col: "riskAttribution", gate: "risk_attribution" },
  { col: "positioningChanges", gate: "positioning_changes" },
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

export type Preview =
  | ExposurePreview
  | DivergencePreview
  | ThemeBetaPreview
  | SkillPreview
  | DetractorPreview
  | ShiftPreview
  | AlternativePreview;

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

// section col -> (fullSection) => previewObject (null if no proof point available)
const PREVIEW_PROJECTORS: Record<string, (s: AnyObj) => Preview | null> = {
  exposureXray: pickTopExposureDiff,
  riskAttribution: pickDivergenceHeadline,
  managerParent: pickSkillProofPoint,
  returnAttribution: pickTopDetractor,
  positioningChanges: pickTopShift,
  alternatives: pickCheapestSubstitute,
};

/** Read the fact row for a ticker. Gating is applied separately. */
export async function getFundFactRow(ticker: string): Promise<FactRow | null> {
  const [row] = await db
    .select()
    .from(fundProfileFacts)
    .where(eq(fundProfileFacts.canonicalTicker, ticker.toUpperCase()))
    .limit(1);
  return (row as unknown as FactRow) ?? null;
}

/**
 * Strip sections/fields the user_state isn't entitled to, server-side.
 * - Section-level: per the `gates` map (section_id -> required tier).
 * - Field-level: the Value Offering 0-100 score + leg detail need >= free,
 *   even though the hero section itself is public (anon sees the label only).
 */
export function applyGates(row: FactRow, userState: UserState): FactRow {
  const rank = TIER_RANK[userState];
  const out: FactRow = { ...row };
  const o = out as unknown as Record<string, unknown>;

  for (const { col, gate: gateKey } of GATED_SECTIONS) {
    const gate = row.gates?.[gateKey] ?? "public";
    if (rank < (GATE_RANK[gate] ?? 0) && o[col] != null) {
      // Surface ONE whitelisted proof point per gated section (free), gate the
      // rest. The projector copies only named fields — the full breakdown never
      // ships below the gate. Sections without a projector keep the hard lock.
      const projector = PREVIEW_PROJECTORS[col];
      if (projector) {
        o[col] = { preview: projector(o[col] as AnyObj) ?? null, locked: gate };
      } else {
        o[col] = { locked: gate };
      }
    }
  }

  // Field-level: hero is public, but the legacy score + diagnostics are free+.
  if (out.valueOffering && !isLocked(out.valueOffering) && rank < TIER_RANK.free) {
    const vo = out.valueOffering as ValueOffering;
    out.valueOffering = {
      ...vo,
      value_offering_score: null,
      legs: null,
      leg_provenance: null,
      locked_fields: ["value_offering_score", "legs", "leg_provenance"],
    };
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

/** Tickers to pre-render at build (the Phase-0 dossier set); rest are on-demand ISR. */
export const SEED_TICKERS = [
  "FCNTX", "DODGX", "FBGRX", "SEQUX", "VDIGX", "VOO", "FXAIX",
];
