// ============================================================================
// Methodology registry — the single source of truth for what the /methodology
// page documents. Every scored artifact the product surfaces has one entry
// here: its plain-language meaning, the method in customer language, the data
// sources, the as-of / freshness cadence, and — critically — the limitations.
//
// TRUST SURFACE: these values are copied from the real shipped data products in
// the fund_score repo (method_version columns, eval_date / *_as_of maxima, and
// the data-product specs under docs/product/data_products/). Do NOT invent
// numbers here. When an artifact is rebuilt, update the matching `methodVersion`
// and `asOf` fields. Anchors are stable: scores/labels deep-link to
// `/methodology#<anchor>`.
// ============================================================================

export interface MethodologyArtifact {
  /** Stable anchor id — deep-link target, never renamed once shipped. */
  anchor: string;
  /** Customer-facing name of the score/label as it appears in product. */
  title: string;
  /** One-line "what it is" used in the index card. */
  tagline: string;
  /** Real method_version string from the shipped gold artifact. */
  methodVersion: string;
  /** Human-readable as-of / freshness line (real dates from the data). */
  asOf: string;
  /** "What it measures" — customer language, 1-3 short paragraphs. */
  measures: string[];
  /** "How we calculate it" — the method in plain language. */
  method: string[];
  /** Data sources feeding this artifact. */
  sources: string[];
  /** Explicit non-definitions — what this score does NOT mean. */
  notMeaning: string[];
  /** Known limitations — the honest gaps. This is the trust payload. */
  limitations: string[];
}

// --- Method versions and as-of dates verified against shipped gold artifacts
//     in /Users/alexfrey/Projects/fund_score/data/gold (2026-06-23). ---

