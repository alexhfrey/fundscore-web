// ============================================================================
// Query Results screener reader — DuckDB-on-Parquet (serving_architecture.md
// Decisions 1 + 6, T5a screener_engine_track4a).
// ----------------------------------------------------------------------------
// The screener/query-results path is COLUMNAR, not row-keyed: it ranks the
// fund universe by computed expressions. Per the locked serving architecture we
// read it through DuckDB-on-Parquet with raw, MotherDuck-compatible SQL — NOT
// through Drizzle/Postgres. In v0 a DuckDB instance is opened fresh per request
// over the local parquets; v1 swaps the source path for a MotherDuck connection
// string with no query rewrite (Decision 6).
//
// This reader serves the PRE-MATERIALIZED canonical results that T5a built:
//   - query_canonical_catalog.parquet  (15 canonical query specs)
//   - query_canonical_results.parquet  (140 ranked rows, 10 per query)
// It computes NO new metric — every value is inherited verbatim from the
// already-validated T5a panels. Nothing here is fabricated; a missing field
// renders as an em-dash upstream, never a guessed default.
// ============================================================================
import { DuckDBInstance } from "@duckdb/node-api";

export const PARSER_VERSION = "query_parser_v0.1";
export const RANKER_VERSION = "query_ranker_v0.1";

// v0: local parquet dir; v1: swap for a MotherDuck source (Decision 6).
// Parquets live in the fund_score data lake, not this repo (Decision: parquets
// stay in object storage / the lake, never bundled with the app).
const QUERY_DIR =
  process.env.QUERY_PARQUET_DIR ??
  "/Users/alexfrey/Projects/fund_score/data/product/query";

const CATALOG = `${QUERY_DIR}/query_canonical_catalog.parquet`;
const RESULTS = `${QUERY_DIR}/query_canonical_results.parquet`;
// Per-fund Value Score attributes (the screener base panel). Joined into the
// ranked rows on series_id so the card shows the value verdict. Only the
// QUALITATIVE verdict is selected (coverage + breakeven state + confidence +
// passive alt) — the precise paid figures (value_score_100/_bps) are never
// projected onto these public/ISR pages (verdict free, precision paid).
const SCREENER = `${QUERY_DIR}/screener_funds.parquet`;

// --- Row shapes (1:1 with the T5a parquet columns) -------------------------
export interface CatalogRow {
  canonical_id: string;
  query_slug: string;
  query_type: string;
  parsed_query_text: string;
  parsed_spec_hash: string;
  reference_frame: string | null;
  universe_size: number;
  result_count: number;
  primary_metric_label: string | null;
  refusal_reason: string | null;
  as_of: string | null;
  ranker_version: string;
  parser_version: string;
}

export interface ResultRow {
  rank: number;
  series_id: string;
  ticker: string;
  fund_name: string;
  wrapper_label: string;
  relevance_score: number;
  primary_metric_value: number | null;
  primary_metric_label: string;
  expense_ratio_bps: number | null;
  badge: string | null;
  why_basis_text: string;
  why_basis_source_fields: string | null;
  holdings_as_of: string | null;
  fund_profile_href: string;
  canonical_id: string;
  query_slug: string;
  query_type: string;
  // --- Value Score verdict (joined from screener_funds on series_id) ---
  // Qualitative only: the precise paid figures are deliberately not selected.
  value_coverage_state: string | null; // scored | too_new | not_comparable | fee_unavailable
  value_breakeven_state: string | null; // above | near | below (null when not scored)
  value_confidence: string | null; // high | limited
  value_passive_alt: string | null; // the passive alternative's ticker
}

export interface QueryPage {
  catalog: CatalogRow;
  rows: ResultRow[];
}

// DuckDB returns int64 columns as JS BigInt and DATE/TS as objects; coerce to
// plain JSON-serializable primitives so RSC payloads stay clean.
function coerce(v: unknown): unknown {
  if (typeof v === "bigint") return Number(v);
  if (v != null && typeof v === "object" && "toString" in v) {
    // DuckDB DATE/TIMESTAMP values stringify to ISO-ish text.
    const s = (v as { toString: () => string }).toString();
    return s;
  }
  return v;
}

function coerceRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) out[k] = coerce(row[k]);
  return out as T;
}

// SQL string-literal escaper. The screener path uses raw SQL (no Drizzle); user
// values flow as bound params, but DuckDB cannot bind a parameter inside
// read_parquet() / a path, so the constant path + any slug used in a literal is
// escaped here (single-quote doubling), matching the Python engine's `_lit`.
function lit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

type SqlParam = string | number;

async function withConn<T>(fn: (run: (sql: string, params?: SqlParam[]) => Promise<Record<string, unknown>[]>) => Promise<T>): Promise<T> {
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  const run = async (sql: string, params: SqlParam[] = []) => {
    const reader = params.length
      ? await conn.runAndReadAll(sql, params)
      : await conn.runAndReadAll(sql);
    return reader.getRowObjects() as Record<string, unknown>[];
  };
  try {
    return await fn(run);
  } finally {
    conn.closeSync();
  }
}

/** All canonical query specs (for generateStaticParams + the index). */
export async function getCanonicalCatalog(): Promise<CatalogRow[]> {
  return withConn(async (run) => {
    const rows = await run(
      `SELECT * FROM read_parquet(${lit(CATALOG)})
       WHERE query_type <> 'refusal'
       ORDER BY query_type, query_slug`,
    );
    return rows.map((r) => coerceRow<CatalogRow>(r));
  });
}

/** Every canonical slug (including the refusal placeholder), for routing. */
export async function getAllCatalog(): Promise<CatalogRow[]> {
  return withConn(async (run) => {
    const rows = await run(`SELECT * FROM read_parquet(${lit(CATALOG)})`);
    return rows.map((r) => coerceRow<CatalogRow>(r));
  });
}

/** Resolve a canonical /q/{slug} → catalog spec + ranked rows. */
export async function getQueryBySlug(slug: string): Promise<QueryPage | null> {
  return withConn(async (run) => {
    const cat = await run(
      `SELECT * FROM read_parquet(${lit(CATALOG)}) WHERE query_slug = ? LIMIT 1`,
      [slug],
    );
    if (cat.length === 0) return null;
    const catalog = coerceRow<CatalogRow>(cat[0]);
    // LEFT JOIN the Value Score verdict on series_id. The 3-state is derived in
    // SQL from value_score_100 with the SAME rule as the Python `_value_score`
    // (>50 above / <50 below / else near), so the screener and the fund page can
    // never disagree on which side of breakeven a fund sits. The precise score is
    // used only to derive the state here — it is NOT selected into the payload.
    const rows = await run(
      `SELECT r.*,
              s.value_coverage_state,
              s.value_confidence,
              s.value_passive_alt,
              CASE
                WHEN s.value_coverage_state = 'scored' AND s.value_score_100 > 50 THEN 'above'
                WHEN s.value_coverage_state = 'scored' AND s.value_score_100 < 50 THEN 'below'
                WHEN s.value_coverage_state = 'scored' THEN 'near'
                ELSE NULL
              END AS value_breakeven_state
       FROM read_parquet(${lit(RESULTS)}) r
       LEFT JOIN read_parquet(${lit(SCREENER)}) s ON r.series_id = s.series_id
       WHERE r.query_slug = ? ORDER BY r.rank`,
      [slug],
    );
    return { catalog, rows: rows.map((r) => coerceRow<ResultRow>(r)) };
  });
}

/** True if a slug exists in the canonical catalog (any type). */
export async function slugExists(slug: string): Promise<boolean> {
  return withConn(async (run) => {
    const rows = await run(
      `SELECT 1 FROM read_parquet(${lit(CATALOG)}) WHERE query_slug = ? LIMIT 1`,
      [slug],
    );
    return rows.length > 0;
  });
}
