// ============================================================================
// DESIGN-PREVIEW SAMPLE DATA — never import outside src/app/preview/**.
// ----------------------------------------------------------------------------
// Crescent v2 archetype-classifier output, transcribed verbatim from the
// embedded `DATA` object in (fund_score repo)
// docs/product/strategy/mockup_fund_profile_crescent.html — `DATA.generated`
// 2026-07-18, `DATA.sources.archetype` "A2 prototype classifier (draft
// cutoffs), 2026-07-18", `DATA.archetype_rules.spine_as_of` "2026-07-11".
// This is a CONCEPT awaiting go/no-go (fund_score memory:
// crescent_signature_artifacts_2026-07-18) — nothing serves archetype data
// yet, so every value here is additive-only and must never shadow a served
// field (see overlayV2Fixtures in serving/profile-v2.ts).
//
// Every export carries `__sample: true`; the preview UI renders a visible
// "sample data" chip off isSample() and omits methodology links.
//
// Coverage note: the mockup's DATA.fund_profile.exemplar_archetypes object
// has a transcribable per-fund classifier result for exactly 7 tickers (its
// hand-picked exemplar/spot-check set). ARCHETYPE_RULES.universe_N (3941) is
// the classifier's full EQ-active-series universe — coverage of THIS fixture
// map is 7 tickers, not 3941; every other ticker gets null (honest
// Unavailable), never a fabricated result.
//
// Two provenance notes for the verbatim-diff review:
// 1) `ArchetypeRuleTableRow.rule` and `.priority` for the "Unclassifiable"
//    row, and `ArchetypeFixture.neighbor_label` for FCNTX/DODGX, are NOT
//    inside the `DATA` object literal — DATA.archetype_rules.rule_table has
//    only the 6 numbered archetypes. Both are sourced from the mockup's own
//    deterministic render logic in renderArchPanel() (lines ~733-760 of the
//    mockup HTML), which is real, non-fabricated content baked into the page
//    (not a guess), but lives in JS template strings rather than the DATA
//    blob. Flagged here per the "note ambiguity, don't guess" instruction.
// 2) fill_bands is a DERIVED aggregate: the mockup's own bandData() function
//    sums DATA.archetype_rules.fill_band_crosstab across archetypes per named
//    band. Reproduced here with exact arithmetic (Python) over the verbatim
//    crosstab counts — no value invented, but the resulting pct fields are
//    computed, not literal DATA fields. pct_of_filled is % of the 2708 funds
//    with a computable fill value; it EXCLUDES the 1233 no_fill (honest-
//    missing) funds — see no_fill_count. Do not read pct_of_filled as "% of
//    universe" (universe_N = 3941 = total_with_fill + no_fill_count).
// ============================================================================
import type { SampleTag } from "../serving/profile-v2";

const SAMPLE_LABEL =
  "real A2 prototype classifier output (draft cutoffs), run 2026-07-18, spine as-of 2026-07-11 — from the Crescent design-mock prep (mockup_fund_profile_crescent.html); concept awaiting go/no-go, no serving spec yet";

export interface ArchetypeFixture extends SampleTag {
  archetype: string;
  deciding_metric: string;
  deciding_value: number;
  borderline: boolean;
  /**
   * Only set when the mockup's renderArchPanel() computes one: borderline
   * funds labeled "Broad Stock-Picker" (the sole pair of adjacent labels on
   * the priority order sharing the `fill` metric) get a hardcoded "Closet
   * Indexer" neighbor note. Not a DATA field — see module-header note (1).
   * Absent (not null) for every ticker the mockup doesn't compute one for.
   */
  neighbor_label?: string | null;
  /**
   * The classifier's own version label (DATA.sources.archetype). Deliberately
   * NOT named `method_version`: DATA.archetype_rules.method_version is a
   * DIFFERENT string ("value_score_v0.3" — the value-score spine the
   * classifier ran over, carried on ARCHETYPE_RULES), and reusing the name
   * for a different value is exactly the label-provenance trap this repo bans.
   */
  classifier_version: string;
  spine_as_of: string;
}