export const METHODOLOGY_ARTIFACTS: MethodologyArtifact[] = [
  {
    anchor: "value-score",
    title: "Value Score",
    tagline:
      "How much genuine active value a fund delivered, net of its fee, versus its passive alternative — a backward-looking, relative read.",
    methodVersion: "value_score_v0.2",
    asOf: "Computed as of 2026-04-25, from each fund's weekly returns through that date.",
    measures: [
      "The Value Score answers one question: of the active options here, did this fund genuinely add value after its fee, versus simply buying its passive alternative (a low-cost index ETF that tracks the same style)? It is shown as net value over the passive alternative, per year, and as a 0–100 score anchored so that 50 = breakeven (the fund exactly earned back its fee).",
      "Above breakeven means the fund's beta-adjusted edge more than covered its fee in the past; below means the fee exceeded the edge — for most active funds, the honest default is that the passive alternative wins. It is a relative, diagnostic read, not a prediction.",
    ],
    method: [
      "We strip out broad market and style exposure (the fund's return minus β times its passive alternative), so generic market beta earns no credit — only the manager's beta-clean excess counts.",
      "That beta-clean edge is deliberately shrunk toward zero because it is mostly noise — specifically it is half of the gross information ratio multiplied by the recent tracking error, so the figure shown is roughly half the fund's raw historical excess. The fund's net expense ratio (at full weight) is then subtracted. What remains is net value over the passive alternative, in basis points per year — the headline number. The 0–100 score is a fixed (not percentile) rescaling anchored at 50 = breakeven.",
      "A fund is only scored when a low-cost passive alternative can fairly stand in for it (sufficient return history and a close enough style match); otherwise it is shown as Too new, Not comparable, or Fee unavailable rather than given a number. Figures are deliberately coarsened because the signal is mostly noise.",
    ],
    sources: [
      "Weekly fund and passive-alternative (L2 blend) returns from passive_alt_daily_nav",
      "Net expense ratio (named share class) and the passive alternative's own fee from expense history",
      "Replica quality (l2_replica_quality) gating which funds can be scored",
    ],
    notMeaning: [
      "It is not a forecast or an expected return — historically even the highest-scoring funds tended to trail their passive alternative, net of fees, going forward.",
      "It is not a buy / sell / hold recommendation, and a high score is not a probability of beating the market.",
      "It is not a universal quality rating — only about 1 in 5 active funds clears breakeven, and the typical fund scores around 35.",
    ],
    limitations: [
      "The underlying signal is roughly 98% noise and regime-dependent (it can reverse in down markets), so we lead with the breakeven sign and treat the exact magnitude as soft.",
      "A single beta adjustment removes broad style but not concentrated theme bets — a growth fund's AI tilt, for example, can still show as positive value.",
      "Coverage is equity funds only for now, and a fund whose strategy has no fair passive stand-in is shown as Not comparable rather than scored.",
    ],
  },
  {
    anchor: "value-offering",
    title: "Value Offering",
    tagline:
      "Whether a fund is a reasonable way to get its exposure and manager, read against its passive alternative.",
    methodVersion: "vo_reframe_v0.3",
    asOf:
      "Evaluated as of 2025-10-31 holdings; skill evidence as of 2026-03-31.",
    measures: [
      "Value Offering reads a fund along two questions, not one rating. First: is there evidence the manager's stock selection has added value (judged selection)? Second: what kind of bet are you actually buying — a stock-picker's book, or mostly a sector or theme tilt you could get more cheaply (bet profile)?",
      "It is shown as a small set of plain badges (for example, Stock-picking edge, Mostly a sector or theme bet, Selection unproven, Costs more, Index, Building track record) — always next to the named passive alternative the fund is being read against.",
    ],
    method: [
      "Axis A (judged selection) uses a hierarchical Bayesian skill posterior — the probability the fund's manager has added value through selection, measured before fees (gross-of-fee, so the signal isn't conflated with cost) and after removing what passive exposures explain.",
      "Axis B (bet profile) uses a risk decomposition that splits the fund's tracking risk versus its passive alternative into idiosyncratic stock-picking risk versus shared sector or theme risk. A fund whose active risk is mostly a sector or theme tilt is labelled as such, even when its returns look strong.",
      "A theme-ride override softens a selection badge to a bet badge when nearly all of a fund's edge is explained by one concentrated theme — so a strong number doesn't read as proven skill when it's really one bet.",
    ],
    sources: [
      "Hierarchical skill posteriors (returns-based, net and gross of fees)",
      "Risk decomposition panel (risk_decomp_v0.1) — active risk split from holdings",
      "SEC N-PORT holdings and the matched passive ETF blend",
    ],
    notMeaning: [
      "It is not an expected return or a forecast of how the fund will do.",
      "It is not a probability of beating the market, and not a buy / sell / hold recommendation.",
      "It is not a universal quality rating — a fund can be a reasonable way to make a bet that turns out poorly.",
    ],
    limitations: [
      "Judged selection requires enough return history; funds with too short a track record are labelled Building track record rather than scored.",
      "The skill posterior is returns-based — it can detect selection that shows up in performance, but cannot see a manager's reasoning or intent.",
      "Bet profile depends on holdings, which carry the usual SEC filing lag (see Exposure X-Ray limitations).",
    ],
  },
  {
    anchor: "fee-fairness",
    title: "Fee Fairness",
    tagline:
      "How a fund's fee compares with what similar funds charge for similar work.",
    methodVersion: "fee_rd_v0.1",
    asOf: "Fee data as of the most recent filed expense ratios (2026-05).",
    measures: [
      "Fee Fairness places a fund's expense ratio in the distribution of fees charged by comparable funds, so you can see whether you are paying near the middle, the cheap end, or the expensive end for the kind of fund it is.",
    ],
    method: [
      "We compare the fund's filed net expense ratio against peers in the same category, and against the fee of its closest passive alternative, to produce a fairness band.",
      "The active fee — what you pay above the passive alternative — is computed from the fund's fee minus the blended fee of the matched passive ETFs.",
    ],
    sources: [
      "SEC-filed net expense ratios (MFRR / prospectus filings)",
      "Matched passive ETF blend and ETF expense ratios",
    ],
    notMeaning: [
      "A fair fee is not a low fee, and an unfair fee is not a prediction the fund will underperform.",
      'We never say a fee is "worth it" or "overpriced" — only how it compares.',
    ],
    limitations: [
      "Fee comparisons depend on a usable peer category and a passive match; where neither is available we suppress the comparison rather than guess.",
      "Only filed expense ratios are used — funds with no recent filed fee show no fairness band.",
    ],
  },
  {
    anchor: "skill-evidence",
    title: "Skill Evidence",
    tagline:
      "The statistical evidence that a fund's manager has added value through selection.",
    methodVersion: "skill_hier_v0",
    asOf: "Returns through the most recent month; skill panel as of 2026-03-31.",
    measures: [
      "Skill Evidence is the probability — read from the fund's own track record — that the manager has added value beyond what its passive exposures explain, net of what it can be attributed to chance.",
    ],
    method: [
      "A hierarchical Bayesian model pools each fund toward its peer group, so a short or noisy record is shrunk toward the typical fund in its category rather than over-read.",
      "We report it as bands and a probability of positive (and of negative) skill, measured on gross-of-fee selection so the signal isn't conflated with fee economics.",
    ],
    sources: [
      "Fund and passive-alternative return series",
      "Peer-group structure from the fund taxonomy",
    ],
    notMeaning: [
      "Evidence of past selection is not a guarantee of future returns.",
      "A low probability is not proof of no skill — it can simply mean not enough evidence yet.",
    ],
    limitations: [
      "Funds with insufficient return history get no skill read (surfaced as a missing-evidence state, never a fabricated number).",
      "The model sees returns, not holdings reasoning — it measures whether selection showed up, not why.",
    ],
  },
  {
    anchor: "exposure-xray",
    title: "Exposure X-Ray",
    tagline:
      "What a fund actually holds — by theme, sector, stock, region and style — versus its passive alternative.",
    methodVersion: "exposure_xray_v0.2",
    asOf:
      "Holdings as of the displayed source date; passive-blend holdings as of 2025-10-31.",
    measures: [
      "Exposure X-Ray breaks a fund's portfolio into theme, sector, stock, country / region, style, concentration and asset-class rows, and shows the fund's exposure, the passive alternative's exposure, and the difference side by side.",
      "Style labels translate factor names into plain language; the raw factor names are kept for the methodology and professional views.",
    ],
    method: [
      "We start from SEC N-PORT holdings, look through fund-of-funds to the underlying securities, and classify each position into the exposure rows using a curated theme library and reference classifications.",
      "Passive-relative rows subtract the matched passive blend's exposure from the fund's, so you see the active difference, not just the absolute weight.",
    ],
    sources: [
      "SEC N-PORT holdings (with fund-of-funds look-through)",
      "Curated v0 theme library (stock-basket themes)",
      "Reference sector / region / style classifications and the matched passive blend",
    ],
    notMeaning: [
      "Exposure differences describe what the fund holds today, not what it will return.",
      'A larger difference is not automatically "better" — it is simply a more distinctive bet.',
    ],
    limitations: [
      "Holdings-derived rows are considered stale after 180 days; past that threshold the affected claims are suppressed.",
      "SEC holdings are filed with a lag, so the most recent portfolio may differ from the filed snapshot.",
      "Where classification coverage of a portfolio is partial, we show the covered weight and suppress claims about the uncovered part rather than fill it in.",
      "Foreign-listed positions are classified where reference data exists; a foreign sector vendor gap means some non-US sector rows are not yet available.",
    ],
  },
  {
    anchor: "return-attribution",
    title: "Return Attribution",
    tagline:
      "Which holdings, sectors and themes drove a fund's return versus its passive alternative.",
    methodVersion: "return_attr_v0.1",
    asOf:
      "Evaluated at the 2025-10-31 holdings frontier; period-start holdings as early as the prior filing.",
    measures: [
      "Return Attribution decomposes a fund's excess return over its passive alternative into contributions from individual stocks, sectors and themes, over 1-, 3- and 5-year windows.",
    ],
    method: [
      "We use a Brinson-style allocation that holds the period-start portfolio and attributes the return difference to where the fund was positioned differently from its passive baseline.",
      "Per-member contributions are exact; the unattributed remainder reflects trading within the period (positions changed between filings), which quarterly holdings cannot resolve.",
    ],
    sources: [
      "SEC N-PORT period-start holdings",
      "Sharadar SEP daily stock prices",
      "The matched passive blend",
    ],
    notMeaning: [
      "Attribution explains the past period only; it is not a forecast of which holdings will drive future returns.",
    ],
    limitations: [
      "Because holdings are quarterly, contributions do not sum exactly to the total excess return — the gap is real trading the snapshots can't see, reported as a residual, not clamped or imputed.",
      "Coverage gate (Gate A): the pre-2025 holdings store is keyed to US stock tickers and drops foreign holdings, so funds whose portfolios were heavily international or emerging-market cannot be attributed with US-only prices — those fund-periods are suppressed rather than shown with distorted numbers.",
      "A small foreign-ADR residual can survive on otherwise-US funds; these are real, unclamped values reflecting the same documented foreign-attribution gap.",
    ],
  },
  {
    anchor: "risk-attribution",
    title: "Risk & Attribution",
    tagline:
      "What drives a fund in return space — its active factor and theme bets beyond a cheap index, how much of a theme it holds versus actively bets on, and how those bets played out.",
    methodVersion: "factor_exp_v0.1 · exposure_divergence_v0.1 · exposure_path_v0.1",
    asOf:
      "Return-based exposures through 2026-04-24; holdings side as of the displayed filing date.",
    measures: [
      "The factor lens regresses a fund's returns on the market, the Fama-French style factors, and a library of curated theme baskets to estimate its exposures. The active β is the bet beyond the fund's passive baseline — its closest passive alternative (the L2 index blend) when one exists, otherwise the broad market. A near-zero active β on a theme means the fund holds it only as much as that baseline does.",
      "The divergence headline juxtaposes two different measurements of the same exposure: how much of a theme the fund holds (% of assets) and how much of an active bet it runs on that theme (active β). These are never added together.",
      "The bias / timing / idiosyncratic decomposition splits a fund's realised active return over the holdings path into the persistent tilt (bias), the part from carrying more of a factor in the quarters it paid (timing), and the residual left after the factor bets (idiosyncratic).",
    ],
    method: [
      "Exposures come from trailing return regressions under several control models — raw, passive-alternative-stripped (vs the fund's L2 index blend), market-stripped, and incremental-to-FF6. The headline active β for any active claim is stripped of the fund's passive alternative when one exists, and falls back to the market otherwise — the page names which baseline applies. The regression runs to a fresher date than the holdings because it needs only returns, not the filing-lagged portfolio; both as-of dates are shown.",
      "The realised attribution multiplies each factor's average active tilt by the cumulative factor return over the path (bias) and adds the covariance of tilt and return (timing). Only the idiosyncratic residual is read as stock-selection evidence — and even then it is cross-referenced with the fund's skill evidence, never asserted alone.",
    ],
    sources: [
      "Fund and factor daily returns (Fama-French factors, market, curated theme baskets)",
      "SEC N-PORT holdings (for the divergence headline's holdings side)",
      "The matched passive blend",
    ],
    notMeaning: [
      "Bias and timing are the realised contribution of the fund's exposure path, NOT a claim that the manager can time factors — three research probes found no evidence of timing skill. Only the idiosyncratic residual reads as selection skill.",
      "This returns-based factor attribution is a separate family from the holdings-based Return Attribution; the two answer the same question two ways and are never summed.",
      "How much of a theme a fund holds is not the same as how much it actively bets on it — a large holding can be pure market exposure.",
      "Exposures and realised attribution describe the past, not the future; we do not forecast factor or theme returns.",
    ],
    limitations: [
      "Estimated for about 4,700 funds — those with enough usable return history and a matched passive blend; the rest are shown as unavailable rather than estimated.",
      "Where a factor or theme β isn't statistically distinguishable from zero (|t| < 2), we say so rather than present it as a real bet.",
      "The divergence holdings side inherits the 180-day holdings staleness and filing-lag limits; where the passive blend has no theme look-through we lean on the absolute weight and active β rather than a misleading self-overweight.",
    ],
  },
  {
    anchor: "te-decomposition",
    title: "Tracking-Error Decomposition",
    tagline:
      "Where a fund's benchmark-relative risk (tracking error) comes from — split into its factor tilts and its stock selection, ranked bet by bet.",
    methodVersion: "te_decomp_v0.1",
    asOf:
      "Computed as of 2026-05-09, from each fund's trailing three-year weekly returns.",
    measures: [
      "Tracking error is how much a fund's returns swing away from its passive alternative. This decomposition answers where that risk comes from: how much is the fund's factor and sector/theme tilts, and how much is its stock selection — the part no factor explains.",
      "It leads with a grouped rollup (for example, about half of a fund's tracking error is stock-specific and its biggest factor source is a sector tilt), then lists the individual bets ranked by how much each contributes to tracking error. A bet with a negative contribution is diversifying: it moves against the rest of the book and reduces tracking error.",
    ],
    method: [
      "We measure tracking error on the same series as the fund's headline tracking error: its beta-adjusted weekly return versus its own closest passive blend, over a trailing three-year window, with Fama-French style controls — so the page shows a single tracking-error number.",
      "That variance is split into a factor sleeve and a stock-selection sleeve. The factor sleeve is allocated across the fund's active factor bets by each bet's share of factor variance; the stock-selection sleeve is the residual left after the factor bets. The two sleeves combine in quadrature back to the total, and the per-bet allocations sum to the factor sleeve.",
      "Each bet's beta is a single-factor read that carries a confidence state from its t-statistic. Only the variance shares scaled into the sleeve split are meaningful — the raw beta levels double-count on overlapping bets, so we never present them as standalone risk contributions.",
    ],
    sources: [
      "Beta-adjusted weekly fund and passive-blend active returns (the tracking-error basis)",
      "The standardized factor-exposure model (sector, theme and macro factors, cluster-representative selection)",
      "The fund's matched passive ETF blend (its passive alternative)",
    ],
    notMeaning: [
      "A bet's tracking-error contribution is a risk reading, not a return — it does not say the bet made or lost money.",
      "The per-bet betas are single-factor reads on a collinear factor set; only the sleeve-scaled variance shares are meaningful, so we lead with the grouped rollup rather than the individual beta levels.",
      "There is no per-stock tracking-error number — individual stock bets are listed by their active weight, not given a fabricated risk contribution.",
    ],
    limitations: [
      "Estimated for about 2,000 funds with enough aligned weekly return history; funds with too short a shared window are shown as unavailable rather than estimated.",
      "On collinear factor sets the individual per-bet betas are not individually robust — the method honors this by serving only the sleeve-scaled shares and flagging each bet's confidence rather than presenting fragile beta levels.",
      "Negative (diversifying) contributions are real and served as-is, never clamped to zero; the sleeves always anchor to the fund's headline tracking error.",
    ],
  },
  {
    anchor: "manager-moves",
    title: "Manager Moves",
    tagline:
      "Whether the trades a fund made between filings have, so far, helped or hurt versus holding still.",
    methodVersion: "manager_moves_v1",
    asOf: "Evaluated at the 2025-10-31 holdings frontier.",
    measures: [
      "Manager Moves looks at the changes a fund made to its portfolio between filings and estimates whether those specific trades have added or subtracted value relative to having left the portfolio unchanged.",
    ],
    method: [
      "We diff consecutive holdings snapshots to recover what was bought and sold, then mark those changes against subsequent prices to estimate the trade-impact contribution.",
    ],
    sources: [
      "SEC N-PORT consecutive holdings snapshots",
      "Sharadar SEP daily stock prices",
    ],
    notMeaning: [
      "A positive trade impact so far is not a prediction that future trades will help.",
    ],
    limitations: [
      "We can only price changes whose securities are in our pricing universe; when coverage of the changed names is too low the row is suppressed, and in a degraded band the numeric impact is kept but the label is suppressed.",
      "Stale vendor security references (for example a ticker rename) can briefly misattribute a small, bounded set of names; known cases are documented and tracked.",
    ],
  },
  {
    anchor: "positioning-changes",
    title: "Portfolio Shifts",
    tagline:
      "How a fund's exposures moved between its two most recent filings.",
    methodVersion: "positioning_changes_v0.1",
    asOf:
      "Current holdings 2025-10-31 versus the prior qualifying filing (as early as 2024-11-30).",
    measures: [
      "Portfolio Shifts compares a fund against its own recent history — how its sector, theme, region, style, concentration and top-position exposures changed between its two most recent filings — so you can see where a manager is leaning in or out.",
    ],
    method: [
      "We reconstruct both filing endpoints and difference them across six exposure families, surfacing the largest moves and guarding against changes that are really security-identifier renames rather than real trades.",
    ],
    sources: [
      "SEC N-PORT holdings at two filing endpoints",
      "The same exposure classifications used by Exposure X-Ray",
    ],
    notMeaning: [
      "A shift describes what changed, not whether it will pay off.",
    ],
    limitations: [
      "A fund needs a qualifying prior filing within the lookback window; without one, no shift is shown.",
      "Where classified-weight coverage is too low to anchor a diff, the affected family is suppressed.",
      "Probable security-identifier changes are flagged and excluded so a rename doesn't read as a trade.",
    ],
  },
  {
    anchor: "alternatives",
    title: "Alternatives to Inspect",
    tagline:
      "Other funds and passive options worth comparing against this one.",
    methodVersion: "alternatives_v0.2",
    asOf: "Evaluated at the 2025-10-31 holdings frontier.",
    measures: [
      "Alternatives to Inspect surfaces the fund's closest passive alternative plus a short list of comparable funds, so you can see what else covers similar ground before deciding anything yourself.",
    ],
    method: [
      "Candidates are drawn from the fund's category and exposure neighborhood, with the matched passive blend as the anchor alternative, and ranked by how comparable they are.",
    ],
    sources: [
      "Fund taxonomy and exposure neighborhood",
      "The matched passive ETF blend",
    ],
    notMeaning: [
      'Alternatives are options to inspect, not "the fund you should use" — we never name a single correct alternative.',
    ],
    limitations: [
      "Alternatives are only as complete as the covered universe; a fund in a thin category may have few comparable candidates.",
    ],
  },
  {
    anchor: "takeaways",
    title: "Takeaways",
    tagline:
      "The handful of plain-language points a profile is trying to make.",
    methodVersion: "takeaways_v0.1",
    asOf: "Evaluated at the 2025-10-31 holdings frontier.",
    measures: [
      "Takeaways turn the profile's underlying facts — fee, exposure difference, selection evidence, recent shifts — into a short, plain-language list of what stands out about the fund.",
    ],
    method: [
      "Each takeaway is generated deterministically from the fund's own data points using a fixed template library; nothing is written free-hand and no point appears without a factual basis behind it.",
    ],
    sources: [
      "The fund's own Value Offering, Fee Fairness, Exposure X-Ray and shift data",
    ],
    notMeaning: [
      "Takeaways describe and explain; they do not advise or predict.",
    ],
    limitations: [
      "A takeaway is only generated when its supporting data point exists; missing inputs simply drop the corresponding point rather than guess.",
    ],
  },
  {
    anchor: "the-take",
    title: "The Take",
    tagline:
      "A one-paragraph summary of the profile, built only when the evidence is complete.",
    methodVersion: "the_take_v0.1",
    asOf: "Evaluated at the 2025-10-31 holdings frontier.",
    measures: [
      "The Take is a single short paragraph that pulls the profile's most important points together into a readable summary.",
    ],
    method: [
      "It is assembled deterministically (selector deterministic_v0) from the same vetted takeaways and facts — a chosen, ordered arrangement of true statements, not a free-form generated opinion.",
    ],
    sources: ["The fund's Takeaways and underlying profile facts"],
    notMeaning: [
      "The Take is a summary of evidence, not a recommendation or a forecast.",
    ],
    limitations: [
      "The Take is suppressed for funds that lack the full evidence set, so a partial profile never gets a confident-sounding summary it hasn't earned.",
    ],
  },
];

