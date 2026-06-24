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
}

export type Section<T> = T | Locked | null;

export function isLocked(v: unknown): v is Locked {
  return typeof v === "object" && v !== null && "locked" in v;
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
  beta_active_mkt: number | null; // the active bet (market stripped) — the lead
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
  beta_active_mkt: number | null; // the active bet
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
      o[col] = { locked: gate };
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
