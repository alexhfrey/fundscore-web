import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getAllCatalog } from "@/lib/serving/screener";
import {
  parseSearchQuery,
  SUGGESTED_ALTERNATIVES,
  REFUSAL_COPY,
  REFUSAL_HEADLINE,
} from "@/lib/serving/query-parser";
import { RefusalPanel } from "@/components/query";

// Ephemeral query landing — dynamic, noindex (serving_architecture Decision 5).
// Parses the raw NL string: redirects to a canonical /q/{slug} when one exists,
// renders an explicit refusal for advice/prediction/personalization, and an
// honest "couldn't interpret" state otherwise. Never indexed; never fabricated.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search — FundScore",
  robots: { index: false, follow: false },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const raw = (q ?? "").trim();

  if (!raw) return <SearchLanding />;

  const catalog = await getAllCatalog();
  const result = parseSearchQuery(raw, catalog);

  if (result.kind === "redirect") {
    // A canonical query exists for this NL → land the user on the indexable page.
    redirect(`/q/${result.slug}`);
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {result.kind === "refusal" ? (
          <RefusalPanel code={result.code} rawQuery={result.rawQuery} />
        ) : (
          // parser_low_confidence: valid surface, but no canonical match and not
          // a refusal. Honest "couldn't interpret" with curated alternatives —
          // never a fabricated ranking. (Live free-text ranking over the full
          // universe is the deferred Python-engine sidecar, not part of v0.)
          <LowConfidence rawQuery={result.rawQuery} />
        )}
      </div>
    </div>
  );
}

function LowConfidence({ rawQuery }: { rawQuery: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          We couldn&apos;t interpret this question
        </div>
        <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
          {REFUSAL_HEADLINE.parser_low_confidence}
        </h1>
        {rawQuery && (
          <p className="mt-2 text-sm italic text-gray-500">
            You asked: &ldquo;{rawQuery}&rdquo;
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          {REFUSAL_COPY.parser_low_confidence}
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Our published query set is still growing. The questions below resolve
          to a ranked answer today.
        </p>
      </div>
      <SuggestionList />
    </div>
  );
}

function SearchLanding() {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Ask about funds
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Ask about exposures, fees, substitutes, or how index-like a fund is.
          We rank funds by Relevance to your question — we don&apos;t recommend
          or predict.
        </p>
        <SuggestionList />
      </div>
    </div>
  );
}

function SuggestionList() {
  return (
    <div className="mt-6">
      <div className="text-sm font-semibold text-gray-900">Try a question</div>
      <ul className="mt-2 space-y-2">
        {SUGGESTED_ALTERNATIVES.map((s) => (
          <li key={s}>
            <Link
              href={`/search?q=${encodeURIComponent(s)}`}
              className="block rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:border-[#1466b8]/40 hover:bg-gray-50"
            >
              {s}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
