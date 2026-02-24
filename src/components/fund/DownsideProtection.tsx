"use client";

import { FundDetail } from "@/lib/types";

interface DownsideProtectionProps {
  fund: FundDetail;
}

export function DownsideProtection({ fund }: DownsideProtectionProps) {
  const upside = fund.risk.upsideCaptureRatio;
  const downside = fund.risk.downsideCaptureRatio;
  const maxDrawdown = fund.risk.maxDrawdown;
  const categoryAvgDrawdown = fund.risk.categoryAvg.maxDrawdown;

  // SVG dimensions
  const size = 300;
  const margin = 40;
  const plotSize = size - 2 * margin;

  // Scale: 60 to 140 on both axes
  const min = 60;
  const max = 140;
  const scale = (val: number) => margin + ((val - min) / (max - min)) * plotSize;
  const clamp = (val: number) => Math.min(max, Math.max(min, val));

  const cx = scale(clamp(downside));
  const cy = size - scale(clamp(upside)) + margin; // Invert Y

  // Determine quadrant label
  const quadrant = upside >= 100 && downside < 100 ? "Best"
    : upside >= 100 && downside >= 100 ? "All Weather"
    : upside < 100 && downside < 100 ? "Dampener"
    : "Worst";

  const quadrantColor = quadrant === "Best" ? "text-green-700"
    : quadrant === "All Weather" ? "text-blue-700"
    : quadrant === "Dampener" ? "text-amber-600"
    : "text-red-700";

  // Asymmetry
  const asymmetry = upside - downside;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Downside Protection</h3>
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* SVG quadrant */}
          <svg width={size} height={size} className="flex-shrink-0">
            {/* Background quadrants */}
            <rect x={margin} y={margin} width={plotSize/2} height={plotSize/2} fill="#f0fdf4" opacity={0.5} />
            <rect x={margin+plotSize/2} y={margin} width={plotSize/2} height={plotSize/2} fill="#eff6ff" opacity={0.5} />
            <rect x={margin} y={margin+plotSize/2} width={plotSize/2} height={plotSize/2} fill="#fffbeb" opacity={0.5} />
            <rect x={margin+plotSize/2} y={margin+plotSize/2} width={plotSize/2} height={plotSize/2} fill="#fef2f2" opacity={0.5} />

            {/* Grid lines at 100% */}
            <line x1={scale(100)} y1={margin} x2={scale(100)} y2={size-margin} stroke="#d1d5db" strokeDasharray="4 4" />
            <line x1={margin} y1={size-scale(100)+margin} x2={size-margin} y2={size-scale(100)+margin} stroke="#d1d5db" strokeDasharray="4 4" />

            {/* Quadrant labels */}
            <text x={margin+plotSize*0.25} y={margin+plotSize*0.15} textAnchor="middle" fontSize={11} fill="#16a34a" fontWeight={500}>Best</text>
            <text x={margin+plotSize*0.75} y={margin+plotSize*0.15} textAnchor="middle" fontSize={11} fill="#1466b8" fontWeight={500}>All Weather</text>
            <text x={margin+plotSize*0.25} y={margin+plotSize*0.85} textAnchor="middle" fontSize={11} fill="#d97706" fontWeight={500}>Dampener</text>
            <text x={margin+plotSize*0.75} y={margin+plotSize*0.85} textAnchor="middle" fontSize={11} fill="#dc2626" fontWeight={500}>Worst</text>

            {/* Axis labels */}
            <text x={size/2} y={size-5} textAnchor="middle" fontSize={10} fill="#6b7280">Downside Capture %</text>
            <text x={12} y={size/2} textAnchor="middle" fontSize={10} fill="#6b7280" transform={`rotate(-90, 12, ${size/2})`}>Upside Capture %</text>

            {/* Axis tick labels */}
            <text x={scale(60)} y={size-margin+15} textAnchor="middle" fontSize={9} fill="#9ca3af">60</text>
            <text x={scale(100)} y={size-margin+15} textAnchor="middle" fontSize={9} fill="#9ca3af">100</text>
            <text x={scale(140)} y={size-margin+15} textAnchor="middle" fontSize={9} fill="#9ca3af">140</text>
            <text x={margin-8} y={size-scale(60)+margin} textAnchor="end" fontSize={9} fill="#9ca3af" dominantBaseline="middle">60</text>
            <text x={margin-8} y={size-scale(100)+margin} textAnchor="end" fontSize={9} fill="#9ca3af" dominantBaseline="middle">100</text>
            <text x={margin-8} y={size-scale(140)+margin} textAnchor="end" fontSize={9} fill="#9ca3af" dominantBaseline="middle">140</text>

            {/* Fund dot */}
            <circle cx={cx} cy={cy} r={8} fill="#1466b8" stroke="white" strokeWidth={2} />
          </svg>

          {/* Text analysis */}
          <div className="space-y-3 flex-1">
            <div>
              <p className={`text-lg font-semibold ${quadrantColor}`}>{quadrant}</p>
              <p className="text-sm text-gray-600">
                Captures {upside.toFixed(0)}% of market gains and {downside.toFixed(0)}% of market losses.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Capture Asymmetry</span>
                <span className={`font-semibold ${asymmetry > 0 ? "text-green-700" : "text-red-700"}`}>
                  {asymmetry > 0 ? "+" : ""}{asymmetry.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Max Drawdown</span>
                <span className="font-semibold text-gray-900">{maxDrawdown.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Category Avg Drawdown</span>
                <span className="text-gray-500">{categoryAvgDrawdown.toFixed(1)}%</span>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              {asymmetry > 5
                ? "Favorable asymmetry — this fund captures significantly more upside than downside."
                : asymmetry > 0
                  ? "Slight positive asymmetry — participates in more upside than downside."
                  : asymmetry > -5
                    ? "Near-symmetric capture — gains and losses track the market closely."
                    : "Unfavorable asymmetry — captures more downside than upside."}
              {" "}
              {maxDrawdown > categoryAvgDrawdown
                ? `Max drawdown of ${maxDrawdown.toFixed(1)}% is shallower than the ${categoryAvgDrawdown.toFixed(1)}% category average.`
                : `Max drawdown of ${maxDrawdown.toFixed(1)}% is deeper than the ${categoryAvgDrawdown.toFixed(1)}% category average.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
