// ============================================================================
// 03 · HistoricalPerformance — server shell around the client GrowthChart plus
// the after-fee period table. A FIXTURE block (Sample chip, no methodology
// link). Gating: the fund growth line + the fund return column are public; the
// vs-passive columns + β-adjusted comparison are paid, with one free proof
// point (the fund's own since-inception return). Comparison legs are stripped
// server-side when !showComparison, so anon never receives them.
// ============================================================================
import type { NavSeries } from "@/lib/serving/profile-v2";
import { bpsSigned } from "./format";
import { ChapterHeader, Panel, PanelHead, PanelNote, SampleProvenance } from "./primitives";
import { InfoTip } from "./InfoTip";
import { Unavailable, ProofPoint, UnlockLine } from "../primitives";
import { GrowthChart } from "./GrowthChart";

const pct = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? "—" : `${v.toFixed(1)}%`;

export function HistoricalPerformance({
  navSeries,
  showComparison,
}: {
  navSeries: NavSeries | null;
  showComparison: boolean;
}) {
  if (!navSeries || !navSeries.points || navSeries.points.length === 0) {
    return (
      <section id="s3" className="scroll-mt-24">
        <ChapterHeader index={3} title="Historical performance" />
        <Unavailable>
          We don&apos;t have a validated monthly growth series for this fund yet,
          so the performance read is suppressed rather than shown partial.
        </Unavailable>
      </section>
    );
  }

  const table = navSeries.period_table ?? [];
  const passive = navSeries.passive_label ?? "the index";
  const beta = navSeries.beta ?? null;
  const si = table.find((r) => r.period === "SI") ?? null;
  const hover = navSeries.hover_copy;

  // Strip the gated comparison legs server-side for non-paid callers.
  const points = showComparison
    ? navSeries.points
    : navSeries.points.map((p) => ({ t: p.t, fund: p.fund, passive: null, beta_adj_passive: null }));

  const takeaway =
    showComparison && si != null && si.diff_bps != null && si.beta_adj_diff_bps != null ? (
      <>
        Since inception the raw scoreboard favors the index — excess{" "}
        <span className={si.diff_bps < 0 ? "text-rose-700" : "text-emerald-700"}>
          {bpsSigned(si.diff_bps)} bps/yr
        </span>{" "}
        vs {passive} — but the fund runs less market risk
        {beta != null ? ` (β ${beta.toFixed(2)})` : ""}: against a passive {passive}{" "}
        position with the <em>same</em> market risk, alpha is{" "}
        <span className={si.beta_adj_diff_bps < 0 ? "text-rose-700" : "text-emerald-700"}>
          {bpsSigned(si.beta_adj_diff_bps)} bps/yr
        </span>
        . <span className="font-normal text-gray-500">Raw excess understates the manager.</span>
      </>
    ) : si != null && si.fund_ann_pct != null ? (
      <>
        Since inception the fund has returned{" "}
        <span className="text-gray-900">{pct(si.fund_ann_pct)}/yr</span>. How that
        compares with {passive} — raw and at matched market risk — is a paid detail.
      </>
    ) : null;

  return (
    <section id="s3" className="scroll-mt-24">
      <ChapterHeader
        index={3}
        title="Historical performance"
        asOf={navSeries.as_of ? `monthly adjusted-NAV growth · as of ${navSeries.as_of}` : undefined}
        takeaway={takeaway}
        sample
      />

      <Panel>
        <GrowthChart
          points={points}
          passiveLabel={navSeries.passive_label}
          beta={beta}
          showComparison={showComparison}
        />
      </Panel>

      <Panel className="p-0">
        <PanelHead
          title="After-fee annualized returns"
          asOf={`fund vs ${passive}, raw and at matched market risk`}
        />
        {showComparison ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-right text-[10.5px] uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2.5 text-left font-semibold">Period</th>
                  <th className="px-4 py-2.5 font-semibold">Fund</th>
                  <th className="px-4 py-2.5 font-semibold">{passive}</th>
                  <th className="px-4 py-2.5 font-semibold">{passive} (β-adj)</th>
                  <th className="px-4 py-2.5 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      Excess
                      {hover?.excess && <InfoTip label="Excess">{hover.excess}</InfoTip>}
                    </span>
                  </th>
                  <th className="px-4 py-2.5 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      Alpha
                      {hover?.alpha && <InfoTip label="Alpha">{hover.alpha}</InfoTip>}
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
                      {r.period === "SI" ? "Since inception" : r.period}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-gray-900">{pct(r.fund_ann_pct)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{pct(r.passive_ann_pct)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{pct(r.beta_adj_passive_ann_pct)}</td>
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
            {si != null && si.fund_ann_pct != null ? (
              <ProofPoint
                label={`${navSeries.passive_label ?? "Fund"} · since-inception return`}
                value={`${pct(si.fund_ann_pct)}/yr`}
                readout={`The fund's own after-fee return since inception. The full period table — fund vs ${passive}, raw and at matched market risk, with excess and alpha — is a paid detail.`}
              />
            ) : null}
            <UnlockLine tier="paid">
              See the full period table: fund vs {passive}, raw and β-adjusted, with
              excess and alpha.
            </UnlockLine>
          </div>
        )}
        <PanelNote>
          Single coherent monthly basis for all columns (fund / {passive} /
          β-adjusted {passive}). <b>Excess</b> = fund − {passive}; <b>Alpha</b> =
          fund − a β-scaled {passive} position. Hover or tap the ⓘ on the column
          headers for plain-language definitions.
          <SampleProvenance label={navSeries.sample_label} />
        </PanelNote>
      </Panel>
    </section>
  );
}
