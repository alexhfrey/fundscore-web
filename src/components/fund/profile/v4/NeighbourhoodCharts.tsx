"use client";
// ============================================================================
// Movement 03 chart islands — the twin's full life, and its calendar years.
// ----------------------------------------------------------------------------
// Presentational only: both charts render the SERVED monthly grid and the
// SERVED calendar-year rows exactly as they arrive. Nothing here compounds,
// rebases, interpolates or fills — the web tier never computes a return series
// (movement 03's locked rule). recharts needs the DOM, hence the client island;
// there is no state, no toggle and no fetch.
//
// Palette (mockup mockup_fund_profile_v4_2026-07-28.html): gold is reserved for
// the twin, every comparator stays in the grey family. The mockup's three greys
// are separated further here (tone + dash) so the legs stay tellable apart at
// mobile width, where the mockup's right-hand end labels do not fit.
// ============================================================================
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NeighbourhoodPoint, NeighbourhoodYear } from "./derive";

export const TWIN_COLOR = "#a87914";
export const IVV_COLOR = "#9aa2ad";
export const VT_COLOR = "#6b7280";
export const BND_COLOR = "#b8bec7";
const TWIN_NEG_COLOR = "#b91c1c";
const WORLD_BAR_COLOR = "#b9c0ca";
/** Headroom around the served extremes so no line is drawn on the axis itself. */
const PAD = 1.08;

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

/** 1-2-5 ladder, so a log axis lands on values a reader recognises. */
function logTicks(lo: number, hi: number): number[] {
  const ladder: number[] = [];
  for (let e = 1; e <= 8; e++) {
    for (const m of [1, 2, 5]) ladder.push(m * Math.pow(10, e));
  }
  const inside = ladder.filter((v) => v >= lo && v <= hi);
  if (inside.length >= 2) return inside;
  // A very narrow range (a short window on a flat leg) would otherwise show one
  // gridline or none — fall back to the ladder values that bracket it.
  const below = ladder.filter((v) => v <= lo);
  const above = ladder.filter((v) => v >= hi);
  const min = below.length > 0 ? below[below.length - 1] : ladder[0];
  const max = above.length > 0 ? above[0] : ladder[ladder.length - 1];
  return ladder.filter((v) => v >= min && v <= max);
}

/** Growth of $10,000 in the twin vs the three asset-class comparators. */
export function NeighbourhoodGrowthChart({
  points,
  twinLabel,
  ivvLabel,
  vtLabel,
  bndLabel,
}: {
  points: NeighbourhoodPoint[];
  twinLabel: string;
  ivvLabel: string;
  vtLabel: string;
  bndLabel: string;
}) {
  const values = points.flatMap((p) =>
    [p.twin, p.ivv, p.vt, p.bnd].filter((v): v is number => v != null && v > 0),
  );
  if (values.length === 0) return null;
  const lo = Math.min(...values) / PAD;
  const hi = Math.max(...values) * PAD;
  const ticks = logTicks(lo, hi);
  const domain: [number, number] = [Math.min(lo, ticks[0]), Math.max(hi, ticks[ticks.length - 1])];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pb-3 text-[12px] font-semibold text-gray-700">
        <Legend color={TWIN_COLOR} label={twinLabel} width={3} />
        <Legend color={VT_COLOR} label={vtLabel} width={2} />
        <Legend color={IVV_COLOR} label={ivvLabel} width={2} />
        <Legend color={BND_COLOR} label={bndLabel} width={2} dashed />
      </div>
      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#f0f1f3" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(t: string) => t.slice(0, 4)}
              minTickGap={44}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              scale="log"
              domain={domain}
              ticks={ticks}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v: number) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`)}
              width={46}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(v) => [typeof v === "number" ? usd(v) : "—"]}
              labelStyle={{ color: "#374151", fontWeight: 600 }}
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="bnd"
              name={bndLabel}
              stroke={BND_COLOR}
              strokeWidth={1.6}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ivv"
              name={ivvLabel}
              stroke={IVV_COLOR}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="vt"
              name={vtLabel}
              stroke={VT_COLOR}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="twin"
              name={twinLabel}
              stroke={TWIN_COLOR}
              strokeWidth={2.6}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Calendar-year returns, twin (gold) vs world stocks (grey). */
export function NeighbourhoodYearBars({
  years,
  twinLabel,
  worldLabel,
}: {
  years: NeighbourhoodYear[];
  twinLabel: string;
  worldLabel: string;
}) {
  if (years.length === 0) return null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pb-2 text-[12px] font-semibold text-gray-700">
        <Legend color={TWIN_COLOR} label={twinLabel} width={3} />
        <Legend color={WORLD_BAR_COLOR} label={worldLabel} width={3} />
      </div>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={years} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#f0f1f3" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              // A partial calendar year is marked, never quietly shown as a full one.
              tickFormatter={(y: number) =>
                `${String(y).slice(2)}${years.find((r) => r.year === y)?.partial ? "*" : ""}`
              }
              interval="preserveStartEnd"
              minTickGap={8}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(v, name) => [typeof v === "number" ? `${v.toFixed(1)}%` : "—", name]}
              labelFormatter={(y) =>
                `${y}${years.find((r) => r.year === y)?.partial ? " (partial year)" : ""}`
              }
              labelStyle={{ color: "#374151", fontWeight: 600 }}
              contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
              cursor={{ fill: "#f7f7f8" }}
            />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <Bar dataKey="worldPct" name={worldLabel} fill={WORLD_BAR_COLOR} radius={[2, 2, 0, 0]} />
            <Bar dataKey="twinPct" name={twinLabel} radius={[2, 2, 0, 0]}>
              {years.map((r) => (
                <Cell
                  key={r.year}
                  fill={(r.twinPct ?? 0) >= 0 ? TWIN_COLOR : TWIN_NEG_COLOR}
                  fillOpacity={(r.twinPct ?? 0) >= 0 ? 0.9 : 0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  width,
  dashed,
}: {
  color: string;
  label: string;
  width: number;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-0 w-4 shrink-0"
        style={{ borderTop: `${width}px ${dashed ? "dashed" : "solid"} ${color}` }}
      />
      <span>{label}</span>
    </span>
  );
}
