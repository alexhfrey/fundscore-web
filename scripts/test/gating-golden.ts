// ============================================================================
// Gating golden test — deep-walk contract check for applyGates.
// ----------------------------------------------------------------------------
// Proves the server-side tier gate strips every paid scalar before a payload
// could ship to an anon client, and that the retired legacy Value Offering keys
// are gone at the source (a regression tripwire against reintroduction).
//
// Run:  node --experimental-strip-types scripts/test/gating-golden.ts
//
// Imports applyGates from ./gating (db-free) so there is NO live Postgres client
// and NO DATABASE_URL in the import graph — the test needs no DB. `gating.ts` is
// imported with its explicit `.ts` extension because Node's type-stripping ESM
// loader does not add extensions (tsconfig sets allowImportingTsExtensions so
// tsc/eslint accept the same specifier).
//
// The FactRow fixture is derived from the FCNTX served-facts capture
// (feature-pipeline/captures/fund_profile__FCNTX/served_facts.json), mapped to
// the Drizzle camelCase TOP-LEVEL column names with nested JSONB keys left in
// snake_case (exactly how applyGates reads them). The retired legacy keys
// (value_offering_score / value_offering_label / value_offering / fee_gap_bps)
// are intentionally absent — the test proves they are gone, not present.
// ============================================================================

import { applyGates, isLocked, type FactRow } from "../../src/lib/serving/gating.ts";

// --- FCNTX fixture (post-drop payload shape) --------------------------------
// Gates carried VERBATIM from the capture: applyGates defaults a missing gate to
// "public", so an omitted map would make the paid section-lock assertions pass
// for the wrong reason. FCNTX: return_attribution=paid, alternatives=paid,
// value_offering_reframed=public, manager_parent=free, risk_attribution=free.
const FCNTX_ROW = {
  seriesId: "S000006037",
  canonicalTicker: "FCNTX",
  profileBuildVersion: "test-fixture",
  fundName: "Fidelity Contrafund",
  valueOfferingStatus: "available",
  dataCompletenessState: "full",
  gates: {
    fees: "public",
    holdings: "public",
    identity: "public",
    the_take: "public",
    takeaways: "public",
    performance: "public",
    alternatives: "paid",
    exposure_xray: "free",
    risk_behavior: "free",
    manager_parent: "free",
    passive_baseline: "public",
    risk_attribution: "free",
    source_inventory: "public",
    return_attribution: "paid",
    positioning_changes: "free",
    value_offering_reframed: "public",
  },
  identity: {
    ticker: "FCNTX",
    fund_name: "Fidelity Contrafund",
    management_style: "active",
  },
  // Reframed BADGE hero: badge/bet_tag are public, value_index (30) is paid.
  valueOfferingReframed: {
    badge: "Selection unproven",
    bet_tag: "underweight technology",
    status: "scored",
    skill_band: "unproven",
    value_index: 30, // PAID scalar — must not survive anon
    method_version: "value_offering_reframed_v0.3",
  },
  // manager_parent gate=free; the manager-moves annualized bps is paid.
  managerParent: {
    skill_evidence: {
      label: "limited",
      p_skill: 0.041779112541398274,
      alpha_ir: -0.12411758042242126,
      t_years: 17.384615384615383,
      manager_moves: {
        label: "Mixed",
        status: "available",
        impact_bps_per_year: 9.395552395486646, // PAID scalar — must not survive anon
        impact_bps_se: 91.1554663430797,
        method_version: "manager_moves_v1",
      },
    },
  },
  // return_attribution gate=paid — whole section must lock for anon.
  returnAttribution: {
    rows: [
      {
        period: "1Y",
        dimension: "stock",
        member_id: "UNH",
        member_label: "UNITEDHEALTH GROUP INC",
        rank_direction: "negative",
        contribution_to_active_return_bps: -123.44825441757371,
        period_start_date: "2024-10-31",
        period_end_date: "2025-10-31",
      },
    ],
    method_version: "return_attr_v0.1",
  },
  // risk_attribution gate=free (section locks for anon); its
  // active_return_attribution sub-panel carries its own paid gate.
  riskAttribution: {
    factor_betas: {
      themes: [
        {
          target_id: "theme::dividend_aristocrats",
          target_kind: "theme",
          beta_active_headline: 0.11645316830678554,
          active_baseline: "l2_blend",
          beta_active_l2: 0.11645316830678554,
          beta_active_mkt: -0.2678388007015299,
          beta_active_tstat: -5.7737002689667865,
          confidence_state: "high",
        },
      ],
      styles: [],
      eval_date: "2025-09-30",
    },
    exposure_divergence: null,
    active_return_attribution: {
      gate: "paid",
      factor_contributions: [
        {
          factor_id: "sector::communication_services",
          factor_type: "sector",
          bias_bps: 363.83972081073847, // PAID attribution number
          timing_bps: 107.80319017354978,
          total_contribution_bps: 471.6429109842882,
          n_quarters: 19,
        },
      ],
      idio: {
        idio_contribution_bps: -298.11487106987335,
        realised_active_bps: 93.39687756909255,
        reconciliation_gap_bps: 165.36270858105516, // PAID attribution number
        n_quarters: 19,
      },
      window_start: "2020-12-31",
      window_end: "2025-09-30",
      method_version: "active_return_attr_v1",
    },
    copy_charter: {},
  },
  // alternatives gate=paid — whole section must lock for anon.
  alternatives: {
    rows: [
      {
        ticker: "FCNKX",
        name: "Class K",
        alternative_type: "cheaper_share_class",
        expense_ratio_bps: 32,
        annual_dollar_savings_10k: 7,
        wrapper_alternative: "mutual_fund",
      },
    ],
    eval_date: "2025-09-30",
    method_version: "alternatives_v1",
  },
  sourceInventory: { source_stamps: [] },
} as unknown as FactRow;

