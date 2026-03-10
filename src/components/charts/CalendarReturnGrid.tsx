"use client";

import { CalendarYearReturn } from "@/lib/types";
import { getReturnColor } from "@/lib/utils/colors";

interface CalendarReturnGridProps {
  returns: CalendarYearReturn[];
}

export function CalendarReturnGrid({ returns }: CalendarReturnGridProps) {
  const colorScale = (value: number): string => {
    if (value > 20) return "bg-green-200 text-green-900";
    if (value > 10) return "bg-green-100 text-green-800";
    if (value > 0) return "bg-green-50 text-green-700";
    if (value > -10) return "bg-red-50 text-red-700";
    if (value > -20) return "bg-red-100 text-red-800";
    return "bg-red-200 text-red-900";
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
              Year
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Fund
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Passive Alt
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Benchmark
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Category
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">
              Excess
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {[...returns].sort((a, b) => b.year - a.year).map((r) => {
            const excess = r.fundReturn - r.passiveAltReturn;
            return (
              <tr key={r.year}>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {r.year}
                </td>
                <td
                  className={`px-3 py-2 text-right font-medium ${colorScale(r.fundReturn)} rounded`}
                >
                  {r.fundReturn > 0 ? "+" : ""}
                  {r.fundReturn.toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2 text-right ${getReturnColor(r.passiveAltReturn)}`}
                >
                  {r.passiveAltReturn > 0 ? "+" : ""}
                  {r.passiveAltReturn.toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2 text-right ${getReturnColor(r.benchmarkReturn)}`}
                >
                  {r.benchmarkReturn > 0 ? "+" : ""}
                  {r.benchmarkReturn.toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2 text-right ${getReturnColor(r.categoryAvgReturn)}`}
                >
                  {r.categoryAvgReturn > 0 ? "+" : ""}
                  {r.categoryAvgReturn.toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${getReturnColor(excess)}`}
                >
                  {excess > 0 ? "+" : ""}
                  {excess.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
