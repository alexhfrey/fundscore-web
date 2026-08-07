import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCanonicalCatalog,
  getQueryBySlug,
} from "@/lib/serving/screener";
import { describeDbHost } from "@/lib/db";
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

// Marks generateStaticParams' own "catalog empty under REQUIRE_Q_PRERENDER" refusal so the
// read-failure handler re-throws it verbatim instead of relabelling a successful read.
const EMPTY_CATALOG = Symbol.for("fundscore.q.emptyCatalog");

interface QueryPageProps {
  params: Promise<{ slug: string }>;
}

// Pre-render the canonical query slugs at build (the SEO/citation set).
//
// The catalog is served from Postgres (screener-beta-port). What happens when
// the build cannot read it is deliberately ASYMMETRIC, because the two kinds of
// build have opposite cost functions:
//
//   LOCAL build → FAIL. This is the gate CLAUDE.md requires before any change
//     is called done. A gate that passes while blind to the data layer is worse
//     than no gate: it reports "0 prerendered /q/ paths" as if that were the
//     code's doing. Nobody is being served by a local build, so failing costs
//     nothing and buys an honest signal. (This catch used to swallow it, which
//     is how two workers reported different prerender counts for identical code
//     — one had a loaded local DB, the other silently hit prod.)
//
//   DEPLOYED build → LOUD SUCCESS. `dynamicParams` is true and these pages are
//     ISR, so zero prerendered slugs costs a cold render on first hit and
//     nothing else. Turning that recoverable degradation into a failed deploy
//     would block every OTHER fix in the same push — including a fix for the
//     outage that caused it. So it shouts, names the host, and continues.
//     Set REQUIRE_Q_PRERENDER=1 on the deployment to make it fail there too;
//     that is the right setting once prod actually carries the query tables
//     (today it does not — the serving load is item D1).
export async function generateStaticParams() {
  try {
    const catalog = await getCanonicalCatalog();
    if (catalog.length === 0) {
      // Reachable but empty: same end state (no prerendered slugs), different
      // cause, and a legitimate one before the serving load. Still say so —
      // "0 paths" must never be a silent outcome.
      console.warn(
        `[q/[slug]] canonical query catalog is EMPTY at ${describeDbHost()} — 0 slugs prerendered. Not an error; that database has no canonical queries loaded.`,
      );
      // REQUIRE_Q_PRERENDER is set once prod genuinely carries the query tables,
      // and it means "0 prerendered slugs is a deploy failure". An EMPTY catalog
      // is that outcome just as much as an unreachable one — covering only the
      // unreachable case would let a load that produced no rows sail past the
      // very flag meant to catch it.
      if (process.env.REQUIRE_Q_PRERENDER === "1") {
        throw Object.assign(
          new Error(
            [
              "",
              "  ✖ /q/[slug]: the canonical query catalog is EMPTY and REQUIRE_Q_PRERENDER=1.",
              `      database: ${describeDbHost()}`,
              "",
              "  The catalog read fine — it has no rows. Load the query serving tables, or",
              "  unset REQUIRE_Q_PRERENDER if this database is not expected to carry them yet.",
              "",
            ].join("\n"),
          ),
          // The catch below reports READ FAILURES and would relabel this as one, burying the
          // fact that the read succeeded. Marked so it passes through verbatim.
          { [EMPTY_CATALOG]: true },
        );
      }
    }
    return catalog.map((c) => ({ slug: c.query_slug }));
  } catch (err) {
    // Our own empty-catalog refusal, not a read failure — re-throw it untouched.
    if (typeof err === "object" && err !== null && EMPTY_CATALOG in err) throw err;
    // Drizzle wraps the driver error and puts the whole SELECT in `.message`,
    // which buries the one fact that matters (ECONNREFUSED vs relation-missing
    // vs auth). Walk to the root cause and report that instead.
    let root: unknown = err;
    while (root instanceof Error && root.cause) root = root.cause;
    const cause = (root instanceof Error ? root.message : String(root)).split("\n")[0];
    const banner = [
      "",
      "  ✖ /q/[slug]: could not read the canonical query catalog at build.",
      `      database: ${describeDbHost()}`,
      `      cause:    ${cause}`,
      "",
    ].join("\n");

    if (process.env.VERCEL && process.env.REQUIRE_Q_PRERENDER !== "1") {
      console.error(
        `${banner}  Deployed build CONTINUING with 0 prerendered /q/ slugs. They will render on\n  demand via ISR (dynamicParams). Set REQUIRE_Q_PRERENDER=1 to make this fail.\n`,
      );
      return [];
    }

    throw new Error(
      `${banner}  This build is failing on purpose rather than shipping 0 prerendered /q/ pages\n  with no signal. Point DATABASE_URL at a reachable serving database and rebuild.\n`,
    );
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
