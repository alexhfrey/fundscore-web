// ============================================================================
// Query Results screener reader — Postgres (screener-beta-port, 2026-08-07).
// ----------------------------------------------------------------------------
// This reader serves the PRE-MATERIALIZED canonical results that T5a built:
//   - query_canonical_catalog  (15 canonical query specs)
//   - query_canonical_results  (140 ranked rows, 10 per non-refusal query)
// It computes NO new metric — every value is inherited verbatim from the
// already-validated T5a panels. Nothing here is fabricated; a missing field
// renders as an em-dash upstream, never a guessed default.
//
// WHY THIS MOVED OFF DUCKDB. The original v0 opened a DuckDB instance per
// request over parquet files at an absolute path inside the local fund_score
// checkout (`QUERY_PARQUET_DIR`). That pinned /q/{slug}, /search and
// /lens/{lens_slug} to one laptop: Vercel has no lake, no persistent
// filesystem, and shipping a native DuckDB binary to serve 155 rows was never
// the right trade. The panels are TINY — 15 + 140 rows, 30 columns, longest
// text field 122 chars — so they now load into Postgres through the same
// TRUNCATE+COPY-in-one-transaction path as every other serving table
// (fund_score: serving/load.py `_load_query_tables`, DDL in
// scripts/pipeline/apply_serving_schema.py, ops in docs/RUNBOOK-serving-load.md).
// The exported API below is unchanged, so no consumer moved.
//
// THE VALUE VERDICT NOW HAS ONE SOURCE. The DuckDB path read the verdict from
// `screener_funds.parquet` while the fund profile read `fund_profile_facts`.
// Those two sources had drifted: across the 110 funds in the canonical results
// they disagreed on coverage_state for 5 funds, on the underlying 0-100 score
// for 12, on confidence for 4 and on the passive alternative for 12 — i.e. a
// fund could show one verdict on the screener and another on its own page. The
// verdict is now LEFT JOINed live from `fund_profile_facts`, the same row the
// profile renders, so the two cannot disagree by construction. The join is LEFT
// so a fund missing from the served universe yields nulls (em-dash), never a
// fabricated verdict.
//
// Verdict free, precision paid: only the QUALITATIVE verdict is selected
// (coverage state + breakeven state + confidence + passive alt). The precise
// figures (`value_score_100` / `value_score_bps`) are never projected onto these
// public/ISR pages — they are not selected here at all.
// ============================================================================
import { asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import {
  fundProfileFacts,
  queryCanonicalCatalog,
  queryCanonicalResults,
} from "../db/schema/serving";

export const PARSER_VERSION = "query_parser_v0.1";
export const RANKER_VERSION = "query_ranker_v0.1";

// --- Row shapes (1:1 with the T5a panel columns) ---------------------------
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
  // --- Value Score verdict (joined from fund_profile_facts on series_id) ---
  // Qualitative only: the precise paid figures are deliberately not selected.
  value_coverage_state: string | null; // scored | too_new | not_comparable | fee_unavailable | …
  value_breakeven_state: string | null; // above | near | below (null when not scored)
  value_confidence: string | null; // high | limited
  value_passive_alt: string | null; // the passive alternative's ticker
}

export interface QueryPage {
  catalog: CatalogRow;
  rows: ResultRow[];
}

// DATE columns are rendered as plain ISO text upstream. Cast in SQL rather than
// relying on driver date parsing, so the `string | null` contract holds
// regardless of connection settings or timezone.
const asOfText = sql<string | null>`${queryCanonicalCatalog.asOf}::text`;
const holdingsAsOfText = sql<string | null>`${queryCanonicalResults.holdingsAsOf}::text`;

const CATALOG_SELECT = {
  canonical_id: queryCanonicalCatalog.canonicalId,
  query_slug: queryCanonicalCatalog.querySlug,
  query_type: queryCanonicalCatalog.queryType,
  parsed_query_text: queryCanonicalCatalog.parsedQueryText,
  parsed_spec_hash: queryCanonicalCatalog.parsedSpecHash,
  reference_frame: queryCanonicalCatalog.referenceFrame,
  universe_size: queryCanonicalCatalog.universeSize,
  result_count: queryCanonicalCatalog.resultCount,
  primary_metric_label: queryCanonicalCatalog.primaryMetricLabel,
  refusal_reason: queryCanonicalCatalog.refusalReason,
  as_of: asOfText,
  ranker_version: queryCanonicalCatalog.rankerVersion,
  parser_version: queryCanonicalCatalog.parserVersion,
} as const;

