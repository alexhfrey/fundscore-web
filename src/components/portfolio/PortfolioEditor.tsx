"use client";

// ============================================================================
// Portfolio Composition Editor (spec § Section 1). Per-row ticker + weight,
// bulk paste, example portfolios, a remaining-weight indicator, and the fixed
// holdings-privacy notice. Weights may be % or $ — the solver normalizes raw
// weights over eligible rows, so this editor stays unit-agnostic.
//
// Editorial identity (matches the landing page + result): ink/paper/primary
// palette, mono labels, rule hairlines.
// ============================================================================
import { useState, type Dispatch, type SetStateAction } from "react";
import type { HoldingRow } from "./PortfolioXray";

interface Example {
  label: string;
  rows: { ticker: string; weight: number }[];
}

const CARD =
  "rounded-2xl border border-rule bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(14,35,56,0.04),0_10px_28px_-14px_rgba(14,35,56,0.15)]";
const CHIP =
  "rounded-full border border-rule px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-primary/40 hover:text-ink";
const FIELD =
  "rounded-lg border border-rule bg-white px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

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

  const looksLikePct = totalWeight > 0 && totalWeight <= 110;
  const remaining = looksLikePct ? 100 - totalWeight : null;

  return (
    <div className={CARD}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Your holdings</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Enter each fund or ETF and its weight (% or $).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* A brokerage CSV export is just text — parse it in the browser and
              reuse the bulk-paste path. The file is never uploaded anywhere. */}
          <label className="cursor-pointer rounded-lg border border-rule px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper">
            Upload CSV
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
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
            className="rounded-lg border border-rule px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper"
          >
            Bulk paste
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-rule px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper"
          >
            Clear
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="mb-4 rounded-lg border border-rule bg-paper p-3">
          <label className="text-xs font-medium text-ink-soft">
            One holding per line — <code>TICKER, WEIGHT</code> (commas, tabs, % and
            $ are all fine).
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={"FCNTX, 60%\nDODGX, 30%\nVOO, 10%"}
            className="mt-2 w-full rounded-lg border border-rule px-3 py-2 font-mono text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPaste(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyPaste}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
            >
              Load holdings
            </button>
          </div>
        </div>
      )}

      {/* Per-row editor */}
      <div className="space-y-2">
        <div className="hidden grid-cols-[1fr_120px_36px] gap-3 px-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft/70 sm:grid">
          <span>Ticker</span>
          <span>Weight</span>
          <span />
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_120px_36px] items-center gap-3">
            <input
              value={r.ticker}
              onChange={(e) => update(r.id, "ticker", e.target.value.toUpperCase())}
              placeholder="e.g. FCNTX"
              spellCheck={false}
              autoCapitalize="characters"
              className={`${FIELD} uppercase tracking-wide`}
            />
            <input
              value={r.weight}
              onChange={(e) => update(r.id, "weight", e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className={`${FIELD} text-right tabular-nums`}
            />
            <button
              type="button"
              onClick={() => removeRow(r.id)}
              aria-label="Remove holding"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft/40 hover:bg-paper hover:text-below"
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
          className="text-sm font-medium text-primary hover:underline"
        >
          + Add holding
        </button>
        <div className="text-xs tabular-nums text-ink-soft">
          {filled} holding{filled === 1 ? "" : "s"}
          {looksLikePct && (
            <>
              {" · "}
              weights total {totalWeight.toFixed(1)}%
              {remaining != null && Math.abs(remaining) >= 0.05 && (
                <span className="text-below">
                  {" "}
                  ({remaining > 0 ? `${remaining.toFixed(1)}% unallocated` : `${Math.abs(remaining).toFixed(1)}% over`})
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Examples */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft/70">
          Try an example
        </span>
        {examples.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => onLoadExample(ex)}
            className={CHIP}
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
          className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Analysing…" : "Run the X-Ray"}
        </button>
      </div>

      {/* Fixed privacy notice (spec § Section 1 — copy must not be modified). */}
      <p className="mt-4 border-t border-rule pt-3 text-xs leading-relaxed text-ink-soft/80">
        Your holdings stay on this device unless you explicitly export or share
        them. We never sell, share, or log row-level holdings.
      </p>
    </div>
  );
}
