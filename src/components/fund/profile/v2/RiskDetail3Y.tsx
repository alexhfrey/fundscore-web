// ============================================================================
// 03b · RiskDetail3Y — the "Risk detail — 3-year trailing" expander under the
// Historical Performance period table. SERVED data (risk_behavior, gate: free):
// fund-only stats (Sharpe/Sortino/std dev 3Y from monthly NAV, all-time max
// drawdown from daily closes) plus benchmark-relative stats where served.
//
// Basis honesty: the relative stats are measured vs an ETF proxy of the fund's
// STATED prospectus benchmark (`benchmark_relative_to`) — NOT the page's passive
// alternative — and on a different (3Y monthly / daily) window than the period
// table above. Both facts are said in place. Missing fields render em-dash
// inside a served group and the whole relative group is omitted when the fund
// has no benchmark ETF match (honest absence, never zeros).
// ============================================================================
import Link from "next/link";
import type { RiskBehavior } from "@/lib/serving/profile-v2";
import type { SourceStamp } from "@/lib/serving/profile";
import { fmtDate, EM_DASH } from "@/lib/serving/format";
import { UnlockLine } from "../primitives";

const ratio = (v: number | null) => (v == null || !isFinite(v) ? EM_DASH : v.toFixed(2));
const fracPct = (v: number | null, digits = 1) =>
  v == null || !isFinite(v) ? EM_DASH : `${(v * 100).toFixed(digits)}%`;
const fracPctSigned = (v: number | null, digits = 1) =>
  v == null || !isFinite(v)
    ? EM_DASH
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;
const rawPct = (v: number | null, digits = 0) =>
  v == null || !isFinite(v) ? EM_DASH : `${v.toFixed(digits)}%`;

function Cell({ k, v, d }: { k: string; v: string; d?: string | null }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3.5 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">{k}</div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-gray-900">{v}</div>
      {d && <div className="mt-0.5 text-[10.5px] leading-snug text-gray-400">{d}</div>}
    </div>
  );
}

export function RiskDetail3Y({
  riskBehavior,
  locked,
  pricingStamp,
  headlineTeNote,
}: {
  // Passed only when the caller is free-entitled (applyGates strips it below);
  // `locked` says the served section exists but the caller is below the gate.
  riskBehavior: RiskBehavior | null;
  locked: boolean;
  // The public Tiingo pricing stamp — the honest as-of (and staleness) for
  // these NAV-derived stats; the payload itself carries no as-of.
  pricingStamp: SourceStamp | null;
  // One-line pointer at the page's headline TE when both exist (different basis).
  headlineTeNote: string | null;
}) {
  if (riskBehavior == null && !locked) return null;

  const rb = riskBehavior;
  const hasRelative =
    rb != null &&
    [rb.beta_3y, rb.alpha_3y, rb.r_squared_3y, rb.tracking_error, rb.information_ratio, rb.upside_capture, rb.downside_capture].some(
      (v) => v != null,
    );
  const bench = rb?.benchmark_relative_to ?? "its stated benchmark";
  const asOf =
    pricingStamp?.as_of_date != null
      ? `daily adjusted NAV through ${fmtDate(pricingStamp.as_of_date)}${pricingStamp.status === "stale" ? " (refresh pending)" : ""}`
      : null;

  return (
    <details className="group mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
        <span className="text-[10px] text-gray-400 transition-transform group-open:rotate-90">▶</span>
        <span className="text-[13px] font-semibold text-gray-900">Risk detail — 3-year trailing</span>
        <span className="text-[11px] text-gray-400">{asOf ?? "from adjusted NAV"}</span>
        <Link
          href="/methodology#risk-behavior"
          className="ml-auto text-[11px] text-gray-400 hover:text-[#1466b8] hover:underline"
        >
          How we calculate this →
        </Link>
      </summary>
      {locked || rb == null ? (
        <div className="border-t border-gray-100 px-5 py-4">
          <UnlockLine tier="free">
            See the fund&apos;s trailing 3-year risk profile — volatility, Sharpe,
            drawdown and benchmark-relative behavior.
          </UnlockLine>
        </div>
      ) : (
        <div className="border-t border-gray-100 px-5 pb-4 pt-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Cell k="Sharpe (3Y)" v={ratio(rb.sharpe_3y)} />
            <Cell k="Sortino (3Y)" v={ratio(rb.sortino_3y)} />
            <Cell k="Std dev (3Y)" v={fracPct(rb.std_dev_3y)} />
            <Cell
              k="Max drawdown"
              v={fracPctSigned(rb.max_drawdown)}
              d={rb.max_drawdown_date ? `dated ${fmtDate(rb.max_drawdown_date)} · full history` : "full history"}
            />
            {hasRelative && (
              <>
                <Cell k={`Beta vs ${bench} (3Y)`} v={ratio(rb.beta_3y)} />
                <Cell k={`Alpha vs ${bench} (3Y)`} v={fracPctSigned(rb.alpha_3y)} d="annualized" />
                <Cell k={`Tracking error vs ${bench} (3Y)`} v={fracPct(rb.tracking_error)} d={headlineTeNote} />
                <Cell k="Information ratio (3Y)" v={ratio(rb.information_ratio)} />
                <Cell k="R² (3Y)" v={rawPct(rb.r_squared_3y)} />
                <Cell k="Upside capture (3Y)" v={rawPct(rb.upside_capture)} />
                <Cell k="Downside capture (3Y)" v={rawPct(rb.downside_capture)} />
              </>
            )}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
            Trailing 3-year figures from monthly adjusted NAV (max drawdown from full-history
            daily closes) — a different, shorter window than the period table above; each is
            shown with its own window on purpose.
            {hasRelative && (
              <>
                {" "}
                Benchmark-relative rows are measured against an ETF tracking the fund&apos;s{" "}
                <b>stated prospectus benchmark ({bench})</b> — not the passive alternative the
                rest of this page compares against.
              </>
            )}
          </p>
        </div>
      )}
    </details>
  );
}
