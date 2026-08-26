// ============================================================================
// /screener select whitelist — PURE + db-free (the tier-safety surface).
// ----------------------------------------------------------------------------
// This module holds the ONLY column list the fund-universe screener may project
// out of `fund_profile_facts`, plus the three verdict CASE expressions. It is
// split out of `screener-universe.ts` for exactly the reason `gating.ts` is
// split out of `profile.ts`: `src/lib/db/index.ts` eagerly constructs a
// `postgres()` client at module scope off `process.env.DATABASE_URL!`, so any
// module that imports `db` drags a live client into its importers' graph. The
// golden tripwire (scripts/test/screener-select-golden.ts) must run in CI with
// no DATABASE_URL — a tier-safety check that cannot run is not a check — so it
// imports from HERE. Nothing below imports `db`; only the Drizzle schema mirror
// (column references, no connection) and `sql` from drizzle-orm.
//
// WHY A WHITELIST AND NOT A GATE. The profile page reads one fact row and runs
// it through `applyGates`, which strips paid fields. The screener is a LIST read
// and never goes through `applyGates`, so its safety cannot be "strip later" —
// it is "never fetch". The paid figures (`value_score_bps`, `value_score_100`,
// `value_bps_3y`, the gross/fee receipt inside `value_score`, `nav_series`) are
// NOT SELECTED AT ALL, at any tier. The payload is therefore tier-invariant and
// public-only, which is what makes the page safe to render without a session
// read. Consequence: no new GATED_SECTIONS entry exists, so the
// fail-open-on-missing-defaultGate class cannot arise here — the golden test
// guards the whitelist instead.
//
// P4 COHERENCE (beta-execution-plan.md § "P4 — ANSWERED 2026-08-08"): per-fund
// `value_bps_3y` is PAID on every surface. No sort key below is a paid or
// paid-derived figure (sort whitelist: ticker, name, fee, aum), so page order
// cannot be used to reconstruct an ordinal of a paid per-fund figure.
//
// THE SCORED PREDICATE (spec ADDENDUM 1 — binding). "Is this fund scored?" is
// `value_coverage_state = 'scored'` and nothing else. Measured on manifest 58:
//
//     value_coverage_state = 'scored'              2,233   correct
//     (value_score->>'scored')::boolean IS TRUE     2,233   identical, 0 disagreements
//     value_score IS NOT NULL                       3,875   WRONG, over by 1,642
//     value_score->>'passive_alt_label' IS NOT NULL  3,562   WRONG, over by 1,329
//
// `value_score` is a non-null JSONB object even for funds the pipeline
// explicitly REFUSES to score — it honestly carries `"scored": false` with every
// figure null (DYMIX, too_new, is the worked example) — so its presence means
// nothing. Worse, `passive_alt_label` is populated on 1,329 unscored funds, so a
// "vs SPY" caption keyed on label presence would assert a fee-vs-passive verdict
// for 1,329 funds this product deliberately declines to judge, 1,238 of them
// merely too new to have a record. Every verdict field below is therefore
// wrapped in `CASE WHEN value_coverage_state = 'scored'`, which is also exactly
// the pattern `screener.ts:172-178` already uses for /q/[slug].
// ============================================================================
import { sql } from "drizzle-orm";
// `.ts` extension on purpose: the golden test imports this module under Node's
// type-stripping ESM loader, which does not add extensions. See the note in
// db/schema/serving.ts and gating-golden.ts's header.
import { fundProfileFacts } from "../db/schema/serving.ts";

/**
 * The one scored predicate, as SQL. Every verdict projection and every verdict
 * filter routes through this so there is a single place the rule lives.
 * ADDENDUM 1: never `value_score IS NOT NULL`, never `passive_alt_label IS NOT NULL`.
 */
export const SCORED_STATE = "scored";

/** The only `value_score` sub-fields the screener may project. */
export const SCREENER_VERDICT_FIELDS = [
  "breakeven_state",
  "confidence",
  "passive_alt_label",
] as const;

export type ScreenerVerdictField = (typeof SCREENER_VERDICT_FIELDS)[number];

/**
 * A verdict field, suppressed to NULL unless the fund is actually scored.
 * Same shape as `screener.ts:172-178` so the /q/[slug] reader and this one
 * cannot drift apart on what "the public verdict" means. The field name is
 * emitted as a SQL literal (so the golden test can read it out of the SQL text)
 * and is typed to the closed `ScreenerVerdictField` union, so no caller-supplied
 * string can reach `sql.raw` — the compiler is the whitelist.
 */
function scoredOnly(field: ScreenerVerdictField) {
  return sql<string | null>`CASE WHEN ${fundProfileFacts.valueCoverageState} = ${SCORED_STATE}
    THEN ${fundProfileFacts.valueScore} ->> ${sql.raw(`'${field}'`)} END`;
}

