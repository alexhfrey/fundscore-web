// ============================================================================
// The Postgres tables THIS CHECKOUT'S CODE READS, whose DDL is owned by
// fund_score's scripts/pipeline/apply_serving_schema.py — not by this repo.
// ----------------------------------------------------------------------------
// The Drizzle definitions in src/lib/db/schema/serving.ts are a read-only typed
// mirror so the app can query these; they create nothing.
//
// Every entry here is REQUIRED. The list is keyed to what the app in this
// working tree depends on, NOT to what has merged in the other repo — those are
// different questions, and only the first one predicts whether the deployment
// works. A table whose DDL is still on an unmerged branch is not "optional"; it
// is a table the app will 500 on, and the check must say so.
//
// `upstream` exists only to make that failure actionable: it names the branch
// that creates the table, so the reader knows what to merge rather than
// wondering whether the database is corrupt. Delete an `upstream` block once its
// branch is on fund_score main — it is provenance, and stale provenance sends
// people to look at the wrong thing.
//
// Plain ESM, not TypeScript, on purpose: consumed only by
// check-serving-schema.mjs, and a .ts import would put a Node 22.6+ floor
// (native type stripping) under an ops script that has to run wherever the
// deploy runs. No app code imports this list.
// ============================================================================

export const SERVING_TABLES = [
  {
    table: "fund_profile_facts",
    readBy: "every fund page (/funds/[ticker]) and the value verdict everywhere",
  },
  {
    table: "fund_holdings_full",
    readBy: "the paid holdings drawer and the portfolio X-Ray look-through",
  },
  {
    table: "fund_attribution_blocks",
    readBy: "the Attribution Explorer payload",
  },
  {
    table: "serving_manifest",
    readBy: "build-version traceability for the served data",
  },
  {
    table: "query_canonical_catalog",
    readBy: "/search, /q/[slug] (incl. its generateStaticParams) and /lens/[lens_slug]",
    upstream: { branch: "w3/query-serving-tables", commit: "89044fb" },
  },
  {
    table: "query_canonical_results",
    readBy: "/search, /q/[slug] (incl. its generateStaticParams) and /lens/[lens_slug]",
    upstream: { branch: "w3/query-serving-tables", commit: "89044fb" },
  },
];

/** Just the names, in declaration order. */
export const SERVING_TABLE_NAMES = SERVING_TABLES.map((t) => t.table);
