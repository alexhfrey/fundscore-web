// ============================================================================
// Query header / "Interpreted-As" strip (query_results.md § 2 + first viewport).
// Shows what the query means, the eligible-universe size, the as-of date, the
// reference frame, and an honest "why these funds" basis. Public, indexable.
// ============================================================================
import Link from "next/link";
import { fmtDate } from "@/lib/serving/format";
import type { CatalogRow } from "@/lib/serving/screener";

const QUERY_TYPE_LABEL: Record<string, string> = {
  composition: "Composition",
  quality_structural: "Quality / structural",
  substitute: "Substitute",
  mixed: "Mixed",
  behavioral: "Behavioral",
};

const REFERENCE_FRAME_LABEL: Record<string, string> = {
  vs_own_passive_alternative: "vs the fund's own passive alternative",
  vs_anchor_fund: "vs the anchor fund",
  vs_peer_group: "vs the peer group",
  vs_market: "vs the market",
  absolute: "absolute",
};

// Honest one-line "why these funds" basis, by query type. No prediction / advice.
function basisFor(catalog: CatalogRow): string {
  switch (catalog.query_type) {
    case "composition":
      return "These are the funds whose holdings give them the most of this theme above what their passive blend already holds. Higher Relevance = more theme on top of the passive baseline. This describes current holdings, not a forecast of theme returns.";
    case "substitute":
      return "These funds sit in the same peer group as the anchor and cost less. Relevance reflects how much you'd save at a comparable exposure. It is not advice to swap funds.";
    case "quality_structural":
      return "These funds rank highest on the structural metric for this question — how index-like a fund is, or how strong its returns-based selection evidence is. It measures the past, not the future.";
    case "mixed":
      return "These funds best satisfy the combination of filters and measurement in the question. Relevance composites the parts; it is not a recommendation.";
    default:
      return "Funds are ranked by Relevance to the stated question above.";
  }
}

export function QueryHeader({ catalog }: { catalog: CatalogRow }) {
  const frame = catalog.reference_frame
    ? REFERENCE_FRAME_LABEL[catalog.reference_frame] ?? catalog.reference_frame
    : null;
  const typeLabel = QUERY_TYPE_LABEL[catalog.query_type] ?? catalog.query_type;

  return (
    <header className="mb-8">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1466b8]">
        Funds ranked by Relevance
      </div>
      <h1 className="mt-1 text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
        {catalog.parsed_query_text}
      </h1>

      {/* Interpreted-as strip: type, frame, universe size, as-of */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Chip label="Interpreted as" value={typeLabel} />
        {frame && <Chip label="Reference frame" value={frame} />}
        <Chip
          label="Eligible funds"
          value={catalog.universe_size.toLocaleString()}
        />
        <Chip label="Showing" value={`Top ${catalog.result_count}`} />
        {catalog.as_of && <Chip label="As of" value={fmtDate(catalog.as_of)} />}
      </div>

      {/* Honest "why these funds" basis */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Why these funds
        </div>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          {basisFor(catalog)}
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Ranking computed by FundScore. Relevance is shown only in the context
          of this stated question — it is not a quality rating.{" "}
          <Link href="/methodology" className="text-[#1466b8] hover:underline">
            How we compute Relevance →
          </Link>
        </p>
      </div>
    </header>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
      <span className="font-medium uppercase tracking-wide text-[10px] text-gray-400">
        {label}
      </span>
      <span className="font-semibold text-gray-700">{value}</span>
    </span>
  );
}
