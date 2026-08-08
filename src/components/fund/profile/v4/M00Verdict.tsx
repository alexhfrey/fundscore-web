// ============================================================================
// Movement 00 · #exec — the verdict.
// ----------------------------------------------------------------------------
// Canon (mockup movement 00): a claim <h2>, a two-figure money hero, a five-row
// ledger, a conclusion + past-tense badge. NOT a 0-100 hero — the Value Score is
// demoted to a catalog chip in the ID row (rendered by the page, not here).
//
// Every figure is served. The two hero figures come from DIFFERENT served
// panels and are labelled accordingly:
//   cost      = fees.fair_fee.active_fee_over_passive_bps   (current, a rate)
//   delivered = nav_series.period_table[SI].beta_adj_diff_bps (realized, a window)
// ============================================================================

import type { ReactNode } from "react";
import { CrescentMark } from "@/components/fund/profile/v2/crescent/CrescentMark";
import {
  Absent,
  BasisChip,
  Caption,
  Card,
  Chip,
  LockedNote,
  MethodLink,
  Movement,
  VerdictBadge,
} from "./chrome";
import {
  buildActiveMix,
  buildConcentration,
  buildCost,
  buildDelivered,
  buildTwin,
  dollarsPer10k,
  fmtBpsAsPct,
  fmtDollarsMagnitude,
  comparatorDiffersFromTwin,
  fmtDollarsSigned,
  kindAdjective,
  leadingBets,
  listPhrase,
  longMonth,
  ownShare,
  type ActiveMixView,
  type CostView,
  type DeliveredView,
  type TwinView,
} from "./derive";

/** Last-resort reason. `Absent` must NEVER render an empty explanation — a bare
 *  "not shown." teaches the reader nothing and reads like a bug. */
const FALLBACK_REASON =
  "The served data this needs is not available for this fund, so we withhold it rather than estimate it.";

// ---------------------------------------------------------------------------
// Row scaffold (the mockup's .exrow: key | value | figure)
// ---------------------------------------------------------------------------