export interface ArchetypeRuleTableRow {
  /** Decision-tree priority (lower runs first). Null for "Unclassifiable" —
   *  the catch-all bucket has no rule slot; the mockup table renders "—". */
  priority: number | null;
  archetype: string;
  /** Verbatim rule text. Null where DATA has none. The "Unclassifiable" row's
   *  text IS populated but is sourced from render logic, not DATA — see
   *  module-header note (1). */
  rule: string | null;
  deciding_metric: string | null;
  cutoff: number | null;
  /** Present only on the one row that carries it in DATA (Sector Rotator). */
  secondary_gate?: string;
  /** Present only on the one row that carries it in DATA (Patient Concentrator). */
  gates?: string;
  /** Present on every rule_table row in DATA except the synthesized Unclassifiable one. */
  needs?: string;
  /** From DATA.archetype_summary.occupancy[].pct (verbatim). */
  universe_share_pct: number;
  /** From DATA.archetype_summary.occupancy[].n (verbatim). */
  universe_n: number;
  /** From DATA.archetype_summary.occupancy[].borderline_pct (verbatim). */
  borderline_share_pct: number;
  /** From DATA.archetype_summary.occupancy[].borderline_n (verbatim). */
  borderline_n: number;
}

export interface ArchetypeRulesFixture extends SampleTag {
  universe_N: number;
  /** DATA.archetype_rules.method_version — the value-score SPINE version the
   *  classifier ran over (not the classifier's own label; that is each
   *  fixture's `classifier_version`). */
  method_version: string;
  /** DATA.archetype_rules.spine_as_of. */
  spine_as_of: string;
  borderline_overall_pct: number;
  borderline_definition: string;
  rule_table: ArchetypeRuleTableRow[];
  fill_bands: {
    bands: { name: string; count: number; pct_of_filled: number }[];
    /** Sum of `count` across bands — the denominator for pct_of_filled. */
    total_with_fill: number;
    /** Funds with no computable fill value (honest-missing; excluded from bands). */
    no_fill_count: number;
  };
}

const ARCHETYPE_FIXTURES: Record<string, ArchetypeFixture> = {
  FCNTX: {
    __sample: true,
    sample_label: SAMPLE_LABEL,
    archetype: "Broad Stock-Picker",
    deciding_metric: "fill",
    deciding_value: 0.052058182451924284,
    borderline: true,
    neighbor_label: "Closet Indexer",
    classifier_version: "A2 prototype classifier (draft cutoffs), 2026-07-18",
    spine_as_of: "2026-07-11",
  },
  DODGX: {
    __sample: true,
    sample_label: SAMPLE_LABEL,
    archetype: "Broad Stock-Picker",
    deciding_metric: "fill",
    deciding_value: 0.05346397794865554,
    borderline: true,
    neighbor_label: "Closet Indexer",
    classifier_version: "A2 prototype classifier (draft cutoffs), 2026-07-18",
    spine_as_of: "2026-07-11",
  },
  JEPSX: {
    __sample: true,
    sample_label: SAMPLE_LABEL,
    archetype: "Broad Stock-Picker",
    deciding_metric: "fill",
    deciding_value: 0.24925678188778644,
    borderline: false,
    classifier_version: "A2 prototype classifier (draft cutoffs), 2026-07-18",
    spine_as_of: "2026-07-11",
  },
  VSMIX: {
    __sample: true,
    sample_label: SAMPLE_LABEL,
    archetype: "Sector Rotator",
    deciding_metric: "sector_active_share",
    deciding_value: 0.33383777929290537,
    borderline: false,
    classifier_version: "A2 prototype classifier (draft cutoffs), 2026-07-18",
    spine_as_of: "2026-07-11",
  },
  VPMCX: {
    __sample: true,
    sample_label: SAMPLE_LABEL,
    archetype: "Broad Stock-Picker",
    deciding_metric: "fill",
    deciding_value: 0.07665995530397796,
    borderline: false,
    classifier_version: "A2 prototype classifier (draft cutoffs), 2026-07-18",
    spine_as_of: "2026-07-11",
  },
  FAGCX: {
    __sample: true,
    sample_label: SAMPLE_LABEL,
    archetype: "Broad Stock-Picker",
    deciding_metric: "fill",
    deciding_value: 0.16461547960292044,
    borderline: false,
    classifier_version: "A2 prototype classifier (draft cutoffs), 2026-07-18",
    spine_as_of: "2026-07-11",
  },
  AEGFX: {
    __sample: true,
    sample_label: SAMPLE_LABEL,
    archetype: "Broad Stock-Picker",
    deciding_metric: "fill",
    deciding_value: 0.0675932150009374,
    borderline: false,
    classifier_version: "A2 prototype classifier (draft cutoffs), 2026-07-18",
    spine_as_of: "2026-07-11",
  },
};

