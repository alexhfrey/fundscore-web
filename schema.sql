-- FundScore Web Database Schema
-- Generated from Drizzle ORM schema, Supabase/PostgreSQL
-- This is the contract: the backend pipeline must produce data matching these tables.

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE asset_class_code AS ENUM (
  'EQ', 'FI', 'MU', 'MA', 'ALT', 'RE', 'OT'
);

CREATE TYPE score_label AS ENUM (
  'Strong Buy', 'Buy', 'Hold', 'Underperform', 'Sell'
);

CREATE TYPE fee_level AS ENUM (
  'Low', 'Below Average', 'Average', 'Above Average', 'High'
);

CREATE TYPE attribution_type AS ENUM (
  'equity', 'fixedIncome', 'allocation'
);

CREATE TYPE trade_action AS ENUM ('buy', 'sell');
CREATE TYPE trade_outcome AS ENUM ('winner', 'loser', 'pending');

-- ============================================================================
-- FUNDS (hub table)
-- ============================================================================

CREATE TABLE funds (
  id            serial PRIMARY KEY,
  ticker        varchar(10)  NOT NULL,
  name          varchar(200) NOT NULL,
  asset_class   asset_class_code NOT NULL,
  geography     varchar(10)  NOT NULL,
  focus         varchar(20)  NOT NULL,
  size          varchar(20)  NOT NULL,
  peer_group    varchar(40)  NOT NULL,
  fund_score    integer       NOT NULL,
  score_label   score_label   NOT NULL,
  passive_alt_ticker varchar(10)  NOT NULL,
  passive_alt_name   varchar(200) NOT NULL,
  nav           real NOT NULL,
  ytd_return    real NOT NULL,
  one_year_return   real NOT NULL,
  three_year_return real NOT NULL,
  five_year_return  real NOT NULL,
  ten_year_return   real,              -- nullable (funds < 10yr old)
  expense_ratio real NOT NULL,
  aum           real NOT NULL,         -- in millions

  -- Detail scalars
  inception_date    varchar(20) NOT NULL,  -- 'YYYY-MM-DD'
  manager           varchar(100) NOT NULL,
  manager_start_year integer NOT NULL,
  investment_objective text NOT NULL,
  investment_strategy  text NOT NULL,
  benchmark         varchar(100) NOT NULL,
  min_investment    integer NOT NULL,
  analyst_note      text NOT NULL,
  peer_avg_one_year_return   real NOT NULL,
  peer_avg_three_year_return real NOT NULL,
  peer_aum_rank    integer NOT NULL,
  peer_fund_count  integer NOT NULL,

  -- Portfolio scalars
  total_holdings integer NOT NULL,
  turnover_rate  real NOT NULL,

  -- JSONB blobs (see shapes below)
  trailing_returns          jsonb NOT NULL,
  risk_metrics              jsonb NOT NULL,
  fees                      jsonb NOT NULL,
  fee_level                 fee_level NOT NULL,
  trading_scalars           jsonb NOT NULL,
  attribution_type          attribution_type NOT NULL,
  attribution_detail        jsonb NOT NULL,
  sector_weights            jsonb NOT NULL,
  asset_allocation          jsonb NOT NULL,
  credit_quality            jsonb,         -- null for equity funds
  benchmark_sector_weights  jsonb,         -- null if not available
  maturity_distribution     jsonb,         -- null for non-FI funds
  equity_characteristics    jsonb,         -- null for FI funds
  fixed_income_characteristics jsonb,      -- null for equity funds
  style_box                 jsonb,         -- null for FI funds
  peer_percentiles          jsonb NOT NULL,
  skill_assessment          jsonb NOT NULL,
  duration_risk             jsonb,         -- null for non-FI funds
  admin_details             jsonb NOT NULL
);

CREATE UNIQUE INDEX funds_ticker_idx ON funds (ticker);
CREATE INDEX funds_peer_group_idx ON funds (peer_group);
CREATE INDEX funds_asset_class_idx ON funds (asset_class);
CREATE INDEX funds_fund_score_idx ON funds (fund_score);

-- ============================================================================
-- CHILD TABLES (all FK to funds.id with CASCADE DELETE)
-- ============================================================================

-- ~480 rows/fund (4 series x ~120 months)
CREATE TABLE monthly_returns (
  id       serial PRIMARY KEY,
  fund_id  integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  series   varchar(20) NOT NULL,  -- 'fund' | 'benchmark' | 'passiveAlt' | 'categoryAvg'
  date     varchar(10) NOT NULL,  -- 'YYYY-MM'
  value    real NOT NULL
);
CREATE INDEX monthly_returns_fund_id_series_idx ON monthly_returns (fund_id, series);

