"use client";

// ============================================================================
// Portfolio X-Ray page client (spec docs/product/page_specs/portfolio_xray.md,
// T7b / Phase 4 Track 4C). Local-first editor → POST /api/portfolio/solve →
// render the verdict-led analysis. Once a result is in, the editor collapses to
// a slim book strip so the page opens on the verdict, not the input form. Every
// number traces to the T7a solver output; missing fee / stale exposure /
// suppressed coverage render as honest states, never fabricated. Holdings stay
// in this component's state and the request body only — never logged, persisted,
// or put in the URL (privacy charter).
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
      { ticker: "FXAIX", weight: 40 },
      { ticker: "FCNTX", weight: 35 },
      { ticker: "VWIGX", weight: 25 },
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
  const [editing, setEditing] = useState(true);

  const loadExample = useCallback((ex: (typeof EXAMPLES)[number]) => {
    setResult(null);
    setError(null);
    setEditing(true);
    setRows(ex.rows.map((r) => ({ id: newId(), ticker: r.ticker, weight: String(r.weight) })));
  }, []);

  const onPaste = useCallback((text: string) => {
    const parsed = parsePortfolioText(text);
    if (parsed.length === 0) return false;
    setResult(null);
    setError(null);
    setEditing(true);
    setRows(parsed.map((p) => ({ id: newId(), ticker: p.ticker, weight: String(p.weight) })));
    return true;
  }, []);

  const startOver = useCallback(() => {
    setResult(null);
    setError(null);
    setEditing(true);
    setRows(blankRows());
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
      setEditing(false);
    } catch {
      setError("Could not reach the analysis service. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [rows]);

  const collapsed = result != null && !editing && !loading;

  return (
    <div className="space-y-8">
      {/* The intro is the hero only before a result — once analysis is in, the
          verdict takes the top so the page opens on the payoff, not the pitch. */}
      {!result && (
        <header className="max-w-2xl">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            Portfolio X-Ray
          </p>
          <h1 className="mt-3 font-serif text-[2.4rem] leading-[1.04] font-semibold tracking-[-0.02em] text-balance text-ink sm:text-5xl">
            See what you actually own.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Enter the funds and ETFs you hold. FundScore looks through every one to
            the stocks underneath, finds the passive blend that tracks your whole
            book, and shows what you&apos;re paying over it.
          </p>
        </header>
      )}

      {collapsed ? (
        <BookStrip rows={rows} onEdit={() => setEditing(true)} onReset={startOver} />
      ) : (
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
      )}

      {error && (
        <div className="rounded-xl border border-below/30 bg-below/5 px-4 py-3 text-sm text-below">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-rule bg-white px-5 py-10 text-center text-sm text-ink-soft shadow-[0_1px_2px_rgba(14,35,56,0.04),0_10px_28px_-14px_rgba(14,35,56,0.15)]">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-rule border-t-primary" />
          Solving one passive ETF blend for your whole portfolio — this runs a live
          optimization and can take up to a minute on a cold start.
        </div>
      )}

      {result && !loading && <XrayResult result={result} />}
    </div>
  );
}

/** Slim summary of the analysed book — replaces the editor once results are in. */
function BookStrip({
  rows,
  onEdit,
  onReset,
}: {
  rows: HoldingRow[];
  onEdit: () => void;
  onReset: () => void;
}) {
  const filled = rows.filter((r) => r.ticker.trim() && Number(r.weight) > 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-rule bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(14,35,56,0.04)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft/70">
          Your book
        </span>
        {filled.map((r) => (
          <span key={r.id} className="text-sm">
            <span className="font-mono font-semibold text-ink">{r.ticker}</span>{" "}
            <span className="tabular-nums text-ink-soft">{r.weight}</span>
          </span>
        ))}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-rule px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper hover:text-ink"
        >
          Edit holdings
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
