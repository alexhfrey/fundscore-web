"use client";

import { MaturityBucket } from "@/lib/types";

interface MaturityDistributionChartProps {
  data: MaturityBucket[];
}

export function MaturityDistributionChart({
  data,
}: MaturityDistributionChartProps) {
  const maxWeight = Math.max(...data.map((d) => d.weight), 1);

  return (
    <div className="space-y-2">
      {data.map((bucket) => (
        <div key={bucket.range} className="flex items-center gap-3 text-sm">
          <span className="text-gray-600 w-16 flex-shrink-0 text-right">
            {bucket.range}
          </span>
          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
            <div
              className="h-full bg-[#1466b8] rounded"
              style={{ width: `${(bucket.weight / maxWeight) * 100}%` }}
            />
          </div>
          <span className="text-gray-900 font-medium w-12 text-right">
            {bucket.weight.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}
