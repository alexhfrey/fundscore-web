// ============================================================================
// Exposure X-Ray (spec #4) — what the fund holds vs its passive alternative,
// in one table: fund exposure, passive exposure, difference, readout. Holdings
// filing-lag disclosure is required at the section header.
// ============================================================================
import {
  Section,
  Card,
  Unavailable,
  AsOf,
  LockedNotice,
  ProofPoint,
  UnlockLine,
} from "./primitives";
import {
  fmtPct,
  fmtPP,
  fmtNum,
  exposureTypeLabel,
  betProfilePeerAnchor,
  EM_DASH,
} from "@/lib/serving/format";
import {
  isLocked,
  getPreview,
  type Locked,
  type ExposurePreview,
} from "@/lib/serving/profile";

interface XrayRow {
  row_id: string;
  exposure_id: string;
  exposure_name: string;
  exposure_type: string;
  // holdings_baseline distinguishes absolute rows from peer-relative (vs_peer)
  // and passive-relative rows. Present in the JSONB payload; typed here so the
  // component can route concentration peer rows to the peer-anchor block.
  holdings_baseline?: string | null;
  baseline_ref?: string | null;
  fund_exposure: number | null;
  passive_exposure: number | null;
  difference: number | null;
  readout: string | null;
  confidence_state: string;
  coverage_state: string;
  holdings_as_of: string | null;
  passive_holdings_as_of: string | null;
  sort_priority?: number;
}

interface Xray {
  rows: XrayRow[];
  fund_holdings_date: string | null;
  passive_holdings_date: string | null;
  exposure_method_version: string | null;
  full_holdings_available: boolean;
}

const TYPE_ORDER = ["theme", "sector", "country_region", "style", "stock", "concentration"];

