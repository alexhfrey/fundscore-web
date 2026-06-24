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

export interface FeeFairness {
  fee_fairness_label: string | null;
  gap_bps: number | null;
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
  fees: Record<string, unknown> | null;
  passiveBaseline: PassiveBaseline | null;
  performance: Record<string, unknown> | null;
  riskBehavior: Record<string, unknown> | null;
  holdings: Record<string, unknown> | null;
  managerParent: Record<string, unknown> | null;
  sourceInventory: Record<string, unknown>;
  exposureXray: Record<string, unknown> | null;
  alternatives: Record<string, unknown> | null;
  takeaways: Record<string, unknown> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Each gated section: `col` is the Drizzle (camelCase) column; `gate` is the
// section_id key inside the `gates` JSONB (snake_case, from the Python loader).
const GATED_SECTIONS: { col: string; gate: string }[] = [
  { col: "identity", gate: "identity" },
  { col: "valueOffering", gate: "value_offering" },
  { col: "fees", gate: "fees" },
  { col: "passiveBaseline", gate: "passive_baseline" },
  { col: "performance", gate: "performance" },
  { col: "riskBehavior", gate: "risk_behavior" },
  { col: "holdings", gate: "holdings" },
  { col: "managerParent", gate: "manager_parent" },
  { col: "sourceInventory", gate: "source_inventory" },
  { col: "exposureXray", gate: "exposure_xray" },
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

  // Field-level: hero is public, but the score + diagnostics are free+.
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

  return out;
}

/** Tickers to pre-render at build (the Phase-0 dossier set); rest are on-demand ISR. */
export const SEED_TICKERS = [
  "FCNTX", "DODGX", "FBGRX", "SEQUX", "VDIGX", "VOO", "FXAIX",
];
