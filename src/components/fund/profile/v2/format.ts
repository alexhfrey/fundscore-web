// ============================================================================
// Small v2-only display helpers. Pure formatting — no fabricated values.
// ============================================================================
import { EM_DASH } from "@/lib/serving/format";

/** ISO-3166 alpha-2 → full country name (labels only, never data). */
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  TW: "Taiwan",
  KY: "Cayman Islands",
  GB: "United Kingdom",
  CH: "Switzerland",
  JP: "Japan",
  IE: "Ireland",
  NL: "Netherlands",
  FR: "France",
  DE: "Germany",
  CN: "China",
  HK: "Hong Kong",
  IN: "India",
  BR: "Brazil",
  KR: "South Korea",
  IL: "Israel",
  BM: "Bermuda",
  LU: "Luxembourg",
  SE: "Sweden",
  DK: "Denmark",
  AU: "Australia",
  SG: "Singapore",
};

/** Full country name for an ISO code, falling back to the code itself. */
export function countryName(code: string | null | undefined): string {
  if (!code) return EM_DASH;
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

/** "2026-04" or "2026-04-09" → "Apr 2026". Defensive; returns input on parse fail. */
export function monthYear(d: string | null | undefined): string {
  if (!d) return EM_DASH;
  const m = /^(\d{4})-(\d{2})/.exec(d);
  if (!m) return d;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Signed percentage-points from a percentage-point number, e.g. 12.8 → "+12.8 pp". */
export function ppSigned(pp: number | null | undefined, digits = 1): string {
  if (pp == null || !isFinite(pp)) return EM_DASH;
  const sign = pp > 0 ? "+" : pp < 0 ? "−" : "";
  return `${sign}${Math.abs(pp).toFixed(digits)} pp`;
}

/** Signed integer bps, e.g. 177 → "+177", -27 → "−27" (no unit suffix). */
export function bpsSigned(bps: number | null | undefined): string {
  if (bps == null || !isFinite(bps)) return EM_DASH;
  const sign = bps > 0 ? "+" : bps < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(bps))}`;
}

/** Curated FCNTX factor_id → human label (labels only, never data). */
const FACTOR_LABELS: Record<string, string> = {
  "sector::communication_services": "Communication Services",
  "sector::technology": "Technology",
  "theme::mag_7": "Magnificent 7",
  "theme::semiconductors_broad": "Semiconductors",
  "macro::credit_hy": "High-yield credit sensitivity",
  "theme::ev_battery_chain": "EVs & Battery Supply",
};

/** Human label for a factor_id, falling back to a generic humanization. */
export function factorLabel(id: string | null | undefined): string {
  if (!id) return EM_DASH;
  if (FACTOR_LABELS[id]) return FACTOR_LABELS[id];
  return id
    .replace(/^[a-z]+::/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "sector" → "Sector bets" label for the waterfall category rows. */
export function categoryLabel(type: string): string {
  switch (type) {
    case "sector":
      return "Sector bets";
    case "theme":
      return "Theme bets";
    case "macro":
      return "Macro bets";
    default:
      return type;
  }
}

/** Ordinal for a percentile, e.g. 2 → "2nd", 67 → "67th". */
export function ordinal(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return EM_DASH;
  const r = Math.round(n);
  const s = ["th", "st", "nd", "rd"];
  const v = r % 100;
  return r + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
