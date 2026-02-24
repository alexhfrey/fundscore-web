"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { CalibrationPoint } from "@/lib/types";

interface CalibrationChartProps {
  data: CalibrationPoint[];
  height?: number;
}

export function CalibrationChart({
  data,
  height = 350,
}: CalibrationChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart
        margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="predictedBucket"
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          label={{
            value: "Predicted Probability (%)",
            position: "bottom",
            offset: 15,
            style: { fontSize: 12, fill: "#6b7280" },
          }}
        />
        <YAxis
          dataKey="actualBeatRate"
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          label={{
            value: "Actual Beat Rate (%)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: "#6b7280" },
          }}
        />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: 100, y: 100 },
          ]}
          stroke="#d1d5db"
          strokeDasharray="5 5"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number | undefined) => {
            if (value == null) return "";
            return `${value.toFixed(1)}%`;
          }}
        />
        <Scatter data={data} fill="#1466b8" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
