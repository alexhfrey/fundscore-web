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

interface GrowthOfDollarChartProps {
  series: Series[];
  baseAmount?: number;
  height?: number;
}

export function GrowthOfDollarChart({
  series,
  baseAmount = 1000,
  height = 400,
}: GrowthOfDollarChartProps) {
  const dateSet = new Set<string>();
  for (const s of series) {
    for (const d of s.data) dateSet.add(d.date);
  }
  const dates = Array.from(dateSet).sort();

  const chartData = dates.map((date) => {
    const point: Record<string, string | number> = { date };
    for (const s of series) {
      const match = s.data.find((d) => d.date === date);
      // Transform cumulative % return to dollar amount
      const cumReturn = match ? match.value : 0;
      point[s.name] = Number((baseAmount * (1 + cumReturn / 100)).toFixed(0));
    }
    return point;
  });

  const tickInterval = Math.max(1, Math.floor(dates.length / 8));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
          tickFormatter={(v: number) =>
            `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number | undefined) =>
            value != null ? [`$${value.toLocaleString()}`] : ""
          }
          labelFormatter={(label) => String(label)}
        />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
        {series.map((s, i) => (
          <Line
            key={s.name}
            type="monotone"
            dataKey={s.name}
            stroke={s.color || COLORS.chart[i % COLORS.chart.length]}
            strokeWidth={i === 0 ? 2.5 : 1.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
