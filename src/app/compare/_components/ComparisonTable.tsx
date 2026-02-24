"use client";

import { FundDetail } from "@/lib/types";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { ReturnValue } from "@/components/ui/ReturnValue";
import {
  formatAUM,
  formatExpenseRatio,
  formatNumber,
} from "@/lib/utils/format";

interface ComparisonTableProps {
  funds: FundDetail[];
}

interface MetricRow {
  label: string;
  values: (string | number | null)[];
  type?: "return" | "score" | "text";
  highlight?: "highest" | "lowest";
}

export function ComparisonTable({ funds }: ComparisonTableProps) {
  const metrics: MetricRow[] = [
    {
      label: "FundScore",
      values: funds.map((f) => f.fundScore),
      type: "score",
      highlight: "highest",
    },
    {
      label: "Category",
      values: funds.map((f) => f.category),
      type: "text",
    },
    {
      label: "Passive Alternative",
      values: funds.map((f) => f.passiveAltTicker),
      type: "text",
    },
    {
      label: "YTD Return",
      values: funds.map((f) => f.ytdReturn),
      type: "return",
      highlight: "highest",
    },
    {
      label: "1Y Return",
      values: funds.map((f) => f.oneYearReturn),
      type: "return",
      highlight: "highest",
    },
    {
      label: "3Y Return (Ann.)",
      values: funds.map((f) => f.threeYearReturn),
      type: "return",
      highlight: "highest",
    },
    {
      label: "5Y Return (Ann.)",
      values: funds.map((f) => f.fiveYearReturn),
      type: "return",
      highlight: "highest",
    },
    {
      label: "Expense Ratio",
      values: funds.map((f) => f.expenseRatio),
      type: "text",
      highlight: "lowest",
    },
    {
      label: "AUM",
      values: funds.map((f) => f.aum),
      type: "text",
    },
    {
      label: "Sharpe Ratio (3Y)",
      values: funds.map((f) => f.risk.sharpeRatio.threeYear),
      type: "text",
      highlight: "highest",
    },
    {
      label: "Max Drawdown",
      values: funds.map((f) => f.risk.maxDrawdown),
      type: "text",
      highlight: "highest",
    },
    {
      label: "Alpha (3Y)",
      values: funds.map((f) => f.risk.alpha.threeYear),
      type: "text",
      highlight: "highest",
    },
    {
      label: "Beta (3Y)",
      values: funds.map((f) => f.risk.beta.threeYear),
      type: "text",
    },
    {
      label: "Batting Average",
      values: funds.map((f) => f.trading.battingAverage),
      type: "text",
      highlight: "highest",
    },
    {
      label: "Active Share",
      values: funds.map((f) => f.trading.activeShare),
      type: "text",
      highlight: "highest",
    },
  ];

  const getBestIndex = (
    values: (string | number | null)[],
    direction: "highest" | "lowest"
  ): number => {
    let bestIdx = -1;
    let bestVal = direction === "highest" ? -Infinity : Infinity;
    values.forEach((v, i) => {
      if (typeof v === "number") {
        if (direction === "highest" && v > bestVal) {
          bestVal = v;
          bestIdx = i;
        }
        if (direction === "lowest" && v < bestVal) {
          bestVal = v;
          bestIdx = i;
        }
      }
    });
    return bestIdx;
  };

  const formatValue = (
    value: string | number | null,
    label: string
  ): string => {
    if (value === null) return "--";
    if (typeof value === "string") return value;
    if (label === "Expense Ratio") return formatExpenseRatio(value);
    if (label === "AUM") return formatAUM(value);
    if (label.includes("Batting") || label.includes("Active Share"))
      return `${(value * 100).toFixed(1)}%`;
    if (label.includes("Max Drawdown")) return `${value.toFixed(1)}%`;
    return formatNumber(value);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Side-by-Side Comparison
      </h3>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-40">
                Metric
              </th>
              {funds.map((f) => (
                <th
                  key={f.ticker}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-900 uppercase"
                >
                  {f.ticker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metrics.map((metric) => {
              const bestIdx = metric.highlight
                ? getBestIndex(metric.values, metric.highlight)
                : -1;
              return (
                <tr key={metric.label}>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {metric.label}
                  </td>
                  {metric.values.map((v, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 text-center ${
                        i === bestIdx
                          ? "bg-green-50 font-semibold text-green-700"
                          : ""
                      }`}
                    >
                      {metric.type === "score" && typeof v === "number" ? (
                        <div className="flex justify-center">
                          <ScoreBadge score={v} size="sm" />
                        </div>
                      ) : metric.type === "return" &&
                        typeof v === "number" ? (
                        <ReturnValue value={v} />
                      ) : (
                        formatValue(v, metric.label)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
