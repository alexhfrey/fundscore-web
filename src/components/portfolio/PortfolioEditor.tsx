"use client";

// ============================================================================
// Portfolio Composition Editor (spec § Section 1). Per-row ticker + weight,
// bulk paste, example portfolios, a remaining-weight indicator, and the fixed
// holdings-privacy notice. Weights may be % or $ — the solver normalizes raw
// weights over eligible rows, so this editor stays unit-agnostic.
// ============================================================================
import { useState, type Dispatch, type SetStateAction } from "react";
import type { HoldingRow } from "./PortfolioXray";

interface Example {
  label: string;
  rows: { ticker: string; weight: number }[];
}

export function PortfolioEditor({
  rows,
  setRows,
  onSubmit,
  onPaste,
  loading,
  examples,
  onLoadExample,
  newId,
}: {
  rows: HoldingRow[];
  setRows: Dispatch<SetStateAction<HoldingRow[]>>;
  onSubmit: () => void;
  onPaste: (text: string) => boolean;
  loading: boolean;
  examples: Example[];
  onLoadExample: (ex: Example) => void;
  newId: () => string;
}) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const totalWeight = rows.reduce((s, r) => {
    const w = Number(r.weight);
    return s + (isFinite(w) && w > 0 ? w : 0);
  }, 0);
  const filled = rows.filter((r) => r.ticker.trim() && Number(r.weight) > 0).length;

  function update(id: string, field: "ticker" | "weight", value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { id: newId(), ticker: "", weight: "" }]);
  }
  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }
  function clearAll() {
    setRows([{ id: newId(), ticker: "", weight: "" }]);
  }
  function applyPaste() {
    const ok = onPaste(pasteText);
    if (ok) {
      setShowPaste(false);
      setPasteText("");
    }
  }

  // Treat totals near 100 as percentages; otherwise the user is using raw
  // weights/dollars and we only show the count (the solver normalizes either way).
  const looksLikePct = totalWeight > 0 && totalWeight <= 110;
  const remaining = looksLikePct ? 100 - totalWeight : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Your holdings</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Enter each fund or ETF and its weight (% or $). We solve one passive
            ETF blend for the whole book.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* A brokerage CSV export is just text — parse it in the browser and
              reuse the bulk-paste path. The file is never uploaded anywhere:
              the privacy charter says row-level holdings never leave the device
              except as the tickers the solver needs. */}
          <label className="cursor-pointer rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            Upload CSV
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // allow re-picking the same file
                if (!file) return;
                const text = await file.text();
                setPasteText(text);
                setShowPaste(true);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setShowPaste((s) => !s)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Bulk paste
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label className="text-xs font-medium text-gray-500">
            One holding per line — <code>TICKER, WEIGHT</code> (commas, tabs, %
            and $ are all fine).
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={"FCNTX, 60%\nDODGX, 30%\nVOO, 10%"}
            className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 font-mono text-sm focus:border-[#1466b8] focus:outline-none focus:ring-1 focus:ring-[#1466b8]"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPaste(false)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyPaste}
              className="rounded-md bg-[#1466b8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f4f8c]"
            >
              Load holdings
            </button>
          </div>
        </div>
      )}

      {/* Per-row editor */}
      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_120px_36px] gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
          <span>Ticker</span>
          <span>Weight</span>
          <span />
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_120px_36px] items-center gap-3"
          >
            <input
              value={r.ticker}
              onChange={(e) => update(r.id, "ticker", e.target.value.toUpperCase())}
              placeholder="e.g. FCNTX"
              spellCheck={false}
              autoCapitalize="characters"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm uppercase tracking-wide focus:border-[#1466b8] focus:outline-none focus:ring-1 focus:ring-[#1466b8]"
            />
            <input
              value={r.weight}
              onChange={(e) => update(r.id, "weight", e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="rounded-md border border-gray-200 px-3 py-2 text-right text-sm tabular-nums focus:border-[#1466b8] focus:outline-none focus:ring-1 focus:ring-[#1466b8]"
            />
            <button
              type="button"
              onClick={() => removeRow(r.id)}
              aria-label="Remove holding"
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-300 hover:bg-gray-50 hover:text-rose-500"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-[#1466b8] hover:underline"
        >
          + Add holding
        </button>
        <div className="text-xs tabular-nums text-gray-500">
          {filled} holding{filled === 1 ? "" : "s"}
          {looksLikePct && (
            <>
              {" · "}
              weights total {totalWeight.toFixed(1)}%
              {remaining != null && Math.abs(remaining) >= 0.05 && (
                <span className="text-amber-600">
                  {" "}
                  ({remaining > 0 ? `${remaining.toFixed(1)}% unallocated` : `${Math.abs(remaining).toFixed(1)}% over`})
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Examples */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <span className="text-xs text-gray-400">Try an example:</span>
        {examples.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => onLoadExample(ex)}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-[#1466b8]/40 hover:bg-gray-50"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Submit */}
      <div className="mt-5">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-[#1466b8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4f8c] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Analyzing…" : "Run the X-Ray"}
        </button>
      </div>

      {/* Fixed privacy notice (spec § Section 1 — copy must not be modified). */}
      <p className="mt-4 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-400">
        Your holdings stay on this device unless you explicitly export or share
        them. We never sell, share, or log row-level holdings.
      </p>
    </div>
  );
}
