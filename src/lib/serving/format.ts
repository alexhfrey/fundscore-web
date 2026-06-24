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
