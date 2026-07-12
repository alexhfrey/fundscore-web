// ============================================================================
// 03 · HistoricalPerformance — server shell around the client GrowthChart plus
// the after-fee period table. SERVED nav_series (profile-nav-series; gate
// public with the applyGates field-strip): the fund growth line + one
// proof-point period row are free; the vs-passive comparison (legs, β, full
// table, β-adj diff) is paid. Comparison legs arrive already stripped
// server-side for non-paid callers — this component renders what it is given
// and computes nothing beyond formatting.
//
// Honesty note: `series_start` is the COMMON PAIRED WINDOW start (first month
// both the fund and its passive blend are priced), NOT the fund's inception —
// all "SI" copy says "since <series_start>" for that reason.
// ============================================================================
import Link from "next/link";
import type { NavSeries, RiskBehavior } from "@/lib/serving/profile-v2";
import { buildNavHoverCopy } from "@/lib/serving/profile-v2";
import type { SourceStamp } from "@/lib/serving/profile";
import { bpsSigned } from "./format";
import { ChapterHeader, Panel, PanelHead, PanelNote } from "./primitives";
import { InfoTip } from "./InfoTip";
import { Unavailable, ProofPoint, UnlockLine } from "../primitives";
import { GrowthChart } from "./GrowthChart";
import { RiskDetail3Y } from "./RiskDetail3Y";

const pct = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "—" : `${v.toFixed(1)}%`;

/** "SI" reads "Since 2008-05" — the common paired window, never "inception". */
const periodLabel = (period: string, seriesStart: string | null) =>
  period === "SI" ? `Since ${seriesStart ?? "series start"}` : period;

