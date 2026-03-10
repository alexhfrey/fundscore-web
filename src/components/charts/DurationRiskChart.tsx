"use client";

interface RateShiftImpact {
  shift: string;
  impact: number;
}

interface DurationRiskChartProps {
  impacts: RateShiftImpact[];
  effectiveDuration: number;
}

export function DurationRiskChart({
  impacts,
  effectiveDuration,
}: DurationRiskChartProps) {
  const maxAbs = Math.max(...impacts.map((i) => Math.abs(i.impact)), 1);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Effective duration: <span className="font-semibold text-gray-900">{effectiveDuration.toFixed(2)} years</span>.
        Estimated price impact if interest rates rise:
      </p>
      <div className="space-y-3">
        {impacts.map((item) => (
          <div key={item.shift} className="flex items-center gap-3 text-sm">
            <span className="text-gray-600 w-20 flex-shrink-0 font-medium">
              {item.shift}
            </span>
            <div className="flex-1 flex items-center">
              <div className="w-full h-6 bg-gray-100 rounded overflow-hidden relative">
                <div
                  className="absolute right-1/2 h-full bg-red-400 rounded"
                  style={{ width: `${(Math.abs(item.impact) / maxAbs) * 50}%` }}
                />
              </div>
            </div>
            <span className="text-red-600 font-semibold w-16 text-right">
              {item.impact.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
