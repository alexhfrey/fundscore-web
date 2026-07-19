import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { BlendLeg, PortfolioInput, SolverRow } from "./portfolio-solver";

// ============================================================================
// PORTFOLIO LOOK-THROUGH — the stocks you actually own, across all your funds.
//
// Buying five funds does not buy five portfolios: the same mega-cap names sit
// near the top of most of them. This resolves each fund to its as-filed SEC
// position list and aggregates to the stock level, so a holder can see the true
// weight of a single company across the whole book — and how many of their
// funds are buying it.
//
// DATA-INTEGRITY RULES (these are the whole point of the feature):
//   • Weights are a share of the ENTERED portfolio and are NEVER renormalised.
//     If we can only see through 70% of the book, the numbers sum to 70% and we
//     say so. Renormalising would silently inflate every figure.
//   • A fund that resolves but has no served positions is reported by name, not
//     dropped. Silently dropping it is the exact defect this feature exposes.
//   • The comparison column is the SOLVED passive blend, on the same basis — so
//     "concentrated" always means concentrated *relative to the alternative*,
//     never in the abstract.
//
// Runs off Postgres only (fund_holdings_full), so it is fast and — unlike the
// CVXPY blend solve — it still works when the blend itself is suppressed.
// ============================================================================

export interface LookThroughStock {
  ticker: string;
  name: string | null;
  /** % of the entered portfolio, via look-through. Not renormalised. */
  portfolio_pct: number;
  /** Same stock's weight in the solved passive blend, or null if unavailable. */
  blend_pct: number | null;
  /** portfolio_pct − blend_pct, in percentage points. */
  difference: number | null;
  /** How many of the user's own funds hold this name. The "you own it N times" read. */
  held_by_funds: number;
  /** WHICH of the user's funds hold this name (entered tickers), ordered to match `funds`. */
  held_by: string[];
  /** This stock's weight IN each fund that holds it (% of that fund's NAV), fund-ordered.
   * Lets the UI show materiality — a 7%-of-fund core vs a sub-1% sliver — honestly. */
  by_fund: { ticker: string; weight_pct: number }[];
}

export interface LookThroughFundNote {
  ticker: string;
  weight_pct: number;
  reason: "unresolved" | "no_positions";
}

export interface LookThroughCountry {
  code: string;
  portfolio_pct: number;
  blend_pct: number | null;
  difference: number | null;
}

export interface LookThrough {
  coverage_state: "available" | "partial" | "missing";
  /** Share of the entered book we could see through to positions. */
  covered_weight_pct: number;
  /** Share of the entered book sitting in identifiable individual stocks. */
  equity_weight_pct: number;
  /** Funds we could not look through, with the weight they carry. Never hidden. */
  excluded: LookThroughFundNote[];
  /** How many funds we did look through. */
  funds_covered: number;
  /** The funds we looked through, ordered by portfolio weight — the columns of the overlap grid. */
  funds: { ticker: string; name: string | null }[];
  distinct_stocks: number;
  top: LookThroughStock[];
  /** Combined weight of the top 10 names — portfolio vs the passive blend. */
  top10_portfolio_pct: number;
  top10_blend_pct: number | null;
  /**
   * Where in the world the money actually sits. Safe to derive from holdings:
   * `country` is 100% populated across all 1.3M served equity positions.
   *
   * NOTE: we deliberately do NOT derive a sector look-through the same way —
   * holdings.sector is ~43% null (the known foreign-classification gap), so a
   * holdings-derived sector split would quietly under-report every non-US name.
   * Sector stays on the solver's own reference-mapped row.
   */
  countries: LookThroughCountry[];
  as_of_min: string | null;
  as_of_max: string | null;
}

interface HoldingRow {
  series_id: string;
  security_ticker: string;
  security_name: string | null;
  weight_pct: number;
  country: string | null;
  as_of: string;
}

interface BlendHoldingRow {
  canonical_ticker: string;
  security_ticker: string;
  weight_pct: number;
  country: string | null;
}

// The summary UI shows ~10; the rest feed the "see all holdings" drill-down. A
// broad index book has thousands of names — we return the top slice by weight
// (which carries the vast majority of the book) and disclose the untracked tail.
const TOP_N = 60;

/**
 * Aggregate the as-filed positions of every fund in the book to the stock level.
 *
 * `input` carries the user's weights — the solver does NOT echo weight_pct back
 * on its rows (they come back null), so the entered weights are the only honest
 * source. `rows` supplies the ticker → series_id resolution the solver performed.
 */