/** All canonical query specs (for generateStaticParams + the index). */
export async function getCanonicalCatalog(): Promise<CatalogRow[]> {
  const rows = await db
    .select(CATALOG_SELECT)
    .from(queryCanonicalCatalog)
    .where(ne(queryCanonicalCatalog.queryType, "refusal"))
    .orderBy(asc(queryCanonicalCatalog.queryType), asc(queryCanonicalCatalog.querySlug));
  return rows as CatalogRow[];
}

/** Every canonical slug (including the refusal placeholder), for routing. */
export async function getAllCatalog(): Promise<CatalogRow[]> {
  const rows = await db.select(CATALOG_SELECT).from(queryCanonicalCatalog);
  return rows as CatalogRow[];
}

/** Resolve a canonical /q/{slug} → catalog spec + ranked rows. */
export async function getQueryBySlug(slug: string): Promise<QueryPage | null> {
  const cat = await db
    .select(CATALOG_SELECT)
    .from(queryCanonicalCatalog)
    .where(eq(queryCanonicalCatalog.querySlug, slug))
    .limit(1);
  if (cat.length === 0) return null;
  const catalog = cat[0] as CatalogRow;

  // The verdict fields come from the fund's OWN served row. `value_score` is the
  // served Value Score section: coverage_state + breakeven_state are the public
  // verdict, the precise figures inside it are paid and are not selected. The
  // breakeven state is read from the served field rather than re-derived from
  // the score, so there is exactly one place that rule lives (the backend);
  // it is suppressed unless the fund is actually scored, matching the panel
  // contract that a non-scored fund has no side of breakeven.
  const rows = await db
    .select({
      rank: queryCanonicalResults.rank,
      series_id: queryCanonicalResults.seriesId,
      ticker: queryCanonicalResults.ticker,
      fund_name: queryCanonicalResults.fundName,
      wrapper_label: queryCanonicalResults.wrapperLabel,
      relevance_score: queryCanonicalResults.relevanceScore,
      primary_metric_value: queryCanonicalResults.primaryMetricValue,
      primary_metric_label: queryCanonicalResults.primaryMetricLabel,
      expense_ratio_bps: queryCanonicalResults.expenseRatioBps,
      badge: queryCanonicalResults.badge,
      why_basis_text: queryCanonicalResults.whyBasisText,
      why_basis_source_fields: queryCanonicalResults.whyBasisSourceFields,
      holdings_as_of: holdingsAsOfText,
      fund_profile_href: queryCanonicalResults.fundProfileHref,
      canonical_id: queryCanonicalResults.canonicalId,
      query_slug: queryCanonicalResults.querySlug,
      query_type: queryCanonicalResults.queryType,
      value_coverage_state: fundProfileFacts.valueCoverageState,
      value_breakeven_state: sql<string | null>`CASE WHEN ${fundProfileFacts.valueCoverageState} = 'scored'
        THEN ${fundProfileFacts.valueScore} ->> 'breakeven_state' END`,
      value_confidence: sql<string | null>`CASE WHEN ${fundProfileFacts.valueCoverageState} = 'scored'
        THEN ${fundProfileFacts.valueScore} ->> 'confidence' END`,
      value_passive_alt: sql<string | null>`CASE WHEN ${fundProfileFacts.valueCoverageState} = 'scored'
        THEN ${fundProfileFacts.valueScore} ->> 'passive_alt_label' END`,
    })
    .from(queryCanonicalResults)
    .leftJoin(
      fundProfileFacts,
      eq(queryCanonicalResults.seriesId, fundProfileFacts.seriesId),
    )
    .where(eq(queryCanonicalResults.querySlug, slug))
    .orderBy(asc(queryCanonicalResults.rank));

  return { catalog, rows: rows as ResultRow[] };
}

/** True if a slug exists in the canonical catalog (any type). */
export async function slugExists(slug: string): Promise<boolean> {
  const rows = await db
    .select({ one: sql<number>`1` })
    .from(queryCanonicalCatalog)
    .where(eq(queryCanonicalCatalog.querySlug, slug))
    .limit(1);
  return rows.length > 0;
}
