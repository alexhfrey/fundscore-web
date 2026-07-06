// ============================================================================
// 05 · CurrentPositioning — the mock's consolidated design (server component):
//   • two gauges (beta + TE) with cohort percentiles + ⓘ plain-language
//     explainers — gated FREE.
//   • ONE bets table (attributed te_decomposition + bridges + top10 stocks) —
//     gated PAID, with the top bet shown free.
//   • holdings block (top-10 vs IWF + View-all-280 + a concentration line) and
//     one geography line from the REAL served exposure X-Ray — gated FREE.
// Gated data is only rendered / passed to client islands when the caller is
// entitled, so anon never receives it.
// ============================================================================
import type {
  PositioningContext,
  RiskExplainers,
  TeDecomposition,
  PositioningBetBridges,
  Top10VsIwf,
  HoldingsFull,
} from "@/lib/serving/profile-v2";
import { fmtPct, fmtSignedBps, EM_DASH } from "@/lib/serving/format";
import { ordinal, countryName, ppSigned } from "./format";
import {
  ChapterHeader,
  Panel,
  PanelHead,
  PanelNote,
  SampleProvenance,
  GapChip,
} from "./primitives";
import { InfoTip } from "./InfoTip";
import { Unavailable, LockedNotice, ProofPoint, UnlockLine } from "../primitives";
import { BetsTable, type BetRow } from "./BetsTable";
import { HoldingsFullDrawer } from "./HoldingsFullDrawer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XrayRow = Record<string, any>;

