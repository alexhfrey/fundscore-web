"use client";
// ============================================================================
// 04 · AttributionExplorer — the bets-to-net waterfall. Client island (paid).
//   • category waterfall: Sector / Theme / Macro / Stock selection → gross
//     (bets + selection) → fees + trading → net, from the FIXTURE window summary.
//   • per-category expand: sector/theme/macro show the steady-tilt (bias) vs
//     tilt-variation (timing) factor split; Stock selection shows the REAL
//     served Brinson member tables (1Y/3Y/5Y) as a RELATED lens — never a
//     decomposition of the idiosyncratic −298.
//   • beta tilt: a separated context panel, never summed into the chain.
//   • range selects: pinned to the default window with the honesty note — no
//     sub-window figure is ever invented.
// ============================================================================
import { useState } from "react";
import type { AttributionWindowSummary } from "@/lib/serving/profile-v2";
import { bpsSigned, factorLabel, categoryLabel, ppSigned } from "./format";
import { ProtoChip, GapChip } from "./primitives";

export interface BrinsonRow {
  label: string;
  activeWeightPp: number | null;
  fundRetPct: number | null;
  iwfRetPct: number | null;
  impactBps: number | null;
}

interface Category {
  type: string;
  label: string;
  total: number;
  factors: {
    id: string;
    label: string;
    bias: number | null;
    timing: number | null;
    avgBeta: number | null;
    total: number | null;
  }[];
}

const pctNum = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);

export function AttributionExplorer({
  summary,
  brinson,
  betaTiltPlain,
  passiveLabel,
}: {
  summary: AttributionWindowSummary;
  brinson: Record<string, BrinsonRow[]>;
  betaTiltPlain: string | null;
  passiveLabel: string | null;
}) {
  const pass = passiveLabel ?? "the index";
  const grid = summary.quarter_grid ?? [];
  const win = summary.default_window;

  // Group factor contributions into the three bet categories.
  const cats: Category[] = ["sector", "theme", "macro"].map((type) => {
    const factors = (summary.factor_contributions ?? [])
      .filter((f) => f.factor_type === type)
      .map((f) => ({
        id: f.factor_id,
        label: factorLabel(f.factor_id),
        bias: f.bias_bps,
        timing: f.timing_bps,
        avgBeta: f.avg_active_beta,
        total: f.total_bps,
      }));
    const total = factors.reduce((s, f) => s + (f.total ?? 0), 0);
    return { type, label: categoryLabel(type), total, factors };
  });

  const idio = summary.stock_selection_idio_bps ?? 0;
  const realised = summary.realised_active_bps ?? 0;
  const recon = summary.residual_reconciliation_bps ?? 0;
  const net = realised - recon;

  const allVals = [...cats.map((c) => c.total), idio, realised, -recon, net];
  const maxAbs = Math.max(1, ...allVals.map((v) => Math.abs(v)));

  const [open, setOpen] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("3Y");
  const [note, setNote] = useState<"window" | "si">("window");

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Range control — preview, pinned to the default window. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Window</span>
        <select
          aria-label="Window start"
          defaultValue={grid[0]}
          onChange={() => setNote("window")}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] font-semibold text-gray-800"
        >
          {grid.map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
        <span className="text-gray-400">→</span>
        <select
          aria-label="Window end"
          defaultValue={grid[grid.length - 1]}
          onChange={() => setNote("window")}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] font-semibold text-gray-800"
        >
          {grid.map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setNote("si")}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:border-gray-400"
        >
          Since inception
        </button>
        <GapChip>preview — figures always show the full window</GapChip>
      </div>
      <div className="border-b border-gray-100 border-l-2 border-l-amber-300 bg-amber-50/60 px-4 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
        {note === "si" ? (
          <>
            &ldquo;Since inception&rdquo; is a <b>returns-based</b> read — see
            Historical performance for the full-life growth chart. Holdings-based
            attribution covers the holdings era only
            {win ? ` (${win.start} → ${win.end})` : ""}.
          </>
        ) : (
          <>
            Custom sub-windows compute in the full product. This preview always
            shows the full holdings-era window
            {win ? ` ${win.start} → ${win.end}` : ""} — sub-window figures are
            never invented.
          </>
        )}
      </div>

      {/* Waterfall + beta-tilt context */}
      <div className="grid lg:grid-cols-[1.55fr_0.95fr]">
        <div className="min-w-0 border-b border-gray-100 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-5 pb-1 pt-4">
            <h3 className="text-[13px] font-semibold text-gray-900">
              From bets to net — bps/yr · β-adjusted · vs {pass}
            </h3>
            <span className="text-[11px] text-gray-400">tap a category to see its members</span>
          </div>
          {summary.basis_migration_note && (
            <p className="px-5 pb-2 pt-1 text-[11.5px] leading-relaxed text-gray-500">
              {summary.basis_migration_note}
            </p>
          )}

          <div className="px-5 pb-4">
            {cats.map((c) => (
              <div key={c.type}>
                <WfRow
                  name={c.label}
                  sub={c.factors
                    .map((f) => `${f.label} ${bpsSigned(f.total)}`)
                    .join(" · ")}
                  value={c.total}
                  maxAbs={maxAbs}
                  expandable
                  isOpen={open === c.type}
                  onToggle={() => setOpen(open === c.type ? null : c.type)}
                />
                {open === c.type && (
                  <FactorSub category={c} />
                )}
              </div>
            ))}

            <WfRow
              name="Stock selection"
              sub="all picks combined, idiosyncratic — expand: how individual names did (related lens)"
              value={idio}
              maxAbs={maxAbs}
              expandable
              isOpen={open === "sel"}
              onToggle={() => setOpen(open === "sel" ? null : "sel")}
            />
            {open === "sel" && (
              <BrinsonSub
                brinson={brinson}
                period={period}
                setPeriod={setPeriod}
                idio={idio}
                pass={pass}
              />
            )}

            <WfRow name="Bets + selection" sub="gross of fees · β-adjusted" value={realised} maxAbs={maxAbs} strong />
            <WfRow
              name="Fees + trading"
              sub="not visible to holdings-based analysis — the frozen-vs-NAV gap"
              value={-recon}
              maxAbs={maxAbs}
              muted
            />
            <WfRow name={`Net vs ${pass} over the window`} sub="after fees & trading · β-adjusted" value={net} maxAbs={maxAbs} net />
          </div>
        </div>

        {/* Beta tilt — a positioning choice, shown on its own, never summed. */}
        <aside className="bg-gray-50/70 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
              Beta tilt — a positioning choice, shown on its own
            </span>
            <ProtoChip />
          </div>
          {summary.beta_tilt && (
            <div className="mt-3 text-3xl font-bold tabular-nums text-slate-700">
              ≈ {bpsSigned(summary.beta_tilt.est_bps_per_year)}{" "}
              <span className="text-sm font-semibold text-gray-400">
                bps/yr · {summary.beta_tilt.window}
              </span>
            </div>
          )}
          {betaTiltPlain && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-gray-600">{betaTiltPlain}</p>
          )}
          <p className="mt-3 border-t border-dashed border-gray-200 pt-3 text-[11.5px] leading-relaxed text-gray-500">
            <b>Why it&apos;s separate:</b> the chain at left is measured after this
            tilt is removed — adding the bar into the chain would double-count it. A
            per-quarter beta-effect series is in development.
          </p>
        </aside>
      </div>

      {summary.residual_explainer && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 text-[12.5px] leading-relaxed text-gray-600">
          <b>Where&apos;s the residual? There isn&apos;t one inside the decomposition.</b>{" "}
          {summary.residual_explainer}
        </div>
      )}
    </div>
  );
}

