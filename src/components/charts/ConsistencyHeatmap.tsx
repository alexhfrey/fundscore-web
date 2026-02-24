"use client";

import React from "react";
import { MonthlyReturn } from "@/lib/types";

interface ConsistencyHeatmapProps {
  fundReturns: MonthlyReturn[];
  passiveReturns: MonthlyReturn[];
}

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function cellColor(excess: number | undefined): string {
  if (excess === undefined) return "bg-gray-50";
  if (excess > 0.5) return "bg-green-200";
  if (excess > 0) return "bg-green-100";
  if (excess > -0.5) return "bg-red-100";
  return "bg-red-200";
}

export function ConsistencyHeatmap({ fundReturns, passiveReturns }: ConsistencyHeatmapProps) {
  // Build lookup map for passive returns by date
  const passiveMap = new Map<string, number>(
    passiveReturns.map((r) => [r.date, r.value])
  );

  // Build grid: year -> month -> excess return
  const grid = new Map<number, Map<number, number>>();
  const allExcess: number[] = [];

  for (const fund of fundReturns) {
    const passiveValue = passiveMap.get(fund.date);
    if (passiveValue === undefined) continue;

    const excess = fund.value - passiveValue;
    const year = parseInt(fund.date.slice(0, 4));
    const month = parseInt(fund.date.slice(5, 7));

    if (!grid.has(year)) {
      grid.set(year, new Map<number, number>());
    }
    grid.get(year)!.set(month, excess);
    allExcess.push(excess);
  }

  const years = Array.from(grid.keys()).sort();

  const wins = allExcess.filter((v) => v > 0.5).length;
  const losses = allExcess.filter((v) => v < -0.5).length;
  const neutral = allExcess.length - wins - losses;

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: "auto repeat(12, minmax(32px, 1fr))" }}
        >
          {/* Header row: empty cell + 12 month labels */}
          <div />
          {MONTH_LABELS.map((m, i) => (
            <div key={i} className="text-center text-xs text-gray-500 font-medium py-1">
              {m}
            </div>
          ))}

          {/* Data rows: year label + 12 cells */}
          {years.map((year) => (
            <React.Fragment key={year}>
              <div
                className="text-xs text-gray-500 font-medium pr-2 flex items-center"
              >
                {year}
              </div>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const val = grid.get(year)?.get(month);
                return (
                  <div
                    key={`${year}-${month}`}
                    className={`w-8 h-8 rounded-sm flex items-center justify-center text-[10px] font-medium ${cellColor(val)} ${val !== undefined && val > 0 ? "text-green-800" : val !== undefined && val < 0 ? "text-red-800" : "text-gray-400"}`}
                    title={val !== undefined ? `${val > 0 ? "+" : ""}${val.toFixed(2)}%` : "N/A"}
                  >
                    {val !== undefined ? (val > 0 ? "+" : val < 0 ? "−" : "·") : ""}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 mt-4 text-sm">
        <span className="text-green-700 font-medium">{wins} months beat</span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-500 font-medium">{neutral} months neutral</span>
        <span className="text-gray-500">|</span>
        <span className="text-red-700 font-medium">{losses} months missed</span>
      </div>
    </div>
  );
}
