import type { Metadata } from "next";
import {
  METHODOLOGY_ARTIFACTS,
  METHODOLOGY_LAST_UPDATED,
  FACTOR_ALPHA_COVERAGE,
  HOLDINGS_FRONTIER,
  HOLDINGS_STALE_DAYS,
  SOURCE_FAMILIES,
  type MethodologyArtifact,
} from "@/lib/methodology/registry";

// Public, indexable trust surface. No per-user gating — gating methodology
// behind an account would undermine every score and as-of affordance that
// deep-links here (methodology.md § Access / Gating).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title:
    "FundScore Methodology: Fees, Exposures, Passive Alternatives, and Skill Evidence",
  description:
    "How FundScore calculates Value Offering, Fee Fairness, skill evidence, Exposure X-Ray, return attribution, and source freshness — and where the limits are.",
};

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">How FundScore works</h1>
        <p className="mt-3 text-gray-600 leading-relaxed">
          FundScore helps you understand what you actually get for a fund&apos;s
          fee versus its closest passive alternative. This page explains every
          score and label we show, the data behind it, how fresh that data is,
          and — just as importantly — where the limits are. Each section here is
          a permanent link, so any number in the product can point you straight
          to its explanation.
        </p>
        <p className="mt-3 text-xs text-gray-400">
          Methodology last updated {METHODOLOGY_LAST_UPDATED}.
        </p>
      </header>

      {/* No-conflict pledge */}
      <section className="mb-10 rounded-lg border border-[#1466b8]/20 bg-[#e8f0fe] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#0f4f8c]">
          We work for you, not the funds
        </h2>
        <p className="mt-1 text-sm text-[#0f4f8c]/90 leading-relaxed">
          We charge users, not fund companies. No paid placements. No
          affiliate-incentive ranking. The scores you see are not for sale.
        </p>
      </section>

      {/* What FundScore is / is not */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          What FundScore is — and is not
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          FundScore is a transparency and analysis tool. We calculate and
          compare; we do not recommend. Nothing here is personalized investment
          advice, and nothing here predicts how a fund will perform. Past
          evidence and current holdings describe what is true today — they do
          not guarantee future returns. When data is missing, stale, or
          unsupported, we say so and suppress the affected claim rather than fill
          the hole.
        </p>
      </section>

      {/* Index */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          What we explain
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {METHODOLOGY_ARTIFACTS.map((a) => (
            <li key={a.anchor}>
              <a
                href={`#${a.anchor}`}
                className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-[#1466b8]/40 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900">
                  {a.title}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 leading-snug">
                  {a.tagline}
                </span>
              </a>
            </li>
          ))}
          <li>
            <a
              href="#data-sources"
              className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-[#1466b8]/40 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-900">
                Data sources &amp; freshness
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 leading-snug">
                Where our data comes from and how we represent its age.
              </span>
            </a>
          </li>
          <li>
            <a
              href="#limits"
              className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-[#1466b8]/40 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-900">
                Limits &amp; no-advice boundary
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 leading-snug">
                The honest gaps and what FundScore is not.
              </span>
            </a>
          </li>
        </ul>
      </section>

      {/* Per-artifact sections */}
      <div className="space-y-10">
        {METHODOLOGY_ARTIFACTS.map((a) => (
          <ArtifactSection key={a.anchor} artifact={a} />
        ))}
      </div>

      {/* Data sources & freshness */}
      <section id="data-sources" className="scroll-mt-20 mt-14">
        <SectionHeading anchor="data-sources" title="Data sources & freshness" />
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Every claim in the product carries a source stamp — where it came
          from, its as-of date, and (for anything we compute) a method version.
          Our data comes from three families:
        </p>
        <dl className="space-y-3">
          {SOURCE_FAMILIES.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <dt className="text-sm font-semibold text-gray-900">{s.name}</dt>
              <dd className="mt-0.5 text-sm text-gray-600 leading-relaxed">
                {s.detail}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-gray-600 leading-relaxed">
          Holdings-derived numbers are evaluated against our latest filing
          frontier of {HOLDINGS_FRONTIER}, and any holdings-based claim is
          treated as stale after {HOLDINGS_STALE_DAYS} days. SEC filings arrive
          with a lag, so the most recent filed portfolio can differ from what a
          fund holds today — we always show the date the data is good as of, and
          never imply data is complete when its coverage is partial.
        </p>
      </section>

      {/* Limits & no-advice */}
      <section id="limits" className="scroll-mt-20 mt-14">
        <SectionHeading
          anchor="limits"
          title="Limits & no-advice boundary"
        />
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            <span className="font-semibold text-gray-900">Not advice.</span>{" "}
            FundScore is a transparency and analysis tool and does not provide
            personalized investment advice. We do not know your situation, and
            nothing here is tailored to it.
          </p>
          <p>
            <span className="font-semibold text-gray-900">
              No prediction.
            </span>{" "}
            Historical evidence and current exposures do not guarantee future
            returns. We do not forecast fund performance, theme returns, or
            market direction.
          </p>
          <p>
            <span className="font-semibold text-gray-900">
              Coverage is bounded.
            </span>{" "}
            Our returns-based selection signal can be computed for about{" "}
            {FACTOR_ALPHA_COVERAGE.funds.toLocaleString()} funds —{" "}
            {FACTOR_ALPHA_COVERAGE.share}. The ceiling is structural: it reflects
            how many funds have enough usable return and exposure history, not a
            stale build. Funds outside it show what we can support and suppress
            the rest.
          </p>
          <p>
            <span className="font-semibold text-gray-900">
              Holdings have a frontier.
            </span>{" "}
            Holdings-derived products are pinned to the {HOLDINGS_FRONTIER}{" "}
            filing frontier. When a fund&apos;s holdings are older than our{" "}
            {HOLDINGS_STALE_DAYS}-day threshold, the affected claims are
            suppressed rather than shown as current.
          </p>
          <p>
            <span className="font-semibold text-gray-900">
              Foreign-heavy funds are partly limited.
            </span>{" "}
            Some return-attribution windows rely on a US-priced holdings store
            that drops foreign positions; funds whose portfolios were heavily
            international or emerging-market are suppressed there rather than
            attributed with incomplete prices.
          </p>
          <p>
            <span className="font-semibold text-gray-900">
              Missing data is never invented.
            </span>{" "}
            We do not fill, impute, or interpolate missing values. A gap is shown
            as a gap.
          </p>
          <p className="text-gray-500">
            A &quot;What we got wrong&quot; log will be published here as we
            correct mistakes. If you spot a number that looks wrong, please tell
            us — fixing data at the source is part of how this product works.
          </p>
        </div>
      </section>

      <p className="mt-14 border-t border-gray-200 pt-6 text-xs text-gray-400">
        FundScore is a transparency and analysis tool, not investment advice. We
        calculate and compare; we do not recommend or predict.
      </p>
    </div>
  );
}

function ArtifactSection({ artifact: a }: { artifact: MethodologyArtifact }) {
  return (
    <section id={a.anchor} className="scroll-mt-20">
      <SectionHeading anchor={a.anchor} title={a.title} />
      <p className="text-sm font-medium text-gray-700 leading-relaxed">
        {a.tagline}
      </p>

      <Block label="What it measures">
        {a.measures.map((p, i) => (
          <p key={i} className="text-sm text-gray-600 leading-relaxed">
            {p}
          </p>
        ))}
      </Block>

      <Block label="How we calculate it">
        {a.method.map((p, i) => (
          <p key={i} className="text-sm text-gray-600 leading-relaxed">
            {p}
          </p>
        ))}
      </Block>

      <Block label="Data sources">
        <ul className="list-disc pl-5 space-y-1">
          {a.sources.map((s, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed">
              {s}
            </li>
          ))}
        </ul>
      </Block>

      <Block label="What it does not mean">
        <ul className="list-disc pl-5 space-y-1">
          {a.notMeaning.map((s, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed">
              {s}
            </li>
          ))}
        </ul>
      </Block>

      <Block label="Limitations">
        <ul className="list-disc pl-5 space-y-1">
          {a.limitations.map((s, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed">
              {s}
            </li>
          ))}
        </ul>
      </Block>

      <p className="mt-3 text-xs text-gray-400">
        Method {a.methodVersion} · {a.asOf}
      </p>
    </section>
  );
}

function SectionHeading({ anchor, title }: { anchor: string; title: string }) {
  return (
    <h2 className="group mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
      <a href={`#${anchor}`} className="hover:underline">
        {title}
      </a>
      <span
        aria-hidden
        className="text-sm font-normal text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
      >
        #
      </span>
    </h2>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </h3>
      <div className="mt-1.5 space-y-2">{children}</div>
    </div>
  );
}
