import { FundDetail } from "@/lib/types";

interface ExpectedOutcomeRangeProps {
  fund: FundDetail;
}

export function ExpectedOutcomeRange({ fund }: ExpectedOutcomeRangeProps) {
  const alpha = fund.risk.alpha.threeYear;
  const te = fund.risk.trackingError;

  const p10 = alpha + -1.28 * te;
  const p25 = alpha + -0.674 * te;
  const median = alpha;
  const p75 = alpha + 0.674 * te;
  const p90 = alpha + 1.28 * te;

  // Domain with padding so bars never touch the edges
  const padding = te * 0.5;
  const domainMin = p10 - padding;
  const domainMax = p90 + padding;
  const domainRange = domainMax - domainMin;

  const toPercent = (value: number) =>
    ((value - domainMin) / domainRange) * 100;

  const lightBandLeft = toPercent(p10);
  const lightBandWidth = toPercent(p90) - lightBandLeft;
  const darkBandLeft = toPercent(p25);
  const darkBandWidth = toPercent(p75) - darkBandLeft;
  const medianLeft = toPercent(median);
  const zeroLeft = toPercent(0);

  const formatValue = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const interpretiveText = `Expected to ${alpha > 0 ? "outperform" : "underperform"} ${fund.passiveAltTicker} by ${Math.abs(alpha).toFixed(1)}%/yr (middle 50%: ${p25.toFixed(1)}% to ${p75.toFixed(1)}%)`;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Expected Outcome Range
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        {/* Range visualization */}
        <div className="relative h-16 my-6">
          {/* Light band: 10th to 90th percentile */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-6 bg-blue-100 rounded"
            style={{
              left: `${lightBandLeft}%`,
              width: `${lightBandWidth}%`,
            }}
          />
          {/* Darker band: 25th to 75th percentile */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-6 bg-blue-300 rounded"
            style={{
              left: `${darkBandLeft}%`,
              width: `${darkBandWidth}%`,
            }}
          />
          {/* Zero line (benchmark) */}
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-400"
            style={{
              left: `${zeroLeft}%`,
              borderLeft: "2px dashed #9ca3af",
              background: "none",
              width: 0,
            }}
          />
          {/* Median dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#1466b8] rounded-full -translate-x-1/2"
            style={{ left: `${medianLeft}%` }}
          />
        </div>

        {/* Labels */}
        <div className="relative h-5">
          {[
            { value: p10, label: "P10" },
            { value: p25, label: "P25" },
            { value: median, label: "Med" },
            { value: p75, label: "P75" },
            { value: p90, label: "P90" },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="absolute -translate-x-1/2 text-center"
              style={{ left: `${toPercent(value)}%` }}
            >
              <span className="text-xs text-gray-500 block">{label}</span>
              <span className="text-xs text-gray-700 font-medium">
                {formatValue(value)}
              </span>
            </div>
          ))}
        </div>

        {/* Interpretive text */}
        <p className="mt-8 text-sm text-gray-600">{interpretiveText}</p>
      </div>
    </div>
  );
}
