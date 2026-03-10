"use client";

import { BayesianSkillDistribution } from "@/lib/types";

interface BayesianSkillChartProps {
  distribution: BayesianSkillDistribution;
}

export function BayesianSkillChart({ distribution }: BayesianSkillChartProps) {
  const { pdfPoints, posteriorMean, credibleInterval80, credibleInterval95 } =
    distribution;

  const width = 500;
  const height = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 20 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  // Filter to meaningful range
  const maxY = Math.max(...pdfPoints.map((p) => p.y), 1);

  const xScale = (x: number) => pad.left + x * innerW;
  const yScale = (y: number) => pad.top + innerH * (1 - y / maxY);

  // Build SVG path for the full distribution
  const pathPoints = pdfPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
    .join(" ");
  const areaPath = `${pathPoints} L ${xScale(1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`;

  // CI band paths
  const ci95Path = pdfPoints
    .filter((p) => p.x >= credibleInterval95[0] && p.x <= credibleInterval95[1])
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
    .join(" ");
  const ci95Area = ci95Path
    ? `${ci95Path} L ${xScale(credibleInterval95[1])} ${yScale(0)} L ${xScale(credibleInterval95[0])} ${yScale(0)} Z`
    : "";

  const ci80Path = pdfPoints
    .filter((p) => p.x >= credibleInterval80[0] && p.x <= credibleInterval80[1])
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
    .join(" ");
  const ci80Area = ci80Path
    ? `${ci80Path} L ${xScale(credibleInterval80[1])} ${yScale(0)} L ${xScale(credibleInterval80[0])} ${yScale(0)} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {/* Background fill */}
      <path d={areaPath} fill="#e0e7ff" opacity={0.3} />

      {/* 95% CI band */}
      {ci95Area && <path d={ci95Area} fill="#818cf8" opacity={0.2} />}

      {/* 80% CI band */}
      {ci80Area && <path d={ci80Area} fill="#6366f1" opacity={0.3} />}

      {/* Distribution line */}
      <path d={pathPoints} fill="none" stroke="#4f46e5" strokeWidth={2} />

      {/* No-skill line at 0.50 */}
      <line
        x1={xScale(0.5)}
        y1={pad.top}
        x2={xScale(0.5)}
        y2={pad.top + innerH}
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text
        x={xScale(0.5)}
        y={pad.top - 5}
        textAnchor="middle"
        fontSize={9}
        fill="#9ca3af"
      >
        No Skill (50%)
      </text>

      {/* Posterior mean marker */}
      <line
        x1={xScale(posteriorMean)}
        y1={pad.top}
        x2={xScale(posteriorMean)}
        y2={pad.top + innerH}
        stroke="#4f46e5"
        strokeWidth={2}
      />
      <circle
        cx={xScale(posteriorMean)}
        cy={yScale(
          pdfPoints.find(
            (p) => Math.abs(p.x - posteriorMean) < 0.015
          )?.y ?? 0
        )}
        r={4}
        fill="#4f46e5"
        stroke="white"
        strokeWidth={2}
      />

      {/* X-axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
        <g key={tick}>
          <line
            x1={xScale(tick)}
            y1={pad.top + innerH}
            x2={xScale(tick)}
            y2={pad.top + innerH + 4}
            stroke="#d1d5db"
          />
          <text
            x={xScale(tick)}
            y={height - 5}
            textAnchor="middle"
            fontSize={10}
            fill="#9ca3af"
          >
            {(tick * 100).toFixed(0)}%
          </text>
        </g>
      ))}

      {/* Baseline */}
      <line
        x1={pad.left}
        y1={pad.top + innerH}
        x2={pad.left + innerW}
        y2={pad.top + innerH}
        stroke="#e5e7eb"
      />
    </svg>
  );
}
