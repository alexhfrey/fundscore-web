import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  real,
  integer,
  text,
  jsonb,
  boolean,
  timestamp,
  uuid,
  index,
  date,
  doublePrecision,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { assetClassCodeEnum } from "./enums";

// ============================================================================
// THESE SERVING TABLES ARE A READ-ONLY MIRROR — THEY ARE NOT CREATED FROM HERE.
// ----------------------------------------------------------------------------
// The ONE authoritative DDL for fund_profile_facts, fund_holdings_full,
// fund_attribution_blocks, serving_manifest and query_canonical_* lives in
// fund_score: scripts/pipeline/apply_serving_schema.py. It creates the tables,
// the enums, the indexes and their access control, and the serving loader
// refuses to run against a database it hasn't been applied to.
//
// The definitions below exist for ONE reason: so the app can read those tables
// through Drizzle with types. Until 2026-08-07 there were three more
// hand-maintained copies (schema.sql + two drizzle/*.sql migrations) that had
// silently drifted 4-13 columns apart and knew nothing of the two long tables;
// they have been deleted, not re-synced. Adding a column: change
// apply_serving_schema.py FIRST, then mirror it here.
//
//   • drizzle.config.ts excludes these tables from `drizzle-kit push` — pushing
//     this file can never create or alter them.
//   • `npm run db:check-serving` verifies this mirror against a live database.
//     It is a required step of docs/RUNBOOK-serving-load.md after every load.
// ============================================================================

// ============================================================================
// SERVING-LAYER ENUMS (Track 1B — Value Offering serving model)
// These back the new fund_profile_facts hot path. They are intentionally
// separate from the legacy predictive-score enums in ./enums.ts, which the
// pivot retires in Track 1C.
// ============================================================================

// Shared Strong / Mixed / Weak label used by both the Value Offering composite
// (spec #7) and the Fee Fairness label (spec #3).
export const tierLabelEnum = pgEnum("tier_label", ["Strong", "Mixed", "Weak"]);

// Value Offering availability + confidence state (spec #7 § Confidence State).
export const valueOfferingStatusEnum = pgEnum("value_offering_status", [
  "available",
  "limited",
  "unavailable",
]);

// Profile completeness (data contract fund_profile.md § data_completeness_state).
export const dataCompletenessEnum = pgEnum("data_completeness_state", [
  "full",
  "basic_profile_only",
  "missing_passive_match",
  "missing_holdings",
  "missing_expense",
  "unsupported",
]);

// ============================================================================
// fund_profile_facts — row-keyed hot path for the /funds/{ticker} profile page
// ----------------------------------------------------------------------------
// One row per series_id (the canonical fund key). Hot scalar columns are
// denormalized for list/index/quick reads; nested payload sections are JSONB
// blobs assembled by the Python loader from the shipped gold panels. Tier
// gating happens at render, not here: every field is present, the UI suppresses
// by user_state. Placeholders (exposure_xray, alternatives, takeaways) carry an
// explicit {placeholder:true,...} marker — never synthetic data.
// ============================================================================

