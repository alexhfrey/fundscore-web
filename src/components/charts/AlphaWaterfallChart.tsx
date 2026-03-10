"use client";

export interface WaterfallDataPoint {
  name: string;
  start: number;
  end: number;
  fill: string;
  isSummary?: boolean;
}

interface AlphaWaterfallChartProps {
  data: WaterfallDataPoint[];
  height?: number;
}

export function AlphaWaterfallChart({
  data,
  height = 280,
}: AlphaWaterfallChartProps) {
  const viewWidth = 500;
  const pad = { top: 28, right: 20, bottom: 46, left: 60 };
  const innerW = viewWidth - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  // Y domain from all bar endpoints, always including zero
  const allVals = data.flatMap((d) => [d.start, d.end]);
  const rawMin = Math.min(0, ...allVals);
  const rawMax = Math.max(0, ...allVals);
  const domainPad = (rawMax - rawMin) * 0.18 || 10;
  const domainMin = rawMin - domainPad;
  const domainMax = rawMax + domainPad;

  const yScale = (v: number) =>
    pad.top + innerH * (1 - (v - domainMin) / (domainMax - domainMin));

  const barGap = innerW / data.length;
  const barW = barGap * 0.52;
  const zeroY = yScale(0);

  // Y-axis ticks — nice round numbers
  const rawStep = (domainMax - domainMin) / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceStep =
    rawStep / magnitude >= 5
      ? 5 * magnitude
      : rawStep / magnitude >= 2
        ? 2 * magnitude
        : magnitude;
  const ticks: number[] = [];
  const tickStart = Math.ceil(domainMin / niceStep) * niceStep;
  for (let t = tickStart; t <= domainMax; t += niceStep) {
    ticks.push(Math.round(t));
  }

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${height}`}
      className="w-full"
      style={{ height }}
    >
      {/* Grid lines + Y labels */}
      {ticks.map((t) => {
        const y = yScale(t);
        return (
          <g key={t}>
            <line
              x1={pad.left}
              y1={y}
              x2={viewWidth - pad.right}
              y2={y}
              stroke={t === 0 ? "#d1d5db" : "#f0f0f0"}
              strokeWidth={t === 0 ? 1.5 : 1}
              strokeDasharray={t === 0 ? "4 3" : "3 3"}
            />
            <text
              x={pad.left - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="#9ca3af"
            >
              {t}
            </text>
          </g>
        );
      })}

      {/* Bars, connectors, labels */}
      {data.map((d, i) => {
        const cx = pad.left + i * barGap + barGap / 2;
        const bx = cx - barW / 2;
        const topVal = Math.max(d.start, d.end);
        const botVal = Math.min(d.start, d.end);
        const topY = yScale(topVal);
        const botY = yScale(botVal);
        const bh = Math.max(botY - topY, 1);
        const value = Math.round(d.end - d.start);
        const sign = value >= 0 ? "+" : "";

        // Connector: draw from this bar's end to next bar's start (skip if next is summary)
        const next = data[i + 1];
        const showConn = next && !next.isSummary;
        const connY = yScale(d.end);
        const nextCx = pad.left + (i + 1) * barGap + barGap / 2;

        // Label position: above for positive, below for negative
        const labelY = value >= 0 ? topY - 7 : botY + 14;

        return (
          <g key={d.name}>
            <rect
              x={bx}
              y={topY}
              width={barW}
              height={bh}
              fill={d.fill}
              rx={3}
            />
            {/* Value label */}
            <text
              x={cx}
              y={labelY}
              textAnchor="middle"
              fontSize={11}
              fontWeight={500}
              fill="#374151"
            >
              {sign}
              {value} bps
            </text>
            {/* Connector */}
            {showConn && (
              <line
                x1={bx + barW}
                y1={connY}
                x2={nextCx - barW / 2}
                y2={connY}
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="3 2"
              />
            )}
            {/* X label — split into lines for readability */}
            {(() => {
              const words = d.name.split(" ");
              if (words.length <= 1) {
                return (
                  <text
                    x={cx}
                    y={height - 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#6b7280"
                  >
                    {d.name}
                  </text>
                );
              }
              return (
                <text textAnchor="middle" fontSize={10} fill="#6b7280">
                  <tspan x={cx} y={height - 28}>
                    {words[0]}
                  </tspan>
                  <tspan x={cx} y={height - 16}>
                    {words.slice(1).join(" ")}
                  </tspan>
                </text>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}
