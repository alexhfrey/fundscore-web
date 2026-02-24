"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { FactorTilt } from "@/lib/types";

interface FactorExposureChartProps {
  factors: FactorTilt[];
  height?: number;
}

export function FactorExposureChart({ factors, height = 300 }: FactorExposureChartProps) {
  const chartData = factors.map((f) => ({
    factor: f.factor,
    exposure: f.exposure,
    label: f.label,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          domain={[-1, 1]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="factor"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <ReferenceLine x={0} stroke="#d1d5db" strokeWidth={1} />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number | undefined) => value != null ? [`${value.toFixed(2)}`, "Exposure"] : ""}
        />
        <Bar dataKey="exposure" radius={[4, 4, 4, 4]} barSize={20}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.exposure >= 0 ? "#16a34a" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