export function HistoricalPerformance({
  navSeries,
  showComparison,
  riskBehavior,
  riskLocked = false,
  pricingStamp,
  headlineTeNote,
  headlineBetaNote,
  isPassive = false,
}: {
  navSeries: NavSeries | null;
  showComparison: boolean;
  // SERVED risk_behavior (gate: free) — passed only when the caller is
  // free-entitled; `riskLocked` keeps the honest locked expander for anon.
  riskBehavior?: RiskBehavior | null;
  riskLocked?: boolean;
  pricingStamp?: SourceStamp | null;
  headlineTeNote?: string | null;
  headlineBetaNote?: string | null;
  isPassive?: boolean;
}) {
  const riskDetail = (
    <RiskDetail3Y
      riskBehavior={riskBehavior ?? null}
      locked={riskLocked}
      pricingStamp={pricingStamp ?? null}
      headlineTeNote={headlineTeNote ?? null}
      headlineBetaNote={headlineBetaNote ?? null}
      isPassive={isPassive}
    />
  );

  if (!navSeries || !navSeries.points || navSeries.points.length === 0) {
    return (
      <section id="s3" className="scroll-mt-24">
        <ChapterHeader index={3} title="Historical performance" />
        <Unavailable>
          We don&apos;t have a validated matched fund-vs-passive growth series for
          this fund, so the performance read is suppressed rather than shown
          partial.
        </Unavailable>
        {/* The served 3Y risk detail can exist without a growth series (e.g. no
            passive blend) — render it rather than suppress served data. */}
        {riskDetail}
      </section>
    );
  }

  const table = navSeries.period_table ?? [];
  const passive = navSeries.passive_label ?? "the index";
  const beta = navSeries.beta ?? null;
  const seriesStart = navSeries.series_start ?? null;
  const si = table.find((r) => r.period === "SI") ?? null;
  // Below paid, applyGates collapses the table to ONE proof-point row (3Y
  // preferred) keeping its fund/passive/diff; β-adj diff stays paid.
  const proofRow = !showComparison && table.length > 0 ? table[0] : null;
  const hover = buildNavHoverCopy({ beta, passiveLabel: navSeries.passive_label });

  const takeaway =
    showComparison && si != null && si.diff_bps != null && si.beta_adj_diff_bps != null ? (
      <>
        Since {seriesStart ?? "the paired window start"} the raw scoreboard favors{" "}
        {si.diff_bps < 0 ? "the index" : "the fund"} — excess{" "}
        <span className={si.diff_bps < 0 ? "text-rose-700" : "text-emerald-700"}>
          {bpsSigned(si.diff_bps)} bps/yr
        </span>{" "}
        vs {passive} — {beta != null && beta < 1 ? "but" : "and"} against a passive{" "}
        {passive} position with the <em>same</em> market risk
        {beta != null ? ` (β ${beta.toFixed(2)})` : ""}, alpha is{" "}
        <span className={si.beta_adj_diff_bps < 0 ? "text-rose-700" : "text-emerald-700"}>
          {bpsSigned(si.beta_adj_diff_bps)} bps/yr
        </span>
        .
        {beta != null && beta < 1 && (
          <span className="font-normal text-gray-500"> Raw excess understates the manager.</span>
        )}
      </>
    ) : proofRow != null && proofRow.fund_ann_pct != null ? (
      <>
        Over the {periodLabel(proofRow.period, seriesStart).toLowerCase()} window the
        fund returned <span className="text-gray-900">{pct(proofRow.fund_ann_pct)}/yr</span>{" "}
        after fees
        {proofRow.diff_bps != null && (
          <>
            {" "}
            —{" "}
            <span className={proofRow.diff_bps < 0 ? "text-rose-700" : "text-emerald-700"}>
              {bpsSigned(proofRow.diff_bps)} bps/yr
            </span>{" "}
            vs {passive}
          </>
        )}
        . The full period table — raw and at matched market risk — is a paid detail.
      </>
    ) : null;

  return (
    <section id="s3" className="scroll-mt-24">
      <ChapterHeader
        index={3}
        title="Historical performance"
        asOf={
          navSeries.as_of
            ? `monthly adjusted-NAV growth · through ${navSeries.as_of}${seriesStart ? ` · paired window from ${seriesStart}` : ""}`
            : undefined
        }
        takeaway={takeaway}
      />

      <Panel>
        <GrowthChart
          points={navSeries.points}
          passiveLabel={navSeries.passive_label}
          beta={beta}
          showComparison={showComparison}
        />
      </Panel>

      <Panel className="p-0">
        <PanelHead
          title="After-fee annualized returns"
          right={
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span>fund vs {passive}, raw and at matched market risk</span>
              <Link
                href="/methodology#nav-series"
                className="shrink-0 hover:text-[#1466b8] hover:underline"
              >
                How we calculate this →
              </Link>
            </div>
          }
        />
        {showComparison ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-right text-[10.5px] uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2.5 text-left font-semibold">Period</th>
                  <th className="px-4 py-2.5 font-semibold">Fund</th>
                  <th className="px-4 py-2.5 font-semibold">{passive}</th>
                  <th className="px-4 py-2.5 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      Excess
                      <InfoTip label="Excess">{hover.excess}</InfoTip>
                    </span>
                  </th>
                  <th className="px-4 py-2.5 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      Alpha
                      <InfoTip label="Alpha">{hover.alpha}</InfoTip>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {table.map((r) => (
                  <tr
                    key={r.period}
                    className={`border-b border-gray-50 text-right last:border-0 ${
                      r.period === "SI" ? "bg-gray-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-left text-gray-700">
                      {periodLabel(r.period, seriesStart)}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-gray-900">{pct(r.fund_ann_pct)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{pct(r.passive_ann_pct)}</td>
                    <td className={`px-4 py-2.5 font-bold ${(r.diff_bps ?? 0) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {bpsSigned(r.diff_bps)}
                    </td>
                    <td className={`px-4 py-2.5 font-bold ${(r.beta_adj_diff_bps ?? 0) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {bpsSigned(r.beta_adj_diff_bps)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-4">
            {proofRow != null && proofRow.fund_ann_pct != null ? (
              <ProofPoint
                label={`${periodLabel(proofRow.period, seriesStart)} · after fees`}
                value={
                  proofRow.diff_bps != null
                    ? `${bpsSigned(proofRow.diff_bps)} bps/yr vs ${passive}`
                    : `${pct(proofRow.fund_ann_pct)}/yr`
                }
                readout={`Fund ${pct(proofRow.fund_ann_pct)}/yr vs ${passive} ${pct(proofRow.passive_ann_pct)}/yr, both after fees, on one matched monthly window. The full period table — every window, plus alpha at matched market risk — is a paid detail.`}
                tone={proofRow.diff_bps != null && proofRow.diff_bps < 0 ? "negative" : undefined}
              />
            ) : null}
            <UnlockLine tier="paid">
              See the full period table: fund vs {passive}, raw and β-adjusted, with
              excess and alpha.
            </UnlockLine>
          </div>
        )}
        <PanelNote>
          Single coherent monthly basis for all columns (fund and {passive}, both
          after fees; the series pairs both legs from {seriesStart ?? "the first common month"},
          not the fund&apos;s inception). <b>Excess</b> = fund − {passive};{" "}
          <b>Alpha</b> = fund − a β-scaled {passive} position. Hover or tap the ⓘ on
          the column headers for plain-language definitions.
        </PanelNote>
      </Panel>

      {riskDetail}
    </section>
  );
}
