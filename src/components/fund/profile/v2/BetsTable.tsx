"use client";
// ============================================================================
// The bets, in one table — a client island with type filters + top-8 / show-all.
// Rows are BUILT SERVER-SIDE from the fixture te_decomposition (attributed bets,
// carry a TE contribution), the top10_vs_iwf snapshot (stock bets, carry held /
// active), and the positioning_bet_bridges (non-attributed bridge rows). TE is
// an em-dash for non-attributed rows; held/active are em-dash where the fixture
// doesn't carry them. Nothing is computed here beyond formatting.
// ============================================================================
import { useState } from "react";
import { EM_DASH } from "@/lib/serving/format";
import { bpsSigned, ppSigned } from "./format";

export interface BetRow {
  name: string;
  type: string | null; // sector | theme | macro | stock | null (bridge)
  heldPct: number | null;
  iwfPct: number | null;
  activePp: number | null;
  teBps: number | null;
  diversifying: boolean;
  bridge: string | null;
  sub: string | null;
}

const TYPES: { key: string; label: string }[] = [
  { key: "all", label: "All bets" },
  { key: "sector", label: "Sector" },
  { key: "theme", label: "Theme" },
  { key: "macro", label: "Macro" },
  { key: "stock", label: "Stock" },
];
const LIMIT = 8;

export function BetsTable({ rows }: { rows: BetRow[] }) {
  const [type, setType] = useState("all");
  const [open, setOpen] = useState(false);

  const pool = type === "all" ? rows : rows.filter((r) => r.type === type);
  const shown = type === "all" && !open ? pool.slice(0, LIMIT) : pool;
  const canExpand = type === "all" && pool.length > LIMIT;

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-5 pb-1 pt-3">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
              type === t.key
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 text-right text-[10px] uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 text-left font-semibold">Bet</th>
              <th className="hidden px-4 py-2.5 text-left font-semibold sm:table-cell">Type</th>
              <th className="px-4 py-2.5 font-semibold">Held (% of fund)</th>
              <th className="px-4 py-2.5 font-semibold">Active vs IWF (pp)</th>
              <th className="px-4 py-2.5 font-semibold">TE contribution (bps)*</th>
              <th className="hidden px-4 py-2.5 text-left font-semibold md:table-cell">In the attribution</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {shown.map((r, i) => (
              <tr key={`${r.name}-${i}`} className="border-b border-gray-50 text-right align-top last:border-0">
                <td className="px-4 py-2.5 text-left">
                  <span className="font-semibold text-gray-900">{r.name}</span>
                  {r.sub && (
                    <span className="mt-0.5 block text-[11px] font-normal leading-snug text-gray-500">
                      {r.sub}
                    </span>
                  )}
                  {/* mobile meta: type + bridge stacked under the name */}
                  <span className="mt-1 block sm:hidden">
                    {r.type && (
                      <span className="mr-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        {r.type}
                      </span>
                    )}
                    {r.bridge && (
                      <span className="text-[11px] font-normal text-gray-500">{r.bridge}</span>
                    )}
                  </span>
                </td>
                <td className="hidden px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:table-cell">
                  {r.type ?? EM_DASH}
                </td>
                <td className="px-4 py-2.5 text-gray-700">
                  {r.heldPct == null ? (
                    <span className="text-gray-400">{EM_DASH}</span>
                  ) : (
                    <>
                      {r.heldPct.toFixed(1)}%
                      {r.iwfPct != null && (
                        <span className="ml-1 text-[11px] text-gray-400">vs {r.iwfPct.toFixed(1)}%</span>
                      )}
                    </>
                  )}
                </td>
                <td
                  className={`px-4 py-2.5 font-semibold ${
                    r.activePp == null ? "text-gray-400" : r.activePp >= 0 ? "text-gray-900" : "text-amber-700"
                  }`}
                >
                  {r.activePp == null ? EM_DASH : ppSigned(r.activePp)}
                </td>
                <td className={`px-4 py-2.5 font-bold ${r.teBps == null ? "text-gray-400" : r.teBps < 0 ? "text-emerald-700" : "text-slate-700"}`}>
                  {r.teBps == null ? EM_DASH : bpsSigned(r.teBps)}
                  {r.diversifying && (
                    <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      diversifying
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-left md:table-cell">
                  {r.bridge ? (
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${
                        r.bridge.startsWith("own")
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-dashed border-gray-300 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {r.bridge}
                    </span>
                  ) : (
                    <span className="text-gray-300">{EM_DASH}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canExpand && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="block w-full border-t border-dashed border-gray-200 bg-gray-50 py-2.5 text-center text-[12.5px] font-semibold text-[#1466b8] hover:bg-gray-100"
        >
          {open ? "Show top 8 ▴" : `Show all ${rows.length} bets ▾`}
        </button>
      )}
    </div>
  );
}
