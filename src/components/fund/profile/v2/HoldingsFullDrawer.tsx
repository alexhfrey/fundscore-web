"use client";
// ============================================================================
// "View all N holdings" — a searchable drawer over the fund's FILED N-PORT
// positions (serve-full-holdings). Paid-only: the rows are fetched lazily via a
// server action on first open (one request per fund), so they never ship in the
// initial page payload. As filed: multi-line issuers stay separate rows, weights
// are the filed % of net assets (never rescaled). The filter searches the FULL
// row set by name OR ticker; rendering is incremental (worst case >15k rows).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import type { HoldingRow } from "@/lib/serving/profile-v2";
import { EM_DASH, fmtAum, fmtDate } from "@/lib/serving/format";
import { assetCatLabel, countryName } from "./format";

const PAGE = 200; // incremental render window (grows on scroll)

/** Filed weight → display. The dust floor is DISPLAY-ONLY and SIGN-PRESERVING:
 *  a filed exact zero prints "0.00%"; a magnitude that rounds below 0.01% prints
 *  the floor carrying its sign ("<0.01%" / "−<0.01%"); everything else renders
 *  as filed at 2dp with its sign. Filed negatives (short / FX-cash / derivative
 *  positions — 13,770 rows universe-wide, down to −309%) MUST keep their sign:
 *  collapsing a negative to "0.00%" would misstate the N-PORT filing. Never drops
 *  a row (display-only, uses the unicode minus to match the house convention). */
function fmtWeight(w: number | null): string {
  if (w == null || !isFinite(w)) return EM_DASH;
  if (w === 0) return "0.00%";
  if (Math.abs(w) < 0.01) return w < 0 ? "−<0.01%" : "<0.01%";
  return `${w < 0 ? "−" : ""}${Math.abs(w).toFixed(2)}%`;
}

/** Filed USD value → display, SIGN-AWARE. Short / FX-cash / derivative positions
 *  carry a negative filed valUSD; fmtAum is a positive-AUM helper that would
 *  garble them ("$-2395372K"), so format the magnitude and carry the sign
 *  ("−$2.4B"). Display-only; the filed value is unchanged. */
function fmtValue(v: number | null): string {
  if (v == null || !isFinite(v)) return EM_DASH;
  return v < 0 ? `−${fmtAum(-v)}` : fmtAum(v);
}

export function HoldingsFullDrawer({
  nPositions,
  asOf,
  loadRows,
}: {
  nPositions: number;
  asOf: string | null;
  /** Server action (tier bound server-side) returning the filed rows. */
  loadRows: () => Promise<HoldingRow[]>;
}) {
  const [rows, setRows] = useState<HoldingRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch once, on the first open of the <details>.
  async function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || rows != null || loading) return;
    setLoading(true);
    setError(false);
    try {
      setRows(await loadRows());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        (r.name?.toLowerCase().includes(needle) ?? false) ||
        (r.ticker?.toLowerCase().includes(needle) ?? false),
    );
  }, [rows, needle]);

  // Reset the render window whenever the filter changes.
  useEffect(() => {
    setLimit(PAGE);
  }, [needle]);

  // Grow the window as the sentinel scrolls into view (incremental render).
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLimit((l) => (l < filtered.length ? l + PAGE : l));
        }
      },
      { root },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [filtered.length, rows]);

  const visible = filtered.slice(0, limit);

  return (
    <details
      className="mx-5 my-4 overflow-hidden rounded-lg border border-gray-200 bg-white"
      onToggle={handleToggle}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 bg-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-700">
        <span className="text-[11px] text-gray-400">▶</span>
        View all {nPositions} holdings
        <span className="ml-auto text-[11px] font-normal text-gray-400">
          N-PORT{asOf ? ` · as of ${fmtDate(asOf)}` : ""} · sorted by weight
        </span>
      </summary>

      {loading && rows == null ? (
        <p className="px-4 py-4 text-[12.5px] italic text-gray-500">Loading holdings…</p>
      ) : error ? (
        <p className="px-4 py-4 text-[12.5px] italic text-gray-500">
          Holdings couldn&apos;t be loaded. Try reopening this section.
        </p>
      ) : rows != null && rows.length === 0 ? (
        <p className="px-4 py-4 text-[12.5px] italic text-gray-500">No holdings returned.</p>
      ) : rows != null ? (
        <>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by name or ticker…"
              aria-label="Filter holdings by name or ticker"
              className="w-full max-w-[280px] rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] text-gray-800"
            />
            <span className="text-[11px] text-gray-400">
              {needle ? `${filtered.length} of ${rows.length}` : `${rows.length}`} positions
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-4 text-[12.5px] italic text-gray-500">
              No holdings match &ldquo;{q}&rdquo;.
            </p>
          ) : (
            <div ref={scrollRef} className="max-h-96 overflow-auto px-2 py-2">
              <table className="w-full min-w-[560px] text-[12px] tabular-nums">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="px-2 py-1.5 text-left font-semibold">Holding</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Weight</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Value</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Country</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Sector</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.position_id} className="border-b border-dashed border-gray-100">
                      <td className="px-2 py-1 text-left">
                        {r.ticker ? (
                          <>
                            <span className="font-semibold text-gray-800">{r.ticker}</span>{" "}
                            <span className="text-gray-500">{r.name ?? EM_DASH}</span>
                          </>
                        ) : (
                          <span className="font-semibold text-gray-800">{r.name ?? EM_DASH}</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">{fmtWeight(r.weight_pct)}</td>
                      <td className="px-2 py-1 text-right text-gray-500">{fmtValue(r.value_usd)}</td>
                      <td className="px-2 py-1 text-left text-gray-500">{countryName(r.country)}</td>
                      <td className="px-2 py-1 text-left text-gray-500">{r.sector ?? EM_DASH}</td>
                      <td className="px-2 py-1 text-left text-gray-500">{assetCatLabel(r.asset_cat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div ref={sentinelRef} className="h-1" />
            </div>
          )}
        </>
      ) : null}

      <p className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-[11.5px] leading-relaxed text-gray-500">
        % of net assets, as filed in the fund&apos;s N-PORT report.
      </p>
    </details>
  );
}
