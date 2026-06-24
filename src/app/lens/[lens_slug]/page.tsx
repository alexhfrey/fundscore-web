import type { Metadata } from "next";
import Link from "next/link";
import { getQueryBySlug } from "@/lib/serving/screener";
import {
  QueryHeader,
  ResultCard,
  EmptyResults,
  QueryFooter,
} from "@/components/query";

// Personal saved Lens — route + minimal render only. Per the page spec a Lens is
// a personally named, privately tracked view over an underlying public query;
// SAVE / SHARE / change-tracking / persistence is Track 6 (NOT this task).
//
// T5b boundary: this route exists and renders. When a lens_slug trivially maps
// to an existing canonical query slug, we resolve and render its results (read
// path is already settled). Otherwise — because no Lens persistence store exists
// yet — we render an honest "coming soon" placeholder that fabricates nothing.
// Per-user, not crawlable (noindex, dynamic) per serving_architecture Decision 5.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lens — FundScore",
  robots: { index: false, follow: false },
};

interface LensPageProps {
  params: Promise<{ lens_slug: string }>;
}

export default async function LensPage({ params }: LensPageProps) {
  const { lens_slug } = await params;

  // Trivial resolution: a Lens whose slug IS a canonical query slug renders that
  // query's results. (Full Lens spec resolution + personal naming lands in T6.)
  const page = await getQueryBySlug(lens_slug);

  if (!page || page.catalog.query_type === "refusal") {
    return <LensPlaceholder />;
  }

  const { catalog, rows } = page;
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 rounded-lg border border-[#1466b8]/20 bg-[#e8f0fe] px-4 py-2 text-xs text-[#0f4f8c]">
          Your saved view of this question. Naming, change-tracking, and sharing
          are coming soon.
        </div>
        <QueryHeader catalog={catalog} />
        {rows.length === 0 ? (
          <EmptyResults message="No funds meet this question" />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <ResultCard key={row.series_id} row={row} />
            ))}
          </div>
        )}
        <QueryFooter catalog={catalog} />
      </div>
    </div>
  );
}

function LensPlaceholder() {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-gray-900">Lenses are coming soon</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          A Lens is your saved view of a fund question — privately named and
          tracked so you can see what changes over time. Saving and sharing
          Lenses isn&apos;t available yet. In the meantime, you can run any of
          our published questions.
        </p>
        <Link
          href="/search"
          className="mt-4 inline-block rounded-lg bg-[#1466b8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f4f8c]"
        >
          Ask about funds →
        </Link>
      </div>
    </div>
  );
}
