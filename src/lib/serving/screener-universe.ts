// ============================================================================
// Fund-universe screener reader — Postgres over `fund_profile_facts` (F7).
// ----------------------------------------------------------------------------
// This replaces the pre-pivot demo table that `/screener` used to read: 25
// hand-written rows carrying an invented 0-100 score, an invented "Strong Buy"
// label, invented trailing returns and an invented analyst write-up — under real
// tickers. Every value this module returns is a column of the served fact row.
// Nothing is derived, defaulted or imputed; a missing figure comes back null and
// renders as an em-dash or an honest state label.
//
// NOT `screener.ts`. That module is the canonical-QUERY reader (`/q/[slug]`,
// `/search`, `/lens/[slug]`) over the 15-catalog / 140-result pre-ranked panels
// — a fixed menu, intentionally frozen API. It cannot serve a filterable
// 5,722-fund universe and stays untouched.
//
// TIER SAFETY lives in `./screener-select.ts` (db-free, golden-tested): the
// select map is a public-only whitelist and the paid figures are never fetched
// at any tier. Read that file's header before changing anything here. Because
// the payload is tier-invariant this module and the page take NO session read.
//
// URL-DRIVEN BY DESIGN. Every filter/sort/page input arrives as a searchParam
// and is normalized here, so `exposure-screener` can later add exposure facets
// as another param family without reworking the surface (spec, § redesign-
// collision check).
//
// INDEXES: none added. 5,819 rows / ~14 projected columns is a millisecond seq
// scan; `fpf_ticker_idx` already exists for the ticker predicate. No schema
// change, no mirror change, no fund_score change.
// ============================================================================
import { and, asc, desc, eq, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { fundProfileFacts } from "../db/schema/serving";
import {
  AUM_USD,
  PAGE_SIZE,
  SCORED_STATE,
  SCREENER_SELECT,
  normalizeParams,
  type ScreenerFilters,
  type ScreenerParams,
  type ScreenerRow,
  type SortDir,
  type SortKey,
  type VerdictKey,
} from "./screener-select.ts";

export type { ScreenerRow };

export {
  PAGE_SIZE,
  SORT_KEYS,
  SORT_DIRS,
  DEFAULT_SORT,
  DEFAULT_DIR,
  VERDICT_KEYS,
  VEHICLE_TYPES,
  MANAGEMENT_STYLES,
  normalizeParams,
} from "./screener-select.ts";
export type { SortKey, SortDir, VerdictKey, ScreenerParams, ScreenerFilters };

/**
 * Live universe counts for the caption. Never hardcoded — a manifest reload
 * moves these, and a caption that lies about its own denominator is the same
 * class of defect this page exists to remove.
 */
export interface ScreenerUniverse {
  served: number;
  routable: number;
  excludedNoTicker: number;
  scored: number;
}

export interface ScreenerPage {
  rows: ScreenerRow[];
  total: number;
  filters: ScreenerFilters;
  universe: ScreenerUniverse;
}

// --- Predicates --------------------------------------------------------------

/**
 * The base predicate. `canonical_ticker IS NOT NULL` excludes the 97 series that
 * have no public ticker (variable-insurance-trust separate accounts) — they
 * cannot route to /funds/[ticker] at all. The exclusion is DISCLOSED with a live
 * count in the page caption; the denominator is never silently shrunk.
 */
const ROUTABLE = isNotNull(fundProfileFacts.canonicalTicker);

/**
 * Verdict → predicate. ADDENDUM 1, binding: "scored" is
 * `value_coverage_state = 'scored'` and nothing else. Never `value_score IS NOT
 * NULL` (3,875 — over by 1,642) and never `passive_alt_label IS NOT NULL`
 * (3,562 — over by 1,329, which would surface a fee-vs-passive verdict for 1,329
 * funds this product declines to judge).
 */
function verdictPredicate(verdict: VerdictKey): SQL {
  if (verdict === "not_scored") {
    return ne(fundProfileFacts.valueCoverageState, SCORED_STATE);
  }
  return and(
    eq(fundProfileFacts.valueCoverageState, SCORED_STATE),
    sql`${fundProfileFacts.valueScore} ->> 'breakeven_state' = ${verdict}`,
  )!;
}

function buildWhere(f: ScreenerFilters): SQL {
  const parts: (SQL | undefined)[] = [ROUTABLE];

  if (f.q) {
    // Parameterized LIKE: the pattern is a bound value, never string-interpolated
    // into the statement. `%` / `_` inside the user's text are escaped so a typed
    // wildcard cannot widen the match beyond what was typed.
    const pattern = `%${f.q.replace(/([\\%_])/g, "\\$1")}%`;
    parts.push(
      or(
        sql`${fundProfileFacts.canonicalTicker} ILIKE ${pattern}`,
        sql`${fundProfileFacts.fundName} ILIKE ${pattern}`,
        sql`${fundProfileFacts.fundFamily} ILIKE ${pattern}`,
      ),
    );
  }
  if (f.vehicle) parts.push(eq(fundProfileFacts.vehicleType, f.vehicle));
  if (f.style) parts.push(eq(fundProfileFacts.managementStyle, f.style));
  if (f.verdict) parts.push(verdictPredicate(f.verdict));
  if (f.maxFeeBps != null) {
    // A max-fee filter drops rows with no served fee: an unknown fee is not
    // evidence of a fee below the cap. They stay visible with an em-dash when
    // the filter is off.
    parts.push(sql`${fundProfileFacts.netExpenseRatioBps} <= ${f.maxFeeBps}`);
  }
  return and(...parts)!;
}

/**
 * Sort → ORDER BY, through a CLOSED map. NULLS LAST in both directions (a fund
 * with no served fee or no AUM never leads the table), with `series_id` as a
 * deterministic tiebreak so page 1 and page 2 can never overlap or drop a row.
 * No paid or paid-derived figure is sortable — P4 coherence: page order must not
 * reconstruct an ordinal of a gated per-fund figure.
 */
function buildOrderBy(f: ScreenerFilters): SQL[] {
  const column =
    f.sort === "fee"
      ? fundProfileFacts.netExpenseRatioBps
      : f.sort === "ticker"
        ? fundProfileFacts.canonicalTicker
        : f.sort === "name"
          ? fundProfileFacts.fundName
          : AUM_USD;
  const dir = f.dir === "asc" ? asc(column) : desc(column);
  return [sql`${dir} NULLS LAST`, asc(fundProfileFacts.seriesId)];
}

// --- Reads -------------------------------------------------------------------

/**
 * Universe counts for the caption, computed live in ONE pass. Keyed on
 * `series_id` (`count(*)`), NOT on `canonical_ticker` — a count keyed on the
 * ticker silently undercounts by the 97 unroutable rows, which is precisely the
 * number this caption exists to disclose.
 */
export async function getScreenerUniverse(): Promise<ScreenerUniverse> {
  const [row] = await db
    .select({
      served: sql<number>`count(*)::int`,
      routable: sql<number>`count(${fundProfileFacts.canonicalTicker})::int`,
      scored: sql<number>`count(*) FILTER (WHERE ${fundProfileFacts.valueCoverageState} = ${SCORED_STATE})::int`,
    })
    .from(fundProfileFacts);
  return {
    served: row?.served ?? 0,
    routable: row?.routable ?? 0,
    excludedNoTicker: (row?.served ?? 0) - (row?.routable ?? 0),
    scored: row?.scored ?? 0,
  };
}

/** One page of the routable universe + the matching total + the live universe. */
export async function getScreenerPage(params: ScreenerParams): Promise<ScreenerPage> {
  const filters = normalizeParams(params);
  const where = buildWhere(filters);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(fundProfileFacts)
    .where(where);
  const total = countRow?.total ?? 0;

  // Clamp an out-of-range page to the last real page rather than serving an
  // empty table for a page that does not exist. An empty RESULT SET (a filter
  // combo that matches nothing) still legitimately yields page 1 of 0 rows.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, lastPage);

  const rows = await db
    .select(SCREENER_SELECT)
    .from(fundProfileFacts)
    .where(where)
    .orderBy(...buildOrderBy(filters))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const universe = await getScreenerUniverse();

  return {
    rows: rows as ScreenerRow[],
    total,
    filters: { ...filters, page },
    universe,
  };
}
