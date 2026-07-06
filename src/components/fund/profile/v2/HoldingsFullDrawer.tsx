"use client";
// ============================================================================
// "View all 280 holdings" — a searchable drawer over the FIXTURE holdings_full
// rows (ticker, weight_pct). Client island for the ticker filter only.
// ============================================================================
import { useState } from "react";
import type { HoldingRow } from "@/lib/serving/profile-v2";

export function HoldingsFullDrawer({
  rows,
  nPositions,
  basis,
}: {
  rows: HoldingRow[];
  nPositions: number | null;
  basis: string | null;
}) {
  const [q, setQ] = useState("");
  const filtered = q
    ? rows.filter((r) => r.stock_ticker.toUpperCase().includes(q.toUpperCase()))
    : rows;

  return (
    <details className="mx-5 my-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 bg-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-700">
        <span className="text-[11px] text-gray-400">▶</span>
        View all {nPositions ?? rows.length} holdings
        <span className="ml-auto text-[11px] font-normal text-gray-400">
          N-PORT · sorted by weight
        </span>
      </summary>
      <div className="px-4 pt-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value.trim())}
          placeholder="Filter by ticker…"
          aria-label="Filter holdings by ticker"
          className="w-full max-w-[260px] rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] text-gray-800"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 py-4 text-[12.5px] italic text-gray-500">No holdings match &ldquo;{q}&rdquo;.</p>
      ) : (
        <div className="grid max-h-96 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-x-5 gap-y-0.5 overflow-y-auto px-4 py-3 text-[12px] tabular-nums">
          {filtered.map((r) => (
            <div key={r.stock_ticker} className="flex justify-between gap-2 border-b border-dashed border-gray-100 py-0.5">
              <span className="font-semibold text-gray-800">{r.stock_ticker}</span>
              <span className="text-gray-500">{r.weight_pct.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}
      {basis && (
        <p className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-[11.5px] leading-relaxed text-gray-500">
          {basis}
        </p>
      )}
    </details>
  );
}
