import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLensBySlug, renderLens } from "@/lib/serving/lens";
import {
  QueryHeader,
  ResultCard,
  EmptyResults,
  QueryFooter,
  LensControls,
  LensDiffPanel,
} from "@/components/query";

// Personal saved Lens (query_results.md § 7 + serving_architecture Decision 5).
// A Lens is a personally named, privately tracked view over an underlying public
// query. Per-user + shareable via slug → dynamic + noindex (not crawlable). The
// ranking is re-run live through the SAME screener as /q/{slug}; the change diff
// compares real captured snapshots — nothing here is fabricated.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lens — FundScore",
  robots: { index: false, follow: false },
};

interface LensPageProps {
  params: Promise<{ lens_slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function LensPage({
  params,
  searchParams,
}: LensPageProps) {
  const { lens_slug } = await params;
  const { saved } = await searchParams;

  const lens = await getLensBySlug(lens_slug);
  if (!lens) return <LensNotFound />;

  // Who is viewing? Owner gets the visit snapshot + change diff; a shared viewer
  // (anyone holding the slug) sees the current ranking but writes no snapshot.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerUserId = user?.id ?? null;

  const rendered = await renderLens(lens, viewerUserId);
  if (!rendered) return <LensUnresolved lens_slug={lens_slug} />;

  const { page, isOwner, diff } = rendered;
  const { catalog, rows } = page;

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <LensControls
          lensSlug={lens.lensSlug}
          querySlug={lens.slug}
          name={lens.name}
          note={lens.note}
          savedOn={lens.createdAt}
          isOwner={isOwner}
          justSaved={saved === "1"}
        />

        <QueryHeader catalog={catalog} />

        {/* Change-tracking diff — owner-only (the tracking belongs to the owner). */}
        {isOwner && diff && (
          <LensDiffPanel diff={diff} savedOn={lens.createdAt} />
        )}

        <div className="mt-6">
          {rows.length === 0 ? (
            <EmptyResults message="No funds meet this question right now" />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <ResultCard key={row.series_id} row={row} />
              ))}
            </div>
          )}
        </div>

        <QueryFooter catalog={catalog} />
      </div>
    </div>
  );
}

function LensNotFound() {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-gray-900">Lens not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          This Lens link doesn&apos;t resolve. It may have been deleted, or the
          link may be incorrect.
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

function LensUnresolved({ lens_slug }: { lens_slug: string }) {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-gray-900">
          This Lens&apos;s question is no longer published
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          The saved Lens <code className="text-gray-500">{lens_slug}</code>{" "}
          points to a question that isn&apos;t in the current published set, so we
          can&apos;t rank it right now. We never show a stale or made-up ranking.
        </p>
        <Link
          href="/lens"
          className="mt-4 inline-block rounded-lg bg-[#1466b8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f4f8c]"
        >
          ← Back to your Lenses
        </Link>
      </div>
    </div>
  );
}