-- ~10 rows/fund
CREATE TABLE calendar_year_returns (
  id                serial PRIMARY KEY,
  fund_id           integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  year              integer NOT NULL,
  fund_return       real NOT NULL,
  benchmark_return  real NOT NULL,
  passive_alt_return real NOT NULL,
  category_avg_return real NOT NULL
);
CREATE INDEX calendar_returns_fund_id_idx ON calendar_year_returns (fund_id);

-- 20-50 rows/fund
CREATE TABLE holdings (
  id               serial PRIMARY KEY,
  fund_id          integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  name             varchar(200) NOT NULL,
  ticker           varchar(20),           -- null for bonds/other
  weight           real NOT NULL,
  shares           real,
  market_value     real,
  sector           varchar(100) NOT NULL,
  benchmark_weight real
);
CREATE INDEX holdings_fund_id_idx ON holdings (fund_id);

-- 5 rows/fund
CREATE TABLE score_drivers (
  id                    serial PRIMARY KEY,
  fund_id               integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  name                  varchar(100) NOT NULL,
  score                 integer NOT NULL,
  weight                real NOT NULL,
  weighted_contribution real NOT NULL,
  description           text NOT NULL
);
CREATE INDEX score_drivers_fund_id_idx ON score_drivers (fund_id);

-- 8 rows/fund
CREATE TABLE score_trend (
  id       serial PRIMARY KEY,
  fund_id  integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  quarter  varchar(20) NOT NULL,  -- '2024 Q1'
  score    integer NOT NULL
);
CREATE INDEX score_trend_fund_id_idx ON score_trend (fund_id);

-- 6 rows/fund
CREATE TABLE trades (
  id             serial PRIMARY KEY,
  fund_id        integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  name           varchar(200) NOT NULL,
  ticker         varchar(20),
  action         trade_action NOT NULL,
  quarter_added  varchar(20) NOT NULL,
  position_size  real NOT NULL,
  return_since   real NOT NULL,
  outcome        trade_outcome NOT NULL
);
CREATE INDEX trades_fund_id_idx ON trades (fund_id);

-- 6 rows/fund
CREATE TABLE sector_hit_rates (
  id          serial PRIMARY KEY,
  fund_id     integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  sector      varchar(100) NOT NULL,
  hit_rate    real NOT NULL,
  trade_count integer NOT NULL
);
CREATE INDEX sector_hit_rates_fund_id_idx ON sector_hit_rates (fund_id);

-- 6 rows/fund
CREATE TABLE factor_tilts (
  id       serial PRIMARY KEY,
  fund_id  integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  factor   varchar(50) NOT NULL,
  exposure real NOT NULL,
  label    varchar(100) NOT NULL
);
CREATE INDEX factor_tilts_fund_id_idx ON factor_tilts (fund_id);

-- 5-8 rows/fund
CREATE TABLE factor_sensitivities (
  id                    serial PRIMARY KEY,
  fund_id               integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  factor                varchar(100) NOT NULL,
  beta                  real NOT NULL,
  shock_label           varchar(100) NOT NULL,
  shock_magnitude       real NOT NULL,
  estimated_impact_down real NOT NULL,
  estimated_impact_up   real NOT NULL
);
CREATE INDEX factor_sensitivities_fund_id_idx ON factor_sensitivities (fund_id);

-- 5-6 rows/fund
CREATE TABLE historical_scenarios (
  id                serial PRIMARY KEY,
  fund_id           integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  name              varchar(200) NOT NULL,
  period            varchar(50) NOT NULL,
  market_return     real NOT NULL,
  fund_return       real NOT NULL,
  passive_alt_return real NOT NULL,
  recovery_months   integer NOT NULL
);
CREATE INDEX historical_scenarios_fund_id_idx ON historical_scenarios (fund_id);

-- 5-8 rows/fund
CREATE TABLE risk_decomposition (
  id              serial PRIMARY KEY,
  fund_id         integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  factor          varchar(100) NOT NULL,
  percent_of_risk real NOT NULL
);
CREATE INDEX risk_decomposition_fund_id_idx ON risk_decomposition (fund_id);

