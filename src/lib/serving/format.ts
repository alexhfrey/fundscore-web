// ============================================================================
// Display helpers for the /funds/[ticker] profile page.
// All values are formatted from the served fact row — never fabricated. A null
// in renders as an em-dash, never a guessed default.
// ============================================================================

export const EM_DASH = "—";

export function fmtPct(decimal: number | null | undefined, digits = 1): string {
  if (decimal == null || !isFinite(decimal)) return EM_DASH;
  return `${(decimal * 100).toFixed(digits)}%`;
}

/** Format a percentage already in percentage points (e.g. active_weight_pp). */
export function fmtPP(pp: number | null | undefined, digits = 1): string {
  if (pp == null || !isFinite(pp)) return EM_DASH;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(digits)} pp`;
}

export function fmtBps(bps: number | null | undefined, digits = 0): string {
  if (bps == null || !isFinite(bps)) return EM_DASH;
  return `${Math.round(bps).toFixed(digits)} bps`;
}

export function fmtSignedBps(bps: number | null | undefined): string {
  if (bps == null || !isFinite(bps)) return EM_DASH;
  const sign = bps > 0 ? "+" : bps < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(bps))} bps`;
}

export function fmtAum(dollars: number | null | undefined): string {
  if (dollars == null || !isFinite(dollars)) return EM_DASH;
  const b = dollars / 1e9;
  if (b >= 1) return `$${b.toFixed(1)}B`;
  const m = dollars / 1e6;
  if (m >= 1) return `$${m.toFixed(0)}M`;
  return `$${(dollars / 1e3).toFixed(0)}K`;
}

