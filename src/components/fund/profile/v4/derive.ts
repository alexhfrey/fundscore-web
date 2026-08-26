// ============================================================================
// V4 derivation layer — served payload → view model. PURE (no React, no db).
// ----------------------------------------------------------------------------
// Every function here either returns a real served figure carrying its BASIS,
// or returns null WITH a reason. Nothing is estimated, defaulted, imputed or
// back-filled. A `missing_reason` is part of the contract, not a nicety: the
// movement components render the reason, so a gap on the page always says why.
//
// The basis rules this file enforces (each one is a locked canon item):
//  • ONE fee story per page — the coherent fair-fee triple only.
//  • ONE fill per page — the CURRENT-twin fit (owner decision (c), 2026-08-06).
//  • Standalone-vs-allocation TE is never conflated.
//  • `te_alloc_bps` is NEVER rendered under swing/dollar-impact copy.
//  • No "biggest bet" superlative when `top_bet_confident` is false.
// ============================================================================

import type {
  NavPeriodRow,
  NavSeries,
  TeDecomposition,
} from "@/lib/serving/profile-v2";
import type { PassiveBaseline, TeProofPreview, TeRollupRow } from "@/lib/serving/profile";
// Imported from `gating` and NOT from `profile`: these two are pure and db-free,
// and `profile` re-exports them through a module that instantiates the Postgres
// client. This file must stay importable without a DATABASE_URL.
import { getPreview, isLocked } from "@/lib/serving/gating";

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * The page's single money convention: **1 bps = $1 per year per $10,000**.
 * (10,000 × bps/10,000 = bps.) Every dollar figure on the V4 page is per
 * $10,000 invested, per year — stated once in movement 00's caption.
 */
export function dollarsPer10k(bps: number | null | undefined): number | null {
  if (bps == null || !Number.isFinite(bps)) return null;
  return bps;
}

/** "$49" / "−$56" — whole dollars, typographic minus. */
export function fmtDollarsSigned(d: number | null | undefined): string | null {
  if (d == null || !Number.isFinite(d)) return null;
  const sign = d < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(d)).toLocaleString()}`;
}

/** "$49" — magnitude only, for a leg whose direction is carried by its label. */
export function fmtDollarsMagnitude(d: number | null | undefined): string | null {
  if (d == null || !Number.isFinite(d)) return null;
  return `$${Math.round(Math.abs(d)).toLocaleString()}`;
}

/**
 * bps → "0.49%" (a rate of what you hold), 2 dp.
 *
 * Rounds HALF AWAY FROM ZERO on the bps figure itself. `toFixed` inherits
 * binary representation, so the served raw SI gap of −94.5 bps printed as
 * "0.94%" — the exact half rounded DOWN, understating a figure the page shows
 * next to its rounded-up sibling. Scaling in bps keeps the .5 exactly
 * representable, so the tie breaks the way a reader expects.
 */
export function fmtBpsAsPct(bps: number | null | undefined, digits = 2): string | null {
  if (bps == null || !Number.isFinite(bps)) return null;
  const f = Math.pow(10, digits);
  const scaled = (bps * f) / 100;
  const rounded = (Math.sign(scaled) * Math.round(Math.abs(scaled))) / f;
  return `${rounded.toFixed(digits)}%`;
}

/** "2012-01" / "2012-01-31" → "January 2012". Returns null on anything else. */
export function longMonth(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})/.exec(d);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2026-05-22" → "22 May 2026". Returns null on anything else. */
export function longDay(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getDate()} ${dt.toLocaleDateString("en-US", { month: "short" })} ${dt.getFullYear()}`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// The twin (movements 00 / 01 / 02 / 06)
// ---------------------------------------------------------------------------

export interface TwinLeg {
  etf: string;
  name: string | null;
  weight: number;
}

export interface TwinView {
  legs: TwinLeg[];
  /** Comma-free display label built from the legs ("68% IGE + 32% VT"). */
  mixLabel: string | null;
  matchStatus: string | null;
  belowFitFloor: boolean;
  /**
   * THE page's one fill figure. Owner decision (c), 2026-08-06: the crescent and
   * the "X% a two-ETF mix" claim run on the CURRENT-twin fit — present-tense
   * identity, basis-coherent with the twin named beside it.
   *
   * Served field: `passive_baseline.selected_summary.selected_blend_r2` — the
   * selected blend's R² over the L2 fit window. NOTE the spec body names
   * `te_decomposition.replicable_risk_share` for this; that is a DIFFERENT
   * quantity (the share of ACTIVE variance the factor basis explains — PRNEX
   * 0.7395) and is not the ~94.3% figure the mockup and the spec both cite.
   * `selected_blend_r2` is (PRNEX 0.94279).
   *
   * DO NOT add a `replica_r2` fallback here (codex --high P2, 2026-08-07 —
   * REFUTED with data, deliberately not applied). Measured on the live serving
   * table across the 3,086 matched funds that carry twin legs:
   *   • this exact path resolves for 3,061; it is null for 25
   *   • of those 25, `selected_summary.replica_r2` is present for **0** and
   *     `value_score.replica_r2` for **0** — `selected_summary` is absent
   *     wholesale, so a fallback chain would rescue exactly ZERO funds
   *   • `selected_blend_r2` has strictly BETTER coverage than either candidate
   *     (3,061 vs 2,366 / 2,885), and is the ONLY field present for 695 funds —
   *     so promoting `replica_r2` to primary would DROP the fill for 695 funds
   * A fallback would also be actively unsafe: `replica_r2` is the same blend
   * over the FULL common history, a different window from the fit-window figure
   * this reads. Silently substituting it would put two windows behind one
   * rendered number — the basis mixing this page exists to prevent. The 25
   * render honest-absent, which is correct: they have no fit figure at all.
   */
  currentFitR2: number | null;
  /** Same blend, FULL common weekly history (`value_score.replica_r2`). Shown
   *  only as the labelled secondary in the fit tooltip — never as the headline,
   *  and never on the same line as the current fit without both windows named. */
  fullHistoryR2: number | null;
  fitWindowStart: string | null;
  fitWindowEnd: string | null;
  fitWindowObs: number | null;
  /** Weighted fee of the blend, bps/yr (from the fair-fee triple, not summed here). */
  missingReason: string | null;
}

