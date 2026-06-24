"use client";

// ============================================================================
// Portfolio X-Ray page client (spec docs/product/page_specs/portfolio_xray.md,
// T7b / Phase 4 Track 4C). Local-first editor → POST /api/portfolio/solve →
// render the AGGREGATE passive alternative, aggregate fit, aggregate fee gap,
// and aggregate sector exposure x-ray. Every number traces to the T7a solver
// output; missing fee / stale exposure / suppressed coverage render as honest
// states, never fabricated. Holdings stay in this component's state and the
// request body only — never logged, persisted, or put in the URL (privacy
// charter).
// ============================================================================
import { useState, useCallback } from "react";
import { PortfolioEditor } from "./PortfolioEditor";
import { XrayResult } from "./XrayResult";
import { parsePortfolioText } from "@/lib/serving/portfolio-parse";
import type { SolveResult } from "@/lib/serving/portfolio-solver";

export interface HoldingRow {
  id: string;
  ticker: string;
  weight: string; // raw string for the input; parsed on submit
}

const EXAMPLES: { label: string; rows: { ticker: string; weight: number }[] }[] = [
  {
    label: "Active / passive mix",
    rows: [
      { ticker: "FCNTX", weight: 60 },
      { ticker: "DODGX", weight: 30 },
      { ticker: "VOO", weight: 10 },
    ],
  },
  {
    label: "All-active growth",
    rows: [
      { ticker: "AGTHX", weight: 50 },
      { ticker: "FBGRX", weight: 50 },
    ],
  },
  {
    label: "3-fund index",
    rows: [
      { ticker: "VTSAX", weight: 60 },
      { ticker: "VTIAX", weight: 30 },
      { ticker: "VBTLX", weight: 10 },
    ],
  },
];

let _rid = 0;
function newId() {
  return `h${_rid++}`;
}

function blankRows(): HoldingRow[] {
  return [
    { id: newId(), ticker: "", weight: "" },
    { id: newId(), ticker: "", weight: "" },
    { id: newId(), ticker: "", weight: "" },
  ];
}

export function PortfolioXray() {
  const [rows, setRows] = useState<HoldingRow[]>(blankRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);

  const loadExample = useCallback((ex: (typeof EXAMPLES)[number]) => {
    setResult(null);
    setError(null);
    setRows(ex.rows.map((r) => ({ id: newId(), ticker: r.ticker, weight: String(r.weight) })));
  }, []);

  const onPaste = useCallback((text: string) => {
    const parsed = parsePortfolioText(text);
    if (parsed.length === 0) return false;
    setResult(null);
    setError(null);
    setRows(parsed.map((p) => ({ id: newId(), ticker: p.ticker, weight: String(p.weight) })));
    return true;
  }, []);

  const onSubmit = useCallback(async () => {
    const holdings = rows
      .map((r) => ({ ticker: r.ticker.trim().toUpperCase(), weight: Number(r.weight) }))
      .filter((r) => r.ticker && isFinite(r.weight) && r.weight > 0);

    if (holdings.length === 0) {
      setError("Enter at least one holding with a ticker and a positive weight.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/portfolio/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error ?? "Something went wrong running the analysis.");
        return;
      }
      setResult(data as SolveResult);
    } catch {
      setError("Could not reach the analysis service. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [rows]);

  return (
    <div className="space-y-8">
      <PortfolioEditor
        rows={rows}
        setRows={setRows}
        onSubmit={onSubmit}
        onPaste={onPaste}
        loading={loading}
        examples={EXAMPLES}
        onLoadExample={loadExample}
        newId={newId}
      />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500 shadow-sm">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#1466b8]" />
          Solving one passive ETF blend for your whole portfolio — this runs a
          live optimization and can take up to a minute on a cold start.
        </div>
      )}

      {result && !loading && <XrayResult result={result} />}
    </div>
  );
}