export async function computeLookThrough(
  input: PortfolioInput[],
  rows: SolverRow[],
  blend: BlendLeg[],
): Promise<LookThrough> {
  const seriesByTicker = new Map<string, string>();
  for (const r of rows) {
    if (r.resolution_state === "resolved" && r.series_id) {
      seriesByTicker.set(r.raw_ticker.toUpperCase(), r.series_id);
    }
  }

  // Normalise the entered weights to fractions of the whole book.
  const totalWeight = input.reduce((s, h) => s + h.weight, 0);
  if (totalWeight <= 0) {
    return empty();
  }

  const excluded: LookThroughFundNote[] = [];
  const wantSeries = new Map<string, { ticker: string; frac: number }>();

  for (const h of input) {
    const tk = h.ticker.toUpperCase();
    const pct = (h.weight / totalWeight) * 100;
    const sid = seriesByTicker.get(tk);
    if (!sid) {
      excluded.push({ ticker: tk, weight_pct: pct, reason: "unresolved" });
      continue;
    }
    // Two share classes of one series would collide; fold their weights.
    const prev = wantSeries.get(sid);
    wantSeries.set(sid, {
      ticker: tk,
      frac: (prev?.frac ?? 0) + h.weight / totalWeight,
    });
  }

  if (wantSeries.size === 0) return empty(excluded);

  const holdings = await fetchHoldings([...wantSeries.keys()]);

  // A fund that resolved but has no served positions is named, never dropped.
  const seriesWithRows = new Set(holdings.map((h) => h.series_id));
  for (const [sid, meta] of wantSeries) {
    if (!seriesWithRows.has(sid)) {
      excluded.push({
        ticker: meta.ticker,
        weight_pct: meta.frac * 100,
        reason: "no_positions",
      });
    }
  }

  const covered = [...wantSeries.entries()]
    .filter(([sid]) => seriesWithRows.has(sid))
    .reduce((s, [, m]) => s + m.frac, 0);

  if (covered <= 0) return empty(excluded);

  // Map each looked-through series to the user's entered ticker + fund name, and
  // fix a stable column order (by portfolio weight) for the overlap grid.
  const sidToName = new Map<string, string | null>();
  for (const rr of rows) if (rr.series_id) sidToName.set(rr.series_id, rr.display_name);
  const funds = [...wantSeries.entries()]
    .filter(([sid]) => seriesWithRows.has(sid))
    .sort((a, b) => b[1].frac - a[1].frac)
    .map(([sid, meta]) => ({ ticker: meta.ticker, name: sidToName.get(sid) ?? null }));
  const sidToTicker = new Map<string, string>(
    [...wantSeries.entries()].map(([sid, meta]) => [sid, meta.ticker]),
  );
  const fundOrder = new Map(funds.map((f, i) => [f.ticker, i]));

  // --- Aggregate the user's book to the stock level -------------------------
  const agg = new Map<
    string,
    { name: string | null; pct: number; fundsW: Map<string, number> }
  >();
  const byCountry = new Map<string, number>();
  let asOfMin: string | null = null;
  let asOfMax: string | null = null;

  for (const h of holdings) {
    const frac = wantSeries.get(h.series_id)?.frac ?? 0;
    if (frac <= 0) continue;
    // weight_pct is % of that fund's NAV; frac is the fund's share of the book.
    const contribution = frac * h.weight_pct;
    const cur = agg.get(h.security_ticker) ?? {
      name: h.security_name,
      pct: 0,
      fundsW: new Map<string, number>(),
    };
    cur.pct += contribution;
    cur.fundsW.set(h.series_id, (cur.fundsW.get(h.series_id) ?? 0) + h.weight_pct);
    if (!cur.name && h.security_name) cur.name = h.security_name;
    agg.set(h.security_ticker, cur);

    if (h.country) {
      byCountry.set(h.country, (byCountry.get(h.country) ?? 0) + contribution);
    }

    const d = String(h.as_of).slice(0, 10);
    if (!asOfMin || d < asOfMin) asOfMin = d;
    if (!asOfMax || d > asOfMax) asOfMax = d;
  }

  // --- The same aggregation for the solved passive blend --------------------
  const blendMaps = await blendLookThrough(blend);
  const blendPct = blendMaps?.stocks ?? null;

  const ranked = [...agg.entries()].sort((a, b) => b[1].pct - a[1].pct);

  const top: LookThroughStock[] = ranked.slice(0, TOP_N).map(([ticker, d]) => {
    const bp = blendPct?.get(ticker) ?? (blendPct ? 0 : null);
    const byFund = [...d.fundsW.entries()]
      .map(([sid, w]) => ({ ticker: sidToTicker.get(sid), weight_pct: round2(w) }))
      .filter((e): e is { ticker: string; weight_pct: number } => !!e.ticker)
      .sort((a, b) => (fundOrder.get(a.ticker) ?? 99) - (fundOrder.get(b.ticker) ?? 99));
    return {
      ticker,
      name: d.name,
      portfolio_pct: round2(d.pct),
      blend_pct: bp === null ? null : round2(bp),
      difference: bp === null ? null : round2(d.pct - bp),
      held_by_funds: byFund.length,
      held_by: byFund.map((e) => e.ticker),
      by_fund: byFund,
    };
  });

  const top10 = ranked.slice(0, 10);
  const top10Portfolio = top10.reduce((s, [, d]) => s + d.pct, 0);
  const top10Blend = blendPct
    ? top10.reduce((s, [t]) => s + (blendPct.get(t) ?? 0), 0)
    : null;

  const equityWeight = ranked.reduce((s, [, d]) => s + d.pct, 0);

  // Geography. Every served equity position carries a country, so this is a
  // complete split of the equity we can see — no silent "unclassified" bucket.
  const countries: LookThroughCountry[] = [...byCountry.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60) // ~all; the summary shows the top 6, the drill-down the rest
    .map(([code, pct]) => {
      const bp = blendMaps?.countries.get(code) ?? (blendMaps ? 0 : null);
      return {
        code,
        portfolio_pct: round2(pct),
        blend_pct: bp === null ? null : round2(bp),
        difference: bp === null ? null : round2(pct - bp),
      };
    });

  return {
    coverage_state: excluded.length === 0 ? "available" : "partial",
    covered_weight_pct: round2(covered * 100),
    equity_weight_pct: round2(equityWeight),
    excluded,
    funds_covered: seriesWithRows.size,
    funds,
    distinct_stocks: ranked.length,
    top,
    top10_portfolio_pct: round2(top10Portfolio),
    top10_blend_pct: top10Blend === null ? null : round2(top10Blend),
    countries,
    as_of_min: asOfMin,
    as_of_max: asOfMax,
  };
}

