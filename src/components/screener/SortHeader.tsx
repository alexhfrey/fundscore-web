// A sortable column header — a plain server-rendered <Link>, no client JS.
// The sort key set is closed (`SORT_KEYS`); the reader falls back to the default
// for anything else, so a hand-edited URL cannot reach ORDER BY un-whitelisted.
// No paid or paid-derived figure is sortable (P4).
import Link from "next/link";
import type { ScreenerFilters, SortKey } from "@/lib/serving/screener-select";
import { nextSort, screenerHref } from "./params";

export function SortHeader({
  label,
  sortKey,
  filters,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  filters: ScreenerFilters;
  align?: "left" | "right";
}) {
  const active = filters.sort === sortKey;
  const arrow = active ? (filters.dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <Link
        href={screenerHref(filters, nextSort(filters, sortKey))}
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${
          active ? "text-gray-900" : ""
        }`}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {arrow && <span aria-hidden>{arrow}</span>}
      </Link>
    </th>
  );
}
