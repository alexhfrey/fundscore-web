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
import Link from "next/link";
import type {
  PositioningContext,
  RiskExplainers,
  TeDecomposition,
  PositioningBetBridges,
  Top10VsIwf,
  HoldingsFullTeaser,
  HoldingRow,
} from "@/lib/serving/profile-v2";
import type { TeProofPreview, TeRollupRow } from "@/lib/serving/profile";
import { fmtPct, fmtSignedBps, fmtNum, fmtDate, EM_DASH } from "@/lib/serving/format";
import { cohortIsBlend, cohortPhrase, ordinal, countryName, ppSigned } from "./format";
import {
  ChapterHeader,
  Panel,
  PanelHead,
  PanelNote,
  SampleChip,
  SampleProvenance,
} from "./primitives";
import { isSample } from "@/lib/serving/profile-v2";
import { InfoTip } from "./InfoTip";
import { Unavailable, LockedNotice, ProofPoint, UnlockLine } from "../primitives";
import { BetsTable, type BetRow } from "./BetsTable";
import { HoldingsFullDrawer } from "./HoldingsFullDrawer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XrayRow = Record<string, any>;

/** Map a served exposure-X-ray by factor_id (its `exposure_id`), keeping the
 *  vs-benchmark rows — the source of a bet's held / passive / active weights. */
function xrayByFactor(exposureXray: { rows?: unknown[] } | null): Map<string, XrayRow> {
  const m = new Map<string, XrayRow>();
  for (const r of (exposureXray?.rows ?? []) as XrayRow[]) {
    if (r?.holdings_baseline === "vs_benchmark" && typeof r?.exposure_id === "string") {
      m.set(r.exposure_id, r);
    }
  }
  return m;
}

/** Plain-language readout for the free top-bet proof point. Appends the bet's
 *  t-stat / confidence (when served) as a single parenthetical — em-dash never
 *  fabricated, so a missing stat simply drops from the sentence. */
function topBetReadout(bet: {
  label: string;
  beta_tstat: number | null;
  confidence_state: string | null;
}): string {
  const stats = [
    bet.beta_tstat != null ? `t ${fmtNum(bet.beta_tstat, 1)}` : null,
    bet.confidence_state ? `${bet.confidence_state} confidence` : null,
  ].filter(Boolean);
  const paren = stats.length > 0 ? ` (${stats.join(", ")})` : "";
  return `${bet.label} is the single largest contributor to the fund's benchmark-relative risk${paren}. The full bets table — every sector, theme and macro bet, held vs active, with each bet's tracking-error contribution — is a paid detail.`;
}