function buildBetRows(
  te: TeDecomposition | null,
  bridges: PositioningBetBridges | null,
  top10: Top10VsIwf | null,
): BetRow[] {
  const rows: BetRow[] = [];
  // Attributed bets (carry a TE contribution + basis β; no held/active in the fixture).
  for (const b of te?.bets ?? []) {
    const varPct = b.var_share != null ? `${Math.round(b.var_share * 100)}% of active variance` : null;
    const sub = [
      b.beta != null ? `basis β ${b.beta >= 0 ? "+" : "−"}${Math.abs(b.beta).toFixed(2)}` : null,
      varPct,
      b.confidence_state ? `${b.confidence_state} confidence` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    rows.push({
      name: b.label,
      type: b.bet_type,
      heldPct: null,
      iwfPct: null,
      activePp: null,
      teBps: b.te_alloc_bps,
      diversifying: b.diversifying === true,
      bridge: "own row in attribution",
      sub: sub || null,
    });
  }
  // Stock bets (carry held / active from the same-date snapshot; not TE-attributed).
  for (const r of top10?.rows ?? []) {
    rows.push({
      name: r.ticker,
      type: "stock",
      heldPct: r.fund_pct,
      iwfPct: r.iwf_pct,
      activePp: r.diff_pp,
      teBps: null,
      diversifying: false,
      bridge: r.note ?? "in attribution member rows",
      sub: null,
    });
  }
  // Bridge rows (non-attributed today — fold into an overlapping factor / selection).
  for (const b of bridges?.bridges ?? []) {
    rows.push({
      name: b.bet,
      type: null,
      heldPct: null,
      iwfPct: null,
      activePp: null,
      teBps: null,
      diversifying: false,
      bridge: b.bridge,
      sub: null,
    });
  }
  return rows;
}

function conc(rows: XrayRow[], id: string): number | null {
  const r = rows.find(
    (x) => x.exposure_id === id && x.holdings_baseline === "absolute" && x.exposure_type === "concentration",
  );
  return typeof r?.fund_exposure === "number" ? r.fund_exposure : null;
}

export function CurrentPositioning({
  positioning,
  riskExplainers,
  teDecomposition,
  bridges,
  top10,
  holdingsFull,
  exposureXray,
  present,
  free,
  paid,
  passiveLabel,
}: {
  positioning: PositioningContext | null;
  riskExplainers: RiskExplainers | null;
  teDecomposition: TeDecomposition | null;
  bridges: PositioningBetBridges | null;
  top10: Top10VsIwf | null;
  holdingsFull: HoldingsFull | null;
  exposureXray: { rows?: unknown[] } | null;
  // `present` = a fixture exists for this fund (so the gated state reads
  // "locked"); the gated payloads below are only passed when entitled.
  present: boolean;
  free: boolean;
  paid: boolean;
  passiveLabel: string | null;
}) {
  const pass = passiveLabel ?? "IWF";

  if (!present) {
    return (
      <section id="s5" className="scroll-mt-24">
        <ChapterHeader index={5} title="Current positioning" />
        <Unavailable>
          The cohort context, bet decomposition and holdings comparison aren&apos;t
          served for this fund yet.
        </Unavailable>
      </section>
    );
  }

  // Positioning (gauges, top bet, holdings) is free-gated — anon sees a single
  // locked affordance and NO gated fixture numbers.
  if (!free) {
    return (
      <section id="s5" className="scroll-mt-24">
        <ChapterHeader index={5} title="Current positioning" sample />
        <LockedNotice tier="free">
          See where this fund&apos;s market sensitivity and benchmark-relative risk
          sit versus its cohort, its active bets, and its holdings versus {pass}.
        </LockedNotice>
      </section>
    );
  }

  const beta = positioning?.beta ?? null;
  const teBps = positioning?.te_bps ?? null;
  const bPct = positioning?.beta_percentile ?? null;
  const tPct = positioning?.te_percentile ?? null;
  const nFunds = positioning?.cohort?.n_funds ?? null;
  const cohortLabel = positioning?.cohort?.label ?? `funds benchmarked to ${pass}`;

  const takeaway =
    free && positioning ? (
      <>
        Beta <span className="tabular-nums">{beta?.toFixed(2)}</span> vs {pass} — lower
        than <span className="tabular-nums">{bPct != null ? 100 - bPct : EM_DASH}%</span>{" "}
        of the {nFunds} {cohortLabel}. Tracking error{" "}
        <span className="tabular-nums">{teBps != null ? `${(teBps / 100).toFixed(1)}%/yr` : EM_DASH}</span>{" "}
        — higher than <span className="tabular-nums">{tPct ?? EM_DASH}%</span> of that
        cohort.
      </>
    ) : (
      <>How this fund is positioned today — its market sensitivity, benchmark-relative risk, active bets and holdings vs {pass}.</>
    );

  const betRows = buildBetRows(teDecomposition, bridges, top10);
  const topBet = teDecomposition?.bets?.[0] ?? null;

  const xrows = (exposureXray?.rows ?? []) as XrayRow[];
  const activeShare = conc(xrows, "concentration::active_share");
  const top10Weight = conc(xrows, "concentration::top10_weight");
  const effPos = conc(xrows, "concentration::effective_positions");
  const regions = xrows
    .filter((r) => r.exposure_type === "country_region" && typeof r.fund_exposure === "number")
    .sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0))
    .slice(0, 7);

  return (
    <section id="s5" className="scroll-mt-24">
      <ChapterHeader
        index={5}
        title="Current positioning"
        asOf={
          positioning?.as_of
            ? `cohort context as of ${positioning.as_of}${top10?.as_of ? ` · holdings as of ${top10.as_of}` : ""}`
            : undefined
        }
        takeaway={takeaway}
        sample
      />

      {/* Gauges — free (this branch only runs for free+ callers) */}
      {positioning != null && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Gauge
            label={`Beta vs ${pass}`}
            tip={riskExplainers?.beta}
            value={beta != null ? beta.toFixed(2) : EM_DASH}
            median={positioning?.beta_cohort_median != null ? `cohort median ${positioning.beta_cohort_median.toFixed(2)}` : null}
            percentile={bPct}
            readout={
              bPct != null && nFunds != null
                ? `${ordinal(bPct)} percentile of the ${nFunds} ${cohortLabel} — lower market sensitivity than ${100 - bPct}% of that cohort.`
                : null
            }
          />
          <Gauge
            label={`Tracking error vs ${pass}`}
            tip={riskExplainers?.tracking_error}
            value={teBps != null ? `${(teBps / 100).toFixed(1)}%` : EM_DASH}
            median={
              positioning?.te_cohort_median_bps != null
                ? `weekly, β-adj, 3Y · cohort median ${(positioning.te_cohort_median_bps / 100).toFixed(1)}%`
                : null
            }
            percentile={tPct}
            readout={
              tPct != null && nFunds != null
                ? `${ordinal(tPct)} percentile — takes more benchmark-relative risk than ${tPct}% of the ${nFunds} ${cohortLabel}.`
                : null
            }
          />
        </div>
      )}

      {/* Bets table — paid, top bet free */}
      <Panel className="p-0">
        <PanelHead
          title="The bets, in one table"
          asOf={top10?.as_of ? `held / active per holdings snapshot · as of ${top10.as_of} · TE contribution per bet*` : undefined}
        />
        {paid ? (
          <BetsTable rows={betRows} />
        ) : (
          <div className="px-5 py-4">
            {topBet && (
              <ProofPoint
                label="Top active bet by tracking-error contribution"
                value={`${topBet.label} ${fmtSignedBps(topBet.te_alloc_bps)}`}
                readout={`${topBet.label} is the single largest contributor to the fund's benchmark-relative risk. The full bets table — every sector, theme, macro and stock bet, held vs active, with each bet's TE contribution — is a paid detail.`}
              />
            )}
            <UnlockLine tier="paid">
              See every bet, its held-vs-active weight and its tracking-error
              contribution.
            </UnlockLine>
          </div>
        )}
        <PanelNote tone="warn">
          <b>* TE contribution — estimate, method in development:</b>{" "}
          {teDecomposition?.basis_label ??
            "measured against broad market and style factors rather than the named passive alternative; magnitudes and ordering may shift when the shipped feature decomposes tracking error vs the passive alternative."}{" "}
          {teDecomposition?.total_te_bps != null && (
            <>
              Total tracking error <b>{teDecomposition.total_te_bps} bps/yr</b>: roughly
              {teDecomposition.idio_risk_share != null
                ? ` ${Math.round(teDecomposition.idio_risk_share * 100)}% stock-specific`
                : " half stock-specific"}
              , the rest factor/theme tilts (sleeves combine as variance). A negative TE
              contribution is <b>diversifying</b> — the bet moves against the rest of the
              book and reduces tracking error.
            </>
          )}
          {teDecomposition && <GapChip>{teDecomposition.sample_label ?? "prototype method"}</GapChip>}
        </PanelNote>
      </Panel>

      {/* Holdings block — free (this branch only runs for free+ callers) */}
      {(top10 != null || holdingsFull != null || regions.length > 0) && (
        <Panel className="p-0">
          <PanelHead title="Holdings" asOf={top10?.as_of ? `N-PORT · as of ${top10.as_of}` : undefined} />
          {top10?.rows && top10.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-gray-200 text-right text-[10.5px] uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-2.5 text-left font-semibold">Holding</th>
                    <th className="px-5 py-2.5 font-semibold">% of fund</th>
                    <th className="px-5 py-2.5 font-semibold">{pass} %</th>
                    <th className="px-5 py-2.5 font-semibold">Diff</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {top10.rows.map((r) => (
                    <tr key={r.ticker} className="border-b border-gray-50 text-right last:border-0">
                      <td className="px-5 py-2 text-left font-bold text-gray-900">
                        {r.ticker}
                        {r.note && (
                          <span className="block text-[10.5px] font-normal text-gray-400">{r.note}</span>
                        )}
                      </td>
                      <td className="px-5 py-2 text-gray-900">{r.fund_pct != null ? `${r.fund_pct.toFixed(2)}%` : EM_DASH}</td>
                      <td className="px-5 py-2 text-gray-500">{r.iwf_pct != null ? `${r.iwf_pct.toFixed(2)}%` : EM_DASH}</td>
                      <td className={`px-5 py-2 font-bold ${(r.diff_pp ?? 0) >= 0 ? "text-gray-900" : "text-amber-700"}`}>
                        {ppSigned(r.diff_pp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-4">
              <Unavailable>A top-holdings comparison isn&apos;t served for this fund yet.</Unavailable>
            </div>
          )}
          {holdingsFull?.rows && holdingsFull.rows.length > 0 && (
            <HoldingsFullDrawer
              rows={holdingsFull.rows}
              nPositions={holdingsFull.n_positions}
              basis={holdingsFull.basis}
            />
          )}
          {top10?.basis_note && (
            <PanelNote>{top10.basis_note}</PanelNote>
          )}
          {(activeShare != null || top10Weight != null || effPos != null) && (
            <PanelNote>
              <b>Concentration:</b>{" "}
              {activeShare != null ? `active share ${fmtPct(activeShare, 1)}` : EM_DASH} ·{" "}
              {top10Weight != null ? `top-10 ${fmtPct(top10Weight, 1)} of fund` : EM_DASH} ·{" "}
              {effPos != null ? `~${Math.round(effPos)} effective positions` : EM_DASH}{" "}
              <span className="text-gray-400">(from the served Exposure X-Ray).</span>
            </PanelNote>
          )}
          {regions.length > 0 && (
            <PanelNote>
              <b>Geography — top country tilts vs {pass}:</b>{" "}
              {regions.map((r, i) => (
                <span key={r.exposure_id ?? i}>
                  {i > 0 ? " · " : ""}
                  {countryName(r.exposure_name)} {fmtPct(r.fund_exposure, 1)} held (
                  {ppSigned((r.difference ?? 0) * 100)})
                </span>
              ))}
            </PanelNote>
          )}
          <SampleProvenance label={top10?.sample_label} />
        </Panel>
      )}
    </section>
  );
}

// --- a single percentile gauge card ----------------------------------------
function Gauge({
  label,
  tip,
  value,
  median,
  percentile,
  readout,
}: {
  label: string;
  tip?: string | null;
  value: string;
  median: string | null;
  percentile: number | null;
  readout: string | null;
}) {
  const pos = percentile != null ? Math.max(0, Math.min(100, percentile)) : null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-gray-900">{value}</span>
        {median && <span className="text-[12px] text-gray-400">{median}</span>}
      </div>
      <div className="relative mt-4 h-2 rounded-full bg-gray-200">
        <span className="absolute -top-1 h-4 w-px bg-gray-400" style={{ left: "50%" }} />
        {pos != null && (
          <span
            className="absolute -top-1.5 h-5 w-3 -translate-x-1/2 rounded bg-gray-900"
            style={{ left: `${pos}%` }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <span>0th</span>
        <span>cohort median</span>
        <span>100th</span>
      </div>
      {readout && <p className="mt-2.5 text-[12.5px] leading-relaxed text-gray-600">{readout}</p>}
    </div>
  );
}