/* -------------------------------------------------------------------------- */

async function fetchHoldings(seriesIds: string[]): Promise<HoldingRow[]> {
  const res = await db.execute(sql`
    SELECT series_id, security_ticker, security_name, weight_pct, country, as_of
    FROM fund_holdings_full
    WHERE series_id IN (${sql.join(
      seriesIds.map((s) => sql`${s}`),
      sql`, `,
    )})
      AND asset_cat = 'EC'
      AND security_ticker IS NOT NULL
      AND weight_pct IS NOT NULL
  `);
  return (res as unknown as Record<string, unknown>[]).map((r) => ({
    series_id: String(r.series_id),
    security_ticker: String(r.security_ticker),
    security_name: r.security_name == null ? null : String(r.security_name),
    weight_pct: Number(r.weight_pct),
    country: r.country == null ? null : String(r.country),
    as_of: String(r.as_of),
  }));
}

interface BlendMaps {
  stocks: Map<string, number>;
  countries: Map<string, number>;
}

/** The blend's own look-through, on the same basis. Null if it can't be built. */
async function blendLookThrough(blend: BlendLeg[]): Promise<BlendMaps | null> {
  const legs = blend.filter((b) => b.etf_ticker && b.weight_pct > 0);
  if (legs.length === 0) return null;

  const res = await db.execute(sql`
    SELECT canonical_ticker, security_ticker, weight_pct, country
    FROM fund_holdings_full
    WHERE canonical_ticker IN (${sql.join(
      legs.map((l) => sql`${l.etf_ticker.toUpperCase()}`),
      sql`, `,
    )})
      AND asset_cat = 'EC'
      AND security_ticker IS NOT NULL
      AND weight_pct IS NOT NULL
  `);
  const raw = res as unknown as Record<string, unknown>[];
  if (raw.length === 0) return null;

  const rows: BlendHoldingRow[] = raw.map((r) => ({
    canonical_ticker: String(r.canonical_ticker),
    security_ticker: String(r.security_ticker),
    weight_pct: Number(r.weight_pct),
    country: r.country == null ? null : String(r.country),
  }));

  // Only count legs we can actually see through; a leg with no served positions
  // (e.g. SPY, which files as a UIT) must not be treated as 0% exposure.
  const seen = new Set(rows.map((r) => r.canonical_ticker));
  const usable = legs.filter((l) => seen.has(l.etf_ticker.toUpperCase()));
  const usableWeight = usable.reduce((s, l) => s + l.weight_pct, 0);
  if (usableWeight <= 0) return null;

  const stocks = new Map<string, number>();
  const countries = new Map<string, number>();
  for (const r of rows) {
    const leg = usable.find(
      (l) => l.etf_ticker.toUpperCase() === r.canonical_ticker,
    );
    if (!leg) continue;
    // Rescale across the legs we can see, so the blend column is a like-for-like
    // 100%-of-blend basis rather than silently under-counting.
    const frac = leg.weight_pct / usableWeight;
    stocks.set(
      r.security_ticker,
      (stocks.get(r.security_ticker) ?? 0) + frac * r.weight_pct,
    );
    if (r.country) {
      countries.set(
        r.country,
        (countries.get(r.country) ?? 0) + frac * r.weight_pct,
      );
    }
  }
  return { stocks, countries };
}

function empty(excluded: LookThroughFundNote[] = []): LookThrough {
  return {
    coverage_state: "missing",
    covered_weight_pct: 0,
    equity_weight_pct: 0,
    excluded,
    funds_covered: 0,
    funds: [],
    distinct_stocks: 0,
    top: [],
    top10_portfolio_pct: 0,
    top10_blend_pct: null,
    countries: [],
    as_of_min: null,
    as_of_max: null,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
