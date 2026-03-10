"use client";

import { RiskDecompositionItem } from "@/lib/types";

const COLORS = [
  "#1466b8", "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6",
];

interface RiskDecompositionChartProps {
  data: RiskDecompositionItem[];
}

export function RiskDecompositionChart({ data }: RiskDecompositionChartProps) {
  return (
    <div>
      {/* Horizontal stacked bar */}
      <div className="h-8 rounded-full overflow-hidden flex">
        {data.map((item, i) => (
          <div
            key={item.factor}
            style={{
              width: `${item.percentOfRisk}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
            className="h-full flex items-center justify-center"
            title={`${item.factor}: ${item.percentOfRisk.toFixed(1)}%`}
          >
            {item.percentOfRisk > 8 && (
              <span className="text-[10px] font-medium text-white truncate px-1">
                {item.percentOfRisk.toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {data.map((item, i) => (
          <div key={item.factor} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-gray-600">
              {item.factor}{" "}
              <span className="font-medium text-gray-900">
                {item.percentOfRisk.toFixed(1)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