// --- one waterfall row (name + bar + value) --------------------------------
function WfRow({
  name,
  sub,
  value,
  maxAbs,
  expandable,
  isOpen,
  onToggle,
  strong,
  muted,
  net,
}: {
  name: string;
  sub?: string;
  value: number;
  maxAbs: number;
  expandable?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  strong?: boolean;
  muted?: boolean;
  net?: boolean;
}) {
  const pos = value >= 0;
  const w = `${Math.min(50, (Math.abs(value) / maxAbs) * 50)}%`;
  const barColor = muted ? "bg-rose-300" : strong || net ? "bg-gray-900" : pos ? "bg-emerald-500" : "bg-rose-500";
  const valColor = pos ? "text-emerald-700" : "text-rose-700";
  const topBorder = strong ? "border-t-2 border-gray-900" : net ? "border-t-2 border-gray-900" : "border-t border-gray-100";
  return (
    <div
      className={`grid grid-cols-[1fr_84px] items-center gap-3 py-2.5 sm:grid-cols-[236px_1fr_84px] ${topBorder} ${
        expandable ? "cursor-pointer hover:bg-gray-50" : ""
      }`}
      onClick={expandable ? onToggle : undefined}
      role={expandable ? "button" : undefined}
      aria-expanded={expandable ? isOpen : undefined}
    >
      <div className="text-[13px]">
        <span className={`font-semibold ${net || strong ? "text-gray-900" : "text-gray-800"}`}>
          {expandable && (
            <span className={`mr-1.5 inline-block text-[10px] text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>
              ▶
            </span>
          )}
          {name}
        </span>
        {sub && <span className="mt-0.5 block text-[11px] font-normal leading-snug text-gray-500">{sub}</span>}
      </div>
      <div className="hidden sm:block">
        <div className="relative h-3.5">
          <span className="absolute bottom-[-2px] top-[-2px] left-1/2 w-px bg-gray-300" />
          <span
            className={`absolute top-0.5 bottom-0.5 rounded-sm ${barColor}`}
            style={pos ? { left: "50%", width: w } : { right: "50%", width: w }}
          />
        </div>
      </div>
      <div className={`text-right text-[13px] font-bold tabular-nums ${valColor} ${net ? "text-base" : ""}`}>
        {bpsSigned(value)}
        {net && <span className="block text-[9.5px] font-semibold text-gray-400">bps/yr</span>}
      </div>
    </div>
  );
}

// --- sector/theme/macro factor sub-table -----------------------------------
function FactorSub({ category }: { category: Category }) {
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-200 text-right text-[10px] uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2 text-left font-semibold">Factor</th>
              <th className="px-4 py-2 font-semibold">Steady tilt (bias)</th>
              <th className="px-4 py-2 font-semibold">Tilt variation (timing)</th>
              <th className="px-4 py-2 font-semibold">Avg active β</th>
              <th className="px-4 py-2 font-semibold">Total (bps/yr)</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {category.factors.map((f) => (
              <tr key={f.id} className="border-b border-gray-100 text-right last:border-0">
                <td className="px-4 py-2 text-left font-medium text-gray-800">{f.label}</td>
                <td className="px-4 py-2 text-gray-600">{bpsSigned(f.bias)}</td>
                <td className="px-4 py-2 text-gray-600">{bpsSigned(f.timing)}</td>
                <td className="px-4 py-2 text-gray-600">{f.avgBeta == null ? "—" : `${f.avgBeta >= 0 ? "+" : "−"}${Math.abs(f.avgBeta).toFixed(2)}`}</td>
                <td className={`px-4 py-2 font-bold ${(f.total ?? 0) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {bpsSigned(f.total)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-900 text-right font-bold">
              <td className="px-4 py-2 text-left text-gray-900">{category.label}</td>
              <td /> <td /> <td />
              <td className={`px-4 py-2 ${category.total < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {bpsSigned(category.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11.5px] leading-relaxed text-gray-500">
        <b>Steady tilt</b> = keeping the position on; <b>tilt variation</b> = moving
        it around. The two sum to each factor&apos;s total exactly — no residual
        inside the decomposition.
      </p>
    </div>
  );
}

// --- stock-selection Brinson member drill (real served returnAttribution) ---
function BrinsonSub({
  brinson,
  period,
  setPeriod,
  idio,
  pass,
}: {
  brinson: Record<string, BrinsonRow[]>;
  period: string;
  setPeriod: (p: string) => void;
  idio: number;
  pass: string;
}) {
  const rows = brinson[period] ?? [];
  const subtotal = rows.reduce((s, r) => s + (r.impactBps ?? 0), 0);
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex flex-wrap items-center gap-2.5 px-4 pb-1 pt-3">
        <h4 className="text-[13px] font-semibold text-gray-900">How individual names did vs {pass}</h4>
        <div className="inline-flex overflow-hidden rounded-md border border-gray-200">
          {["1Y", "3Y", "5Y"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPeriod(p);
              }}
              className={`border-r border-gray-200 px-2.5 py-1 text-[12px] font-semibold last:border-r-0 ${
                period === p ? "bg-gray-900 text-white" : "bg-white text-gray-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-gray-500">
          Brinson · its own window &amp; method — not a decomposition of the {bpsSigned(idio)}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[12.5px] italic text-gray-500">
          Member rows aren&apos;t served for this fund/period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-200 text-right text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 text-left font-semibold">Holding</th>
                <th className="px-4 py-2 font-semibold">Avg active wt (pp)</th>
                <th className="px-4 py-2 font-semibold">Fund return</th>
                <th className="px-4 py-2 font-semibold">{pass} return</th>
                <th className="px-4 py-2 font-semibold">Impact (bps)</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 text-right last:border-0">
                  <td className="px-4 py-2 text-left font-medium text-gray-800">{r.label}</td>
                  <td className="px-4 py-2 text-gray-600">{ppSigned(r.activeWeightPp)}</td>
                  <td className="px-4 py-2 text-gray-600">{pctNum(r.fundRetPct)}</td>
                  <td className="px-4 py-2 text-gray-600">{pctNum(r.iwfRetPct)}</td>
                  <td className={`px-4 py-2 font-bold ${(r.impactBps ?? 0) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {bpsSigned(r.impactBps)}
                  </td>
                </tr>
              ))}
              <tr className="italic text-gray-400">
                <td className="px-4 py-2 text-left">Top contributors shown — not exhaustive</td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2">—</td>
              </tr>
              <tr className="border-t-2 border-gray-900 text-right font-bold">
                <td className="px-4 py-2 text-left text-gray-900">Shown rows subtotal · {period}</td>
                <td /> <td /> <td />
                <td className={`px-4 py-2 ${subtotal < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {bpsSigned(subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="px-4 py-2.5 text-[11.5px] leading-relaxed text-gray-500">
        A <b>related lens, not a decomposition</b>: these Brinson member rows run on
        their own trailing window and method, and show which holdings drove{" "}
        <em>overall</em> active return vs {pass} — they do not sum to the{" "}
        {bpsSigned(idio)} bps/yr stock-selection figure above. Top contributors
        shown; the subtotal covers the displayed names only.
      </p>
    </div>
  );
}
