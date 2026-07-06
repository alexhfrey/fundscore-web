// ============================================================================
// Query-page data / methodology / disclosures footer (query_results.md § 10).
// Required on every result page: parser + ranker version, as-of, methodology
// link, no-advice + no-conflict disclosures.
// ============================================================================
import Link from "next/link";
import { fmtDate } from "@/lib/serving/format";
import type { CatalogRow } from "@/lib/serving/screener";

export function QueryFooter({ catalog }: { catalog: CatalogRow }) {
  return (
    <footer className="mt-12 border-t border-gray-200 pt-6">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        <span>Parser {catalog.parser_version}</span>
        <span>·</span>
        <span>Ranker {catalog.ranker_version}</span>
        {catalog.as_of && (
          <>
            <span>·</span>
            <span>Universe as of {fmtDate(catalog.as_of)}</span>
          </>
        )}
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-gray-500">
        FundScore is a transparency and analysis tool. It does not provide
        personalized investment advice and does not predict which funds will
        outperform. Relevance ranks funds against the stated question only.{" "}
        <Link href="/methodology" className="text-[#1466b8] hover:underline">
          Read the methodology →
        </Link>
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-gray-400">
        We charge users, not fund companies. No paid placements. No
        affiliate-incentive ranking.
      </p>
    </footer>
  );
}
