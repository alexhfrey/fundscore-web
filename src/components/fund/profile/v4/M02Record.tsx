// ============================================================================
// Movement 02 · #record — the record: did holding the manager pay?
// ----------------------------------------------------------------------------
// Card 1 growth of $10,000 (fund / β-scaled twin / raw twin) — SERVED nav_series
// Card 2 "where the gap came from"                            — SERVED attribution
//
// The mockup's card 2 is an honest WITHHELD notice. That was the PRE-reload
// state: `factor_attribution` was still computed against the fund's previous
// twin. On the active serving manifest the attribution panels are rebuilt AFTER
// the twin refit (verified — see f1-progress.md §0.1), so the drill-down serves
// real numbers again and the withheld copy is retired rather than reproduced.
//
// Window doctrine, stated once here: the window starts where we first hold a
// daily price for THIS FUND — never "the twin's history", which reaches further
// back. Growth-chart donor: GrowthChart (window-aware ranges, "Max" not
// "since inception"); attribution donor: AttributionSection.
// ============================================================================

import { GrowthChart, type ChartPoint } from "@/components/fund/profile/v2/GrowthChart";
import { AttributionSection } from "@/components/fund/profile/v2";
import type { AttributionWindowSummary, RiskExplainers } from "@/lib/serving/profile-v2";
import type { Locked } from "@/lib/serving/profile";
import {
  Absent,
  Caption,
  Card,
  CardLabel,
  LockedNote,
  MethodLink,
  Movement,
} from "./chrome";
import {
  buildDelivered,
  buildTwin,
  comparatorDiffersFromTwin,
  fmtBpsAsPct,
  fmtDollarsMagnitude,
  longMonth,
  type DeliveredView,
} from "./derive";

const STAKE = 10_000;

/** Growth of the display stake at a served point (the series is base $1,000). */
function atStake(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return (v / 1000) * STAKE;
}

function headlineFor(
  fundName: string,
  points: ChartPoint[],
  delivered: DeliveredView,
): { headline: React.ReactNode; standfirst: React.ReactNode } | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const fundEnd = atStake(last.fund);
  const twinEnd = atStake(last.beta_adj_passive);
  const start = longMonth(delivered.windowStart);
  if (fundEnd == null || twinEnd == null) return null;

  const gap = twinEnd - fundEnd;
  const bps = delivered.paired?.betaAdjBps ?? null;

  return {
    headline: (
      <>
        {start ? <>Since {start}, </> : null}${STAKE.toLocaleString()} in {fundName} grew to{" "}
        {fmtDollarsMagnitude(fundEnd)}. The same ${STAKE.toLocaleString()} in its twin grew to{" "}
        {fmtDollarsMagnitude(twinEnd)}.
      </>
    ),
    standfirst: (
      <>
        {bps != null ? (
          <>
            That is a gap of <b>{fmtBpsAsPct(Math.abs(bps))} a year</b> — the{" "}
            {fmtDollarsMagnitude(bps)} per $10,000, every year, from the verdict above — which
            compounds to <b>{fmtDollarsMagnitude(gap)}</b>{" "}
            {gap >= 0 ? "of missing money" : "of extra money"} over the period.{" "}
          </>
        ) : null}
        The fund did not {gap >= 0 ? "lose" : "win"} against the market in some abstract sense. It
        was measured against the specific, buyable mix of ETFs that behaves almost exactly like it.
      </>
    ),
  };
}

export interface M02Props {
  fundName: string;
  /** The verdict's twin, for the comparator-divergence disclosure only. */
  passiveBaseline: Parameters<typeof buildTwin>[0];
  valueScoreReplicaR2: number | null;
  navSeries: Parameters<typeof buildDelivered>[0];
  /** Presence-only: does the paired β-adjusted figure exist pre-gate? */
  rawPairedBetaAdjPresent: boolean;
  paid: boolean;
  passiveLabel: string | null;
  beta: number | null;
  attrSummary: AttributionWindowSummary | null;
  attrPresent: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  returnAttribution: { rows?: any[] } | Locked | null;
  riskExplainers: RiskExplainers | null;
}

export function M02Record({
  fundName,
  passiveBaseline,
  valueScoreReplicaR2,
  navSeries,
  rawPairedBetaAdjPresent,
  paid,
  passiveLabel,
  beta,
  attrSummary,
  attrPresent,
  returnAttribution,
  riskExplainers,
}: M02Props) {
  const delivered = buildDelivered(navSeries, paid, rawPairedBetaAdjPresent);
  const twin = buildTwin(passiveBaseline, valueScoreReplicaR2);
  const comparatorDiffers = comparatorDiffersFromTwin(twin, delivered.passiveLabel);
  const points: ChartPoint[] = Array.isArray(navSeries?.points)
    ? (navSeries.points as ChartPoint[])
    : [];
  const head = paid ? headlineFor(fundName, points, delivered) : null;

  return (
    <Movement
      id="record"
      index="02"
      eyebrow="the record — did holding the manager pay"
      headline={head?.headline}
      standfirst={head?.standfirst}
    >
      <Card className="px-3">
        <div className="px-3 pt-1">
          <CardLabel>
            Growth of ${STAKE.toLocaleString()} · fund net of its fee, twin net of its own
          </CardLabel>
        </div>
        {points.length > 0 ? (
          <>
            <GrowthChart
              points={points}
              passiveLabel={passiveLabel}
              beta={beta}
              showComparison={paid}
              base={STAKE}
            />
            <div className="px-3">
              <Caption>
                Three lines. <b>Fund</b> is what you actually received, after this fund&rsquo;s fee.{" "}
                <b>Twin</b> is the ETF mix scaled to carry the same market risk as the fund, after
                the ETFs&rsquo; own fees — the like-for-like comparison. <b>Raw</b> is that same mix
                unscaled, shown dashed, for readers who want the untouched version. The window
                starts {longMonth(delivered.windowStart) ?? "where the paired series starts"}{" "}
                because that is roughly as far back as we hold a daily price for this fund — the
                twin itself can usually be priced further back. A different start date would give a
                different gap.
                {comparatorDiffers ? (
                  <>
                    {" "}
                    <b>The twin line is point-in-time.</b> It is the cheapest matching ETF mix as
                    it stood at each date, refit periodically as the fund itself changed, rather
                    than today&rsquo;s mix projected backwards — which would flatter or punish the
                    fund using a mirror that did not exist at the time. {twin.mixLabel} is the
                    current segment of that sequence.
                  </>
                ) : null}{" "}
                <MethodLink anchor="nav-series" />
              </Caption>
            </div>
          </>
        ) : (
          <div className="px-3 pb-2">
            <Absent
              what="The growth chart"
              reason={
                delivered.missingReason ??
                "We only draw this when we hold a daily price for both the fund and its twin over a shared window."
              }
            />
          </div>
        )}
      </Card>

      <Card>
        <CardLabel>Where the gap came from</CardLabel>
        <div className="mt-2.5">
          {attrPresent ? (
            paid ? (
              <AttributionSection
                summary={attrSummary}
                present={attrPresent}
                returnAttribution={returnAttribution}
                riskExplainers={riskExplainers}
                paid={paid}
                passiveLabel={passiveLabel}
                demoted
              />
            ) : (
              <LockedNote what="The bet-by-bet accounting of where the gap came from" />
            )
          ) : (
            <Absent
              what="The bet-by-bet accounting"
              reason="Splitting the gap into the decisions that caused it needs several years of quarterly filed holdings priced against this fund's twin. We do not have that for this fund."
            />
          )}
        </div>
      </Card>
    </Movement>
  );
}