/**
 * AUM lives in `identity.aum_usd`. Guarded with an explicit `jsonb_typeof` check
 * rather than a bare `::double precision` cast: the cast would throw for the
 * whole query if a non-numeric string ever appeared in that field. Measured on
 * manifest 58: 5,441 rows carry a `number`, 0 carry a non-numeric non-null — but
 * the guard is what keeps a future bad value an em-dash on one row instead of a
 * 500 on the page.
 */
export const AUM_USD = sql<number | null>`CASE
  WHEN jsonb_typeof(${fundProfileFacts.identity} -> 'aum_usd') = 'number'
  THEN (${fundProfileFacts.identity} ->> 'aum_usd')::double precision END`;

/**
 * The public whitelist. `screener-select-golden.ts` asserts set-equality against
 * SCREENER_SELECT_KEYS in both directions, so adding or renaming a key here
 * without updating that list fails the test.
 */
export const SCREENER_SELECT = {
  series_id: fundProfileFacts.seriesId,
  canonical_ticker: fundProfileFacts.canonicalTicker,
  fund_name: fundProfileFacts.fundName,
  fund_family: fundProfileFacts.fundFamily,
  vehicle_type: fundProfileFacts.vehicleType,
  management_style: fundProfileFacts.managementStyle,
  peer_group: fundProfileFacts.peerGroup,
  net_expense_ratio_bps: fundProfileFacts.netExpenseRatioBps,
  aum_usd: AUM_USD,
  value_coverage_state: fundProfileFacts.valueCoverageState,
  // --- the public verdict, scored-only (never a number) ---
  value_breakeven_state: scoredOnly("breakeven_state"),
  value_confidence: scoredOnly("confidence"),
  value_passive_alt: scoredOnly("passive_alt_label"),
} as const;

/** The whitelist, as a literal list — the golden test's other side of the equality. */
export const SCREENER_SELECT_KEYS = [
  "series_id",
  "canonical_ticker",
  "fund_name",
  "fund_family",
  "vehicle_type",
  "management_style",
  "peer_group",
  "net_expense_ratio_bps",
  "aum_usd",
  "value_coverage_state",
  "value_breakeven_state",
  "value_confidence",
  "value_passive_alt",
] as const;

/**
 * Keys that must NEVER appear in the select map. Non-empty by construction (the
 * golden test asserts that too — an empty forbidden list would make the
 * disjointness assertion vacuously true).
 */
export const SCREENER_FORBIDDEN_KEYS = [
  "valueScoreBps",
  "value_score_bps",
  "valueScore100",
  "value_score_100",
  "value_bps",
  "value_bps_3y",
  "score100",
  "gross_alpha_bps",
  "fee_bps",
  "passive_alt_fee_bps",
  "beta",
  "n_weeks",
  "replica_r2",
  "navSeries",
  "nav_series",
  "fundFamilyPanel",
  "teDecomposition",
] as const;

/**
 * THE scored predicate, in TypeScript, for the render path — the exact mirror of
 * the SQL `value_coverage_state = 'scored'`. Both the table's verdict chip and
 * the "vs {passive_alt_label}" caption route through this, and the golden test
 * asserts it against a fixture population that includes a deliberately seeded
 * trap row (non-scored, but carrying BOTH a `value_score` object AND a
 * `passive_alt_label`) — the two shapes that make the naive tests wrong.
 *
 * Do NOT reimplement this inline as `row.value_score != null` or
 * `row.value_passive_alt != null`. See the header for the measured cost of each.
 */
export function isScored(row: {
  value_coverage_state?: string | null | undefined;
}): boolean {
  return row.value_coverage_state === SCORED_STATE;
}

/**
 * Does this row get the "vs {passive_alt_label}" caption? ONLY inside the scored
 * branch — ADDENDUM 1 item 3. It re-checks the coverage state rather than
 * trusting the projection to have suppressed the label: if a future edit ever
 * un-suppressed `value_passive_alt`, this second gate still refuses to assert a
 * fee-vs-passive comparison for a fund the pipeline declines to judge. Belt and
 * braces on the one surface that would silently manufacture a verdict for 1,329
 * funds.
 */
export function showsPassiveAltCaption(row: {
  value_coverage_state?: string | null | undefined;
  value_passive_alt?: string | null | undefined;
}): boolean {
  return isScored(row) && Boolean(row.value_passive_alt);
}

export type ScreenerRow = {
  series_id: string;
  canonical_ticker: string | null;
  fund_name: string | null;
  fund_family: string | null;
  vehicle_type: string | null;
  management_style: string | null;
  peer_group: string | null;
  net_expense_ratio_bps: number | null;
  aum_usd: number | null;
  value_coverage_state: string | null;
  value_breakeven_state: string | null;
  value_confidence: string | null;
  value_passive_alt: string | null;
};

