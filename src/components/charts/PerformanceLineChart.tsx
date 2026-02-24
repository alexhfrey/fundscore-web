"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { COLORS } from "@/lib/constants";

interface Series {
  name: string;
  data: { date: string; value: number }[];
  color?: string;
}

interface PerformanceLineChartProps {
  series: Series[];
  height?: number;
  showGrid?: boolean;
}

export function PerformanceLineChart({
  series,
  height = 350,
  showGrid = true,
}: PerformanceLineChartProps) {
  const dateSet = new Set<string>();
  for (const s of series) {
    for (const d of s.data) {
      dateSet.add(d.date);
    }
  }
  const dates = Array.from(dateSet).sort();

  const chartData = dates.map((date) => {
    const point: Record<string, string | number> = { date };
    for (const s of series) {
      const match = s.data.find((d) => d.date === date);
      point[s.name] = match ? Number(match.value.toFixed(2)) : 0;
    }
    return point;
  });

  const tickInterval = Math.max(1, Math.floor(dates.length / 10));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        )}
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number | undefined) => value != null ? [`${value.toFixed(2)}%`] : ""}
          labelFormatter={(label) => String(label)}
        />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
        {series.map((s, i) => (
          <Line
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={s.color || COLORS.chart[i % COLORS.chart.length]}
            strokeWidth={i === 0 ? 2 : 1.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
