// ============================================================================
// Movement 06 · #stats — key stats & details (PARTIAL, per the F1 fences).
// ----------------------------------------------------------------------------
// Rendered: NAV · AUM · net expense ratio · inception · managers (+ as-of) ·
// filed positions (+ as-of) · top-10 equity holdings · category · family value
// rank · the twin · the twin's fee.
//
// Held back, each with its reason on the page (never a blank or a zero):
//  • Effective positions — the served figure is on the wrong book (L10).
//  • Active share       — cannot be certified per fund (f1-progress PARKED-1).
//
// COUNT DISCIPLINE: the "holdings" cell reads `holdings.holdings_full.n_positions`
// — the count of FILED position lines, which is the same book the numbers above
// it use and the same list a reader can open. `identity.holdings_count` is a
// different, narrower count that disagrees for 4,366 of 5,721 served funds
// (76%); using it here would contradict the page's own filed-book figures.
// ============================================================================

import type { ReactNode } from "react";
import { EM_DASH, fmtAum } from "@/lib/serving/format";
import type { Identity } from "@/lib/serving/profile";
import type { FundFamilyPanel } from "@/lib/serving/profile-v2";
import { Absent, Caption, Card, CardLabel, MethodLink, Movement } from "./chrome";
import {
  buildConcentration,
  buildCost,
  buildTwin,
  fmtBpsAsPct,
  looksThroughToMaster,
} from "./derive";

/** Last-resort reason. `Absent` must NEVER render an empty explanation. */
const FALLBACK_REASON =
  "The served data this needs is not available for this fund, so we withhold it rather than estimate it.";

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-100 py-2 text-[13.5px] last:border-b-0">
      <span className="text-gray-500">{k}</span>
      <span className="text-right font-mono text-[13px] text-gray-900">{v}</span>
    </div>
  );
}

function money(v: number | null | undefined): ReactNode {
  if (v == null || !Number.isFinite(v)) return EM_DASH;
  return `$${v.toFixed(2)}`;
}

export interface M06Props {
  identity: Identity;
  fees: Record<string, unknown> | null;
  holdings: Record<string, unknown> | null;
  managerParent: Record<string, unknown> | null;
  passiveBaseline: Parameters<typeof buildTwin>[0];
  valueScoreReplicaR2: number | null;
  exposureXray: { rows?: unknown[] } | null;
  family: FundFamilyPanel | null;
}

export function M06KeyStats({
  identity,
  fees,
  holdings,
  managerParent,
  passiveBaseline,
  valueScoreReplicaR2,
  exposureXray,
  family,
}: M06Props) {
  const cost = buildCost(fees);
  const twin = buildTwin(passiveBaseline, valueScoreReplicaR2);
  const conc = buildConcentration(exposureXray);

  const hf = (holdings?.["holdings_full"] ?? null) as Record<string, unknown> | null;
  const nPositions = typeof hf?.["n_positions"] === "number" ? (hf["n_positions"] as number) : null;
  const holdingsAsOf =
    (hf?.["as_of"] as string | null) ?? (holdings?.["as_of_date"] as string | null) ?? null;

  const managers = Array.isArray(managerParent?.["managers"])
    ? (managerParent["managers"] as unknown[])
    : null;
  const managerAsOf = (managerParent?.["manager_as_of"] as string | null) ?? null;

  // Master-feeder funds file ONE line (their stake in a master portfolio) while
  // the concentration figures look THROUGH it to the master's book. Where that
  // is provable, both cells say so rather than sitting next to each other
  // implying "1 filed position" and "top-10 = 5.2%" describe the same book.
  const lookThrough = looksThroughToMaster(nPositions, conc.top10Weight);

  return (
    <Movement id="stats" index="06" eyebrow="key stats &amp; details — the plain facts">
      <Card>
        <div className="grid max-w-[880px] grid-cols-1 gap-x-9 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Row k="NAV" v={money(identity.latest_nav)} />
            <Row k="AUM" v={identity.aum_usd != null ? fmtAum(identity.aum_usd) : EM_DASH} />
            <Row
              k="Net expense ratio"
              v={cost.netErBps != null ? `${fmtBpsAsPct(cost.netErBps)}/yr` : EM_DASH}
            />
            {/* `identity.inception_date` is the FUND's inception, not this share class's
                (VOO serves 1976-08-31 — the Vanguard 500 fund, whose ETF class
                launched in 2010). Labelled for what it is. */}
            <Row k="Inception" v={identity.inception_date ?? EM_DASH} />
            <Row
              k="Managers"
              v={
                managers != null && managers.length > 0
                  ? `${managers.length}${managerAsOf ? ` · as of ${managerAsOf}` : ""}`
                  : EM_DASH
              }
            />
          </div>
          <div>
            <Row
              k={lookThrough ? "Filed positions (feeder)" : "Filed positions"}
              v={
                nPositions != null
                  ? `${nPositions}${holdingsAsOf ? ` · as of ${holdingsAsOf}` : ""}`
                  : EM_DASH
              }
            />
            <Row
              k={
                lookThrough ? "Top-10 equity holdings (look-through)" : "Top-10 equity holdings"
              }
              v={
                conc.top10Weight != null ? `${(conc.top10Weight * 100).toFixed(1)}% of NAV` : EM_DASH
              }
            />
            <Row k="Category" v={identity.peer_group ?? EM_DASH} />
            <Row
              k="Family value rank"
              v={
                family?.family_rank != null && family.n_families_ranked != null
                  ? `${family.family_rank} of ${family.n_families_ranked}`
                  : EM_DASH
              }
            />
          </div>
          <div>
            <Row k="The twin" v={twin.mixLabel ?? EM_DASH} />
            <Row
              k="Twin fee"
              v={cost.twinFeeBps != null ? `${fmtBpsAsPct(cost.twinFeeBps)}/yr` : EM_DASH}
            />
            <Row
              k="Twin fit"
              v={twin.currentFitR2 != null ? `${(twin.currentFitR2 * 100).toFixed(1)}%` : EM_DASH}
            />
          </div>
        </div>

        <div className="mt-5 space-y-2 border-t border-dashed border-gray-200 pt-4">
          <CardLabel>Two figures we are holding back</CardLabel>
          <Absent what="Effective positions" reason={conc.effectivePositionsReason} />
          {conc.activeShare == null ? (
            <Absent what="Active share" reason={conc.activeShareReason ?? FALLBACK_REASON} />
          ) : null}
        </div>

        <Caption>
          Holdings are filed with a lag, so the positions above describe the book as at the date
          beside them, not today. <b>Top-10 equity holdings</b> is the sum of the ten largest
          equity positions as a share of net assets, on the SEC-filed percent-of-net-assets basis.
          It excludes debt, preferred, cash and short lines, which is why it is named that way
          rather than &ldquo;top-10 concentration&rdquo;.
          {lookThrough ? (
            <>
              {" "}
              <b>This fund invests through a master portfolio.</b> It files a single position of
              its own — its stake in that master — so the concentration figure above describes the
              master&rsquo;s underlying book, not the one line this fund files. The two counts are
              not measuring the same thing, and are labelled separately above.
            </>
          ) : null}{" "}
          <MethodLink anchor="exposure-xray" />
        </Caption>
      </Card>
    </Movement>
  );
}