/** The fund's passive twin, or a stated reason there is none. */
export function buildTwin(
  pb: PassiveBaseline | null,
  valueScoreReplicaR2: number | null,
): TwinView {
  const empty: TwinView = {
    legs: [],
    mixLabel: null,
    matchStatus: null,
    belowFitFloor: false,
    currentFitR2: null,
    fullHistoryR2: null,
    fitWindowStart: null,
    fitWindowEnd: null,
    fitWindowObs: null,
    missingReason:
      "We only name a passive twin when a cheap ETF mix can be shown to behave like the fund. This one has no matched mix, so every fund-versus-twin figure on this page is withheld rather than estimated.",
  };
  if (pb == null) return empty;

  const raw = pb as unknown as Record<string, unknown>;
  const status = (pb.match_status as string | null) ?? null;
  const belowFloor = raw["below_fit_floor"] === true;
  const legs: TwinLeg[] = Array.isArray(pb.etf_weights)
    ? pb.etf_weights
        .filter((w) => w?.etf != null && num(w.weight) != null)
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        .map((w) => ({ etf: w.etf, name: w.etf_name ?? null, weight: w.weight }))
    : [];

  if (status !== "matched" || legs.length === 0) {
    return {
      ...empty,
      matchStatus: status,
      belowFitFloor: belowFloor,
      missingReason: belowFloor
        ? "The closest passive mix we could build does not track this fund closely enough to be a fair yardstick, so we withhold the comparison rather than publish a misleading one."
        : empty.missingReason,
    };
  }

  const sel = (raw["selected_summary"] ?? null) as Record<string, unknown> | null;
  const fw = (raw["fit_window"] ?? null) as Record<string, unknown> | null;

  return {
    legs,
    mixLabel: legs
      .map((l) => `${Math.round(l.weight * 100)}% ${l.etf}`)
      .join(" + "),
    matchStatus: status,
    belowFitFloor: belowFloor,
    currentFitR2: num(sel?.["selected_blend_r2"]),
    fullHistoryR2: valueScoreReplicaR2,
    fitWindowStart: (fw?.["start"] as string | null) ?? null,
    fitWindowEnd: (fw?.["end"] as string | null) ?? null,
    fitWindowObs: num(fw?.["n_obs"]),
    missingReason: null,
  };
}

/** The manager's own share = 1 − the current-twin fit. Null when there is no fit. */
export function ownShare(twin: TwinView): number | null {
  if (twin.currentFitR2 == null) return null;
  return 1 - twin.currentFitR2;
}

/**
 * TRUE when the record's comparison leg is served under a DIFFERENT name from
 * the twin the verdict names.
 *
 * RESOLVED 2026-08-07 by the data critic's recompute, which settled what the
 * served passive leg actually is: it is `passive_alt_daily_nav`, bit-for-bit —
 * a WALK-FORWARD CASCADE of point-in-time annual twin refits, not one fixed mix
 * and not the lead ETF alone. (PRNEX: XLE '12-16 → IXC '17 → IXC+VT → VEU+XLE →
 * VT+XLE → IXC+VT → IGE+VT today.) The twin named in the verdict is the FINAL
 * segment of that same cascade, and the fee leg describes that same segment, so
 * the money hero's two figures ARE commensurable — no recompute was needed.
 *
 * What remains is an upstream LABEL defect: `nav_series.passive_label` carries
 * only the lead ETF on 204 of 218 multi-leg blends, so the record can appear
 * under a name the reader has just seen defined as something wider. Filed
 * upstream. Until it is fixed, this flag drives a plain-words explanation of
 * the point-in-time basis rather than letting the two names silently conflict.
 */
export function comparatorDiffersFromTwin(
  twin: TwinView,
  navPassiveLabel: string | null,
): boolean {
  if (twin.legs.length < 2 || navPassiveLabel == null) return false;
  return !twin.legs.every((l) => navPassiveLabel.includes(l.etf));
}

// ---------------------------------------------------------------------------
// The cost leg (movement 00) — the coherent fair-fee triple, and nothing else
// ---------------------------------------------------------------------------

export interface CostView {
  /** The fund's own net expense ratio, bps/yr. */
  netErBps: number | null;
  /** The TWIN's weighted fee, bps/yr. */
  twinFeeBps: number | null;
  /** THE canonical figure: what the manager costs OVER the twin, bps/yr. */
  overPassiveBps: number | null;
  missingReason: string | null;
}

/**
 * The one fee story on the page. Read ONLY from `fees` — deliberately never
 * from `value_score.fee_bps` / `value_score.passive_alt_fee_bps`, which are a
 * different (single-ETF) basis at a different eval date and disagree (PRNEX
 * value_score 79 bps vs fees 77 bps). Two fee answers under one label is the
 * exact incoherence the canonical-fee gate exists to prevent.
 */
/**
 * The served `active_fee_over_passive_missing_reason` codes, in plain English.
 * These are SERVED CODES, not prose — rendering the raw token ("passive_fund")
 * to a reader is a leak of pipeline vocabulary into the product. An unknown
 * code falls back to a generic-but-honest sentence rather than being printed.
 * Live vocabulary (measured over the 5,819 served funds): passive_fund 1,728 ·
 * passive_fee_unavailable 11 · net_er_unavailable 3.
 */
const FEE_MISSING_REASON: Record<string, string> = {
  passive_fund:
    "This is itself an index fund, so there is no active manager being paid a premium over a passive alternative — the fee comparison this page is built around does not apply to it.",
  passive_fee_unavailable:
    "We do not have a published fee for the passive alternative, so we cannot say what this fund costs over it.",
  net_er_unavailable:
    "This fund's own net expense ratio is not in our data yet, so there is nothing to compare.",
};

