// Prev/next pagination — server-rendered <Link>s over the same URL param family.
// The count line states the exact window and the exact total, both computed from
// the SAME predicates as the rows (one count query, one page query), so the
// number a reader sees is never an estimate.
import Link from "next/link";
import type { ScreenerFilters } from "@/lib/serving/screener-select";
import { screenerHref } from "./params";

const LINK =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";
const DISABLED =
  "rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-300";

export function Pagination({
  filters,
  total,
  pageSize,
  shown,
}: {
  filters: ScreenerFilters;
  total: number;
  pageSize: number;
  shown: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const last = total === 0 ? 0 : first + shown - 1;

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-gray-500">
        {total === 0
          ? "Showing 0 funds"
          : `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()} funds`}
      </p>
      <div className="flex items-center gap-2">
        {filters.page > 1 ? (
          <Link href={screenerHref(filters, { page: filters.page - 1 })} className={LINK}>
            Previous
          </Link>
        ) : (
          <span className={DISABLED}>Previous</span>
        )}
        <span className="text-sm text-gray-500">
          Page {filters.page.toLocaleString()} of {lastPage.toLocaleString()}
        </span>
        {filters.page < lastPage ? (
          <Link href={screenerHref(filters, { page: filters.page + 1 })} className={LINK}>
            Next
          </Link>
        ) : (
          <span className={DISABLED}>Next</span>
        )}
      </div>
    </div>
  );
}