// --- deep-walk helpers ------------------------------------------------------
function walk(node: unknown, visit: (key: string, value: unknown) => void): void {
  if (Array.isArray(node)) {
    for (const el of node) walk(el, visit);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      visit(k, v);
      walk(v, visit);
    }
  }
}

/** All values found under `key` at any depth. */
function collectKey(node: unknown, key: string): unknown[] {
  const found: unknown[] = [];
  walk(node, (k, v) => {
    if (k === key) found.push(v);
  });
  return found;
}

/** Does any value under `key` at any depth hold a finite number? */
function hasLiveNumber(node: unknown, key: string): boolean {
  return collectKey(node, key).some((v) => typeof v === "number" && isFinite(v));
}

/** Does `key` appear at any depth at all? */
function hasKey(node: unknown, key: string): boolean {
  return collectKey(node, key).length > 0;
}

// --- assertion harness ------------------------------------------------------
let failures = 0;
function check(label: string, pass: boolean): void {
  if (pass) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

const LEGACY_KEYS = [
  "value_offering_score",
  "value_offering_label",
  "value_offering",
  "fee_gap_bps",
];

// ============================================================================
// 1. Anonymous payload — nothing paid survives, nothing legacy exists.
// ============================================================================
const anon = applyGates(FCNTX_ROW, "anonymous");
console.log("anonymous payload:");

// Retired legacy keys must be gone at every depth (regression tripwire).
for (const k of LEGACY_KEYS) {
  check(`no legacy key "${k}" anywhere in anon payload`, !hasKey(anon, k));
}

// Paid reframed value_index must be nulled in-place (its section is public).
check(
  "value_index is null everywhere in anon payload",
  !hasLiveNumber(anon, "value_index"),
);

// Manager-moves annualized bps must not survive.
check(
  "impact_bps_per_year does not survive in anon payload",
  !hasLiveNumber(anon, "impact_bps_per_year"),
);

// Paid attribution numbers (inside the paid active_return_attribution sub-panel,
// itself inside the free-gated risk_attribution) must not survive.
check("bias_bps does not survive in anon payload", !hasLiveNumber(anon, "bias_bps"));
check(
  "reconciliation_gap_bps does not survive in anon payload",
  !hasLiveNumber(anon, "reconciliation_gap_bps"),
);

// Every section gated paid/free above the anon tier is a {locked} marker.
check("return_attribution (paid) is {locked} for anon", isLocked(anon.returnAttribution));
check("alternatives (paid) is {locked} for anon", isLocked(anon.alternatives));
check("risk_attribution (free) is {locked} for anon", isLocked(anon.riskAttribution));
check("manager_parent (free) is {locked} for anon", isLocked(anon.managerParent));

// The public reframed badge itself still ships (badge/bet_tag are public).
const anonVr = anon.valueOfferingReframed as { badge?: string } | null;
check("public reframed badge still present for anon", anonVr?.badge === "Selection unproven");

// ============================================================================
// 2. Paid payload — positive control: gating opens at the right tier.
// ============================================================================
const paid = applyGates(FCNTX_ROW, "paid");
console.log("paid payload:");

const paidVr = paid.valueOfferingReframed as { value_index?: number | null } | null;
check("value_index present (30) for paid", paidVr?.value_index === 30);

check(
  "impact_bps_per_year present for paid",
  hasLiveNumber(paid.managerParent, "impact_bps_per_year"),
);

check("return_attribution unlocked for paid", !isLocked(paid.returnAttribution));
check("alternatives unlocked for paid", !isLocked(paid.alternatives));

const paidRa = paid.riskAttribution;
check(
  "active_return_attribution unlocked for paid",
  paidRa != null &&
    !isLocked(paidRa) &&
    !isLocked((paidRa as { active_return_attribution?: unknown }).active_return_attribution),
);
check("bias_bps present for paid (positive control)", hasLiveNumber(paid, "bias_bps"));

// Even the full paid payload carries no retired legacy key (schema is clean).
for (const k of LEGACY_KEYS) {
  check(`no legacy key "${k}" anywhere in paid payload`, !hasKey(paid, k));
}

// ============================================================================
if (failures > 0) {
  console.error(`\ngating-golden: ${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\ngating-golden: all assertions passed");