export function ExposureXray({ xray }: { xray: Xray | Locked | null }) {
  if (isLocked(xray)) {
    const pp = getPreview(xray) as ExposurePreview | null;
    return (
      <Section id="exposure-xray" title="Exposure X-Ray" methodologyAnchor="exposure-xray">
        {pp ? (
          <>
            <ProofPoint
              label={`Biggest active difference · ${exposureTypeLabel(pp.exposure_type)}`}
              value={`${pp.exposure_name}: ${fmtPP(pp.difference * 100)}`}
              readout={`${pp.exposure_name} is ${fmtPP(pp.difference * 100)} vs this fund's passive alternative — its single largest active exposure difference.`}
              tone={pp.difference >= 0 ? "positive" : "negative"}
              asOf={pp.holdings_as_of ? `Holdings as of ${pp.holdings_as_of}.` : null}
            />
            <UnlockLine tier={xray.locked}>
              See the full exposure breakdown — by theme, sector, region, stock and
              style.
            </UnlockLine>
          </>
        ) : (
          <LockedNotice tier={xray.locked}>
            See exactly what this fund owns — by theme, sector, region, stock and
            style — and how it differs from the passive alternative.
          </LockedNotice>
        )}
      </Section>
    );
  }
  if (!xray || !xray.rows || xray.rows.length === 0) {
    return (
      <Section id="exposure-xray" title="Exposure X-Ray" methodologyAnchor="exposure-xray">
        <Unavailable>
          Exposure X-Ray is unavailable for this fund — we don&apos;t have
          current holdings to break down.
        </Unavailable>
      </Section>
    );
  }

  // Concentration rows are peer-relative counts/ratios (e.g. effective positions
  // 17.7 vs 29.4), NOT weight differences. They must not appear in the pp difference
  // table, where a raw count delta (e.g. -11.70) renders as a garbage "-1170 pp".
  // They belong in a dedicated peer-anchor readout (see plain-english verdict spec).
  const tableRows = xray.rows.filter((r) => r.exposure_type !== "concentration");
  const hasPassive = tableRows.some((r) => r.passive_exposure != null);
  // Top rows: largest absolute difference (passive-relative) or largest weight.
  const sorted = [...tableRows].sort((a, b) => {
    const ad = Math.abs(a.difference ?? a.fund_exposure ?? 0);
    const bd = Math.abs(b.difference ?? b.fund_exposure ?? 0);
    return bd - ad;
  });
  // Default to a focused set; keep a per-type cap so one family doesn't crowd out.
  const perType: Record<string, number> = {};
  const top: XrayRow[] = [];
  for (const r of sorted) {
    const t = r.exposure_type;
    perType[t] = (perType[t] ?? 0) + 1;
    if (perType[t] <= 4) top.push(r);
    if (top.length >= 16) break;
  }
  top.sort(
    (a, b) =>
      TYPE_ORDER.indexOf(a.exposure_type) - TYPE_ORDER.indexOf(b.exposure_type) ||
      Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0),
  );

  const fundDate = xray.fund_holdings_date;
  const anyStale = xray.rows.some((r) => r.coverage_state === "stale");

  // Peer-anchor readout: the vs_peer concentration stats (active share + effective
  // positions) read by their vs_peer rows and shown in a NON-pp format — active
  // share as a ratio, effective positions as a plain count. Excluded from the pp
  // table above precisely because their deltas are counts/ratios, not weight pp.
  const peerAnchor = betProfilePeerAnchor(xray.rows);

  return (
    <Section
      id="exposure-xray"
      title="Exposure X-Ray"
      subtitle={
        hasPassive
          ? "Fund exposure vs its passive alternative — the active difference, by exposure type."
          : "What this fund is exposed to (absolute weights — no comparable passive holdings to difference against)."
      }
      methodologyAnchor="exposure-xray"
    >
      <PeerConcentrationReadout anchor={peerAnchor} />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 font-medium">Exposure</th>
              <th className="px-3 py-2.5 text-right font-medium">Fund</th>
              {hasPassive && (
                <th className="px-3 py-2.5 text-right font-medium">Passive</th>
              )}
              {hasPassive && (
                <th className="px-3 py-2.5 text-right font-medium">Difference</th>
              )}
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.row_id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-gray-900">{r.exposure_name}</span>
                  <span className="ml-2 text-[11px] uppercase tracking-wide text-gray-400">
                    {exposureTypeLabel(r.exposure_type)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                  {fmtPct(r.fund_exposure)}
                </td>
                {hasPassive && (
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                    {r.passive_exposure != null ? fmtPct(r.passive_exposure) : EM_DASH}
                  </td>
                )}
                {hasPassive && (
                  <td className="px-3 py-2.5 text-right">
                    <DiffPill diff={r.difference} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <AsOf>
        Holdings as of {fundDate ?? EM_DASH}
        {anyStale ? " — older than our 180-day staleness threshold, so exact difference claims are read with caution" : ""}
        {hasPassive && xray.passive_holdings_date
          ? `; passive holdings as of ${xray.passive_holdings_date}`
          : ""}
        . Method {xray.exposure_method_version ?? EM_DASH}. SEC holdings are filed
        with a lag — the most recent portfolio may differ from the filed snapshot.
      </AsOf>
    </Section>
  );
}

/**
 * Dedicated peer-anchor readout for the vs_peer concentration stats. Active share
 * renders as a ratio (0.497 vs 0.671), effective positions as a plain count
 * (17.7 vs 29.4) — NEVER as pp (those deltas are counts/ratios, not weight
 * fractions). Each value traces to its vs_peer concentration row. Renders nothing
 * when neither stat is available.
 */
function PeerConcentrationReadout({
  anchor,
}: {
  anchor: ReturnType<typeof betProfilePeerAnchor>;
}) {
  if (!anchor) return null;
  const { activeShareFund, activeSharePeer, effPositionsFund, effPositionsPeer } =
    anchor;
  const hasActiveShare = activeShareFund != null && activeSharePeer != null;
  const hasEffPositions = effPositionsFund != null && effPositionsPeer != null;
  if (!hasActiveShare && !hasEffPositions) return null;

  // Plain anchor: effective positions IS the count of distinct bets, so anchor
  // the "fewer / more distinct bets" read on it (fall back to active share only
  // when positions are absent). Neutral reference, not a grade. Render the count
  // anchor only when its driving stat exists.
  let betsAnchor: string | null = null;
  if (hasEffPositions) {
    betsAnchor = `It makes ${
      (effPositionsFund as number) < (effPositionsPeer as number) ? "fewer" : "more"
    } distinct bets than its peers.`;
  } else if (hasActiveShare) {
    betsAnchor = `It deviates ${
      (activeShareFund as number) > (activeSharePeer as number) ? "more" : "less"
    } from its peers' average holdings.`;
  }

  return (
    <Card className="mb-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        How concentrated vs peers
      </div>
      <div className="mt-1.5 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
        {hasActiveShare && (
          <div>
            <span className="font-semibold tabular-nums text-gray-900">
              {fmtNum(activeShareFund, 3)}
            </span>{" "}
            <span className="text-gray-500">
              active share vs {fmtNum(activeSharePeer, 3)} for the average peer
            </span>
          </div>
        )}
        {hasEffPositions && (
          <div>
            <span className="font-semibold tabular-nums text-gray-900">
              {fmtNum(effPositionsFund, 1)}
            </span>{" "}
            <span className="text-gray-500">
              effective positions vs {fmtNum(effPositionsPeer, 1)} for the average
              peer
            </span>
          </div>
        )}
      </div>
      {betsAnchor && (
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{betsAnchor}</p>
      )}
    </Card>
  );
}

function DiffPill({ diff }: { diff: number | null }) {
  if (diff == null) return <span className="text-gray-400">{EM_DASH}</span>;
  const pp = diff * 100;
  if (Math.abs(pp) < 0.05)
    return <span className="text-xs text-gray-400">~0 pp</span>;
  const pos = pp > 0;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        pos ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {fmtPP(pp)}
    </span>
  );
}