-- 5-11 rows/fund
CREATE TABLE sector_bets (
  id                serial PRIMARY KEY,
  fund_id           integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  sector            varchar(100) NOT NULL,
  fund_weight       real NOT NULL,
  benchmark_weight  real NOT NULL,
  over_underweight  real NOT NULL,
  contribution      real NOT NULL
);
CREATE INDEX sector_bets_fund_id_idx ON sector_bets (fund_id);

-- 5-11 rows/fund
CREATE TABLE stock_picks (
  id                serial PRIMARY KEY,
  fund_id           integer NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  name              varchar(200) NOT NULL,
  ticker            varchar(20),
  fund_weight       real NOT NULL,
  benchmark_weight  real NOT NULL,
  contribution      real NOT NULL
);
CREATE INDEX stock_picks_fund_id_idx ON stock_picks (fund_id);

-- ============================================================================
-- MODEL BACKTEST (singleton parent + 5 child tables)
-- ============================================================================

CREATE TABLE model_backtest (
  id                 serial PRIMARY KEY,
  total_funds_scored integer NOT NULL,
  data_start_date    varchar(20) NOT NULL,
  last_updated       varchar(20) NOT NULL
);

CREATE TABLE model_calibration (
  id               serial PRIMARY KEY,
  model_id         integer NOT NULL REFERENCES model_backtest(id) ON DELETE CASCADE,
  predicted_bucket integer NOT NULL,
  actual_beat_rate real NOT NULL,
  sample_size      integer NOT NULL
);
CREATE INDEX model_calibration_model_id_idx ON model_calibration (model_id);

CREATE TABLE model_rolling_accuracy (
  id       serial PRIMARY KEY,
  model_id integer NOT NULL REFERENCES model_backtest(id) ON DELETE CASCADE,
  date     varchar(20) NOT NULL,
  hit_rate real NOT NULL
);
CREATE INDEX model_rolling_accuracy_model_id_idx ON model_rolling_accuracy (model_id);

CREATE TABLE model_quintile_returns (
  id                serial PRIMARY KEY,
  model_id          integer NOT NULL REFERENCES model_backtest(id) ON DELETE CASCADE,
  quintile          integer NOT NULL,  -- 1-5
  avg_excess_return real NOT NULL,
  fund_count        integer NOT NULL
);
CREATE INDEX model_quintile_returns_model_id_idx ON model_quintile_returns (model_id);

CREATE TABLE model_spread (
  id       serial PRIMARY KEY,
  model_id integer NOT NULL REFERENCES model_backtest(id) ON DELETE CASCADE,
  date     varchar(20) NOT NULL,
  spread   real NOT NULL
);
CREATE INDEX model_spread_model_id_idx ON model_spread (model_id);

CREATE TABLE model_peer_group_accuracy (
  id          serial PRIMARY KEY,
  model_id    integer NOT NULL REFERENCES model_backtest(id) ON DELETE CASCADE,
  peer_group  varchar(100) NOT NULL,
  accuracy    real NOT NULL,
  sample_size integer NOT NULL
);
CREATE INDEX model_peer_group_accuracy_model_id_idx ON model_peer_group_accuracy (model_id);

-- ============================================================================
-- JSONB COLUMN SHAPES
-- ============================================================================

