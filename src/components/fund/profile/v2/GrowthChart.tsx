"use client";
// ============================================================================
// GrowthChart — fund vs β-adjusted passive (headline) vs raw passive (dashed).
// Client island: period toggle (1Y/3Y/5Y/10Y/SI) re-slices + rebases the served
// monthly growth series to the window start ($1,000 base); SI uses the raw
// series unrebased. The comparison legs are only present in `points` when the
// caller (server) is paid-entitled — anon receives fund-only points.
// ============================================================================
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
/** Looser than NavSeriesPoint: the comparison legs are nulled server-side when
 *  the caller isn't paid, so this island renders whatever legs are present. */
export interface ChartPoint {
  t: string;
  fund: number | null;
  passive: number | null;
  beta_adj_passive?: number | null;
}

type Period = "1Y" | "3Y" | "5Y" | "10Y" | "SI";
const PERIODS: Period[] = ["1Y", "3Y", "5Y", "10Y", "SI"];
const MONTHS: Record<Exclude<Period, "SI">, number> = { "1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120 };
const BASE = 1000;

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

export function GrowthChart({
  points,
  passiveLabel,
  beta,
  showComparison,
}: {
  points: ChartPoint[];
  passiveLabel: string | null;
  beta: number | null;
  showComparison: boolean;
}) {
  const [period, setPeriod] = useState<Period>("SI");
  const pass = passiveLabel ?? "the index";

  const data = useMemo(() => {
    if (points.length === 0) return [];
    const start = period === "SI" ? 0 : Math.max(0, points.length - 1 - MONTHS[period]);
    const win = points.slice(start);
    const rebase = (v: number | null | undefined, base: number | null | undefined) => {
      if (v == null) return null;
      if (period === "SI") return v;
      if (base == null || base === 0) return null;
      return (v / base) * BASE;
    };
    const f0 = win[0].fund;
    const p0 = win[0].passive;
    const b0 = win[0].beta_adj_passive;
    return win.map((pt) => ({
      t: pt.t,
      fund: rebase(pt.fund, f0),
      passive: showComparison ? rebase(pt.passive, p0) : null,
      betaAdj: showComparison ? rebase(pt.beta_adj_passive, b0) : null,
    }));
  }, [points, period, showComparison]);

  const last = data[data.length - 1];

  return (
    <div className="px-4 pb-2 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-semibold text-gray-700">
          <Legend color="#111827" label={`${data.length ? "the fund" : "fund"}`} solid />
          {showComparison && (
            <>
              <Legend
                color="#0e7c6b"
                label={`${pass} at the fund's market risk${beta != null ? ` (β ${beta.toFixed(2)})` : ""}`}
                sub="headline comparison"
                solid
              />
              <Legend color="#a8a294" label={`${pass} — raw index`} dashed />
            </>
          )}
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`border-r border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold last:border-r-0 ${
                period === p ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:text-gray-900"
              }`}
            >
              {/* "SI" is the COMMON PAIRED WINDOW (both legs priced), not the
                  fund's inception — "Max" avoids the false inception claim. */}
              {p === "SI" ? "Max" : p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="#eef0f2" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(t: string) => (data.length > 30 ? t.slice(0, 4) : t)}
              minTickGap={40}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              width={44}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(v) => [typeof v === "number" ? usd(v) : "—"]}
              labelStyle={{ color: "#374151", fontWeight: 600 }}
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
            />
            <ReferenceLine y={BASE} stroke="#cbd5e1" strokeDasharray="3 3" />
            {showComparison && (
              <Line
                type="monotone"
                dataKey="passive"
                name={`${pass} raw`}
                stroke="#a8a294"
                strokeWidth={1.8}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {showComparison && (
              <Line
                type="monotone"
                dataKey="betaAdj"
                name={`${pass} β-adj`}
                stroke="#0e7c6b"
                strokeWidth={2.2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="fund"
              name="Fund"
              stroke="#111827"
              strokeWidth={2.4}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="px-1 pt-2 text-[12.5px] leading-relaxed text-gray-500">
        Growth of <span className="font-semibold text-gray-700">$1,000</span>
        {period === "SI"
          ? ` over the full paired series${data.length ? ` (from ${data[0].t})` : ""}`
          : ` over the last ${period}`}
        , month-end series
        {period === "SI" ? "" : " rebased to the window start"}.
        {showComparison && last?.fund != null ? (
          <>
            {" "}
            Headline comparison: the fund vs a β-scaled {pass} position (same market
            risk); raw {pass} shown dashed.{" "}
            {last.betaAdj != null && last.passive != null && (
              <>
                This window ends at{" "}
                <span className="font-semibold text-gray-700">{usd(last.fund)}</span> (fund) ·{" "}
                <span className="font-semibold text-[#0e7c6b]">{usd(last.betaAdj)}</span> ({pass}{" "}
                β-adj) · <span className="text-gray-500">{usd(last.passive)}</span> (raw {pass}).
              </>
            )}
          </>
        ) : (
          !showComparison && (
            <>
              {" "}
              The {pass} comparison lines — raw and at the fund&apos;s market risk —
              are a paid detail.
            </>
          )
        )}
      </p>
    </div>
  );
}

function Legend({
  color,
  label,
  sub,
  solid,
  dashed,
}: {
  color: string;
  label: string;
  sub?: string;
  solid?: boolean;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-0 w-4"
        style={{
          borderTop: `${solid ? 3 : 2}px ${dashed ? "dashed" : "solid"} ${color}`,
        }}
      />
      <span>
        {label}
        {sub && <span className="ml-1 font-normal text-gray-400">· {sub}</span>}
      </span>
    </span>
  );
}