export const fundProfileFacts = pgTable(
  "fund_profile_facts",
  {
    seriesId: text("series_id").primaryKey(),
    canonicalTicker: varchar("canonical_ticker", { length: 12 }),
    profileBuildVersion: text("profile_build_version").notNull(),

    // --- hot scalar fields (denormalized) ---
    // text (not length-capped): SEC-sourced free text occasionally carries
    // long/garbled values (e.g. a liquidation notice in a series_name). The
    // canonical value also lives in the identity JSONB section.
    fundName: text("fund_name"),
    fundFamily: text("fund_family"),
    assetClass: assetClassCodeEnum("asset_class"),
    peerGroup: varchar("peer_group", { length: 64 }),
    managementStyle: varchar("management_style", { length: 24 }),
    vehicleType: varchar("vehicle_type", { length: 32 }),

    // Legacy 5-leg Value Offering artifacts — the 0-100 score + label scalars,
    // the fee-gap scalar, and the value_offering JSONB section — were dropped
    // 2026-06; the reframed value_offering_reframed badge + value_score are the
    // canonical verdicts now (see drizzle/retire_legacy_value_offering.sql). The
    // states/labels below are kept: backend still populates them.
    valueOfferingStatus: valueOfferingStatusEnum("value_offering_status").notNull(),
    confidenceState: valueOfferingStatusEnum("confidence_state").notNull(),

    feeFairnessLabel: tierLabelEnum("fee_fairness_label"), // null when fair_fee null
    netExpenseRatioBps: real("net_expense_ratio_bps"),

    dataCompletenessState: dataCompletenessEnum("data_completeness_state").notNull(),

    // --- nested payload sections (assembled by the loader) ---
    identity: jsonb("identity").notNull(),
    valueOfferingReframed: jsonb("value_offering_reframed"), // spec #7 v0.3 badge typology — the hero
    fees: jsonb("fees"),
    passiveBaseline: jsonb("passive_baseline"),
    performance: jsonb("performance"),
    // profile-nav-series — matched growth-of-$1000 series (fund vs passive blend)
    // + after-fee period table. Section gate is public (fund-only chart); the
    // vs-passive legs + full period table are stripped field-level below paid.
    navSeries: jsonb("nav_series"),
    // neighbourhood-panel — V4 movement 03. The TWIN's full-life growth vs US
    // stocks / world stocks / US bonds (IVV/VT/BND), plus capture, the worst
    // three drawdowns and calendar-year bars. Keyed by blend, not by fund: two
    // funds on the same twin share one computed history. The twin leg is a
    // CURRENT-mix backcast and therefore HYPOTHETICAL — every non-null payload
    // carries `hypothetical: true` + `mix_as_of`, which the web chip depends on.
    // Suppression is honest and fail-closed upstream (no twin, below fit floor,
    // no fit winner, sub-36-month window, or a blend/panel desync all serve null).
    neighbourhood: jsonb("neighbourhood"),
    riskBehavior: jsonb("risk_behavior"),
    holdings: jsonb("holdings"),
    managerParent: jsonb("manager_parent"), // carries skill_evidence + manager_moves
    sourceInventory: jsonb("source_inventory").notNull(),
    gates: jsonb("gates").notNull(),

    // --- Phase 2/3 product panels (Track 1C prep — were placeholders in Track 1B) ---
    exposureXray: jsonb("exposure_xray"), // spec #4 — differentiated exposure rows + contributors
    returnAttribution: jsonb("return_attribution"), // spec #10 — active-return attribution
    positioningChanges: jsonb("positioning_changes"), // spec #12 — surfaced portfolio shifts
    positioningContext: jsonb("positioning_context"), // positioning-context-percentiles — beta/TE percentile vs same-passive-alt cohort
    // te-decomposition-by-bet — the served te_current split into a factor sleeve
    // (standardized bets, sleeve-scaled variance shares; negatives = diversifying,
    // never clamped) + the idio "stock selection" sleeve, plus a grouped rollup
    // (share_of_te_var is the cross-group comparator, sums to 1 incl. selection).
    // Section gate is "paid"; the free proof point (rollup + top bet) ships via a
    // gating.ts preview projector in the render spec.
    teDecomposition: jsonb("te_decomposition"),
    fundFamilyPanel: jsonb("fund_family_panel"), // fund-family-panel — adviser-level family aggregation
    alternatives: jsonb("alternatives"), // spec #6 — alternatives to inspect + reasons
    takeaways: jsonb("takeaways"), // spec #8 (3b) — evidence bullets
    theTake: jsonb("the_take"), // spec #8 (3a) — synthesis block
    riskAttribution: jsonb("risk_attribution"), // spec #13 — factor/theme betas + divergence + bias/timing/idio

    // --- Value Score (CURRENT value verdict, 2026-06-29) — the hero ---
    // Net active value over the passive alternative; replaces old FundScore AND
    // the value_offering_reframed badge. The JSONB section carries coverage_state
    // + breakeven_state (public verdict) and the precise figures + gross/fee
    // receipt (paid). Scalars denormalized for list/index reads.
    valueScore: jsonb("value_score"),
    valueScoreBps: real("value_score_bps"),
    valueScore100: integer("value_score_100"),
    valueCoverageState: text("value_coverage_state"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("fpf_ticker_idx").on(t.canonicalTicker),
    index("fpf_peer_group_idx").on(t.peerGroup),
    index("fpf_asset_class_idx").on(t.assetClass),
    index("fpf_vo_status_idx").on(t.valueOfferingStatus),
  ],
);

// ============================================================================
// fund_holdings_full — the filed full-holdings list (serve-full-holdings)
// ----------------------------------------------------------------------------
// First LONG-format serving table: one row per (series_id, filed position
// line) at the fund's latest canonical N-PORT accession. As-filed fidelity:
// multi-line issuers stay multiple rows; weight_pct is the filed pctVal (% of
// net assets — per-fund sums cluster near 100 but are NEVER rescaled); float8
// for byte-equal copy fidelity vs the filing. Loaded by fund_score's serving
// loader via TRUNCATE+COPY in the SAME transaction as fund_profile_facts, so
// the free teaser on the facts row (holdings.holdings_full.{n_positions,
// as_of}) always equals this table's per-fund row count. Full rows are paid:
// gates.holdings_full = "paid" (present on the facts row iff rows exist here).
// ============================================================================

export const fundHoldingsFull = pgTable(
  "fund_holdings_full",
  {
    seriesId: text("series_id").notNull(),
    canonicalTicker: varchar("canonical_ticker", { length: 12 }),
    asOf: date("as_of").notNull(), // filed report_period_end
    accNo: text("acc_no").notNull(), // canonical accession (lexmax per period)
    positionRank: integer("position_rank").notNull(), // filed-weight desc, 1-based
    securityName: text("security_name"),
    securityTitle: text("security_title"),
    securityTicker: text("security_ticker"), // resolved US ticker — display metadata, nullable
    cusip: varchar("cusip", { length: 9 }),
    isin: varchar("isin", { length: 12 }),
    weightPct: doublePrecision("weight_pct"), // filed pctVal, EXACTLY as filed
    valueUsd: doublePrecision("value_usd"), // filed valUSD
    // Filed long/short marker. Postgres type is plain `text` (no enum, no CHECK)
    // — mirrored as text, NOT a pgEnum, because the database does not constrain
    // it and a narrower TS type would claim a guarantee that isn't there. The
    // three values the loader has ever written, measured over all 1,398,380
    // served rows on 2026-08-07: "long" (1,370,084), "derivative_na" (25,637),
    // "short" (2,659). The sign already lives in weight_pct/value_usd (99.4% of
    // "short" rows are filed negative); this column is what NAMES the position
    // so a −2.68% row reads as a short sale rather than a data error.
    positionDirection: text("position_direction"),
    country: text("country"), // filed invCountry
    // Sector basis (fund_score `fundscore.reference.sector_attach.attach_sector`) —
    // NOT a plain cusip_reference join, and the name does not tell you the basis:
    //   1. domicile routing — US-domiciled lines (filed invCountry == "US") take
    //      cusip_reference (Sharadar) by filed CUSIP; every other line takes
    //      isin_reference (FMP) by ISIN. Sharadar-by-CUSIP is DISCARDED on foreign
    //      lines because foreign CUSIPs collide with unrelated US issuers.
    //   2. pinned US-filed consensus overlay (owner ruling 2026-08-21) — where one
    //      security carried two different sector labels across funds and its
    //      US-filed rows all agreed on one, that label is applied to EVERY row of
    //      that security. The verdict is decided once on gold/holdings_complete and
    //      propagated, so this column, the Exposure X-Ray and positioning_changes
    //      cannot disagree about the same company.
    //   3. identity gate on that overlay (sector-identity-defect-recovery,
    //      2026-08-25) — the overlay's two failure modes were both identity, not
    //      opinion. (a) A US line whose filed CUSIP does not resolve (the literal
    //      'N/A' sentinel, or no vendor row) falls through to the FMP-by-ISIN label
    //      and then VOTES with it, manufacturing a US-side "disagreement" out of one
    //      vendor's opinion stated twice — such a row no longer votes. (b) A line
    //      whose filed CUSIP resolves to a DIFFERENT company than its ISIN and name
    //      (a filer typo: a GE Aerospace CUSIP on a Genie Energy ISIN) neither votes
    //      nor receives the consensus label — it keeps its own correct one. Where the
    //      claimants tie, the security is excluded rather than bound to a
    //      stable-but-wrong winner. Measured ON THIS TABLE (the gold book is a
    //      different basis and reads 6 -> 1): ISINs served under two different
    //      sector labels fell 7 -> 2, relabelling 100 rows across 77 funds. Of the
    //      two remaining, US3722842081 (Genie Energy) is case (b) working as
    //      designed; GG00BMGYLN96 (Burford Capital) is the same wrong-CUSIP
    //      class but out of the overlay's reach — its three defective fund-quarters
    //      carry no gold rows, so the consensus map never sees the security.
    //      Measured and filed 2026-08-25; neither is an unresolved disagreement.
    // Null where neither reference resolves — an HONEST null: it means "we could not
    // identify this line", never "no sector exists". 5.73% of served rows; 2.25% of
    // asset_cat 'EC' equity-common rows (re-measured 2026-08-25, unchanged by (3)).
    sector: text("sector"),
    assetCat: varchar("asset_cat", { length: 16 }), // filed assetCat raw code (display labeling is frontend)
  },
  (t) => [
    primaryKey({ columns: [t.seriesId, t.positionRank] }),
    // per-fund fetch key for the profile drawer ("View all N holdings")
    index("fhf_ticker_idx").on(t.canonicalTicker),
  ],
);

// ============================================================================
// fund_attribution_blocks — lazy Attribution Explorer payload
// ----------------------------------------------------------------------------
// One row per fund with the quarter-level factor path built by fund_score.
// The payload matches AttributionBlocks in src/lib/serving/profile-v2.ts.
// Brinson member blocks remain an empty array until attribution-quarter-blocks
// lands; do not infer or interpolate member rows client-side.
// ============================================================================

export const fundAttributionBlocks = pgTable(
  "fund_attribution_blocks",
  {
    seriesId: text("series_id").primaryKey(),
    canonicalTicker: varchar("canonical_ticker", { length: 12 }),
    payload: jsonb("payload").notNull(),
  },
  (t) => [index("fab_ticker_idx").on(t.canonicalTicker)],
);

// ============================================================================
// serving_manifest — mirrors profile_build_manifest.json at the serving boundary
// ----------------------------------------------------------------------------
// Serving Architecture Decision 4: gold parquets do NOT carry the build
// version; the loader mirrors the active manifest here so each served build is
// traceable to the input mtimes / row counts / method versions that produced it.
// ============================================================================

export const servingManifest = pgTable(
  "serving_manifest",
  {
    id: serial("id").primaryKey(),
    profileBuildVersion: text("profile_build_version").notNull(),
    builtAt: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(false),
    factRowCount: integer("fact_row_count").notNull(),
    // [{ panel, path, mtime, row_count, method_version }]
    sourcePanels: jsonb("source_panels").notNull(),
    // mirror of data/product/fund_profiles/profile_build_manifest.json
    buildManifest: jsonb("build_manifest").notNull(),
  },
  (t) => [
    index("sm_build_version_idx").on(t.profileBuildVersion),
    index("sm_active_idx").on(t.active),
  ],
);

// ============================================================================
// query_canonical_catalog / query_canonical_results — the published-query
// surface behind /q/{slug}, /search and /lens/{lens_slug} (screener-beta-port)
// ----------------------------------------------------------------------------
// 1:1 with fund_score's data/product/query/query_canonical_{catalog,results}
// parquets. Until 2026-08-07 the web app read those files directly through
// DuckDB, which pinned the whole query surface to a local filesystem and could
// not run on Vercel; they now serve from Postgres like every other panel.
//
// AUTHORITATIVE DDL LIVES IN fund_score's scripts/pipeline/apply_serving_schema.py
// (see the open serving-DDL-drift bug). These definitions mirror it for typed
// reads only — Drizzle must NOT create the serving tables.
//
// Nothing here is computed: every column is inherited verbatim from the
// already-validated query panels. The Value Score verdict shown next to a result
// is NOT stored here — it is LEFT JOINed live from fund_profile_facts, so the
// screener and the fund's own profile page cannot disagree.
// ============================================================================

export const queryCanonicalCatalog = pgTable("query_canonical_catalog", {
  canonicalId: text("canonical_id").notNull(),
  querySlug: text("query_slug").primaryKey(),
  queryType: text("query_type").notNull(),
  parsedQueryText: text("parsed_query_text").notNull(),
  parsedSpecHash: text("parsed_spec_hash"),
  referenceFrame: text("reference_frame"),
  universeSize: integer("universe_size").notNull(),
  resultCount: integer("result_count").notNull(),
  primaryMetricLabel: text("primary_metric_label"),
  refusalReason: text("refusal_reason"),
  asOf: date("as_of"),
  rankerVersion: text("ranker_version").notNull(),
  parserVersion: text("parser_version").notNull(),
});

export const queryCanonicalResults = pgTable(
  "query_canonical_results",
  {
    rank: integer("rank").notNull(),
    seriesId: text("series_id").notNull(),
    ticker: text("ticker"),
    fundName: text("fund_name"),
    wrapperLabel: text("wrapper_label"),
    relevanceScore: integer("relevance_score"),
    primaryMetricValue: doublePrecision("primary_metric_value"),
    primaryMetricLabel: text("primary_metric_label"),
    expenseRatioBps: doublePrecision("expense_ratio_bps"),
    badge: text("badge"),
    whyBasisText: text("why_basis_text"),
    whyBasisSourceFields: text("why_basis_source_fields"),
    holdingsAsOf: date("holdings_as_of"),
    fundProfileHref: text("fund_profile_href"),
    canonicalId: text("canonical_id"),
    querySlug: text("query_slug").notNull(),
    queryType: text("query_type"),
  },
  (t) => [
    primaryKey({ columns: [t.querySlug, t.rank] }),
    index("qcr_series_idx").on(t.seriesId),
  ],
);

// ============================================================================
// AUTH / ENTITLEMENTS (Track 1B follow-on)
// ----------------------------------------------------------------------------
// Per-user tables keyed off Supabase `auth.users(id)`. RLS (own-row) is applied
// out of band (scripts/pipeline/apply_auth_schema.py / schema.sql) because
// policies + the FK to the auth schema aren't expressed through drizzle push
// here. The FK and RLS live in SQL; these definitions give the app typed reads.
//
// Tier model: anonymous = no session (no row); authenticated users carry an
// entitlements row with tier ∈ {free, paid_retail, pro}.
// ============================================================================

export const entitlementTierEnum = pgEnum("entitlement_tier", [
  "free",
  "paid_retail",
  "pro",
]);

// App-level profile mirror of auth.users.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // = auth.users.id (FK in SQL)
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per authenticated user; drives tier gating.
export const entitlements = pgTable("entitlements", {
  userId: uuid("user_id").primaryKey(), // = auth.users.id (FK in SQL)
  tier: entitlementTierEnum("tier").notNull().default("free"),
  profilesViewedMonth: integer("profiles_viewed_month").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Saved personal Lenses (query_results.md § 7). A Lens is a user's saved query
// (the canonical /q/{slug} spec, personally named) + opt-in change-tracking.
// `definition` carries the canonical query spec verbatim (slug + parsed text +
// query_type + as_of) so /lens/{lens_slug} re-runs the SAME screener path the
// public /q/{slug} uses — nothing about the ranking is fabricated or stored.
// `lens_slug` is the public, shareable handle for the Lens (distinct from the
// underlying query slug); RLS guards owner writes, a SECURITY-DEFINER RPC serves
// the public shared read (see schema.sql get_shared_lens).
export const lenses = pgTable(
  "lenses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(), // = auth.users.id (FK in SQL)
    lensSlug: text("lens_slug").notNull().unique(), // public shareable handle
    slug: text("slug").notNull(), // underlying canonical /q/{slug}
    name: text("name").notNull(),
    note: text("note"),
    changeTracking: boolean("change_tracking").notNull().default(true),
    definition: jsonb("definition").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lenses_user_id_idx").on(t.userId),
    index("lenses_lens_slug_idx").on(t.lensSlug),
  ],
);

// Change-tracking basis (query_results.md § 7 + Acceptance: "see what changes").
// One immutable row per snapshot of a Lens's ranked result set. The honest diff
// ("3 funds entered, 1 left since you saved this") is computed by comparing the
// most-recent snapshot's `member_series_ids` to the PRIOR snapshot's — never a
// fabricated change history. The first snapshot (taken at save) has no prior, so
// a freshly saved Lens deterministically shows 0 changes. Snapshots are appended
// on save and on each visit, capped server-side to bound growth.
export const lensSnapshots = pgTable(
  "lens_snapshots",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    lensId: uuid("lens_id").notNull(), // = lenses.id (FK in SQL, ON DELETE CASCADE)
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    resultAsOf: text("result_as_of"), // catalog as_of of the ranked set captured
    memberCount: integer("member_count").notNull(),
    // ordered list of series_id (the ranked result-set membership at capture)
    memberSeriesIds: jsonb("member_series_ids").notNull(),
    // ticker map for honest, human-readable diff copy (series_id -> ticker/name)
    memberMeta: jsonb("member_meta").notNull(),
  },
  (t) => [index("lens_snapshots_lens_id_idx").on(t.lensId)],
);