// ============================================================================
// URL PARAM VOCABULARY — closed sets, db-free, golden-tested.
// ----------------------------------------------------------------------------
// These live here, next to the select whitelist, for two reasons. (1) The SORT
// whitelist is itself a tier-safety surface: P4 makes per-fund `value_bps_3y`
// paid on every surface, so no paid or paid-derived figure may be sortable —
// page order must not reconstruct a gated ordinal. The golden test asserts
// SORT_KEYS is disjoint from the forbidden list. (2) The client controls need
// these vocabularies, and this module has no live db client in its import
// graph, so importing them cannot drag `postgres` into the browser bundle —
// which is exactly what happened when they lived in screener-universe.ts.
//
// Everything is a CLOSED set: an unrecognized value normalizes to "no filter"
// or the default and can never reach SQL. `q` is the one free-text input and
// is Drizzle-parameterized at the query site, never interpolated.
// ============================================================================

export const PAGE_SIZE = 50;

/** Sort keys the URL may name. Anything else falls back to DEFAULT_SORT. */
export const SORT_KEYS = ["aum", "fee", "ticker", "name"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_DIRS = ["asc", "desc"] as const;
export type SortDir = (typeof SORT_DIRS)[number];
export const DEFAULT_SORT: SortKey = "aum";
export const DEFAULT_DIR: SortDir = "desc";

/**
 * Verdict facet values. `above|near|below` are the scored breakeven states;
 * `not_scored` is every other coverage state. Deliberately NOT one-per-coverage-
 * state: the axis the owner named is the Value Score verdict, and the honest
 * answer for the rest is a single "we don't score this".
 */
export const VERDICT_KEYS = ["above", "near", "below", "not_scored"] as const;
export type VerdictKey = (typeof VERDICT_KEYS)[number];

export const VEHICLE_TYPES = ["ETF", "Mutual Fund", "Index Mutual Fund"] as const;
export const MANAGEMENT_STYLES = ["active", "passive"] as const;

/**
 * A single URL search param as Next actually supplies it.
 *
 * Next's `searchParams` is `Record<string, string | string[] | undefined>` — a
 * REPEATED param (`/screener?q=voo&q=spy`, which a hand-edited or shared link
 * produces) arrives as an array. Declaring these as bare `string` told
 * TypeScript that `.trim()` was safe when it was not, and `?q=voo&q=spy` threw
 * `TypeError: .trim is not a function` at request time — a 500 on a link a user
 * could legitimately share. Codex P2, 2026-08-26; reproduced before fixing.
 *
 * The other fields degraded safely by accident (`oneOf` array-vs-string
 * `.includes` is false, `Number([...])` is NaN), which is exactly the kind of
 * accident that stops being true when someone adds a field. So the type is
 * honest here and every read goes through `first()`.
 */
type ScreenerParam = string | string[] | undefined;

export interface ScreenerParams {
  q?: ScreenerParam;
  vehicle?: ScreenerParam;
  style?: ScreenerParam;
  verdict?: ScreenerParam;
  maxFeeBps?: ScreenerParam;
  sort?: ScreenerParam;
  dir?: ScreenerParam;
  page?: ScreenerParam;
}

/** First value of a possibly-repeated param — the conventional duplicate resolution. */
function first(raw: ScreenerParam): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

/** The normalized, already-validated shape the page renders its controls from. */
export interface ScreenerFilters {
  q: string;
  vehicle: string | null;
  style: string | null;
  verdict: VerdictKey | null;
  maxFeeBps: number | null;
  sort: SortKey;
  dir: SortDir;
  page: number;
}

// --- Param normalization -----------------------------------------------------
// Closed maps, not string passthrough: an unrecognized value becomes "no filter"
// or the default, and can never reach SQL. `q` is the one free-text input and is
// Drizzle-parameterized (never interpolated) below.

function oneOf<T extends string>(raw: string | undefined, allowed: readonly T[]): T | null {
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

function parseMaxFee(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function normalizeParams(params: ScreenerParams): ScreenerFilters {
  const pageRaw = Number(first(params.page));
  return {
    q: (first(params.q) ?? "").trim().slice(0, 64),
    vehicle: oneOf(first(params.vehicle), VEHICLE_TYPES),
    style: oneOf(first(params.style), MANAGEMENT_STYLES),
    verdict: oneOf(first(params.verdict), VERDICT_KEYS),
    maxFeeBps: parseMaxFee(first(params.maxFeeBps)),
    sort: oneOf(first(params.sort), SORT_KEYS) ?? DEFAULT_SORT,
    dir: oneOf(first(params.dir), SORT_DIRS) ?? DEFAULT_DIR,
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
  };
}
