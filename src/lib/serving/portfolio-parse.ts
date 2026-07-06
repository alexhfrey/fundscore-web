// ============================================================================
// Portfolio bulk-paste parser (Composition Editor, spec § Section 1).
// Tolerant of common copy/paste shapes: "TICKER, WEIGHT", "TICKER WEIGHT",
// "TICKER<tab>WEIGHT", a leading "$", a trailing "%", and a header row. Weights
// may be percentages or dollar amounts; the solver normalizes raw weights over
// the eligible rows either way, so we keep the raw number here.
// ============================================================================
import type { PortfolioInput } from "./portfolio-solver";

export interface ParsedHolding extends PortfolioInput {
  raw: string;
}

const NUM_RE = /-?\$?\s*[\d,]*\.?\d+\s*%?/;

/** Parse one-holding-per-line text into {ticker, weight} rows. Drops blank and
 * header-like lines; never throws. Returns rows even if weights don't sum to
 * 100 (the editor surfaces the remaining-weight warning; the solver normalizes).
 */
export function parsePortfolioText(text: string): ParsedHolding[] {
  const out: ParsedHolding[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Split on comma, tab, or run of spaces.
    const parts = line.split(/[,\t]|\s{2,}|\s+/).filter(Boolean);
    if (parts.length < 1) continue;
    const ticker = parts[0].trim().toUpperCase();
    // Skip header rows like "TICKER, WEIGHT" / "SYMBOL, %"
    if (/^(TICKER|SYMBOL|FUND|NAME|HOLDING)$/i.test(ticker)) continue;
    if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) continue;

    // Find the first number-looking token after the ticker.
    let weight = NaN;
    for (let i = 1; i < parts.length; i++) {
      const m = parts[i].match(NUM_RE);
      if (m) {
        weight = Number(m[0].replace(/[$,%\s]/g, ""));
        break;
      }
    }
    if (!isFinite(weight)) continue;
    if (weight <= 0) continue;
    out.push({ ticker, weight, raw: line });
  }
  return out;
}
