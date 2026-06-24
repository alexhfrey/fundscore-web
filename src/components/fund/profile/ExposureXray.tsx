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
} from "./primitives";
import { fmtPct, fmtPP, exposureTypeLabel, EM_DASH } from "@/lib/serving/format";
import { isLocked, type Locked } from "@/lib/serving/profile";

interface XrayRow {
  row_id: string;
  exposure_id: string;
  exposure_name: string;
  exposure_type: string;
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
    return (
      <Section id="exposure-xray" title="Exposure X-Ray" methodologyAnchor="exposure-xray">
        <LockedNotice tier={xray.locked}>
          See exactly what this fund owns — by theme, sector, region, stock and
          style — and how it differs from the passive alternative.
        </LockedNotice>
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

  const hasPassive = xray.rows.some((r) => r.passive_exposure != null);
  // Top rows: largest absolute difference (passive-relative) or largest weight.
  const sorted = [...xray.rows].sort((a, b) => {
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
