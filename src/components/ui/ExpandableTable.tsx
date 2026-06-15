"use client";

import { useState, ReactNode } from "react";

interface ExpandableTableProps {
  data: Record<string, unknown>[];
  initialCount: number;
  renderRow: (item: Record<string, unknown>, index: number) => ReactNode;
  renderHeader: () => ReactNode;
}

export function ExpandableTable({
  data,
  initialCount,
  renderRow,
  renderHeader,
}: ExpandableTableProps) {
  const [expanded, setExpanded] = useState(false);
  const displayData = expanded ? data : data.slice(0, initialCount);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>{renderHeader()}</thead>
        <tbody className="divide-y divide-gray-100">
          {displayData.map((item, i) => renderRow(item, i))}
        </tbody>
      </table>
      {data.length > initialCount && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 text-sm font-medium text-[#1466b8] hover:bg-blue-50 border-t border-gray-200 transition-colors"
        >
          {expanded
            ? "Show less"
            : `Show all (${data.length} total)`}
        </button>
      )}
    </div>
  );
}