/*
trailing_returns: {
  "oneMonth": 6.87,
  "threeMonth": 2.66,
  "sixMonth": 1.98,
  "ytd": -0.05,
  "oneYear": -0.05,
  "threeYear": -11.53,
  "fiveYear": 1.93,
  "tenYear": 0.77,           -- null if fund < 10yr
  "sinceInception": 0.77
}

risk_metrics: {
  "standardDeviation": { "threeYear": 12.13, "fiveYear": 11.93, "tenYear": 9.27 },
  "sharpeRatio":       { "threeYear": 0.97, "fiveYear": 1.07, "tenYear": 0.96 },
  "alpha":             { "threeYear": -0.29, "fiveYear": 0.53, "tenYear": -0.94 },
  "beta":              { "threeYear": 0.80, "fiveYear": 0.80, "tenYear": 0.79 },
  "rSquared":          { "threeYear": 80.5, "fiveYear": 83.5, "tenYear": 87.5 },
  "maxDrawdown": -15.5,
  "maxDrawdownDate": "2020-03",
  "upsideCaptureRatio": 105.0,
  "downsideCaptureRatio": 73.8,
  "sortinoRatio": 0.59,
  "trackingError": 5.89,
  "informationRatio": -0.28,
  "peerAvg": {
    "standardDeviation": 10.93,
    "sharpeRatio": 0.93,
    "alpha": -1.64,
    "beta": 0.97,
    "maxDrawdown": -23.2
  }
}

fees: {
  "expenseRatio": 0.39,
  "managementFee": 0.27,
  "twelveBOneOne": 0,
  "otherExpenses": 0.12,
  "frontLoad": 0,
  "deferredLoad": 0,
  "redemptionFee": 0,
  "peerAvgExpenseRatio": 0.82,
  "feeLevel": "Low"
}

trading_scalars: {
  "battingAverage": 0.508,
  "avgWinSize": 62,
  "avgLossSize": 72,
  "winLossRatio": 0.86,
  "activeShare": 0.61,
  "convictionScore": 3.19,
  "tradeSizingEfficiency": 0.52,
  "avgHoldingPeriodMonths": 25,
  "numberOfIndependentDecisions": 56
}

attribution_detail (when attribution_type = 'equity'): {
  "betaContribution": 7.21,
  "sectorExposure": 0.85,
  "sectorTiming": -0.23,
  "marketTiming": 0.45,
  "stockSelection": 1.67,
  "grossAlpha": 2.74,
  "feesDrag": -0.39,
  "netAlpha": 2.35
}

attribution_detail (when attribution_type = 'fixedIncome'): {
  "durationEffect": ...,
  "yieldCurveEffect": ...,
  "creditSpreadEffect": ...,
  "sectorAllocation": ...,
  "securitySelection": ...,
  "grossAlpha": ...,
  "feesDrag": ...,
  "netAlpha": ...
}

attribution_detail (when attribution_type = 'allocation'): {
  "assetClassAllocation": ...,
  "withinEquity": ...,
  "withinFixedIncome": ...,
  "withinAlternatives": ...,
  "grossAlpha": ...,
  "feesDrag": ...,
  "netAlpha": ...
}

sector_weights: [
  { "sector": "Technology", "weight": 28.5 },
  ...
]

asset_allocation: [
  { "type": "US Stocks", "weight": 92.3 },
  ...
]

credit_quality (FI only, null otherwise): [
  { "rating": "AAA", "weight": 15.2 },
  ...
]

benchmark_sector_weights (null if not available): [
  { "sector": "Technology", "weight": 30.1 },
  ...
]

maturity_distribution (FI only, null otherwise): [
  { "range": "0-1 yr", "weight": 5.2 },
  ...
]

equity_characteristics (equity only, null otherwise): {
  "peRatio": 22.4,
  "pbRatio": 4.1,
  "weightedAvgMarketCap": 245000,
  "earningsGrowth": 15.3,
  "dividendYield": 1.2,
  "roe": 18.5
}

fixed_income_characteristics (FI only, null otherwise): {
  "effectiveDuration": 5.2,
  "avgCreditQuality": "A",
  "yieldToMaturity": 4.8,
  "sec30DayYield": 4.5,
  "avgCoupon": 4.1,
  "avgMaturity": 7.3
}

style_box (equity only, null otherwise): {
  "size": "Large",      -- "Large" | "Mid" | "Small"
  "style": "Growth",    -- "Value" | "Blend" | "Growth"
  "position": 3
}

peer_percentiles: {
  "fee": 85,
  "activeShare": 62,
  "trackingError": 45,
  "return1Y": 70,
  "return3Y": 55,
  "return5Y": 60,
  "returnInception": 58
}

skill_assessment: {
  "battingAverage": 0.508,
  "bayesianDistribution": {
    "priorAlpha": 2,
    "priorBeta": 2,
    "observedWins": 28,
    "observedTotal": 56,
    "posteriorMean": 0.50,
    "posteriorStdDev": 0.064,
    "credibleInterval80": [0.42, 0.58],
    "credibleInterval95": [0.37, 0.63],
    "pdfPoints": [ { "x": 0.0, "y": 0.0 }, ... ]
  },
  "avgWinSize": 62,
  "avgLossSize": 72,
  "winLossRatio": 0.86,
  "independentDecisions": 56,
  "informationCoefficient": 0.067,
  "breadth": 56,
  "estimatedIR": 0.50,
  "durationTimingSkill": null,   -- FI only
  "creditTimingSkill": null      -- FI only
}

duration_risk (FI only, null otherwise): {
  "effectiveDuration": 5.2,
  "keyRateDurations": [ { "tenor": "2Y", "duration": 0.8 }, ... ],
  "rateShiftImpacts": [ { "shift": "+100bp", "impact": -4.8 }, ... ],
  "creditSpreadSensitivity": 3.2
}

admin_details: {
  "shareClass": "Investor",
  "cusip": "316071109",
  "isin": "US3160711097",
  "distributionFrequency": "Annually",
  "fiscalYearEnd": "December",
  "legalStructure": "Open-End Fund",
  "fundFamily": "Fidelity Investments",
  "phone": "1-800-544-8544",
  "website": "https://www.fidelity.com"
}
*/

