// ============================================================================
// Deterministic /search parser + refusal classifier (TS port of the Python
// query_parser.py for the ephemeral /search surface).
// ----------------------------------------------------------------------------
// The /search route is ephemeral and noindex. Per serving_architecture.md it is
// a dynamic route handler that redirects to a canonical /q/{slug} when one
// exists, and otherwise renders a refusal or an honest "not yet supported"
// state. In v0 the live Python ranking engine is NOT wired into the web app;
// only the 15 canonical query specs are materialized. So /search:
//   1. runs the refusal classifier FIRST (advice / prediction / personalization
//      must NEVER produce a ranking and must NOT leak advice) — ported verbatim
//      from query_parser.py so the copy charter matches the backend exactly;
//   2. otherwise matches the free text against the canonical catalog's query
//      phrasings → resolves to a /q/{slug};
//   3. otherwise returns parser_low_confidence (an honest "we couldn't
//      interpret this" with curated example alternatives) — never a fabricated
//      ranking.
// This is a deliberate v0 boundary: live free-text ranking over the full
// universe requires the Python engine as a sidecar (T-future), not part of T5b.
// ============================================================================

export type RefusalCode =
  | "personalized_advice"
  | "prediction"
  | "unsupported_theme"
  | "unsupported_universe"
  | "ambiguous_anchor"
  | "parser_low_confidence"
  | "insufficient_eligible_universe";

// Closed taxonomy, copy ported 1:1 from query_parser.py REFUSAL_COPY. The copy
// states FundScore's scope; it never leaks advice / prediction / personalization.
export const REFUSAL_COPY: Record<RefusalCode, string> = {
  personalized_advice:
    "FundScore does not produce personalized recommendations. Try asking about exposures, fees, or substitute funds instead.",
  prediction:
    "FundScore does not predict which funds will outperform. We can show you which funds match an exposure, fee, or style you specify.",
  unsupported_theme:
    "That theme is not in the curated theme library yet. Try one of the supported themes.",
  unsupported_universe:
    "That asset class or wrapper is outside the supported universe (US-listed equity mutual funds and ETFs).",
  ambiguous_anchor:
    "We could not resolve that fund to a single ticker. Try the exact ticker.",
  parser_low_confidence:
    "We could not confidently interpret this question. Try one of the example queries, or rephrase.",
  insufficient_eligible_universe:
    "Too few funds match this question to rank responsibly. Try broadening the filters.",
};

// Headline per refusal code (page H1). Honest, not euphemistic.
export const REFUSAL_HEADLINE: Record<RefusalCode, string> = {
  personalized_advice: "We don't give personalized recommendations",
  prediction: "We don't predict which funds will outperform",
  unsupported_theme: "That theme isn't supported yet",
  unsupported_universe: "That's outside our supported universe",
  ambiguous_anchor: "We couldn't pin that fund to one ticker",
  parser_low_confidence: "We couldn't interpret this question",
  insufficient_eligible_universe: "Too few funds to rank responsibly",
};

// Curated example queries (ported from query_parser.py SUGGESTED_ALTERNATIVES).
// These phrasings each resolve to a real canonical /q/{slug}.
export const SUGGESTED_ALTERNATIVES: string[] = [
  "funds with AI Infrastructure exposure above their passive blend",
  "cheaper funds with comparable exposure to FCNTX",
  "closet indexers in US large-cap",
  "US large-cap funds with a stock-picking edge",
];

