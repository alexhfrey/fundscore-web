"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { QuintileReturn } from "@/lib/types";

interface BacktestChartProps {
  data: QuintileReturn[];
  height?: number;
}

export function BacktestChart({ data, height = 300 }: BacktestChartProps) {
  const chartData = data.map((d) => ({
    label:
      d.quintile === 1
        ? "Top 20%"
        : d.quintile === 5
          ? "Bottom 20%"
          : `Q${d.quintile}`,
    avgExcessReturn: d.avgExcessReturn,
    fundCount: d.fundCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f0f0f0"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="avgExcessReturn" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.avgExcessReturn >= 0 ? "#16a34a" : "#dc2626"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