-- ============================================================================
-- SERVING LAYER (Track 1B) — Value Offering hot path
-- ----------------------------------------------------------------------------
-- These tables replace the legacy predictive-score mock above as the profile
-- page's data source (the mock is retired in Track 1C once the UI is rebuilt).
-- The Python loader (fund_score: scripts/pipeline/build_serving_facts.py) does
-- a full-replace COPY into fund_profile_facts and mirrors the build manifest
-- into serving_manifest. Source of truth: src/lib/db/schema/serving.ts.
-- ============================================================================

CREATE TYPE tier_label AS ENUM ('Strong', 'Mixed', 'Weak');
CREATE TYPE value_offering_status AS ENUM ('available', 'limited', 'unavailable');
CREATE TYPE data_completeness_state AS ENUM (
  'full', 'basic_profile_only', 'missing_passive_match',
  'missing_holdings', 'missing_expense', 'unsupported'
);

-- One row per series_id. Hot scalars + nested JSONB payload sections matching
-- the FundProfilePayload contract (docs/product/data_contracts/fund_profile.md).
-- Sections with no real data for a fund are SQL NULL (never synthetic). The
-- Phase 2/3 panels (value_offering_reframed/exposure_xray/return_attribution/
-- positioning_changes/alternatives/takeaways/the_take) shipped in Track 1C prep.
CREATE TABLE fund_profile_facts (
  series_id               text PRIMARY KEY,
  canonical_ticker        varchar(12),
  profile_build_version   text NOT NULL,
  fund_name               text,                          -- SEC free text; not length-capped
  fund_family             text,
  asset_class             asset_class_code,
  peer_group              varchar(64),
  management_style        varchar(24),
  vehicle_type            varchar(32),
  value_offering_score    integer,                       -- null when unavailable (legacy v0.1)
  value_offering_label    tier_label,                    -- null when unavailable (legacy v0.1)
  value_offering_status   value_offering_status NOT NULL,
  confidence_state        value_offering_status NOT NULL,
  fee_fairness_label      tier_label,                    -- null when fair_fee null
  fee_gap_bps             real,
  net_expense_ratio_bps   real,
  data_completeness_state data_completeness_state NOT NULL,
  identity                jsonb NOT NULL,
  value_offering          jsonb,                         -- legacy 5-leg payload (spec #7 v0.1)
  value_offering_reframed jsonb,                         -- spec #7 v0.3 badge typology (hero)
  fees                    jsonb,
  passive_baseline        jsonb,
  performance             jsonb,
  risk_behavior           jsonb,
  holdings                jsonb,
  manager_parent          jsonb,                         -- carries skill_evidence + manager_moves
  source_inventory        jsonb NOT NULL,
  gates                   jsonb NOT NULL,
  exposure_xray           jsonb,                         -- spec #4
  return_attribution      jsonb,                         -- spec #10
  positioning_changes     jsonb,                         -- spec #12
  alternatives            jsonb,                         -- spec #6
  takeaways               jsonb,                         -- spec #8 (3b)
  the_take                jsonb,                          -- spec #8 (3a)
  risk_attribution        jsonb,                         -- spec #13 — factor/theme betas + divergence + bias/timing/idio
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fpf_ticker_idx ON fund_profile_facts (canonical_ticker);
CREATE INDEX fpf_peer_group_idx ON fund_profile_facts (peer_group);
CREATE INDEX fpf_asset_class_idx ON fund_profile_facts (asset_class);
CREATE INDEX fpf_vo_status_idx ON fund_profile_facts (value_offering_status);

-- Mirrors data/product/fund_profiles/profile_build_manifest.json at the serving
-- boundary (Serving Architecture Decision 4).
CREATE TABLE serving_manifest (
  id                    serial PRIMARY KEY,
  profile_build_version text NOT NULL,
  built_at              timestamptz NOT NULL DEFAULT now(),
  active                boolean NOT NULL DEFAULT false,
  fact_row_count        integer NOT NULL,
  source_panels         jsonb NOT NULL,  -- [{panel,path,mtime,row_count,method_version}]
  build_manifest        jsonb NOT NULL
);

CREATE INDEX sm_build_version_idx ON serving_manifest (profile_build_version);
CREATE INDEX sm_active_idx ON serving_manifest (active);

-- ============================================================================
-- AUTH / ENTITLEMENTS (Track 1B follow-on) — per-user tables + RLS
-- ----------------------------------------------------------------------------
-- Keyed off Supabase auth.users. Applied via
-- scripts/pipeline/apply_auth_schema.py (fund_score). Tier gating itself runs
-- server-side in the RSC (see src/lib/serving/profile.ts); RLS here protects the
-- per-user rows, and public-read RLS guards the serving content tables when
-- accessed via the Supabase anon/auth roles (the loader writes as postgres,
-- which bypasses RLS).
-- ============================================================================

CREATE TYPE entitlement_tier AS ENUM ('free', 'paid_retail', 'pro');

CREATE TABLE users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entitlements (
  user_id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                  entitlement_tier NOT NULL DEFAULT 'free',
  profiles_viewed_month integer NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Saved personal Lenses (query_results.md § 7): a user's saved canonical query,
-- personally named, with opt-in change-tracking. `definition` carries the
-- canonical /q/{slug} spec verbatim so /lens/{lens_slug} re-runs the SAME
-- screener path — the ranking is never stored or fabricated. `lens_slug` is the
-- public shareable handle (distinct from the underlying query slug).
CREATE TABLE lenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lens_slug       text NOT NULL UNIQUE,
  slug            text NOT NULL,                       -- underlying canonical /q/{slug}
  name            text NOT NULL,
  note            text,
  change_tracking boolean NOT NULL DEFAULT true,
  definition      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lenses_user_id_idx ON lenses (user_id);
CREATE INDEX lenses_lens_slug_idx ON lenses (lens_slug);

-- Change-tracking basis. One immutable row per snapshot of a Lens's ranked
-- result set. The honest "N entered / M left" diff compares the latest snapshot
-- to its prior; the first snapshot (at save) has no prior so a fresh Lens shows
-- 0 changes. Never a fabricated change history.
CREATE TABLE lens_snapshots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_id            uuid NOT NULL REFERENCES lenses(id) ON DELETE CASCADE,
  captured_at        timestamptz NOT NULL DEFAULT now(),
  result_as_of       text,
  member_count       integer NOT NULL,
  member_series_ids  jsonb NOT NULL,   -- ordered series_id list (ranked membership)
  member_meta        jsonb NOT NULL    -- series_id -> {ticker,name} for diff copy
);
CREATE INDEX lens_snapshots_lens_id_idx ON lens_snapshots (lens_id);

-- RLS: own-row for per-user tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lens_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY entitlements_select_own ON entitlements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY lenses_all_own ON lenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Snapshots are owned transitively through the parent Lens.
CREATE POLICY lens_snapshots_all_own ON lens_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM lenses l WHERE l.id = lens_snapshots.lens_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM lenses l WHERE l.id = lens_snapshots.lens_id AND l.user_id = auth.uid()));

