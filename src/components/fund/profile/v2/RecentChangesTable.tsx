"use client";
// ============================================================================
// Recent changes table — client island: type filters + headline / show-all.
// Rows are the FIXTURE recentChangesTe rows (Δpp-first). The stock filter shows
// an honest empty state (no qualifying single-position changes in the window).
// ============================================================================
import { useState } from "react";
import type { RecentChangeRow } from "@/lib/serving/profile-v2";
import { EM_DASH } from "@/lib/serving/format";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "sector", label: "Sector" },
  { key: "theme", label: "Theme" },
  { key: "concentration", label: "Concentration" },
  { key: "stock", label: "Stock" },
  { key: "cash", label: "Cash" },
];
const HEADLINE = 11;

function dirChip(dir: string): string {
  return dir === "cut" || dir === "trimmed" || dir === "down"
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-gray-100 text-gray-700 border-gray-200";
}

export function RecentChangesTable({ rows }: { rows: RecentChangeRow[] }) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const pool = filter === "all" ? rows : rows.filter((r) => r.classification === filter);
  const shown = filter === "all" && !open ? pool.slice(0, HEADLINE) : pool;
  const canExpand = filter === "all" && pool.length > HEADLINE;
  const maxMag = Math.max(1, ...rows.map((r) => Math.abs(r.change_magnitude ?? 0)));

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-5 pb-1 pt-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
              filter === f.key
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-500 hover:text-gray-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pool.length === 0 ? (
        <p className="px-5 py-6 text-[13px] italic text-gray-500">
          No qualifying single-position changes for this fund in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 text-right text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-5 py-2.5 text-left font-semibold">Position</th>
                <th className="px-5 py-2.5 text-left font-semibold">Move</th>
                <th className="px-5 py-2.5 font-semibold">Δ pp</th>
                <th className="hidden px-5 py-2.5 sm:table-cell" />
                <th className="px-5 py-2.5 font-semibold">Prior → current</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {shown.map((r, i) => {
                const mag = r.change_magnitude ?? 0;
                const w = `${Math.min(50, (Math.abs(mag) / maxMag) * 50)}%`;
                return (
                  <tr key={`${r.change_name}-${i}`} className="border-b border-gray-50 text-right last:border-0">
                    <td className="px-5 py-2.5 text-left">
                      <span className="font-semibold text-gray-900">{r.change_name}</span>
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        {r.classification}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-left">
                      <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${dirChip(r.change_direction)}`}>
                        {r.change_direction}
                      </span>
                    </td>
                    <td className={`px-5 py-2.5 font-bold ${mag < 0 ? "text-amber-700" : "text-gray-900"}`}>
                      {mag > 0 ? "+" : mag < 0 ? "−" : ""}
                      {Math.abs(mag).toFixed(1)}
                    </td>
                    <td className="hidden px-5 py-2.5 sm:table-cell">
                      <div className="relative h-3">
                        <span className="absolute -top-0.5 bottom-[-2px] left-1/2 w-px bg-gray-300" />
                        <span
                          className={`absolute top-0.5 bottom-0.5 rounded-sm ${mag < 0 ? "bg-amber-400" : "bg-gray-800"}`}
                          style={mag >= 0 ? { left: "50%", width: w } : { right: "50%", width: w }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-gray-500">
                      {r.prior_value != null && r.current_value != null
                        ? `${r.prior_value.toFixed(1)}% → ${r.current_value.toFixed(1)}%`
                        : EM_DASH}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canExpand && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="block w-full border-t border-dashed border-gray-200 bg-gray-50 py-2.5 text-center text-[12.5px] font-semibold text-[#1466b8] hover:bg-gray-100"
        >
          {open ? "Show headline changes ▴" : `Show all ${rows.length} changes ▾`}
        </button>
      )}
    </div>
  );
}