// --- refusal triggers (ported verbatim from query_parser.py) ----------------
const PERSONALIZATION_PATTERNS: RegExp[] = [
  /\bmy\b/, /\bi\b/, /\bme\b/, /\bmine\b/, /\bour\b/, /\bwe\b/,
  /401\s*\(?k\)?/, /\bira\b/, /\broth\b/, /\bretire/, /\bretirement\b/,
  /\bfor my\b/, /\bmy situation\b/, /\bmy goals?\b/, /\bmy age\b/,
  /\bmy income\b/, /\brisk tolerance\b/, /\bshould i\b/, /\bsuit(s|able)\b/,
  /\bfor someone\b/, /\bnest egg\b/,
];
const PREDICTION_PATTERNS: RegExp[] = [
  /\bwill\b/, /\boutperform/, /\bbeat the market\b/, /\bgoing to\b/,
  /\bfuture\b/, /\bnext year\b/, /\bgo up\b/, /\bgains? next\b/,
  /\bwinner/, /\bbest fund\b/, /\bbest funds?\b/, /\bwhich.*win\b/,
  /\bpredict/, /\bforecast/, /\bguarant/, /\bsure thing\b/, /\bmoon\b/,
  /\bskyrocket/, /\bmost likely to\b/,
];
const ADVICE_PATTERNS: RegExp[] = [
  /\bshould i\b/, /\bwhat should\b/, /\brecommend/, /\badvice\b/,
  /\bwhat to buy\b/, /\bwhat do i buy\b/, /\bhelp me pick\b/,
  /\btell me what\b/, /\bwhich one should\b/,
];

function norm(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export type ParseResult =
  | { kind: "refusal"; code: RefusalCode; rawQuery: string }
  | { kind: "redirect"; slug: string }
  | { kind: "low_confidence"; code: "parser_low_confidence"; rawQuery: string };

/**
 * Deterministic parse for /search. Refusal classifier runs first (order matches
 * query_parser.py: advice/personalization → personalized_advice; future/winner
 * → prediction). Otherwise the text is matched against the canonical catalog's
 * phrasings (provided by the caller). No match → parser_low_confidence.
 */
export function parseSearchQuery(
  rawQuery: string,
  catalog: { query_slug: string; parsed_query_text: string; query_type: string }[],
): ParseResult {
  const raw = rawQuery ?? "";
  const q = norm(raw);
  if (!q) return { kind: "low_confidence", code: "parser_low_confidence", rawQuery: raw };

  // 1. Refusal classifier FIRST (load-bearing for trust).
  if (matchesAny(q, ADVICE_PATTERNS) || matchesAny(q, PERSONALIZATION_PATTERNS)) {
    return { kind: "refusal", code: "personalized_advice", rawQuery: raw };
  }
  if (matchesAny(q, PREDICTION_PATTERNS)) {
    return { kind: "refusal", code: "prediction", rawQuery: raw };
  }

  // 2. Match against canonical phrasings. Exact (normalized) first, then a
  //    token-overlap heuristic so an example query reliably resolves even when
  //    paraphrased lightly. Never invents a slug — only returns one that exists.
  const candidates = catalog.filter((c) => c.query_type !== "refusal");
  const exact = candidates.find((c) => norm(c.parsed_query_text) === q);
  if (exact) return { kind: "redirect", slug: exact.query_slug };

  const best = bestTokenMatch(q, candidates);
  if (best) return { kind: "redirect", slug: best };

  // 3. No canonical match and not a refusal → honest low-confidence state.
  return { kind: "low_confidence", code: "parser_low_confidence", rawQuery: raw };
}

const STOPWORDS = new Set([
  "the", "a", "an", "with", "to", "of", "in", "for", "and", "their", "that",
  "above", "funds", "fund", "exposure",
]);

function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .replace(/[^a-z0-9\s/-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

// Jaccard-style overlap; require a strong overlap so we don't mis-route. A
// strict threshold keeps the canonical-redirect honest — borderline text falls
// through to the low-confidence state rather than a wrong ranking.
function bestTokenMatch(
  q: string,
  candidates: { query_slug: string; parsed_query_text: string }[],
): string | null {
  const qt = tokens(q);
  if (qt.size === 0) return null;
  let bestScore = 0;
  let bestSlug: string | null = null;
  for (const c of candidates) {
    const ct = tokens(c.parsed_query_text);
    if (ct.size === 0) continue;
    let inter = 0;
    for (const t of qt) if (ct.has(t)) inter++;
    const union = new Set([...qt, ...ct]).size;
    const score = inter / union;
    // Also require that most of the query's distinctive tokens are covered.
    const coverage = inter / qt.size;
    if (score > bestScore && coverage >= 0.6 && inter >= 2) {
      bestScore = score;
      bestSlug = c.query_slug;
    }
  }
  return bestScore >= 0.45 ? bestSlug : null;
}
