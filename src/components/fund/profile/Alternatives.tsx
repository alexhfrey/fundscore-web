// ============================================================================
// Alternatives to Inspect (spec #6) — labeled groups: closest passive, cheaper
// share class, same category, cross-wrapper, similar active. Each row shows
// reasons; unavailable groups show their reason rather than hiding silently.
// ============================================================================
import Link from "next/link";
import {
  Section,
  Card,
  Unavailable,
  AsOf,
  LockedNotice,
  ProofPoint,
  UnlockLine,
} from "./primitives";
import { fmtBps, fmtDollars, fmtPct } from "@/lib/serving/format";
import {
  isLocked,
  getPreview,
  type Locked,
  type AlternativePreview,
} from "@/lib/serving/profile";

interface AltReason {
  reason_code: string;
  reason_text: string;
}
interface AltRow {
  alternative_id: string;
  alternative_type: string;
  ticker: string;
  name: string;
  wrapper_alternative: string | null;
  expense_ratio_bps: number | null;
  passive_fit_r2: number | null;
  factor_overlap_pct: number | null;
  annual_dollar_savings_10k: number | null;
  annual_dollar_savings_100k: number | null;
  key_difference_summary: string | null;
  availability_status: string | null;
  reasons: AltReason[] | null;
}
interface Alts {
  rows: AltRow[];
  unavailable_reason: string | null;
  method_version?: string | null;
  eval_date?: string | null;
}

const GROUPS: { type: string; label: string; blurb: string }[] = [
  { type: "closest_passive", label: "Closest passive alternative", blurb: "The passive blend this fund is read against." },
  { type: "cheaper_share_class", label: "Cheaper share classes", blurb: "Same fund, lower fee." },
  { type: "cross_wrapper", label: "Cross-wrapper substitutes", blurb: "ETF/mutual-fund versions of similar exposure." },
  { type: "similar_active", label: "Similar active funds", blurb: "Comparable exposure, actively managed." },
  { type: "same_category", label: "Same-category funds", blurb: "Other funds in this category." },
];

export function Alternatives({ alts }: { alts: Alts | Locked | null }) {
  if (isLocked(alts)) {
    const pp = getPreview(alts) as AlternativePreview | null;
    return (
      <Section id="alternatives" title="Alternatives to Inspect" methodologyAnchor="alternatives">
        {pp ? (
          <>
            <ProofPoint
              label={
                pp.alternative_type === "cheaper_share_class"
                  ? "Cheaper share class of this fund"
                  : "Cheaper way to hold this exposure"
              }
              value={`${pp.ticker} at ${fmtBps(pp.expense_ratio_bps)}`}
              readout={`${pp.ticker}${pp.name ? ` (${pp.name})` : ""} covers similar ground at ${fmtBps(pp.expense_ratio_bps)}${pp.annual_dollar_savings_10k != null ? ` — saving ${fmtDollars(pp.annual_dollar_savings_10k)}/yr per $10K invested` : ""}. An option to inspect, not a recommendation.`}
              tone="positive"
            />
            <UnlockLine tier={alts.locked}>
              See all alternatives — cheaper share classes, ETF substitutes and
              comparable funds.
            </UnlockLine>
          </>
        ) : (
          <LockedNotice tier={alts.locked}>
            See cheaper share classes, ETF substitutes and comparable funds before
            deciding anything yourself.
          </LockedNotice>
        )}
      </Section>
    );
  }
  if (!alts || !alts.rows || alts.rows.length === 0) {
    return (
      <Section id="alternatives" title="Alternatives to Inspect" methodologyAnchor="alternatives">
        <Unavailable>
          {alts?.unavailable_reason ??
            "No comparable alternatives are available for this fund yet."}
        </Unavailable>
      </Section>
    );
  }

  return (
    <Section
      id="alternatives"
      title="Alternatives to Inspect"
      subtitle="Other funds and passive options that cover similar ground. These are options to inspect, not recommendations."
      methodologyAnchor="alternatives"
    >
      <div className="space-y-4">
        {GROUPS.map((g) => {
          const rows = alts.rows.filter((r) => r.alternative_type === g.type);
          if (rows.length === 0) return null;
          return (
            <Card key={g.type} className="p-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">{g.label}</h3>
                <span className="text-xs text-gray-400">{g.blurb}</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <AltRowItem key={r.alternative_id} r={r} />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
      <AsOf>
        Alternatives: FundScore similarity + passive-match pipeline
        {alts.method_version ? ` (${alts.method_version})` : ""}
        {alts.eval_date ? `, as of ${alts.eval_date}` : ""}. Cross-wrapper savings
        use current expense ratios.
      </AsOf>
    </Section>
  );
}

function AltRowItem({ r }: { r: AltRow }) {
  const wrapper = r.wrapper_alternative === "etf" ? "ETF" : r.wrapper_alternative === "mutual_fund" ? "Mutual fund" : null;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <div className="min-w-0">
        <Link
          href={`/funds/${r.ticker}`}
          className="font-medium text-[#1466b8] hover:underline"
        >
          {r.ticker}
        </Link>
        <span className="ml-2 text-sm text-gray-700">{r.name}</span>
        {r.key_difference_summary && (
          <p className="mt-0.5 text-xs text-gray-500">{r.key_difference_summary}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-gray-500">
        {wrapper && <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">{wrapper}</span>}
        {r.expense_ratio_bps != null && (
          <span className="tabular-nums">{fmtBps(r.expense_ratio_bps)}</span>
        )}
        {r.passive_fit_r2 != null && (
          <span>R² {fmtPct(r.passive_fit_r2, 0)}</span>
        )}
        {r.annual_dollar_savings_10k != null && (
          <span className="font-medium text-emerald-700">
            saves {fmtDollars(r.annual_dollar_savings_10k)}/yr per $10K
          </span>
        )}
      </div>
    </li>
  );
}