export function fmtDollars(dollars: number | null | undefined): string {
  if (dollars == null || !isFinite(dollars)) return EM_DASH;
  return `$${Math.round(dollars).toLocaleString()}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return EM_DASH;
  return d.slice(0, 10);
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !isFinite(n)) return EM_DASH;
  return n.toFixed(digits);
}

/** Signed beta, e.g. "+0.37" / "−0.58" — used for active/raw factor betas. */
export function fmtBeta(b: number | null | undefined, digits = 2): string {
  if (b == null || !isFinite(b)) return EM_DASH;
  const sign = b > 0 ? "+" : b < 0 ? "−" : "";
  return `${sign}${Math.abs(b).toFixed(digits)}`;
}

// --- Risk & Attribution (spec #13) — divergence state → label + chip. ---
// NEUTRAL framing: describes the bet, never a buy/sell verdict.
export function divergenceStateLabel(state: string | null | undefined): string {
  switch (state) {
    case "active_bet":
      return "Active bet";
    case "exposure_no_active_bet":
      return "Market exposure";
    case "active_bet_low_holdings":
      return "Active bet";
    case "minimal":
      return "Minimal";
    default:
      return EM_DASH;
  }
}

export function divergenceStateChip(state: string | null | undefined): string {
  switch (state) {
    case "active_bet":
    case "active_bet_low_holdings":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "exposure_no_active_bet":
      return "bg-slate-50 text-slate-600 border-slate-200";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

/** Curated theme/style target_id → human label fallback (exposure_name preferred). */
export function styleTargetLabel(targetId: string): string {
  const id = targetId.replace(/^style::/, "");
  switch (id) {
    case "SMB":
      return "Size (small minus big)";
    case "HML":
      return "Value (high minus low)";
    case "RMW":
      return "Profitability";
    case "CMA":
      return "Investment (conservative)";
    case "MOM":
    case "WML":
      return "Momentum";
    case "MKT":
    case "MKT-RF":
      return "Market";
    default:
      return id;
  }
}

/** Fee dollars per a notional, recomputable from the displayed bps. */
export function feeDollars(bps: number | null | undefined, notional: number): number | null {
  if (bps == null || !isFinite(bps)) return null;
  return (bps / 10000) * notional;
}

// --- Badge typology → visual treatment (Confident Consumer palette). ---
// The six v0.3 badges plus the passive/index case. Treatment is NEUTRAL: the
// badge describes the bet, not a buy/sell verdict.
export type BadgeTone = "edge" | "neutral" | "unproven" | "caution" | "index" | "building";

export function badgeStyle(badge: string | null | undefined): {
  tone: BadgeTone;
  chip: string;
  dot: string;
} {
  switch (badge) {
    case "Stock-picking edge":
      return {
        tone: "edge",
        chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "Mostly a sector/theme bet":
      return {
        tone: "neutral",
        chip: "bg-sky-50 text-sky-800 border-sky-200",
        dot: "bg-sky-500",
      };
    case "Selection unproven":
      return {
        tone: "unproven",
        chip: "bg-slate-50 text-slate-700 border-slate-200",
        dot: "bg-slate-400",
      };
    case "Costs more than it returns":
      return {
        tone: "caution",
        chip: "bg-amber-50 text-amber-800 border-amber-200",
        dot: "bg-amber-500",
      };
    case "Index in disguise":
      return {
        tone: "index",
        chip: "bg-indigo-50 text-indigo-800 border-indigo-200",
        dot: "bg-indigo-500",
      };
    case "Building track record":
      return {
        tone: "building",
        chip: "bg-gray-50 text-gray-600 border-gray-200",
        dot: "bg-gray-400",
      };
    default:
      return {
        tone: "neutral",
        chip: "bg-gray-50 text-gray-600 border-gray-200",
        dot: "bg-gray-400",
      };
  }
}

// --- Skill-evidence band → label + chip (non-predictive). ---
export function skillBandLabel(band: string | null | undefined): string {
  switch (band) {
    case "strong":
      return "Strong evidence";
    case "moderate":
      return "Moderate evidence";
    case "limited":
      return "Limited evidence";
    case "unproven":
      return "Unproven";
    default:
      return "Not available";
  }
}

export function skillBandChip(band: string | null | undefined): string {
  switch (band) {
    case "strong":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "moderate":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "limited":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "unproven":
      return "bg-slate-50 text-slate-600 border-slate-200";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

// --- Fee Fairness label → chip ---
export function fairnessChip(label: string | null | undefined): string {
  switch (label) {
    case "Strong":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Mixed":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Weak":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

// --- Manager Moves direction-of-impact → chip (never a quality grade). ---
export function managerMovesChip(label: string | null | undefined): string {
  switch (label) {
    case "Adding Value":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Mixed":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Subtracting Value":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-gray-50 text-gray-500 border-gray-200";
  }
}

/** Exposure-type → human label for X-Ray rows. */
export function exposureTypeLabel(t: string): string {
  switch (t) {
    case "theme":
      return "Theme";
    case "sector":
      return "Sector";
    case "stock":
      return "Stock";
    case "country_region":
      return "Region";
    case "style":
      return "Style";
    case "concentration":
      return "Concentration";
    case "asset_class":
      return "Asset class";
    case "fixed_income_characteristic":
      return "Fixed income";
    default:
      return t;
  }
}

/** Plain-English readout for a passive-relative exposure difference. */
export function exposureReadout(
  name: string,
  difference: number | null | undefined,
): string | null {
  if (difference == null || !isFinite(difference)) return null;
  const pp = difference * 100;
  if (Math.abs(pp) < 0.5) return `About the same ${name} exposure as the passive mix.`;
  const dir = pp > 0 ? "More" : "Less";
  return `${dir} ${name} than the passive mix (${pp > 0 ? "+" : "−"}${Math.abs(pp).toFixed(1)} pp).`;
}

// ============================================================================
// Plain-English verdict line (spec: plain-english-verdict-and-jargon-anchors).
// ----------------------------------------------------------------------------
// Nets the page's fee verdict against its skill verdict into ONE retail
// takeaway. Composed DETERMINISTICALLY from already-served, public hero fields
// (no free text from data, no 0-100 index reference). Returns null when any
// required field is missing → the hero renders nothing rather than a guess.
// The clause choices are driven off fee_fairness_label, the sign/size of
// active_fee_bps, and skill_band — never hard-coded to one fund's case.
// ============================================================================

/** Minimal shape composeVerdictLine reads — a subset of ValueOfferingReframed. */
export interface VerdictInputs {
  status: string | null;
  skill_band: string | null;
  fee: { active_fee_bps: number | null } | null;
}

/** The "cheap / fairly priced / expensive for an active fund" lead clause. */
function feeLeadClause(label: string | null | undefined): string | null {
  switch (label) {
    case "Strong":
      return "Cheap for an active fund";
    case "Mixed":
      return "Fairly priced for an active fund";
    case "Weak":
      return "Expensive for an active fund";
    default:
      return null;
  }
}

/**
 * Compose the netting verdict sentence from public hero fields.
 * @param vr the value_offering_reframed section (or a VerdictInputs subset)
 * @param feeFairnessLabel the top-level fee_fairness_label fact column
 * @returns the one-sentence verdict, or null if not scored / any field missing.
 */
export function composeVerdictLine(
  vr: VerdictInputs | null | undefined,
  feeFairnessLabel: string | null | undefined,
): string | null {
  // Only scored active funds get a verdict; passive/unsupported render nothing.
  if (!vr || vr.status !== "scored") return null;

  const lead = feeLeadClause(feeFairnessLabel);
  if (lead == null) return null;

  const bps = vr.fee?.active_fee_bps;
  if (bps == null || !isFinite(bps)) return null;

  const band = vr.skill_band;
  if (band == null) return null;

  // Fee clause: derive the bps premium from the served number (rounded), never
  // a hard-coded constant. A non-positive premium reads as "no premium".
  const roundedBps = Math.round(bps);
  const feeClause =
    roundedBps > 0
      ? `you pay a ${roundedBps} bps premium over indexing`
      : `you pay no premium over indexing`;

  // Skill clause: drives the "pays off / unproven / not paying off" read off the
  // judged-selection band. Neutral, non-predictive language.
  let skillClause: string;
  switch (band) {
    case "strong":
      skillClause =
        roundedBps > 0
          ? "and the stock-picking has a proven edge that justifies it"
          : "and the stock-picking has a proven edge";
      break;
    case "moderate":
      skillClause =
        roundedBps > 0
          ? "that the stock-picking has so far partly earned back"
          : "with moderate evidence the stock-picking adds value";
      break;
    case "limited":
      skillClause =
        roundedBps > 0
          ? "with only limited evidence the stock-picking has earned it back"
          : "with only limited evidence the stock-picking adds value";
      break;
    case "unproven":
      skillClause =
        roundedBps > 0
          ? "that only pays off if the stock-picking does, and right now the selection is unproven"
          : "and the selection is still unproven";
      break;
    default:
      return null;
  }

  return `${lead} — but ${feeClause} ${skillClause}.`;
}

// --- Bet-profile peer anchor (from exposure_xray vs_peer concentration rows) ---
// Reads the two peer-relative concentration stats by their vs_peer rows and
// returns them in a NON-pp format: active_share as a ratio, effective_positions
// as a plain count. Never run these through the pp DiffPill (the effective-
// positions delta is a raw count, not a weight fraction).
export interface PeerConcentrationRow {
  row_id?: string;
  exposure_id?: string;
  exposure_type?: string;
  holdings_baseline?: string | null;
  fund_exposure?: number | null;
  passive_exposure?: number | null;
}

export interface BetProfilePeerAnchor {
  activeShareFund: number | null;
  activeSharePeer: number | null;
  effPositionsFund: number | null;
  effPositionsPeer: number | null;
}

/**
 * Pull the two vs_peer concentration stats (active share + effective positions)
 * from the exposure_xray rows. Returns null when neither is present. The peer
 * value is the row's `passive_exposure` (= the peer-group reference).
 */
export function betProfilePeerAnchor(
  rows: PeerConcentrationRow[] | null | undefined,
): BetProfilePeerAnchor | null {
  if (!Array.isArray(rows)) return null;
  const find = (exposureId: string) =>
    rows.find(
      (r) =>
        r.exposure_type === "concentration" &&
        r.holdings_baseline === "vs_peer" &&
        r.exposure_id === exposureId,
    ) ?? null;

  const as = find("concentration::active_share");
  const ep = find("concentration::effective_positions");
  if (as == null && ep == null) return null;

  return {
    activeShareFund: num(as?.fund_exposure),
    activeSharePeer: num(as?.passive_exposure),
    effPositionsFund: num(ep?.fund_exposure),
    effPositionsPeer: num(ep?.passive_exposure),
  };
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}
