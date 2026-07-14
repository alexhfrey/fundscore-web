// ============================================================================
// Portfolio bulk-paste / CSV parser (Composition Editor, spec § Section 1).
// Tolerant of common copy/paste and brokerage-export shapes:
//   FCNTX, 60%
//   FCNTX<tab>60
//   FCNTX 60
//   Symbol,Description,Percent          <- header, skipped
//   FXAIX,FIDELITY 500 INDEX,40%        <- multi-column brokerage export
//   VTSAX,"VANGUARD TOTAL STOCK",$12,500.00
//
// Weights may be percentages or dollar amounts; the solver normalizes raw
// weights over the eligible rows either way, so we keep the raw number here.
//
// DELIMITER RULE (this is load-bearing): when a line is delimited (comma/tab),
// we split ONLY on that delimiter — never additionally on whitespace. A
// description column like "FIDELITY 500 INDEX" otherwise tokenizes into a stray
// number and gets read as the weight. That produced FXAIX @ 500% from a real
// brokerage CSV. A wrong weight is far worse than a rejected row: it silently
// mis-states the whole portfolio.
// ============================================================================
import type { PortfolioInput } from "./portfolio-solver";

export interface ParsedHolding extends PortfolioInput {
  raw: string;
}

/** A field that is ENTIRELY a number (allowing $, thousands commas, %). */
const FULL_NUM_RE = /^-?\s*\$?\s*\d[\d,]*\.?\d*\s*%?$/;
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;
const HEADER_RE =
  /^(TICKER|SYMBOL|FUND|NAME|HOLDING|ACCOUNT|SECURITY|DESCRIPTION)$/i;

function toNumber(field: string): number {
  return Number(field.replace(/[$,%\s]/g, ""));
}

/** Split a line into fields. Delimited lines split ONLY on their delimiter. */
function splitFields(line: string): string[] {
  const delimited = /[,\t]/.test(line);
  const parts = delimited ? line.split(/[,\t]/) : line.split(/\s+/);
  return parts.map((p) => p.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

/** Parse one-holding-per-line text into {ticker, weight} rows. Drops blank and
 * header-like lines; never throws. Returns rows even if weights don't sum to
 * 100 (the editor surfaces the remaining-weight warning; the solver normalizes).
 */
export function parsePortfolioText(text: string): ParsedHolding[] {
  const out: ParsedHolding[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let fields = splitFields(line);
    if (fields.length < 2) continue;

    const ticker = fields[0].toUpperCase();
    if (HEADER_RE.test(ticker)) continue; // header row
    if (!TICKER_RE.test(ticker)) continue;

    // A thousands separator can split a dollar amount across fields
    // ("$12", "500.00"). Re-join adjacent numeric fragments before scanning.
    fields = rejoinThousands(fields);

    // Candidate weights: fields (after the ticker) that are ENTIRELY numeric.
    // A description like "FIDELITY 500 INDEX" is not, so it can never win.
    const candidates: { value: number; isPercent: boolean }[] = [];
    for (let i = 1; i < fields.length; i++) {
      const f = fields[i];
      if (!FULL_NUM_RE.test(f)) continue;
      const value = toNumber(f);
      if (!isFinite(value) || value <= 0) continue;
      candidates.push({ value, isPercent: f.includes("%") });
    }
    if (candidates.length === 0) continue;

    // An explicit percentage is unambiguous — prefer it. Otherwise take the LAST
    // numeric column: brokerage exports trend Symbol, Desc, Qty, Value, Weight,
    // and the rightmost figure is the allocation. (Dollars are fine: the solver
    // normalizes raw weights.)
    const pct = candidates.filter((c) => c.isPercent);
    const chosen = pct.length
      ? pct[pct.length - 1]
      : candidates[candidates.length - 1];

    out.push({ ticker, weight: chosen.value, raw: line });
  }

  return out;
}

/** "$12" + "500.00" (split by a thousands comma) → "$12500.00". */
function rejoinThousands(fields: string[]): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const prev = out[out.length - 1];
    const isThousandsTail = /^\d{3}(\.\d+)?\s*%?$/.test(f);
    const prevIsBareNum = prev !== undefined && /^-?\$?\s*\d+$/.test(prev);
    if (prevIsBareNum && isThousandsTail) {
      out[out.length - 1] = prev + f;
    } else {
      out.push(f);
    }
  }
  return out;
}
