"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { SectorWeight } from "@/lib/types";

const SECTOR_COLORS = [
  "#1466b8",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#f43f5e",
  "#84cc16",
  "#06b6d4",
  "#a855f7",
];

interface SectorDonutChartProps {
  sectors: SectorWeight[];
  height?: number;
}

export function SectorDonutChart({
  sectors,
  height = 300,
}: SectorDonutChartProps) {
  const topSectors = sectors.slice(0, 8);
  const otherWeight = sectors
    .slice(8)
    .reduce((sum, s) => sum + s.weight, 0);
  const chartData = [
    ...topSectors,
    ...(otherWeight > 0
      ? [{ sector: "Other", weight: Number(otherWeight.toFixed(2)) }]
      : []),
  ];

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="weight"
            nameKey="sector"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
          >
            {chartData.map((_entry, index) => (
              <Cell
                key={index}
                fill={SECTOR_COLORS[index % SECTOR_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | undefined) => value != null ? [`${value.toFixed(1)}%`, "Weight"] : ""}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {chartData.map((item, i) => (
          <div key={item.sector} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{
                backgroundColor:
                  SECTOR_COLORS[i % SECTOR_COLORS.length],
              }}
            />
            <span className="text-gray-600 flex-1">{item.sector}</span>
            <span className="text-gray-900 font-medium">
              {item.weight.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