function ExRow({
  label,
  children,
  figure,
  alignTop = false,
}: {
  label: string;
  children: ReactNode;
  figure?: ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 border-b border-gray-100 py-4 last:border-b-0 sm:grid-cols-[150px_1fr_190px] ${
        alignTop ? "items-start" : "items-center"
      }`}
    >
      <div className="font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.1em] text-gray-400">
        {label}
      </div>
      <div className="font-serif text-[16.5px] leading-relaxed text-gray-900">{children}</div>
      {figure != null ? <div className="justify-self-start sm:justify-self-center">{figure}</div> : <div />}
    </div>
  );
}

function FigCap({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-center font-mono text-[9.5px] leading-relaxed text-gray-400">
      {children}
    </p>
  );
}

/** Sub-line under an exrow value. */
function Sub({ children }: { children: ReactNode }) {
  return <span className="mt-1 block font-sans text-xs text-gray-500">{children}</span>;
}

/**
 * The fee bars: the fund's fee, the twin's fee, and the gap between them —
 * drawn to scale from the two served figures. Nothing is drawn when either is
 * missing (an unscaled bar would imply a magnitude we do not have).
 */
function FeeBars({ netErBps, twinFeeBps }: { netErBps: number | null; twinFeeBps: number | null }) {
  if (netErBps == null || twinFeeBps == null || netErBps <= 0) return null;
  const W = 190;
  const x0 = 34;
  const full = 106;
  const twinW = full * Math.min(1, twinFeeBps / netErBps);
  return (
    <svg width={W} height={64} viewBox={`0 0 ${W} 64`} role="img" aria-label="Fund fee versus twin fee">
      <rect x={x0} y={8} width={full} height={13} rx={3} className="fill-gray-400" />
      <rect x={x0} y={30} width={twinW} height={13} rx={3} className="fill-gray-300" />
      <text x={x0 - 6} y={18} textAnchor="end" fontSize={9} className="fill-gray-500 font-mono">
        fund
      </text>
      <text x={x0 - 6} y={40} textAnchor="end" fontSize={9} className="fill-gray-500 font-mono">
        twin
      </text>
      <text x={x0 + full + 4} y={18} fontSize={9} className="fill-gray-700 font-mono">
        {fmtBpsAsPct(netErBps)}
      </text>
      <text x={x0 + twinW + 4} y={40} fontSize={9} className="fill-gray-700 font-mono">
        {fmtBpsAsPct(twinFeeBps)}
      </text>
      <line x1={x0 + twinW} x2={x0 + full} y1={52} y2={52} strokeWidth={1} className="stroke-amber-700" />
      <line x1={x0 + twinW} x2={x0 + twinW} y1={49} y2={55} strokeWidth={1} className="stroke-amber-700" />
      <line x1={x0 + full} x2={x0 + full} y1={49} y2={55} strokeWidth={1} className="stroke-amber-700" />
      <text
        x={(x0 + twinW + x0 + full) / 2}
        y={63}
        textAnchor="middle"
        fontSize={8.5}
        className="fill-amber-700 font-mono"
      >
        the gap · {fmtBpsAsPct(netErBps - twinFeeBps)}/yr
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Copy builders — every sentence is assembled from served figures, and each one
// declines to render rather than filling a hole.
// ---------------------------------------------------------------------------

function claimHeadline(
  fundName: string,
  cost: CostView,
  delivered: DeliveredView,
): ReactNode | null {
  const costD = dollarsPer10k(cost.overPassiveBps);
  const delD = delivered.paired ? dollarsPer10k(delivered.paired.betaAdjBps) : null;

  const costClause =
    costD != null ? (
      <>
        {fundName} charges <b>{fmtDollarsMagnitude(costD)}</b> a year{" "}
        {costD >= 0 ? "more" : "less"} than its twin
      </>
    ) : null;

  const delClause =
    delD != null ? (
      <>
        has returned <b>{fmtDollarsMagnitude(delD)}</b> a year {delD < 0 ? "less" : "more"}
      </>
    ) : null;

  if (costClause && delClause) {
    return (
      <>
        On every $10,000 you hold, {costClause} — and {delClause}.
      </>
    );
  }
  if (costClause) return <>On every $10,000 you hold, {costClause}.</>;
  if (delClause) return <>Against its twin, on every $10,000 you hold, {fundName} {delClause}.</>;
  return null;
}

function badgeFor(breakevenState: string | null): { text: string; tone: "cleared" | "not_cleared" | "even" } | null {
  switch (breakevenState) {
    case "below":
      return { text: "Has not cleared its fee", tone: "not_cleared" };
    case "above":
      return { text: "Has cleared its fee", tone: "cleared" };
    case "near":
      return { text: "Has roughly broken even on its fee", tone: "even" };
    default:
      return null;
  }
}

/** The positioning sentence — behaviour basis, and superlative-safe. */
/** True when the fund has at least one non-selection sleeve to talk about. */
function hasTilts(mix: ActiveMixView): boolean {
  return mix.slices.some((s) => s.kind !== "selection");
}

function positioningCopy(mix: ActiveMixView, own: number | null): ReactNode | null {
  if (mix.slices.length === 0) return null;
  const { bets, superlativeAllowed } = leadingBets(mix, 3);
  const sel = mix.selectionShare;
  const nonSelection = mix.slices.filter((s) => s.kind !== "selection");

  const tiltPhrase = listPhrase(nonSelection.map((s) => kindAdjective(s.kind)));

  const head =
    own != null && sel != null ? (
      <>
        Today the {(own * 100).toFixed(1)}% that is the manager&rsquo;s own is{" "}
        {/* No "the rest is …" when there is no rest: a fund whose active risk is
            entirely stock selection has no factor sleeves to name, and saying
            "100% their own stock picks; the rest is …" contradicts itself. */}
        {nonSelection.length > 0 && tiltPhrase ? (
          <>
            <b>{Math.round(sel * 100)}% their own stock picks</b>; the rest is {tiltPhrase} tilts.
          </>
        ) : (
          <>
            <b>all their own stock picks</b> — it takes no named factor tilts against its twin.
          </>
        )}
      </>
    ) : sel != null ? (
      <>
        Of everything that moves this fund differently from its twin,{" "}
        <b>{Math.round(sel * 100)}%</b> is the manager&rsquo;s own stock picks.
      </>
    ) : null;

  if (bets.length === 0) return head;

  // Superlative discipline: when `top_bet_confident` is false the #1-vs-#2 gap
  // is inside the noise, so no single bet may be called the biggest — and the
  // copy says so out loud rather than just going quiet.
  const names = bets.map((b) => b.label);
  const tail = superlativeAllowed ? (
    <>
      {" "}
      Its largest single difference from the twin is <b>{names[0]}</b>
      {bets[0].direction != null ? (
        <> — it {bets[0].direction === "over" ? "leans toward" : "leans away from"} it.</>
      ) : (
        "."
      )}
    </>
  ) : names.length > 1 ? (
    <>
      {" "}
      Among its larger differences from the twin are <b>{listPhrase(names)}</b> — close enough in
      size that none of them stands out as the biggest.
    </>
  ) : (
    <>
      {" "}
      <b>{names[0]}</b> is among its larger differences from the twin, though several bets are
      close enough in size that none stands out as the biggest.
    </>
  );

  return (
    <>
      {head}
      {tail}
    </>
  );
}

// ---------------------------------------------------------------------------

export interface M00Props {
  fundName: string;
  ticker: string;
  passiveBaseline: TwinView extends never ? never : Parameters<typeof buildTwin>[0];
  valueScore: {
    breakeven_state?: string | null;
    replica_r2?: number | null;
    beta?: number | null;
    coverage_state?: string | null;
  } | null;
  fees: Record<string, unknown> | null;
  navSeries: Parameters<typeof buildDelivered>[0];
  /** Presence-only: does the paired β-adjusted figure exist pre-gate? */
  rawPairedBetaAdjPresent: boolean;
  teDecomposition: Parameters<typeof buildActiveMix>[0];
  teProof: Parameters<typeof buildActiveMix>[1];
  /** True when the te-decomposition section is locked for this tier. */
  teLocked: boolean;
  exposureXray: { rows?: unknown[] } | null;
  paid: boolean;
}

export function M00Verdict({
  fundName,
  passiveBaseline,
  valueScore,
  fees,
  navSeries,
  rawPairedBetaAdjPresent,
  teDecomposition,
  teProof,
  teLocked,
  exposureXray,
  paid,
}: M00Props) {
  const twin = buildTwin(passiveBaseline, valueScore?.replica_r2 ?? null);
  const cost = buildCost(fees);
  const delivered = buildDelivered(navSeries, paid, rawPairedBetaAdjPresent);
  const mix = buildActiveMix(teDecomposition, teProof);
  const own = ownShare(twin);
  void buildConcentration(exposureXray); // concentration lives in movement 06

  const headline = claimHeadline(fundName, cost, delivered);
  const badge = badgeFor(valueScore?.breakeven_state ?? null);
  const costD = dollarsPer10k(cost.overPassiveBps);
  const delD = delivered.paired ? dollarsPer10k(delivered.paired.betaAdjBps) : null;
  const windowLabel = longMonth(delivered.windowStart);

  return (
    <Movement
      id="exec"
      index="00"
      eyebrow="the verdict — the whole case, five lines"
      headline={headline ?? undefined}
    >
      {headline == null ? (
        <Absent
          what="The headline verdict"
          reason={
            twin.missingReason ??
            cost.missingReason ??
            delivered.missingReason ??
            FALLBACK_REASON
          }
          className="mt-3"
        />
      ) : null}

      {/* ---- the money hero ------------------------------------------------ */}
      <p className="mb-2 mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-gray-700">
        Per $10,000 invested, every year
      </p>
      <div className="mb-4 flex max-w-[660px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50/40 sm:flex-row">
        <div className="flex-1 px-5 py-3.5">
          {costD != null ? (
            <>
              <div className="font-mono text-[32px] font-semibold leading-tight text-gray-900">
                {fmtDollarsMagnitude(costD)}
                <small className="ml-1.5 font-sans text-[13px] font-normal text-gray-700">a year</small>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-gray-700">
                what the manager <b>costs</b> you over the twin
                <Sub>{fmtBpsAsPct(cost.overPassiveBps)} of what you hold</Sub>
              </p>
            </>
          ) : (
            <Absent what="What the manager costs over the twin" reason={cost.missingReason ?? FALLBACK_REASON} />
          )}
        </div>
        <div className="flex-1 border-t border-gray-200 px-5 py-3.5 sm:border-l sm:border-t-0">
          {delD != null ? (
            <>
              <div
                className={`font-mono text-[32px] font-semibold leading-tight ${
                  delD < 0 ? "text-crescent-bad" : "text-crescent-good"
                }`}
              >
                {fmtDollarsSigned(delD)}
                <small className="ml-1.5 font-sans text-[13px] font-normal text-gray-700">a year</small>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-snug text-gray-700">
                what the manager has <b>delivered</b> against the twin
                <Sub>
                  {fmtBpsAsPct(Math.abs(delivered.paired?.betaAdjBps ?? 0))} a year{" "}
                  {delD < 0 ? "less" : "more"}
                  {windowLabel ? `, since ${windowLabel}` : ""} · after all fees · same market risk
                  {delivered.passiveLabel ? ` · measured against ${delivered.passiveLabel}` : ""}
                </Sub>
              </p>
            </>
          ) : delivered.gated ? (
            <LockedNote what="What the manager has delivered against the twin" />
          ) : (
            <Absent
              what="What the manager has delivered against the twin"
              reason={
                delivered.betaAdjMissingReason ??
                delivered.missingReason ??
                twin.missingReason ??
                FALLBACK_REASON
              }
            />
          )}
        </div>
      </div>

      {/* ---- the five-row ledger ------------------------------------------ */}
      <Card>
        <ExRow
          label="Closest passive alternative"
          figure={
            own != null ? (
              <div>
                <CrescentMark
                  fill={own}
                  size={96}
                  ariaLabel={`${(own * 100).toFixed(1)}% of this fund's week-to-week behaviour is not reproduced by its passive twin`}
                />
                <FigCap>
                  grey — the mix · gold — its own {(own * 100).toFixed(1)}%
                </FigCap>
              </div>
            ) : null
          }
        >
          {twin.legs.length > 0 ? (
            <>
              Every fund we grade gets a <b>twin</b>: the cheapest mix of ETFs that behaves almost
              exactly like it. This fund&rsquo;s twin is{" "}
              {twin.legs.map((l, i) => (
                <span key={l.etf}>
                  {i > 0 ? " + " : ""}
                  <b>
                    {Math.round(l.weight * 100)}% {l.etf}
                  </b>
                  {l.name ? ` (${l.name})` : ""}
                </span>
              ))}
              {twin.currentFitR2 != null ? (
                <>
                  {" "}
                  — it reproduces <b>{(twin.currentFitR2 * 100).toFixed(1)}%</b> of the fund&rsquo;s
                  week-to-week returns.
                </>
              ) : (
                "."
              )}
              <Sub>
                That is a share of how it <i>moves</i>, not of what it holds. The gold in the circle
                is the {own != null ? `${(own * 100).toFixed(1)}%` : "part"} no ETF mix can copy —
                the manager.
                {twin.fitWindowStart && twin.fitWindowEnd ? (
                  <>
                    {" "}
                    Measured on weekly returns from {longMonth(twin.fitWindowStart)} to{" "}
                    {longMonth(twin.fitWindowEnd)}
                    {twin.fullHistoryR2 != null ? (
                      <>
                        {" "}
                        (over the full history we can price both, the same mix reproduces{" "}
                        {(twin.fullHistoryR2 * 100).toFixed(1)}%)
                      </>
                    ) : null}
                    .
                  </>
                ) : null}
              </Sub>
            </>
          ) : (
            <Absent what="A passive twin" reason={twin.missingReason ?? FALLBACK_REASON} />
          )}
        </ExRow>

        <ExRow
          label="What it costs"
          figure={<FeeBars netErBps={cost.netErBps} twinFeeBps={cost.twinFeeBps} />}
        >
          {cost.netErBps != null && cost.twinFeeBps != null && cost.overPassiveBps != null ? (
            <>
              This fund charges <b>{fmtBpsAsPct(cost.netErBps)}</b> a year; its twin costs{" "}
              <b>{fmtBpsAsPct(cost.twinFeeBps)}</b>. The manager&rsquo;s bets have to earn back that{" "}
              <b className="font-semibold text-gray-700">
                {fmtBpsAsPct(cost.overPassiveBps)} difference
              </b>{" "}
              — {fmtDollarsMagnitude(costD)} per $10,000 — before you are even.
              <Sub>
                Every after-fee figure on this page already has the fee inside it, so there the bar
                is simply zero: match the twin.
              </Sub>
            </>
          ) : (
            <Absent what="The fee comparison" reason={cost.missingReason ?? FALLBACK_REASON} />
          )}
        </ExRow>

        <ExRow label="Current positioning">
          {teLocked && mix.slices.length === 0 ? (
            <LockedNote what="How the manager's own layer splits" />
          ) : positioningCopy(mix, own) != null ? (
            <>
              {positioningCopy(mix, own)}
              <Sub>
                Measured from how the fund <i>moves</i> against its twin over three years of weekly
                returns — not from what it holds.
                {hasTilts(mix) ? (
                  <>
                    {" "}
                    The manager also moves these tilts over time; that shows up in the record, not
                    in today&rsquo;s positions.
                  </>
                ) : null}
              </Sub>
            </>
          ) : (
            <Absent what="Current positioning" reason={mix.missingReason ?? FALLBACK_REASON} />
          )}
        </ExRow>

        <ExRow label="The history">
          {delivered.paired?.betaAdjBps != null ? (
            <>
              Against this twin it has{" "}
              {delivered.paired.betaAdjBps < 0 ? "trailed by" : "beaten it by"}{" "}
              <b className={delivered.paired.betaAdjBps < 0 ? "text-crescent-bad" : "text-crescent-good"}>
                {fmtBpsAsPct(Math.abs(delivered.paired.betaAdjBps))} a year
                {windowLabel ? ` since ${windowLabel}` : ""}
              </b>{" "}
              after all fees — about {fmtDollarsMagnitude(delD)} per $10,000
              {delivered.fiveYear?.betaAdjBps != null ? (
                <>
                  {" "}
                  — and by{" "}
                  <b
                    className={
                      delivered.fiveYear.betaAdjBps < 0 ? "text-crescent-bad" : "text-crescent-good"
                    }
                  >
                    {fmtBpsAsPct(Math.abs(delivered.fiveYear.betaAdjBps))} a year
                  </b>{" "}
                  over the last five
                </>
              ) : null}
              .
              <Sub>
                Both figures put the twin on the same market risk as the fund.
                {delivered.paired.rawBps != null ? (
                  <>
                    {" "}
                    Raw, before that adjustment, the{windowLabel ? ` since-${windowLabel}` : ""} gap
                    is {fmtBpsAsPct(Math.abs(delivered.paired.rawBps))} a year{" "}
                    {delivered.paired.rawBps < 0 ? "behind" : "ahead"}.
                  </>
                ) : null}{" "}
                The bet-by-bet accounting of <i>why</i> is in the record, section 02.
                {comparatorDiffersFromTwin(twin, delivered.passiveLabel) ? (
                  <>
                    {" "}
                    One note on the yardstick: the record is measured against the cheapest
                    matching ETF mix <i>as it stood at each point in time</i>, refit periodically
                    as the fund changed — not against today&rsquo;s mix applied backwards.{" "}
                    {twin.mixLabel} is the current segment of that sequence, which is why the
                    record is served under a shorter name.
                  </>
                ) : null}
              </Sub>
            </>
          ) : delivered.gated ? (
            <LockedNote what="The fund's record against its twin" />
          ) : (
            <Absent
              what="The record against this twin"
              reason={
                delivered.betaAdjMissingReason ??
                delivered.missingReason ??
                twin.missingReason ??
                FALLBACK_REASON
              }
            />
          )}
        </ExRow>

        <ExRow label="Conclusion" alignTop>
          <div className="sm:col-span-2">
            {badge != null ? (
              <div className="border-l-[3px] border-gray-900 bg-amber-50/40 px-4 py-3.5 font-serif text-[17px] leading-relaxed text-gray-900">
                Measured against the cheapest mix of ETFs that behaves like it, this fund{" "}
                {valueScore?.breakeven_state === "below"
                  ? "has returned less than it charged for the difference"
                  : valueScore?.breakeven_state === "above"
                    ? "has returned more than it charged for the difference"
                    : "has come out roughly even against what it charged for the difference"}
                . Whether the picking is skill is a separate question from whether it earned the fee.
              </div>
            ) : (
              <Absent
                what="A verdict"
                reason="We only publish a verdict when the fund has a matched passive twin and enough shared history to grade it against."
              />
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {badge != null ? <VerdictBadge tone={badge.tone}>{badge.text}</VerdictBadge> : null}
              {twin.currentFitR2 != null ? (
                <Chip title="How much of the fund's week-to-week movement the current twin reproduces, over the twin's fit window.">
                  twin fit · {(twin.currentFitR2 * 100).toFixed(1)}%
                </Chip>
              ) : null}
              {valueScore?.beta != null ? (
                <BasisChip title="Beta versus the passive twin: 1.00 means the fund carries the same market risk as the mix it is graded against.">
                  SAME MARKET RISK · β {valueScore.beta.toFixed(2)}
                </BasisChip>
              ) : null}
              <MethodLink anchor="value-score" />
            </div>
          </div>
        </ExRow>

        <Caption>
          Every dollar figure on this page is per $10,000 invested, a year — one basis point of fee
          or of return is one dollar. The cost figure is a current rate; the delivered figure is what
          actually happened over the window named beside it.
        </Caption>
      </Card>
    </Movement>
  );
}