-- Public shared-Lens read (query_results.md § 7: "share read-only Lens links").
-- A Lens is private (own-row RLS) for management, but its definition is readable
-- by anyone who holds the lens_slug — sharing is the whole point. A SECURITY
-- DEFINER RPC exposes ONLY the non-owner-identifying definition fields by slug,
-- so the share path never leaks the owner's id, note, or other rows. The app
-- re-runs the screener for the actual ranking; this returns the query spec only.
CREATE OR REPLACE FUNCTION public.get_shared_lens(p_lens_slug text)
RETURNS TABLE (lens_slug text, slug text, name text, change_tracking boolean, definition jsonb, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.lens_slug, l.slug, l.name, l.change_tracking, l.definition, l.created_at
  FROM public.lenses l
  WHERE l.lens_slug = p_lens_slug
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_shared_lens(text) TO anon, authenticated;

-- RLS: public read on serving content (loader writes as postgres / bypasses RLS)
ALTER TABLE fund_profile_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE serving_manifest ENABLE ROW LEVEL SECURITY;
CREATE POLICY fpf_public_read ON fund_profile_facts FOR SELECT USING (true);
CREATE POLICY sm_public_read ON serving_manifest FOR SELECT USING (true);

-- New-user provisioning: every auth.users insert gets a public.users +
-- entitlements (default 'free') row, regardless of sign-up path. SECURITY
-- DEFINER so the trigger writes past RLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.entitlements (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
