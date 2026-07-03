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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { assetClassCodeEnum } from "./enums";

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

    valueOfferingScore: integer("value_offering_score"), // null when unavailable
    valueOfferingLabel: tierLabelEnum("value_offering_label"), // null when unavailable
    valueOfferingStatus: valueOfferingStatusEnum("value_offering_status").notNull(),
    confidenceState: valueOfferingStatusEnum("confidence_state").notNull(),

    feeFairnessLabel: tierLabelEnum("fee_fairness_label"), // null when fair_fee null
    feeGapBps: real("fee_gap_bps"),
    netExpenseRatioBps: real("net_expense_ratio_bps"),

    dataCompletenessState: dataCompletenessEnum("data_completeness_state").notNull(),

    // --- nested payload sections (assembled by the loader) ---
    identity: jsonb("identity").notNull(),
    valueOffering: jsonb("value_offering"), // legacy 5-leg + provenance (spec #7 v0.1); null when unavailable
    valueOfferingReframed: jsonb("value_offering_reframed"), // spec #7 v0.3 badge typology — the hero
    fees: jsonb("fees"),
    passiveBaseline: jsonb("passive_baseline"),
    performance: jsonb("performance"),
    riskBehavior: jsonb("risk_behavior"),
    holdings: jsonb("holdings"),
    managerParent: jsonb("manager_parent"), // carries skill_evidence + manager_moves
    sourceInventory: jsonb("source_inventory").notNull(),
    gates: jsonb("gates").notNull(),

    // --- Phase 2/3 product panels (Track 1C prep — were placeholders in Track 1B) ---
    exposureXray: jsonb("exposure_xray"), // spec #4 — differentiated exposure rows + contributors
    returnAttribution: jsonb("return_attribution"), // spec #10 — active-return attribution
    positioningChanges: jsonb("positioning_changes"), // spec #12 — surfaced portfolio shifts
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
