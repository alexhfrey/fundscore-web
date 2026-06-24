// ============================================================================
// Ranked result card (query_results.md § 5 Ranked Results + § 6 Why Column).
// One card per fund: rank, ticker, name, wrapper, VO badge, Relevance, the
// query-relevant primary metric, the number-bearing Why basis, fee, and a
// deep-link to /funds/{ticker} carrying the query context.
// Every value comes from the T5a canonical result row — nothing fabricated.
// ============================================================================
import Link from "next/link";
import { badgeStyle, fmtBps, fmtDate } from "@/lib/serving/format";
import type { ResultRow } from "@/lib/serving/screener";

export function ResultCard({ row }: { row: ResultRow }) {
  const badge = row.badge ? badgeStyle(row.badge) : null;
  const holdingsDerived = row.query_type === "composition" || row.query_type === "mixed";

  return (
    <Link
      href={row.fund_profile_href}
      className="group block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-[#1466b8]/40 hover:bg-gray-50/60 sm:p-5"
    >
      <div className="flex items-start gap-4">
        {/* Rank */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f0fe] text-sm font-bold text-[#0f4f8c]">
          {row.rank}
        </div>

        <div className="min-w-0 flex-1">
          {/* Identity line */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-bold text-gray-900">{row.ticker}</span>
            <span className="truncate text-sm text-gray-600">{row.fund_name}</span>
          </div>

          {/* Tags: wrapper + VO badge */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
              {row.wrapper_label}
            </span>
            {badge && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${badge.chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                {row.badge}
              </span>
            )}
          </div>

          {/* Why basis (always carries at least one number — § 6) */}
          <p className="mt-2 text-sm leading-relaxed text-gray-700">
            {row.why_basis_text}
          </p>
          {holdingsDerived && row.holdings_as_of && (
            <p className="mt-1 text-[11px] text-gray-400">
              Holdings as of {fmtDate(row.holdings_as_of)} (SEC filings arrive
              with a lag).
            </p>
          )}
        </div>

        {/* Right rail: Relevance + primary metric + fee */}
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Relevance
          </div>
          <div className="text-2xl font-bold leading-none text-[#1466b8]">
            {row.relevance_score}
          </div>
          {row.primary_metric_value != null && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">
                {shortMetricLabel(row.primary_metric_label)}
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {formatPrimaryMetric(row.primary_metric_label, row.primary_metric_value)}
              </div>
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-400">
            Fee {fmtBps(row.expense_ratio_bps)}
          </div>
          <span className="mt-1 inline-block text-[11px] font-medium text-[#1466b8] opacity-0 transition-opacity group-hover:opacity-100">
            View profile →
          </span>
        </div>
      </div>
    </Link>
  );
}

// Compress the primary-metric label for the right rail (full label is in the
// Why basis + query header).
function shortMetricLabel(label: string): string {
  if (label.startsWith("Net expense ratio")) return "Net fee";
  if (label.startsWith("Passive R")) return "Passive R²";
  if (label.startsWith("P(positive")) return "P(skill)";
  if (label.includes("exposure vs passive")) return "Theme Δ vs passive";
  return label.length > 22 ? label.slice(0, 21) + "…" : label;
}

// Format the primary metric in the units T5a produced it in. No re-derivation —
// the value is rendered verbatim, just unit-formatted.
function formatPrimaryMetric(label: string, value: number): string {
  if (label.startsWith("Net expense ratio")) return fmtBps(value);
  if (label.startsWith("Passive R")) return value.toFixed(3);
  if (label.startsWith("P(positive")) return `${(value * 100).toFixed(0)}%`;
  // exposure-difference metrics are already in percentage points
  if (label.includes("exposure")) return `${value.toFixed(1)} pp`;
  return value.toFixed(2);
}
