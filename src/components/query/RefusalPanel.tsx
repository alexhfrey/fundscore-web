// ============================================================================
// Refusal / insufficient-data panel (query_results.md § 8).
// Renders an explicit, honest refusal for advice / prediction / personalization
// / unsupported queries. Copy is taxonomy-keyed (never freeform), states
// FundScore's scope, and NEVER leaks advice. Suggested alternatives come from a
// curated list, not on-the-fly generation. Served noindex (set on the route).
// ============================================================================
import Link from "next/link";
import {
  REFUSAL_COPY,
  REFUSAL_HEADLINE,
  SUGGESTED_ALTERNATIVES,
  type RefusalCode,
} from "@/lib/serving/query-parser";

export function RefusalPanel({
  code,
  rawQuery,
}: {
  code: RefusalCode;
  rawQuery?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          We can&apos;t rank funds for this question
        </div>
        <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
          {REFUSAL_HEADLINE[code]}
        </h1>
        {rawQuery && (
          <p className="mt-2 text-sm italic text-gray-500">
            You asked: &ldquo;{rawQuery}&rdquo;
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          {REFUSAL_COPY[code]}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          This is about FundScore&apos;s scope, not your question. We&apos;re a
          transparency and analysis tool — we calculate and compare, we
          don&apos;t recommend or predict.{" "}
          <Link href="/methodology#limits" className="text-[#1466b8] hover:underline">
            Where we draw the line →
          </Link>
        </p>
      </div>

      <div className="mt-6">
        <div className="text-sm font-semibold text-gray-900">
          Try one of these instead
        </div>
        <ul className="mt-2 space-y-2">
          {SUGGESTED_ALTERNATIVES.map((q) => (
            <li key={q}>
              <Link
                href={`/search?q=${encodeURIComponent(q)}`}
                className="block rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 transition-colors hover:border-[#1466b8]/40 hover:bg-gray-50"
              >
                {q}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Honest empty / insufficient-data state for a valid spec that yields no rows.
export function EmptyResults({
  message,
  suggestion,
}: {
  message: string;
  suggestion?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center">
      <p className="text-sm font-semibold text-gray-900">{message}</p>
      {suggestion && <p className="mt-1 text-sm text-gray-500">{suggestion}</p>}
      <Link
        href="/methodology"
        className="mt-3 inline-block text-xs text-[#1466b8] hover:underline"
      >
        How our coverage works →
      </Link>
    </div>
  );
}
