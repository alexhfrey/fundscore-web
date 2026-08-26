// ============================================================================
// /screener URL-state helpers — pure, shared by the server table and the client
// controls.
// ----------------------------------------------------------------------------
// ALL filter/sort/page state lives in searchParams. That is a design constraint,
// not a convenience: it keeps the surface shareable and server-rendered, and it
// is what lets `exposure-screener` later add exposure facets as another param
// family without reworking this page (F7 spec, § redesign-collision check).
//
// Only non-default values are written, so the canonical URL of the unfiltered
// screener is a bare `/screener`.
// ============================================================================
import {
  DEFAULT_DIR,
  DEFAULT_SORT,
  type ScreenerFilters,
} from "@/lib/serving/screener-select";

export type ScreenerHrefOverrides = Partial<
  Pick<ScreenerFilters, "q" | "vehicle" | "style" | "verdict" | "maxFeeBps" | "sort" | "dir" | "page">
>;

/**
 * Build `/screener?…` from the current filters plus an override. Any change
 * other than `page` itself RESETS to page 1 — paging into an offset that a new
 * filter no longer has rows for is the classic "empty page that looks broken".
 */
export function screenerHref(
  filters: ScreenerFilters,
  overrides: ScreenerHrefOverrides = {},
): string {
  const next: ScreenerFilters = { ...filters, ...overrides };
  const changedBeyondPage = Object.keys(overrides).some((k) => k !== "page");
  if (changedBeyondPage && overrides.page === undefined) next.page = 1;

  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.vehicle) sp.set("vehicle", next.vehicle);
  if (next.style) sp.set("style", next.style);
  if (next.verdict) sp.set("verdict", next.verdict);
  if (next.maxFeeBps != null) sp.set("maxFeeBps", String(next.maxFeeBps));
  if (next.sort !== DEFAULT_SORT) sp.set("sort", next.sort);
  if (next.dir !== DEFAULT_DIR) sp.set("dir", next.dir);
  if (next.page > 1) sp.set("page", String(next.page));

  const qs = sp.toString();
  return qs ? `/screener?${qs}` : "/screener";
}

/**
 * Clicking a sort header: same key toggles direction, a new key starts at the
 * direction that reads as "most interesting first" for that column (largest
 * assets, cheapest fee, A-Z for text).
 */
export function nextSort(
  filters: ScreenerFilters,
  key: ScreenerFilters["sort"],
): { sort: ScreenerFilters["sort"]; dir: ScreenerFilters["dir"] } {
  if (filters.sort === key) {
    return { sort: key, dir: filters.dir === "asc" ? "desc" : "asc" };
  }
  return { sort: key, dir: key === "aum" ? "desc" : "asc" };
}
