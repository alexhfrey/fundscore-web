"use client";

import { useRouter } from "next/navigation";
import { FundSummary } from "@/lib/types";
import { useSortableData } from "@/hooks";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { ReturnValue } from "@/components/ui/ReturnValue";
import { formatAUM, formatExpenseRatio } from "@/lib/utils/format";

interface FundTableProps {
  funds: FundSummary[];
}

type SortConfig = ReturnType<
  typeof useSortableData<FundSummary>
>["sortConfig"];

interface SortHeaderProps {
  label: string;
  sortKey: string;
  className?: string;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
}

function SortHeader({
  label,
  sortKey,
  className = "",
  sortConfig,
  onSort,
}: SortHeaderProps) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortConfig?.key === sortKey && (
          <span className="text-[#1466b8]">
            {sortConfig.direction === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </th>
  );
}

export function FundTable({ funds }: FundTableProps) {
  const router = useRouter();
  const { items, sortConfig, requestSort } = useSortableData(funds, {
    key: "fundScore",
    direction: "desc",
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <SortHeader
                label="Fund"
                sortKey="name"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
              <SortHeader
                label="Peer Group"
                sortKey="peerGroup"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
              <SortHeader
                label="FundScore"
                sortKey="fundScore"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
              <SortHeader
                label="YTD"
                sortKey="ytdReturn"
                className="text-right"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
              <SortHeader
                label="1Y"
                sortKey="oneYearReturn"
                className="text-right"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
              <SortHeader
                label="3Y"
                sortKey="threeYearReturn"
                className="text-right"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
              <SortHeader
                label="Expense"
                sortKey="expenseRatio"
                className="text-right"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
              <SortHeader
                label="AUM"
                sortKey="aum"
                className="text-right"
                sortConfig={sortConfig}
                onSort={requestSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                  No funds match your search criteria
                </td>
              </tr>
            ) : (
              items.map((fund) => (
                <tr
                  key={fund.ticker}
                  className="cursor-pointer hover:bg-blue-50/30 transition-colors"
                  onClick={() => router.push(`/funds/${fund.ticker}`)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">
                        {fund.ticker}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {fund.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      vs {fund.passiveAltTicker}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {fund.peerGroup}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={fund.fundScore} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReturnValue value={fund.ytdReturn} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReturnValue value={fund.oneYearReturn} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReturnValue value={fund.threeYearReturn} />
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {formatExpenseRatio(fund.expenseRatio)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {formatAUM(fund.aum)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