// ----------------------------------------------------------------------------
// Cross-cutting facts shown in the Data Sources and Limits sections. Real
// values from the shipped artifacts and specs.
// ----------------------------------------------------------------------------

export const METHODOLOGY_LAST_UPDATED = "2026-06-23";

/** Coverage ceiling for the returns-based selection signal (factor alpha). */
export const FACTOR_ALPHA_COVERAGE = {
  funds: 3928,
  share: "about 64–66% of the active retail equity universe",
};

/** Holdings frontier the holdings-derived products are evaluated against. */
export const HOLDINGS_FRONTIER = "2025-10-31";

/** Shared staleness threshold for holdings-derived claims. */
export const HOLDINGS_STALE_DAYS = 180;

export const SOURCE_FAMILIES = [
  {
    name: "SEC filings",
    detail:
      "N-PORT (holdings), N-CEN, and MFRR / prospectus filings (fees, benchmarks). Public, point-in-time, filed with a lag.",
  },
  {
    name: "Vendor pricing & ETF reference",
    detail:
      "Daily stock prices (Sharadar SEP), ETF prices and expense ratios, and reference security classifications.",
  },
  {
    name: "FundScore derived panels",
    detail:
      "Everything we compute — skill posteriors, risk decomposition, exposures, attribution — each stamped with a method version and as-of date.",
  },
];
