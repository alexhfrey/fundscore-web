import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCanonicalCatalog,
  getQueryBySlug,
} from "@/lib/serving/screener";
import {
  QueryHeader,
  ResultCard,
  EmptyResults,
  QueryFooter,
  SaveLensStrip,
} from "@/components/query";

// Canonical published query page — ISR. SEO + LLM-citation target: stable URL,
// statically renderable HTML with source/as-of co-published (serving_architecture
// Decision 5). Revalidate daily; the canonical results rebuild out of band.
export const revalidate = 86400;
export const dynamicParams = true;

interface QueryPageProps {
  params: Promise<{ slug: string }>;
}

// Pre-render all 15 canonical query slugs at build (the SEO/citation set).
//
// The catalog lives in the fund_score data lake, NOT in this repo (screener.ts:
// "parquets stay in object storage / the lake, never bundled with the app"). On
// a build host that has no lake — Vercel — this read fails. Returning [] there
// is correct rather than fatal: `dynamicParams` is true, so slugs render on
// demand instead of at build. Set QUERY_PARQUET_DIR to a reachable source (an
// R2/S3 path via DuckDB httpfs, or MotherDuck per Decision 6) to restore
// build-time prerendering and the SEO benefit.
export async function generateStaticParams() {
  try {
    const catalog = await getCanonicalCatalog();
    return catalog.map((c) => ({ slug: c.query_slug }));
  } catch (err) {
    console.warn(
      "[q/[slug]] no query catalog at build — skipping prerender. Slugs will render on demand.",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function generateMetadata({
  params,
}: QueryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getQueryBySlug(slug);
  if (!page) return { title: "Query Not Found | FundScore" };
  const { catalog } = page;
  const asOf = catalog.as_of ? ` As of ${catalog.as_of}.` : "";
  return {
    title: `${catalog.parsed_query_text} — Funds Ranked by Relevance | FundScore`,
    description: `${catalog.universe_size.toLocaleString()} funds ranked by Relevance to '${catalog.parsed_query_text}'. See top matches, the query-relevant metric, fees, and the Why behind each rank.${asOf}`,
    alternates: { canonical: `/q/${slug}` },
  };
}

export default async function QueryPage({ params }: QueryPageProps) {
  const { slug } = await params;
  const page = await getQueryBySlug(slug);
  // Refusal specs do not get a canonical /q/{slug}; only valid rankings render here.
  if (!page || page.catalog.query_type === "refusal") notFound();

  const { catalog, rows } = page;

  // ItemList / FinancialProduct structured data for LLM-citation + SEO. Relevance
  // is published ONLY alongside the parsed query in the same record (§ SEO rule).
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: catalog.parsed_query_text,
    numberOfItems: rows.length,
    itemListElement: rows.map((r) => ({
      "@type": "ListItem",
      position: r.rank,
      item: {
        "@type": "FinancialProduct",
        name: r.fund_name,
        tickerSymbol: r.ticker,
        url: `/funds/${r.ticker}`,
      },
    })),
  };

  return (
    <div className="bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <QueryHeader catalog={catalog} />

        {rows.length === 0 ? (
          <EmptyResults
            message="No funds meet this question"
            suggestion="Try loosening the most restrictive part of the question."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <ResultCard key={row.series_id} row={row} />
            ))}
          </div>
        )}

        {/* Save / Share strip (§ 7). Client island so the page stays ISR; the
            Suspense boundary isolates its useSearchParams() read. */}
        {rows.length > 0 && (
          <Suspense fallback={null}>
            <SaveLensStrip
              querySlug={catalog.query_slug}
              parsedQueryText={catalog.parsed_query_text}
            />
          </Suspense>
        )}

        <QueryFooter catalog={catalog} />
      </div>
    </div>
  );
}