export function buildCost(fees: Record<string, unknown> | null): CostView {
  if (fees == null) {
    return {
      netErBps: null,
      twinFeeBps: null,
      overPassiveBps: null,
      missingReason: "This fund's filed fee schedule is not in our data yet.",
    };
  }
  const ff = (fees["fair_fee"] ?? null) as Record<string, unknown> | null;
  const netEr = num(fees["net_expense_ratio_bps"]);
  const twinFee = num(ff?.["passive_fee_bps"]);
  const over = num(ff?.["active_fee_over_passive_bps"]);
  const reason = (ff?.["active_fee_over_passive_missing_reason"] as string | null) ?? null;
  return {
    netErBps: netEr,
    twinFeeBps: twinFee,
    overPassiveBps: over,
    missingReason:
      over == null
        ? (reason != null ? FEE_MISSING_REASON[reason] : null) ??
          "The fee comparison needs both this fund's fee and its twin's; one of them is missing."
        : null,
  };
}

// ---------------------------------------------------------------------------
// The delivered leg (movements 00 / 02) — realized, β-adjusted, after all fees
// ---------------------------------------------------------------------------

export interface DeliveredPeriod {
  period: string;
  /** β-adjusted after-fee excess, bps/yr — the "same market risk" comparison. */
  betaAdjBps: number | null;
  /** Raw (un-β-adjusted) after-fee excess, bps/yr — the labelled secondary. */
  rawBps: number | null;
  fundAnnPct: number | null;
  passiveAnnPct: number | null;
}

export interface DeliveredView {
  /** The paired-window row (period "SI") — the money hero's delivered leg. */
  paired: DeliveredPeriod | null;
  /** Five-year row, when served. */
  fiveYear: DeliveredPeriod | null;
  all: DeliveredPeriod[];
  /** COMMON PAIRED WINDOW start — never the fund's inception. */
  windowStart: string | null;
  windowEnd: string | null;
  passiveLabel: string | null;
  /** True when the tier gate stripped the β-adjusted figures (not missing data). */
  gated: boolean;
  missingReason: string | null;
  /**
   * Why the β-adjusted figure is absent even though a paired row exists. This
   * happens when the fund has no beta against its twin yet (typically too short
   * a shared history). We deliberately do NOT fall back to the raw excess: raw
   * compares a fund and a mix carrying different amounts of market risk, and
   * substituting it under the same-market-risk framing would be a basis swap
   * the reader cannot see.
   */
  betaAdjMissingReason: string | null;
}

function toPeriod(r: NavPeriodRow): DeliveredPeriod {
  return {
    period: r.period,
    betaAdjBps: num(r.beta_adj_diff_bps),
    rawBps: num(r.diff_bps),
    fundAnnPct: num(r.fund_ann_pct),
    passiveAnnPct: num(r.passive_ann_pct),
  };
}

export function buildDelivered(
  nav: NavSeries | null,
  paid: boolean,
  /**
   * Does the paired-window β-adjusted figure EXIST on the pre-gate row?
   *
   * Without this, `gated: !paid` claimed a paid lock for every non-paid tier —
   * including funds where the figure is null upstream and a paid user would see
   * nothing either. That is a false promise: it invites an upgrade for a number
   * that does not exist. The caller reads it off the RAW row as a BOOLEAN, so no
   * gated value crosses the boundary — the same presence-only pattern the page
   * already uses for `attrPresent`.
   */
  rawPairedBetaAdjPresent: boolean,
): DeliveredView {
  if (nav == null) {
    return {
      paired: null,
      fiveYear: null,
      all: [],
      windowStart: null,
      windowEnd: null,
      passiveLabel: null,
      gated: false,
      betaAdjMissingReason: null,
      missingReason:
        "We compare a fund to its twin only over the window where we hold a daily price for both. This fund has no such paired window yet.",
    };
  }
  const rows = Array.isArray(nav.period_table) ? nav.period_table.map(toPeriod) : [];
  const paired = rows.find((r) => r.period === "SI") ?? null;
  return {
    paired,
    fiveYear: rows.find((r) => r.period === "5Y") ?? null,
    all: rows,
    windowStart: nav.series_start ?? null,
    windowEnd: nav.as_of ?? null,
    passiveLabel: nav.passive_label ?? null,
    // Below the paid gate applyGates collapses the table to ONE proof row and
    // nulls its beta_adj_diff_bps. That is a GATE, not missing data — say so.
    // A lock is claimed ONLY when the tier stripped something that really is
    // there. Upstream-missing beats gated: if the figure does not exist, every
    // tier gets the same honest reason instead of an upgrade prompt.
    gated: !paid && rawPairedBetaAdjPresent,
    betaAdjMissingReason:
      !rawPairedBetaAdjPresent && rows.length > 0
        ? "We only report this at matched market risk, and this fund does not yet have a beta measured against its twin — usually because the two have too little shared price history. We are not substituting the unadjusted gap, which would compare two things carrying different amounts of market risk."
        : null,
    missingReason:
      rows.length === 0
        ? "The paired-window return table is not served for this fund."
        : null,
  };
}

// ---------------------------------------------------------------------------
// The active layer (movements 00 / 01)
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  selection: "Its own stock picks",
  geography: "Countries",
  sector: "Sectors",
  commodity: "Commodities",
  macro: "Macro forces",
  theme: "Themes",
};

/** Plain label for a te_decomposition bet_type / rollup kind. */
export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

const KIND_ADJECTIVE: Record<string, string> = {
  geography: "country",
  sector: "sector",
  commodity: "commodity",
  macro: "macro",
  theme: "theme",
};

/** Attributive form of a kind, for "… country, sector and commodity tilts". */
export function kindAdjective(kind: string): string {
  return KIND_ADJECTIVE[kind] ?? kind;
}