function buildBetRows(
  te: TeDecomposition | null,
  bridges: PositioningBetBridges | null,
  top10: Top10VsIwf | null,
  exposureXray: { rows?: unknown[] } | null,
): BetRow[] {
  const rows: BetRow[] = [];
  const xray = xrayByFactor(exposureXray);
  // Attributed factor bets (SERVED te_decomposition): carry a real TE contribution
  // + t-stat; held / active come from the matched Exposure X-Ray row where the
  // bet's factor_id equals the X-ray exposure_id (em-dash when no match — never
  // fabricated). Only variance SHARES are meaningful, so we show var_share + the
  // t-stat, not the double-counting per-bet beta level (see the panel's note).
  for (const b of te?.bets ?? []) {
    const x = b.factor_id ? xray.get(b.factor_id) : undefined;
    const held = typeof x?.fund_exposure === "number" ? x.fund_exposure * 100 : null;
    const passive = typeof x?.passive_exposure === "number" ? x.passive_exposure * 100 : null;
    const active = typeof x?.difference === "number" ? x.difference * 100 : null;
    const varPct =
      b.var_share != null ? `${Math.round(b.var_share * 100)}% of factor variance` : null;
    const sub = [
      varPct,
      b.beta_tstat != null ? `t ${fmtNum(b.beta_tstat, 1)}` : null,
      b.confidence_state ? `${b.confidence_state} confidence` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    rows.push({
      name: b.label,
      type: b.bet_type,
      heldPct: held,
      iwfPct: passive,
      activePp: active,
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
  teProof,
  teLocked = false,
  bridges,
  top10,
  holdingsFullTeaser,
  loadHoldingsFullRows,
  exposureXray,
  present,
  free,
  paid,
  passiveLabel,
  l2BlendEtfs,
}: {
  // SERVED positioning_context (gate: free) — passed only when entitled.
  positioning: PositioningContext | null;
  riskExplainers: RiskExplainers | null;
  // The FULL served bets table (paid only — the 12 bets never ship below paid).
  teDecomposition: TeDecomposition | null;
  // The free proof point (grouped sleeve rollup + the single top bet) surfaced
  // for free callers below the paid gate; null for paid (uses the full table).
  teProof: TeProofPreview | null;
  // True when a paid decomposition EXISTS for this fund but the caller is below
  // the gate — keeps the honest lock rendered even if the proof point is null.
  teLocked?: boolean;
  bridges: PositioningBetBridges | null;
  top10: Top10VsIwf | null;
  // The teaser (count + as-of) off the public holdings section — present iff the
  // fund has a served list, shown for ALL tiers (anon + free get the locked
  // affordance below). `loadHoldingsFullRows` is the paid, lazy row fetch (tier
  // bound server-side); null below paid so the teaser renders locked.
  holdingsFullTeaser: HoldingsFullTeaser | null;
  loadHoldingsFullRows: (() => Promise<HoldingRow[]>) | null;
  exposureXray: { rows?: unknown[] } | null;
  // `present` = a fixture exists for this fund (so the gated state reads
  // "locked"); the gated payloads below are only passed when entitled.
  present: boolean;
  free: boolean;
  paid: boolean;
  passiveLabel: string | null;
  // The fund's L2 blend constituent ETF names (public l2_blend_etfs) — drives
  // the blend-aware "Active vs" header + the baseline-composition chip so a
  // blend baseline is never presented as the lead ETF alone.
  l2BlendEtfs?: string[] | null;
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
        <ChapterHeader index={5} title="Current positioning" />
        <LockedNotice tier="free">
          See where this fund&apos;s market sensitivity and benchmark-relative risk
          sit versus its cohort, its active bets, and its holdings versus {pass}.
        </LockedNotice>
        {/* The full-holdings teaser (count + as-of, no rows) is public and shows
            for anon too — only the rows themselves stay paid-gated. Rendered only
            when the fund actually has a served list. */}
        {holdingsFullTeaser != null && (
          <Panel className="p-0">
            <PanelHead title="Holdings" />
            <HoldingsFullLocked
              nPositions={holdingsFullTeaser.n_positions}
              asOf={holdingsFullTeaser.as_of}
            />
          </Panel>
        )}
      </section>
    );
  }

  const beta = positioning?.beta ?? null;
  const teBps = positioning?.te_bps ?? null;
  const bPct = positioning?.beta_percentile ?? null;
  const tPct = positioning?.te_percentile ?? null;
  const nFunds = positioning?.cohort?.n_funds ?? null;
  // Shared page-wide cohort phrasing (same helper as the fee ruler): "funds
  // benchmarked to IWF" / blend / peer-group — the raw served label alone would
  // read "the 160 IWF". Blend cohorts weigh SEPARATE ranked populations, so the
  // single-count prefix ("the 20 …") is dropped for them — the per-constituent
  // sizes print inside the phrase instead.
  const cohortDesc = positioning?.cohort
    ? cohortPhrase(positioning.cohort)
    : `funds benchmarked to ${pass}`;
  const cohortWithCount =
    positioning?.cohort && cohortIsBlend(positioning.cohort)
      ? cohortDesc
      : nFunds != null
        ? `${nFunds} ${cohortDesc}`
        : cohortDesc;

  const takeaway =
    free && positioning ? (
      <>
        Beta <span className="tabular-nums">{beta != null ? beta.toFixed(2) : EM_DASH}</span> vs {pass}
        {bPct != null && nFunds != null && (
          <>
            {" "}
            — lower than <span className="tabular-nums">{Math.round(100 - bPct)}%</span> of
            the {cohortWithCount}
          </>
        )}
        . Tracking error{" "}
        <span className="tabular-nums">{teBps != null ? `${(teBps / 100).toFixed(1)}%/yr` : EM_DASH}</span>
        {tPct != null && (
          <>
            {" "}
            — higher than <span className="tabular-nums">{Math.round(tPct)}%</span> of that
            cohort
          </>
        )}
        .
      </>
    ) : (
      <>How this fund is positioned today — its market sensitivity, benchmark-relative risk, active bets and holdings vs {pass}.</>
    );

  // TE decomposition (SERVED, gated paid): paid holds the full object; free holds
  // the proof point (rollup + top bet). Read shared scalars from whichever is set.
  const betRows = buildBetRows(teDecomposition, bridges, top10, exposureXray);
  const teRollup: TeRollupRow[] = teDecomposition?.rollup ?? teProof?.rollup ?? [];
  const topBet = teProof?.top_bet ?? null; // free-tier proof point only
  const teTotalBps = teDecomposition?.te_total_bps ?? teProof?.te_total_bps ?? null;
  const teIdioShare = teDecomposition?.idio_risk_share ?? teProof?.idio_risk_share ?? null;
  const teBasisNote = teDecomposition?.basis_note ?? teProof?.basis_note ?? null;
  const teAsOf = teDecomposition?.as_of ?? teProof?.as_of ?? null;
  const teWindowEnd = teDecomposition?.window_end ?? teProof?.window_end ?? null;
  const tePassive = teDecomposition?.passive_alt_label ?? teProof?.passive_alt_label ?? pass;
  const teAvailable = teDecomposition != null || teProof != null || teLocked;

  // Blend-aware baseline: when the passive alternative is an L2 BLEND, the
  // bets table's held/active differences are vs the blend, not the lead ETF —
  // the header must not name the lead alone. Weights print only when the
  // positioning cohort covers the FULL blend (qualifying_weight === 1, so its
  // renormalized weights ARE the blend weights); otherwise names only — never
  // fabricated weights.
  const isBlendBaseline = (l2BlendEtfs?.length ?? 0) > 1;
  const cohortCoversBlend =
    positioning?.cohort?.kind === "same_passive_alt" &&
    positioning.cohort.is_blend === true &&
    positioning.cohort.qualifying_weight === 1 &&
    (positioning.cohort.constituents?.length ?? 0) === (l2BlendEtfs?.length ?? 0);
  const blendComposition = isBlendBaseline
    ? cohortCoversBlend && positioning?.cohort?.constituents
      ? positioning.cohort.constituents
          .map((c) => `${c.etf} ${Math.round((c.weight ?? 0) * 100)}%`)
          .join(" + ")
      : l2BlendEtfs!.join(" + ")
    : null;

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
      />
      {/* No section-level Sample badge: the gauges + bets table are SERVED
          (positioning_context / te_decomposition). Only the top-10 sub-block
          below is still fixture-backed and carries its own sample marker —
          a section badge would mislabel served data as sample (DQ-critic P2). */}

      {/* Gauges — SERVED positioning_context, free (this branch only runs for
          free+ callers). Percentiles are the page-wide strictly-below
          convention; displayed values are rounded (the raw served precision —
          "98.125%" — over-implies exactness). */}
      {positioning != null && (
        <>
          <div className="mt-4 flex items-baseline justify-end gap-3 text-[11px] text-gray-400">
            {positioning.as_of && <span>cohort percentiles as of {fmtDate(positioning.as_of)}</span>}
            <Link
              href="/methodology#positioning-context"
              className="shrink-0 hover:text-[#1466b8] hover:underline"
            >
              How we calculate this →
            </Link>
          </div>
          <div className="mt-1.5 grid gap-4 sm:grid-cols-2">
            <Gauge
              label={`Beta vs ${pass}`}
              tip={riskExplainers?.beta}
              value={beta != null ? beta.toFixed(2) : EM_DASH}
              basis={null}
              percentile={bPct}
              readout={
                bPct != null && nFunds != null
                  ? `${ordinal(bPct)} percentile of the ${cohortWithCount} — lower market sensitivity than ${Math.round(100 - bPct)}% of that cohort.`
                  : null
              }
            />
            <Gauge
              label={`Tracking error vs ${pass}`}
              tip={riskExplainers?.tracking_error}
              value={teBps != null ? `${(teBps / 100).toFixed(1)}%` : EM_DASH}
              basis="weekly, β-adjusted, 3Y"
              percentile={tPct}
              readout={
                tPct != null && nFunds != null
                  ? `${ordinal(tPct)} percentile — takes more benchmark-relative risk than ${Math.round(tPct)}% of the ${cohortWithCount}.`
                  : null
              }
            />
          </div>
        </>
      )}

      {/* Bets table (SERVED te_decomposition) — full table paid, grouped rollup
          + top bet free. Rendered only when the fund has a served decomposition. */}
      {teAvailable && (
        <Panel className="p-0">
          <PanelHead
            title="The bets, in one table"
            right={
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                {/* Split freshness stamp: the build date alone overstates
                    freshness — the returns window ends earlier. */}
                {teWindowEnd != null && teAsOf != null ? (
                  <span>
                    returns through {fmtDate(teWindowEnd)} · built {fmtDate(teAsOf)}
                  </span>
                ) : (
                  teAsOf && <span>built {fmtDate(teAsOf)}</span>
                )}
                <Link
                  href="/methodology#te-decomposition"
                  className="shrink-0 text-gray-400 hover:text-[#1466b8] hover:underline"
                >
                  How we calculate this →
                </Link>
              </div>
            }
          />

          {/* Baseline-composition chip — a blend baseline is never presented as
              the lead ETF alone (weights only when truly known). */}
          {blendComposition && (
            <div className="px-5 pb-1 pt-0.5 text-[11.5px] leading-relaxed text-gray-500">
              <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-medium">
                Baseline = L2 blend: {blendComposition}
              </span>{" "}
              &ldquo;Active&rdquo; weights compare against this weighted blend, not{" "}
              {tePassive} alone.
            </div>
          )}

          {/* Grouped sleeve rollup — the free proof-point headline (all free+ tiers). */}
          <TeRollupHeadline rollup={teRollup} totalBps={teTotalBps} />

          {paid && teDecomposition ? (
            <BetsTable
              rows={betRows}
              passiveLabel={tePassive}
              baselineLabel={isBlendBaseline ? "blend" : tePassive}
            />
          ) : (
            <div className="border-t border-gray-100 px-5 py-4">
              {topBet && (
                <ProofPoint
                  label="Top active bet by tracking-error contribution"
                  value={`${topBet.label} ${fmtSignedBps(topBet.te_alloc_bps)}`}
                  readout={topBetReadout(topBet)}
                />
              )}
              <UnlockLine tier="paid">
                See every bet, its held-vs-active weight and its tracking-error
                contribution.
              </UnlockLine>
            </div>
          )}

          <PanelNote tone="warn">
            <b>Read shares, not levels.</b>{" "}
            {teBasisNote ??
              "Per-bet betas are single-factor reads that double-count on overlapping bets — only the sleeve-scaled variance shares are meaningful."}{" "}
            {teTotalBps != null && (
              <>
                Total tracking error <b>{Math.round(teTotalBps)} bps/yr</b> vs {tePassive}:
                {teIdioShare != null
                  ? ` roughly ${Math.round(teIdioShare * 100)}% stock-specific`
                  : " part stock-specific"}
                , the rest factor / theme / macro tilts (the sleeves combine as
                variance, not by adding). A negative contribution is{" "}
                <b>diversifying</b> — the bet moves against the rest of the book and
                reduces tracking error.
              </>
            )}
          </PanelNote>
        </Panel>
      )}

      {/* Holdings block — free (this branch only runs for free+ callers) */}
      {(top10 != null || holdingsFullTeaser != null || regions.length > 0) && (
        <Panel className="p-0">
          <PanelHead
            title="Holdings"
            right={
              <div className="flex items-center gap-2">
                {/* The top-10 comparison is the one remaining fixture in this
                    section — sample-marked at the SUB-BLOCK, not the section. */}
                {top10 != null && isSample(top10) && <SampleChip>Top-10 sample</SampleChip>}
                {top10?.as_of && (
                  <span className="text-[11px] text-gray-400">N-PORT · as of {top10.as_of}</span>
                )}
              </div>
            }
          />
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
          {holdingsFullTeaser != null &&
            (loadHoldingsFullRows != null ? (
              <HoldingsFullDrawer
                nPositions={holdingsFullTeaser.n_positions}
                asOf={holdingsFullTeaser.as_of}
                loadRows={loadHoldingsFullRows}
              />
            ) : (
              <HoldingsFullLocked
                nPositions={holdingsFullTeaser.n_positions}
                asOf={holdingsFullTeaser.as_of}
              />
            ))}
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

// --- grouped sleeve rollup: the free proof-point headline that leads the bets --
// Factor tilts vs stock selection (+ macro), each with its TE contribution and
// share of tracking-error variance. Negative contributions render as-is (a
// diversifying sleeve) — never clamped. Sorted by contribution, descending.
function rollupLabel(betType: string): string {
  switch (betType) {
    case "selection":
      return "Stock selection";
    case "sector":
      return "Sector tilts";
    case "theme":
      return "Theme tilts";
    case "macro":
      return "Macro tilts";
    default:
      return betType;
  }
}

function TeRollupHeadline({
  rollup,
  totalBps,
}: {
  rollup: TeRollupRow[];
  totalBps: number | null;
}) {
  if (rollup.length === 0) return null;
  const rows = [...rollup].sort(
    (a, b) => (b.te_alloc_bps ?? -Infinity) - (a.te_alloc_bps ?? -Infinity),
  );
  return (
    <div className="px-5 pb-3 pt-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Where the tracking error comes from
        {totalBps != null && (
          <span className="ml-2 font-normal normal-case tracking-normal text-gray-400">
            {Math.round(totalBps)} bps/yr total
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.bet_type}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13.5px]"
          >
            <span className="min-w-[7.5rem] font-semibold text-gray-900">
              {rollupLabel(r.bet_type)}
            </span>
            <span
              className={`tabular-nums font-bold ${
                (r.te_alloc_bps ?? 0) < 0 ? "text-emerald-700" : "text-gray-900"
              }`}
            >
              {fmtSignedBps(r.te_alloc_bps)}
            </span>
            <span className="text-[12.5px] text-gray-500">
              {r.share_of_te_var != null
                ? `${Math.round(r.share_of_te_var * 100)}% of TE variance`
                : EM_DASH}
              {r.n_bets != null ? ` · ${r.n_bets} ${r.n_bets === 1 ? "bet" : "bets"}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- free/anon locked teaser: count + as-of only, never the rows themselves --
// Rendered only when a served list exists (never teases rows that don't exist).
function HoldingsFullLocked({
  nPositions,
  asOf,
}: {
  nPositions: number;
  asOf: string | null;
}) {
  return (
    <div className="mx-5 my-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-500">
        View all {nPositions} holdings
        <span className="ml-auto text-[11px] font-normal text-gray-400">
          N-PORT{asOf ? ` · as of ${fmtDate(asOf)}` : ""}
        </span>
      </div>
      <div className="px-4 pb-3">
        <UnlockLine tier="paid">
          See every filed position — name, weight, value, country, sector and type.
        </UnlockLine>
      </div>
    </div>
  );
}

// --- a single percentile gauge card ----------------------------------------
function Gauge({
  label,
  tip,
  value,
  basis,
  percentile,
  readout,
}: {
  label: string;
  tip?: string | null;
  value: string;
  // Short basis line beside the value (e.g. "weekly, β-adjusted, 3Y") — the
  // served payload carries no cohort medians, so nothing else prints here.
  basis: string | null;
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
        {basis && <span className="text-[12px] text-gray-400">{basis}</span>}
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
