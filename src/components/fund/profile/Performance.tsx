// ============================================================================
// Performance — "How have the bets done?" The fund's own realized return
// history, period by period, read against the NAMED passive alternative.
//
// DATA INTEGRITY: every number traces to the served `performance.return_periods`
// (annualized for 3Y/5Y/10Y, cumulative for YTD/1Y — exactly as the gold
// metadata computes them). We do NOT fabricate a per-period passive return: the
// served passive figures (`passive_baseline_return_bps` inside return_attribution)
// are measured over a DIFFERENT window (anchored to the holdings frontier), so
// pairing them with these returns would mix time spans. The clean passive-
// relative read is the bet-by-bet attribution in the verdict section, which we
// point to here rather than invent a mismatched "$X vs $Y" headline.
// ============================================================================
import { Section, Card, Unavailable, AsOf } from "./primitives";
import { fmtPct } from "@/lib/serving/format";

interface ReturnPeriods {
  ytd: number | null;
  one_year: number | null;
  three_year: number | null;
  five_year: number | null;
  ten_year: number | null;
}
interface PerformanceData {
  return_periods?: ReturnPeriods | Record<string, number | null> | null;
  // Daily NAV series are not yet wired in the serving layer (always null today).
  fund_return_series?: unknown;
  passive_return_series?: unknown;
}

// Display order + label + whether the figure is annualized (3Y/5Y/10Y) or a
// plain cumulative period return (YTD/1Y). The annualized flag drives the
// footnote so an annualized number is never read as a cumulative one.
const PERIODS: {
  key: keyof ReturnPeriods;
  label: string;
  annualized: boolean;
}[] = [
  { key: "ytd", label: "YTD", annualized: false },
  { key: "one_year", label: "1 year", annualized: false },
  { key: "three_year", label: "3 year", annualized: true },
  { key: "five_year", label: "5 year", annualized: true },
  { key: "ten_year", label: "10 year", annualized: true },
];

export function Performance({
  performance,
  passiveName,
  isPassive,
}: {
  performance: PerformanceData | null;
  passiveName: string | null;
  isPassive: boolean;
}) {
  const rp = performance?.return_periods ?? null;
  const present = PERIODS.filter((p) => rp?.[p.key] != null);

  if (!rp || present.length === 0) {
    return (
      <Section id="performance" title="How have the bets done?" methodologyAnchor="performance">
        <Unavailable>
          We don&apos;t have a validated return history for this fund yet, so we
          suppress the performance read rather than show a partial figure.
        </Unavailable>
      </Section>
    );
  }

  return (
    <Section
      id="performance"
      title="How have the bets done?"
      subtitle={
        isPassive
          ? "What this index vehicle has actually returned, period by period."
          : "What the fund has actually returned, period by period — the realized result of the bets above."
      }
      methodologyAnchor="performance"
    >
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 font-medium">Period</th>
              <th className="px-4 py-2.5 text-right font-medium">
                {isPassive ? "Index return" : "Fund return"}
              </th>
            </tr>
          </thead>
          <tbody>
            {present.map((p) => {
              const v = rp[p.key] as number;
              return (
                <tr key={p.key} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-700">
                    {p.label}
                    {p.annualized && (
                      <span className="ml-1.5 text-[11px] text-gray-400">/yr</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                      v >= 0 ? "text-gray-900" : "text-rose-700"
                    }`}
                  >
                    {fmtPct(v)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {!isPassive && (
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          These are the fund&apos;s own returns. How much of this came from its
          active bets versus its{" "}
          {passiveName ? (
            <span className="font-medium text-gray-800">{passiveName}</span>
          ) : (
            "passive alternative"
          )}{" "}
          — and whether the manager&apos;s stock-picking added to it — is broken
          out in the verdict below.
        </p>
      )}

      <AsOf>
        Returns from daily adjusted prices; YTD and 1-year are cumulative,
        3/5/10-year are annualized. Past performance does not imply future
        results.
      </AsOf>
    </Section>
  );
}