/** ["A"] → "A"; ["A","B"] → "A and B"; ["A","B","C"] → "A, B and C". */
export function listPhrase(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export interface MixSlice {
  kind: string;
  label: string;
  /** Share of TOTAL active risk (`share_of_te_var`) — the rollup slices are
   *  EXHAUSTIVE and sum to 1 with selection included. */
  shareOfActive: number;
  nBets: number | null;
}

export interface ActiveMixView {
  slices: MixSlice[];
  /** `idio_risk_share` — the stock-picking sleeve, also present as a slice. */
  selectionShare: number | null;
  /**
   * The display-rule remainder. IMPORTANT: this is NOT a sibling slice of the
   * kinds — the 18 rolled-up bets live INSIDE the kind slices, which already
   * sum to 1. Rendering it as a fifth wedge would double-count ~17% of the
   * page's own risk budget. It is rendered as a NAMED/UN-NAMED disclosure and
   * as a table row, never as part of the strip.
   */
  otherBets: { label: string; nRolled: number; shareOfActive: number | null } | null;
  namedBets: NamedBetView[];
  /** FALSE ⇒ no surface may call any bet "the biggest". */
  topBetConfident: boolean | null;
  windowStart: string | null;
  windowEnd: string | null;
  anchorAsOf: string | null;
  anchorLagWeeks: number | null;
  teTotalBps: number | null;
  basisNote: string | null;
  noNamedBets: boolean;
  /** True when the tier gate withheld the per-bet detail (free proof point only). */
  proofOnly: boolean;
  missingReason: string | null;
}

export interface NamedBetView {
  label: string;
  kind: string;
  factorId: string | null;
  direction: "over" | "under" | null;
  /** Contribution to TRACKING ERROR, bps/yr. This is an ALLOCATION quantity.
   *  It is NOT the bet's standalone risk and must never be rendered under
   *  "can swing a year by ±$N" copy — that column needs a per-bet σ_factor
   *  (`standalone_te_bps`) which is NOT served. */
  teAllocBps: number | null;
  varShare: number | null;
  diversifying: boolean;
  confidence: string | null;
}

function rollupToSlices(rollup: TeRollupRow[]): MixSlice[] {
  // Drop empty sleeves. A fund whose active risk is 100% stock selection still
  // carries zero-share factor rows in the rollup; keeping them would render a
  // legend of 0.0% wedges and let the copy say "the rest is country and sector
  // tilts" when there is no rest.
  return rollup
    .filter((r) => num(r.share_of_te_var) != null && (r.share_of_te_var as number) > 0.0005)
    .map((r) => ({
      kind: r.bet_type,
      label: kindLabel(r.bet_type),
      shareOfActive: r.share_of_te_var as number,
      nBets: num(r.n_bets),
    }))
    .sort((a, b) => b.shareOfActive - a.shareOfActive);
}

/**
 * Build the active-risk mix from whichever te-decomposition view the tier is
 * entitled to: the full paid object, or the free proof point (rollup + top bet).
 */
export function buildActiveMix(
  te: TeDecomposition | null,
  proof: TeProofPreview | null,
): ActiveMixView {
  const empty: ActiveMixView = {
    slices: [],
    selectionShare: null,
    otherBets: null,
    namedBets: [],
    topBetConfident: null,
    windowStart: null,
    windowEnd: null,
    anchorAsOf: null,
    anchorLagWeeks: null,
    teTotalBps: null,
    basisNote: null,
    noNamedBets: false,
    proofOnly: false,
    missingReason:
      "Splitting a fund's active risk needs three years of weekly returns against a matched twin. We do not have that for this fund, so the split is withheld.",
  };

  if (te != null) {
    const ob = te.other_bets ?? null;
    return {
      slices: rollupToSlices(te.rollup ?? []),
      selectionShare: num(te.idio_risk_share),
      otherBets:
        ob != null
          ? {
              label: ob.label,
              nRolled: ob.n_rolled,
              shareOfActive: num(ob.share_of_te_var),
            }
          : null,
      namedBets: (te.bets ?? []).map((b) => ({
        label: b.label,
        kind: b.bet_type,
        factorId: b.factor_id ?? null,
        direction: betSide(b),
        teAllocBps: num(b.te_alloc_bps),
        varShare: num(b.var_share),
        diversifying: b.diversifying === true,
        confidence: b.confidence_state ?? null,
      })),
      topBetConfident: te.top_bet_confident ?? null,
      windowStart: te.window_start ?? null,
      windowEnd: te.window_end ?? null,
      anchorAsOf: te.anchor_as_of ?? null,
      anchorLagWeeks: num(te.anchor_lag_weeks),
      teTotalBps: num(te.te_total_bps),
      basisNote: te.basis_note ?? null,
      noNamedBets: te.no_named_bets === true,
      proofOnly: false,
      missingReason: null,
    };
  }

  if (proof != null) {
    const top = proof.top_bet;
    return {
      ...empty,
      slices: rollupToSlices(proof.rollup ?? []),
      selectionShare: num(proof.idio_risk_share),
      namedBets: top
        ? [
            {
              label: top.label,
              kind: top.bet_type,
              factorId: top.factor_id ?? null,
              direction: top.bet_direction ?? null,
              teAllocBps: num(top.te_alloc_bps),
              varShare: num(top.var_share),
              diversifying: top.diversifying === true,
              confidence: top.confidence_state ?? null,
            },
          ]
        : [],
      topBetConfident: proof.top_bet_confident ?? null,
      windowEnd: proof.window_end ?? null,
      teTotalBps: num(proof.te_total_bps),
      basisNote: proof.basis_note ?? null,
      proofOnly: true,
      missingReason: null,
    };
  }

  return empty;
}

/** Which side of the twin a bet sits on — served `bet_direction`, else the FWL
 *  beta sign (the exact backend rule; y = fund − twin, so beta > 0 is "over").
 *  Deliberately NOT derived from te_alloc_bps: an underweight normally ADDS
 *  tracking error, so those two signs disagree for most bets. */
function betSide(b: { bet_direction?: string | null; beta?: number | null }): "over" | "under" | null {
  if (b.bet_direction === "over" || b.bet_direction === "under") return b.bet_direction;
  const beta = num(b.beta);
  if (beta == null || beta === 0) return null;
  return beta > 0 ? "over" : "under";
}

/**
 * The bets a movement may name in prose. When `top_bet_confident` is false the
 * #1/#2 gap is inside the measurement noise (measured rank-1 stability there is
 * 53% — a coin flip), so the caller gets the top few WITHOUT permission to call
 * any of them the biggest. `superlativeAllowed` is that permission.
 */
export function leadingBets(
  mix: ActiveMixView,
  n = 3,
): { bets: NamedBetView[]; superlativeAllowed: boolean } {
  const ranked = [...mix.namedBets]
    .filter((b) => b.teAllocBps != null)
    .sort((a, b) => Math.abs(b.teAllocBps ?? 0) - Math.abs(a.teAllocBps ?? 0));
  return {
    bets: ranked.slice(0, n),
    superlativeAllowed: mix.topBetConfident === true,
  };
}

// ---------------------------------------------------------------------------
// Concentration / book stats (movements 01 / 06)
// ---------------------------------------------------------------------------

/**
 * DISPATCHER VETO SWITCH. The run-plan fence told me to gate the top-10 slot
 * because Σ `holdings.top_holdings[].weight` is on the wrong book (27.2% where
 * the filed book gives 31.0%). I do not read that field. The field I read —
 * `exposure_xray … concentration::top10_weight` — was traced to
 * `exposure_xray.py:1361` → `holdings_complete.pct_nav` =
 * `SUM(pctVal)/100.0`, the SEC-filed percent-of-NAV basis, and independently
 * reproduced twice against the filed rows (PRNEX 0.309654 vs served
 * 0.30965392782). Its ONE narrowing — the candidate set is the EC long book, so
 * debt/preferred/cash/short lines cannot enter the ten — is carried in the
 * rendered label. Flip this to false to gate the slot anyway.
 */
export const RENDER_TOP10_WEIGHT = true;

/**
 * Active share is GATED CLOSED (see f1-progress.md PARKED-1). The served row
 * cannot be certified per-fund: when the twin look-through fails, the formula
 * degenerates to a fabricated 0.5, and the served payload carries no
 * `method` / `lookthrough_resolved_weight` to catch it (all 17 fabricated funds
 * report confidence_state "high"). Flip to true to ship option (b) — the
 * fabricated-0.5 suppression below is already written and will engage.
 */
export const RENDER_ACTIVE_SHARE = false;

export interface XrayRow {
  row_id?: string | null;
  fund_exposure?: number | null;
  holdings_as_of?: string | null;
  coverage_state?: string | null;
  confidence_state?: string | null;
}

function xrayValue(rows: XrayRow[] | null, rowId: string): XrayRow | null {
  if (!Array.isArray(rows)) return null;
  return rows.find((r) => r?.row_id === rowId) ?? null;
}

/**
 * TRUE when the concentration figures demonstrably do NOT describe the fund's
 * own filed position lines.
 *
 * Master-feeder funds file a single line — their stake in a master portfolio —
 * and `holdings_complete` looks THROUGH it to the master's book. DEMSX files
 * 1 line yet serves a top-10 of 5.2%: if the ten largest positions were really
 * drawn from a one-line book, the top ten would BE the book (~100%).
 *
 * DETECTOR (and its honest limit): `n_positions <= 10` with a top-10 well under
 * the whole book is unambiguous — 121 served funds. But 637 further funds
 * diverge >=5pp from an all-filed-lines top-10 while filing more than ten
 * lines, and the payload CANNOT separate those into "master-feeder
 * look-through" versus the already-disclosed EC-long narrowing (debt, preferred,
 * cash and short lines are outside the x-ray's candidate set). So this flag is
 * used only to ADD a disclosure where look-through is provable; the caption
 * drops the blanket "exactly as filed" claim for everyone, because it is not
 * universally true.
 *
 * WHAT SERVING WOULD NEED to make this exact: a `lookthrough_applied` boolean
 * (or a `book_basis` label / the `holdings_complete` line count) carried on the
 * concentration rows. All three exist upstream in `holdings_complete`; none
 * reaches `fund_profile_facts`.
 */
export function looksThroughToMaster(
  nFiledPositions: number | null,
  top10Weight: number | null,
): boolean {
  if (nFiledPositions == null || top10Weight == null) return false;
  return nFiledPositions <= 10 && top10Weight < 0.9;
}

export interface ConcentrationView {
  /** Top-10 EQUITY holdings as % of NAV, filed basis. See RENDER_TOP10_WEIGHT. */
  top10Weight: number | null;
  top10AsOf: string | null;
  /** Always null today — the served value is on the wrong book (L10). */
  effectivePositions: null;
  effectivePositionsReason: string;
  activeShare: number | null;
  activeShareAsOf: string | null;
  activeShareReason: string | null;
}

export function buildConcentration(
  exposureXray: { rows?: unknown[] } | null,
): ConcentrationView {
  const rows = (exposureXray?.rows as XrayRow[] | undefined) ?? null;
  const t10 = xrayValue(rows, "concentration::top10_weight::absolute");
  const as = xrayValue(rows, "concentration::active_share::absolute");
  const asVal = num(as?.fund_exposure);

  // Fail-closed on the look-through degeneracy: exactly 0.5 means the benchmark
  // side of `0.5·Σ|w_fund − w_bench|` was EMPTY, so the number describes nothing.
  const asFabricated = asVal != null && Math.abs(asVal - 0.5) < 1e-4;

  return {
    top10Weight: RENDER_TOP10_WEIGHT ? num(t10?.fund_exposure) : null,
    top10AsOf: t10?.holdings_as_of ?? null,
    effectivePositions: null,
    effectivePositionsReason:
      "The served figure counts only the fund's US-listed equity lines, with their weights rescaled to 100%. For a fund with foreign or private holdings that materially misstates how concentrated it is — usually reading too concentrated, sometimes the reverse, and for a handful of funds by many times over. We would rather show nothing than a number on the wrong book; it returns once it is computed on the filed book.",
    activeShare: RENDER_ACTIVE_SHARE && !asFabricated ? asVal : null,
    activeShareAsOf: as?.holdings_as_of ?? null,
    activeShareReason:
      !RENDER_ACTIVE_SHARE
        ? "We can only trust this number when we can see through the twin's ETFs to the shares underneath. For a small number of funds that look-through fails silently, and nothing in the served data tells us which — so it is held back for every fund until it does."
        : asFabricated
          ? "We could not see through this fund's twin to the shares underneath, so there is nothing to measure it against."
          : null,
  };
}

// ---------------------------------------------------------------------------
// The biggest recent move (movement 01 posline) — `positioning_changes`
// ---------------------------------------------------------------------------
// Served panel `positioning_changes_v0.3_no_expansion` (backend spec
// `recent-changes-te-ranked`, shipped 2026-08-25), section gate `free`. Each row
// is a year-over-year N-PORT diff carrying BOTH filing dates and, where the
// change can be priced, `te_impact_bps ≈ |Δweight| × σ` — an ESTIMATE — with its
// rank `te_rank`.
//
// RULE 1 · SIGNIFICANCE OR SILENCE. The cutover spec (lines 200-202) says this
// posline is either significance-ranked or ABSENT — "not magnitude-ranked prose
// pretending to be significance-ranked". That is not a stylistic preference:
// measured on manifest 58, the TE-top change is NOT the largest change by size
// in 1,787 of the 3,037 eligible funds (58.8%), so a magnitude ranking names the
// wrong move more often than the right one. Everything below fails CLOSED on a
// missing `te_rank`, which covers both honest gaps:
//   • 2,575 funds serve no `positioning_changes` at all;
//   • 207 more serve only `concentration` / `cash` rows, which the BACKEND
//     deliberately gives `te_impact_bps: null` — spec line 50, "no TE mapping in
//     v1 ... don't force a fake common scale".
// Neither substitutes a magnitude ranking; both render their reason.
//
// RULE 2 · THE SUPERLATIVE IS EARNED, NOT ASSUMED. `te_rank` is assigned across
// every TE-estimated CANDIDATE row while the panel surfaces a subset, so it is
// not 1-based within the served rows: 191 of the 3,037 have a served best of
// rank 2 or worse, i.e. a bigger priced change exists that this panel does not
// carry. Calling that one "the biggest" would be false. Only a served
// `te_rank === 1` sets `earnedSuperlative`; the rest get the softer label. This
// is the same discipline as `top_bet_confident` in the te_decomposition — a
// superlative needs its own served evidence.
//
// RULE 3 · DUAL AS-OF STAMPS ARE MANDATORY. Filings lag 30-61 days and the two
// endpoints are a year apart; a row missing either stamp is refused rather than
// stamped with one date. (Measured: 0 served rows are missing a stamp, so this
// is drift protection, not a live filter.)
//
// RULE 4 · ONE SCALE. Only `value_unit === "pp"` rows are eligible. The panel
// also serves `count` rows (151 of them — Effective Positions), and mixing a
// count into percentage-point copy is the cross-type fake commensurability the
// backend spec forbids. Every TE-ranked row is `pp` today, so this guard is
// likewise drift protection — but the `count` rows it excludes are real.
//
// NOT RENDERED, deliberately: `te_impact_bps` itself. It is a STANDALONE
// estimate (|Δweight| × σ), while the te_alloc_bps figures inches away in the
// same card are ALLOCATIONS of the fund's total tracking error. Printing the two
// side by side invites exactly the standalone-vs-allocation conflation this
// movement's header calls out. The ranking basis is stated in words instead, and
// the word "estimated" is required copy (backend spec, data-integrity
// guardrails).

/** The one change this posline names. Every field is a straight served read. */
export interface RecentMove {
  /** Served label: a ticker for `position` rows, a sector/theme name otherwise. */
  name: string;
  /** `position` | `theme` | `sector` — the priced kinds. */
  changeType: string;
  /** `entered` | `exited` | `increased` | `decreased`. */
  direction: string;
  /** Signed percentage points of the portfolio. */
  magnitudePp: number | null;
  /** Percent of the portfolio at each filing. `priorPct` is null exactly when the
   *  direction is `entered` and `currentPct` when it is `exited` — the served
   *  payload leaves them null and they are NEVER back-filled with 0. */
  priorPct: number | null;
  currentPct: number | null;
  /** Both stamps, always. Never collapsed to one date. */
  asOfPrior: string;
  asOfCurrent: string;
  /** Served `te_rank === 1`: no priced change outranks this one. See RULE 2. */
  earnedSuperlative: boolean;
  /** The largest of the priced moves by SIZE, named only when it is a different
   *  change from the one above — the concrete proof that the ranking did work.
   *  Null for a below-the-gate reader, who holds one row and cannot compare. */
  largestBySize: string | null;
}

export interface RecentMoveView {
  move: RecentMove | null;
  /** Why nothing is shown. Non-null exactly when `move` is null. */
  reason: string | null;
}

const NO_CHANGES_SERVED =
  "We compare a fund's filed holdings against its own filing from a year earlier. That comparison is not served for this fund, so there is no recent move to rank.";

const NO_PRICED_CHANGE =
  "This fund's filed holdings did change, but none of the served changes carries a risk-impact estimate — concentration and cash moves have no tracking-error mapping, and some positions sit outside our pricing universe. Ranking what is left by size would name the loudest change rather than the one that mattered, so we hold this back.";

const UNREADABLE =
  "This fund's positioning-change data could not be read, so nothing is claimed about it.";

/**
 * Rows that may be ranked and rendered: priced, on the pp scale, dual-stamped.
 *
 * `te_rank` is the whole test for "priced" — the backend assigns it only to rows
 * that carry a TE estimate, and the two agree exactly on manifest 58 (1,913 rows
 * have a null `te_impact_bps`, the same 1,913 have a null `te_rank`). Testing
 * `te_impact_bps` as well would look safer and be worse: it is NOT whitelisted
 * into `ShiftPreview` (the posline does not print it, so it does not cross the
 * gate), and requiring it here failed the anonymous tier closed on every fund.
 */
function eligibleShift(o: Record<string, unknown>): boolean {
  return (
    num(o["te_rank"]) != null &&
    o["value_unit"] === "pp" &&
    str(o["change_name"]) != null &&
    str(o["change_direction"]) != null &&
    str(o["holdings_as_of_prior"]) != null &&
    str(o["holdings_as_of_current"]) != null
  );
}

/**
 * Served `positioning_changes` (or its locked marker) → the one move to name.
 *
 * Takes the GATED value, because this section's gate is `free` and therefore has
 * THREE states, not two: the full rows (free/paid), the whitelisted one-row
 * `ShiftPreview` proof point (anonymous), and null. All three converge on the
 * same three outcomes here — a priced top move, the no-priced-change reason, or
 * the not-served reason — so no tier is told a different story about the fund,
 * only a shorter one.
 */
export function buildRecentMove(gatedSection: unknown): RecentMoveView {
  // --- anonymous: the whitelisted single-row proof point --------------------
  if (isLocked(gatedSection)) {
    const p = getPreview(gatedSection) as Record<string, unknown> | null;
    // A hard lock (malformed gate → no projector) carries no preview at all.
    if (p == null) return { move: null, reason: UNREADABLE };
    if (!eligibleShift(p)) return { move: null, reason: NO_PRICED_CHANGE };
    return {
      move: {
        name: str(p["change_name"]) as string,
        changeType: str(p["change_type"]) ?? "",
        direction: str(p["change_direction"]) as string,
        magnitudePp: num(p["change_magnitude"]),
        priorPct: num(p["prior_value"]),
        currentPct: num(p["current_value"]),
        asOfPrior: str(p["holdings_as_of_prior"]) as string,
        asOfCurrent: str(p["holdings_as_of_current"]) as string,
        earnedSuperlative: num(p["te_rank"]) === 1,
        largestBySize: null,
      },
      reason: null,
    };
  }

  const s = obj(gatedSection);
  if (!s) return { move: null, reason: NO_CHANGES_SERVED };
  const rows = Array.isArray(s["rows"]) ? s["rows"] : null;
  if (rows == null) return { move: null, reason: UNREADABLE };
  if (rows.length === 0) return { move: null, reason: NO_CHANGES_SERVED };

  const priced = rows
    .map(obj)
    .filter((o): o is Record<string, unknown> => o != null && eligibleShift(o));
  if (priced.length === 0) return { move: null, reason: NO_PRICED_CHANGE };

  // Array order is NOT a contract (two builds of the same gold emit these rows
  // in different orders), so sort explicitly. `te_rank` is the served ranking and
  // wins; the te_impact/surfaced tie-breaks only make the pick deterministic.
  const byRank = [...priced].sort(
    (a, b) =>
      (num(a["te_rank"]) as number) - (num(b["te_rank"]) as number) ||
      (num(b["te_impact_bps"]) ?? 0) - (num(a["te_impact_bps"]) ?? 0) ||
      (num(a["surfaced_rank"]) ?? 9e9) - (num(b["surfaced_rank"]) ?? 9e9),
  );
  const top = byRank[0];

  // The loudest move, for contrast — compared only among the PRICED rows, which
  // all measure percentage points of the same portfolio. Comparing against a
  // concentration or cash row would be comparing different quantities.
  const bySize = [...priced].sort(
    (a, b) => Math.abs(num(b["change_magnitude"]) ?? 0) - Math.abs(num(a["change_magnitude"]) ?? 0),
  )[0];
  const largestBySize =
    bySize != null && bySize["change_id"] !== top["change_id"] ? str(bySize["change_name"]) : null;

  return {
    move: {
      name: str(top["change_name"]) as string,
      changeType: str(top["change_type"]) ?? "",
      direction: str(top["change_direction"]) as string,
      magnitudePp: num(top["change_magnitude"]),
      priorPct: num(top["prior_value"]),
      currentPct: num(top["current_value"]),
      asOfPrior: str(top["holdings_as_of_prior"]) as string,
      asOfCurrent: str(top["holdings_as_of_current"]) as string,
      earnedSuperlative: num(top["te_rank"]) === 1,
      largestBySize,
    },
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// The neighbourhood (movement 03) — `fund_profile_facts.neighbourhood`
// ---------------------------------------------------------------------------
// Served panel (`neighbourhood_v1_2026-08-09`), keyed by BLEND not by fund: two
// funds on the same twin see the same history. Everything below is a straight
// read of the served payload — the web tier never computes a return series.
//
// HONESTY GATE (fail-closed): the twin leg is a CURRENT-MIX BACKCAST. The
// payload must carry `hypothetical: true` AND `mix_as_of`, because the page's
// only defence against reading that leg as a track record is the chip built
// from those two fields. A payload missing either is SUPPRESSED, not rendered
// unlabelled — the same rule the upstream builder enforces.

/** One leg's summary tile: annualised % and the end value of $10,000. */
export interface NeighbourhoodTile {
  annPct: number | null;
  endValue: number | null;
}

/** One month of the growth-of-$10,000 grid. All four legs are priced. */
export interface NeighbourhoodPoint {
  t: string;
  twin: number | null;
  ivv: number | null;
  vt: number | null;
  bnd: number | null;
}

export interface NeighbourhoodYear {
  year: number;
  twinPct: number | null;
  worldPct: number | null;
  /** A calendar year the window only partly covers (first/last year). */
  partial: boolean;
}

export interface NeighbourhoodDrawdown {
  rank: number | null;
  peak: string | null;
  trough: string | null;
  /** null exactly when `ongoing` — never back-filled with the window end. */
  recovered: string | null;
  depthPct: number | null;
  underwaterMonths: number | null;
  ongoing: boolean;
}

export interface NeighbourhoodCapture {
  /** The reference leg capture is measured against (VT on every served row). */
  reference: string | null;
  upPct: number | null;
  downPct: number | null;
  nDownMonths: number | null;
  /** Down months for the reference where the twin still rose. */
  nDownMonthsTwinUp: number | null;
}

export interface NeighbourhoodView {
  /** Always true on a rendered view — see the honesty gate above. */
  hypothetical: true;
  /** The refit date the backcast mix was fit at. Never null on a rendered view. */
  mixAsOf: string;
  windowStart: string | null;
  windowEnd: string | null;
  windowYears: number | null;
  /** The leg whose first price bound the window start ("VT", "IEMG", …). */
  bindingTicker: string | null;
  /**
   * Days skipped because a leg had no price (skipped for EVERY leg, never
   * filled). Not emitted by `neighbourhood_v1_2026-08-09` — read optionally so
   * the disclosure appears the moment the builder starts emitting it, and stays
   * silent (rather than showing a fabricated 0) until then.
   */
  nDaysDropped: number | null;
  /** Served comparator labels — used verbatim, never restated in the web tier. */
  labels: { ivv: string | null; vt: string | null; bnd: string | null };
  tiles: {
    twin: NeighbourhoodTile;
    ivv: NeighbourhoodTile;
    vt: NeighbourhoodTile;
    bnd: NeighbourhoodTile;
  };
  capture: NeighbourhoodCapture | null;
  drawdowns: NeighbourhoodDrawdown[];
  years: NeighbourhoodYear[];
  points: NeighbourhoodPoint[];
  methodVersion: string | null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function tile(v: unknown): NeighbourhoodTile {
  const o = obj(v);
  return { annPct: num(o?.["ann_pct"]), endValue: num(o?.["end_value"]) };
}

/**
 * Served `neighbourhood` payload → view model, or null (render nothing).
 *
 * Null means the fund honestly has no neighbourhood: no twin, a twin below the
 * fit floor, no fit winner, a sub-36-month window, or a blend/panel desync.
 * Upstream already fails closed on all five; there is no reason code to render,
 * so the movement omits itself rather than printing a vague "unavailable".
 */
export function buildNeighbourhood(rawSection: unknown): NeighbourhoodView | null {
  const n = obj(rawSection);
  if (!n) return null;

  // The honesty gate. Both halves of the chip must exist or nothing renders.
  const mixAsOf = str(n["mix_as_of"]);
  if (n["hypothetical"] !== true || mixAsOf == null) return null;

  const rawPoints = Array.isArray(n["series"]) ? n["series"] : [];
  const points: NeighbourhoodPoint[] = rawPoints
    .map((p) => {
      const o = obj(p);
      const t = str(o?.["t"]);
      if (t == null) return null;
      return { t, twin: num(o?.["twin"]), ivv: num(o?.["ivv"]), vt: num(o?.["vt"]), bnd: num(o?.["bnd"]) };
    })
    .filter((p): p is NeighbourhoodPoint => p != null);
  // A single point is not a history; two is the minimum a line can describe.
  if (points.length < 2) return null;

  const w = obj(n["window"]);
  const labels = obj(n["labels"]);
  const tiles = obj(n["tiles"]);
  const cap = obj(n["capture"]);

  // FAIL CLOSED on the four-file contract. The assembler writes series, stats,
  // drawdowns and years atomically and refuses to emit a partial set, so a
  // MISSING array here means the payload drifted — not that the fund has no
  // drawdowns. Coercing to [] silently dropped whole cards while the section and
  // its nav entry still rendered, which is the nested-contract-collapse shape:
  // the parent looks populated so no section-level guard can see it.
  if (!Array.isArray(n["drawdowns"]) || !Array.isArray(n["years"]) || !obj(n["capture"])) {
    return null;
  }

  const drawdowns: NeighbourhoodDrawdown[] = (Array.isArray(n["drawdowns"]) ? n["drawdowns"] : [])
    .map((d) => {
      const o = obj(d);
      if (!o) return null;
      return {
        rank: num(o["rank"]),
        peak: str(o["peak"]),
        trough: str(o["trough"]),
        recovered: str(o["recovered"]),
        depthPct: num(o["depth_pct"]),
        underwaterMonths: num(o["underwater_months"]),
        ongoing: o["ongoing"] === true,
      };
    })
    .filter((d): d is NeighbourhoodDrawdown => d != null)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const years: NeighbourhoodYear[] = (Array.isArray(n["years"]) ? n["years"] : [])
    .map((y) => {
      const o = obj(y);
      const yr = num(o?.["year"]);
      if (yr == null) return null;
      return {
        year: yr,
        twinPct: num(o?.["twin_pct"]),
        worldPct: num(o?.["world_pct"]),
        partial: o?.["partial"] === true,
      };
    })
    .filter((y): y is NeighbourhoodYear => y != null)
    .sort((a, b) => a.year - b.year);

  return {
    hypothetical: true,
    mixAsOf,
    windowStart: str(w?.["start"]),
    windowEnd: str(w?.["end"]),
    windowYears: num(w?.["years"]),
    bindingTicker: str(w?.["binding_ticker"]),
    nDaysDropped: num(w?.["n_days_dropped"]) ?? num(n["n_days_dropped"]),
    labels: {
      ivv: str(labels?.["ivv"]),
      vt: str(labels?.["vt"]),
      bnd: str(labels?.["bnd"]),
    },
    tiles: {
      twin: tile(tiles?.["twin"]),
      ivv: tile(tiles?.["ivv"]),
      vt: tile(tiles?.["vt"]),
      bnd: tile(tiles?.["bnd"]),
    },
    capture: cap
      ? {
          reference: str(cap["reference"]),
          upPct: num(cap["up_capture_pct"]),
          downPct: num(cap["down_capture_pct"]),
          nDownMonths: num(cap["n_down_months"]),
          nDownMonthsTwinUp: num(cap["n_down_months_twin_up"]),
        }
      : null,
    drawdowns,
    years,
    points,
    methodVersion: str(n["method_version"]),
  };
}

/**
 * "+5.3%" / "−17.8%" — a signed percentage already expressed in percent units.
 * Rounds HALF AWAY FROM ZERO (same reason as `fmtBpsAsPct`: `toFixed` inherits
 * binary representation and silently rounds an exact half the wrong way).
 */
export function fmtPctSigned(v: number | null | undefined, digits = 1): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = Math.pow(10, digits);
  const r = (Math.sign(v) * Math.round(Math.abs(v) * f)) / f;
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r).toFixed(digits)}%`;
}

/** "110%" — a capture ratio, whole percent. */
export function fmtPctWhole(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `${Math.round(v)}%`;
}

/** "2014-07" → "Jul 2014" — the compact form the drawdown table needs. */
export function shortMonth(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})/.exec(d);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
