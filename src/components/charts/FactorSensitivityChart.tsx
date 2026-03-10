"use client";

import { FactorSensitivity } from "@/lib/types";

interface FactorSensitivityChartProps {
  sensitivities: FactorSensitivity[];
}

export function FactorSensitivityChart({
  sensitivities,
}: FactorSensitivityChartProps) {
  const maxAbs = Math.max(
    ...sensitivities.flatMap((s) => [
      Math.abs(s.estimatedImpactDown),
      Math.abs(s.estimatedImpactUp),
    ]),
    5
  );

  return (
    <div className="space-y-4">
      {sensitivities.map((s) => {
        const downWidth = (Math.abs(s.estimatedImpactDown) / maxAbs) * 100;
        const upWidth = (Math.abs(s.estimatedImpactUp) / maxAbs) * 100;

        return (
          <div key={s.factor} className="grid grid-cols-12 gap-2 items-center text-sm">
            <div className="col-span-3 sm:col-span-2">
              <p className="font-medium text-gray-900">{s.factor}</p>
              <p className="text-xs text-gray-400">{s.shockLabel}</p>
            </div>
            <div className="col-span-3 sm:col-span-4 flex justify-end items-center gap-1">
              <span className="text-xs text-red-600 font-medium w-12 text-right">
                {s.estimatedImpactDown > 0 ? "+" : ""}{s.estimatedImpactDown}%
              </span>
              <div className="w-full max-w-[120px] h-4 flex justify-end">
                <div
                  className="h-full bg-red-400 rounded-l"
                  style={{ width: `${downWidth}%` }}
                />
              </div>
            </div>
            <div className="col-span-3 sm:col-span-4 flex items-center gap-1">
              <div className="w-full max-w-[120px] h-4 flex">
                <div
                  className="h-full bg-green-400 rounded-r"
                  style={{ width: `${upWidth}%` }}
                />
              </div>
              <span className="text-xs text-green-600 font-medium w-12">
                {s.estimatedImpactUp > 0 ? "+" : ""}{s.estimatedImpactUp}%
              </span>
            </div>
            <div className="col-span-3 sm:col-span-2 text-xs text-gray-400 text-right">
              β={s.beta}
            </div>
          </div>
        );
      })}
      <div className="flex justify-center gap-6 pt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-red-400 rounded" /> If factor falls
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-green-400 rounded" /> If factor rises
        </span>
      </div>
    </div>
  );
}