/** Only the 7 tickers with a real classifier result in the mockup; every other ticker is honest Unavailable (null). */
export function getArchetypeFixture(ticker: string): ArchetypeFixture | null {
  return ARCHETYPE_FIXTURES[ticker.toUpperCase()] ?? null;
}

export const ARCHETYPE_RULES: ArchetypeRulesFixture = {
  __sample: true,
  sample_label: SAMPLE_LABEL,
  method_version: "value_score_v0.3",
  spine_as_of: "2026-07-11",
  universe_N: 3941,
  borderline_overall_pct: 21.5,
  borderline_definition:
    "deciding_value within +/-20% (relative) of the cutoff that decided the label",
  rule_table: [
    {
      priority: 1,
      archetype: "Closet Indexer",
      rule: "fill < 0.05  (replica_R2 > 0.95)",
      deciding_metric: "fill = 1 - replica_r2",
      cutoff: 0.05,
      needs: "fill",
      universe_share_pct: 11.8,
      universe_n: 465,
      borderline_share_pct: 39.8,
      borderline_n: 185,
    },
    {
      priority: 2,
      archetype: "Theme Fund",
      rule: "single-theme OVERWEIGHT vs twin >= 0.12 (12pp)",
      deciding_metric: "theme_top_ovw (max positive theme difference vs L2 twin)",
      cutoff: 0.12,
      needs: "theme (vs_benchmark)",
      universe_share_pct: 5.56,
      universe_n: 219,
      borderline_share_pct: 33.8,
      borderline_n: 74,
    },
    {
      priority: 3,
      archetype: "Sector Rotator",
      rule: "sector active share vs twin >= 0.25 AND turnover >= 0.50 (50%/yr)",
      deciding_metric: "sector_active_share = 0.5*sum|sector diff vs twin|",
      cutoff: 0.25,
      secondary_gate: "turnover>=0.50",
      needs: "sector (vs_benchmark) + turnover",
      universe_share_pct: 4.03,
      universe_n: 159,
      borderline_share_pct: 39.0,
      borderline_n: 62,
    },
    {
      priority: 4,
      archetype: "Patient Concentrator",
      rule: "fill >= 0.10 AND eff_n_raw < 20 AND turnover <= 0.25 (25%/yr)",
      deciding_metric: "eff_n_raw (effective # holdings)",
      cutoff: 20,
      gates: "fill>=0.10, turnover<=0.25",
      needs: "fill + eff_n + turnover",
      universe_share_pct: 6.01,
      universe_n: 237,
      borderline_share_pct: 21.9,
      borderline_n: 52,
    },
    {
      priority: 5,
      archetype: "Style Tilter",
      rule: "max |FF6 style z vs twin| >= 1.0",
      deciding_metric: "max_style_z (FF6 style z-score vs passive baseline)",
      cutoff: 1.0,
      needs: "style z (PARTIAL panel ~11%)",
      universe_share_pct: 5.33,
      universe_n: 210,
      borderline_share_pct: 18.1,
      borderline_n: 38,
    },
    {
      priority: 6,
      archetype: "Broad Stock-Picker",
      rule: "fill >= 0.05, diversified, no dominant axis (residual active)",
      deciding_metric: "fill = 1 - replica_r2",
      cutoff: 0.05,
      needs: "fill",
      universe_share_pct: 38.24,
      universe_n: 1507,
      borderline_share_pct: 12.5,
      borderline_n: 189,
    },
    {
      // Not a member of DATA.archetype_rules.rule_table (no priority/cutoff in
      // DATA); rule text sourced from renderArchPanel()'s hardcoded catch-all
      // row — see module-header note (1).
      priority: null,
      archetype: "Unclassifiable",
      rule: "no returns-basis fill (too new / not comparable) — never guessed",
      deciding_metric: null,
      cutoff: null,
      universe_share_pct: 29.03,
      universe_n: 1144,
      borderline_share_pct: 0.0,
      borderline_n: 0,
    },
  ],
  fill_bands: {
    bands: [
      { name: "0-5%", count: 465, pct_of_filled: 17.171344165435745 },
      { name: "5-10%", count: 772, pct_of_filled: 28.508124076809455 },
      { name: "10-20%", count: 782, pct_of_filled: 28.877400295420973 },
      { name: "20-35%", count: 444, pct_of_filled: 16.395864106351553 },
      { name: "35%+", count: 245, pct_of_filled: 9.047267355982274 },
    ],
    total_with_fill: 2708,
    no_fill_count: 1233,
  },
};
