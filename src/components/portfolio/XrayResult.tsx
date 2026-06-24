"use client";

// ============================================================================
// Portfolio X-Ray result (spec §§ 2,4,5). Renders the AGGREGATE passive
// alternative, aggregate fit, aggregate fee gap, and aggregate sector exposure
// x-ray straight from the T7a solver output. NOTHING is computed here beyond
// formatting + AUM-weighted active/passive split (derived from the solver's own
// resolved rows). Honest states throughout:
//   • coverage_state="suppress"  → "no good passive alternative" panel, no blend
//   • fee.coverage_state="missing" (blend on SPY/UIT, no filed ER) → fee shown
//     as unavailable, never faked
//   • exposure.coverage_state="stale"/"partial"/"missing" → labeled accordingly
// ============================================================================
import Link from "next/link";
import {
  fmtPct,
  fmtBps,
  fmtSignedBps,
  fmtDollars,
  fmtDate,
  feeDollars,
  EM_DASH,
} from "@/lib/serving/format";
import type { SolveResult, SolverRow } from "@/lib/serving/portfolio-solver";

export function XrayResult({ result: r }: { result: SolveResult }) {
  const resolved = r.rows.filter((x) => x.resolution_state === "resolved");
  const excluded = r.rows.filter((x) => x.resolution_state !== "resolved");
  const isSingleFund = resolved.length === 1;

  return (
    <div className="space-y-8">
      <IdentityStrip result={r} resolved={resolved} excluded={excluded} />

      {r.coverage_state === "suppress" ? (
        <Suppressed result={r} />
      ) : (
        <>
          <FeeGap result={r} />
          <PassiveBlend result={r} isSingleFund={isSingleFund} />
          <ExposureXray result={r} />
        </>
      )}

      <SourceFooter result={r} />
    </div>
  );
}

// --- Identity strip (spec § Section 2) -------------------------------------

function IdentityStrip({
  result: r,
  resolved,
  excluded,
}: {
  result: SolveResult;
  resolved: SolverRow[];
  excluded: SolverRow[];
}) {
  // AUM-weighted active/passive split across resolved fund/ETF holdings. The
  // solver gives us each row's normalized weight + security_type; is_passive
  // isn't on the row payload, so we infer the passive sleeve from the holdings
  // we can confirm are index vehicles is NOT possible here — instead we report
  // the wrapper split (mutual fund / ETF / stock), which the row payload fully
  // supports, and leave active/passive to the per-fund profiles. This avoids
  // guessing a passive flag we don't have.
  const byType: Record<string, number> = {};
  let wsum = 0;
  for (const row of resolved) {
    const w = row.weight_pct ?? 0;
    wsum += w;
    byType[row.security_type] = (byType[row.security_type] ?? 0) + w;
  }
  const wrapperRows = Object.entries(byType)
    .map(([type, w]) => ({ type, share: wsum > 0 ? w / wsum : 0 }))
    .sort((a, b) => b.share - a.share);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Holdings analyzed" value={String(resolved.length)} />
        <Stat
          label="Eligible weight"
          value={fmtPct(r.eligible_weight_pct, 0)}
          sub={
            r.excluded_weight_pct > 0
              ? `${fmtPct(r.excluded_weight_pct, 0)} excluded`
              : undefined
          }
        />
        <Stat
          label="Wrapper split"
          value={
            wrapperRows.length
              ? wrapperRows
                  .map((w) => `${fmtPct(w.share, 0)} ${wrapperLabel(w.type)}`)
                  .join(" · ")
              : EM_DASH
          }
        />
        <Stat
          label="Coverage"
          value={coverageLabel(r.coverage_state)}
          tone={r.coverage_state === "available" ? "ok" : "warn"}
        />
      </div>

      {excluded.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Excluded from analysis:{" "}
          {excluded.map((e, i) => (
            <span key={e.raw_ticker}>
              {i > 0 && ", "}
              <span className="font-semibold">{e.raw_ticker}</span> (
              {(e.exclusion_reason ?? "unsupported").replace(/_/g, " ")})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Suppressed (no good passive alternative) ------------------------------

function Suppressed({ result: r }: { result: SolveResult }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
      <h2 className="text-lg font-bold text-gray-900">
        No good passive alternative for this portfolio
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        We couldn&apos;t solve a single passive ETF blend that honestly tracks
        this combination of holdings, so we suppress the comparison rather than
        force a blend that wouldn&apos;t fit.
      </p>
      <p className="mt-3 text-xs text-gray-500">
        Reason: <span className="font-mono">{r.suppression_reason ?? "unknown"}</span>
      </p>
    </div>
  );
}

// --- Aggregate fee gap (spec § Section 4) ----------------------------------

function FeeGap({ result: r }: { result: SolveResult }) {
  const fee = r.fee;
  const feeMissing = fee.coverage_state === "missing" || fee.fee_gap_bps == null;

  return (
    <Section
      title="Aggregate fee gap"
      subtitle="Your blended fee versus the blended fee of the passive alternative."
      methodologyAnchor="fee-fairness"
    >
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {feeMissing ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            We can&apos;t show a blended fee gap for this portfolio: the matched
            passive vehicle has no SEC-filed expense ratio, so we leave the
            comparison unavailable rather than invent a fee.
            {fee.portfolio_er_bps != null && (
              <span className="mt-1 block text-gray-500">
                Your blended expense ratio is {fmtBps(fee.portfolio_er_bps)}.
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Your blended fee" value={fmtBps(fee.portfolio_er_bps)} />
              <Stat label="Passive blend fee" value={fmtBps(fee.blend_er_bps)} />
              <Stat
                label="Blended fee gap"
                value={fmtSignedBps(fee.fee_gap_bps)}
                emphasis
                tone={(fee.fee_gap_bps ?? 0) > 0 ? "warn" : "ok"}
              />
            </div>

            <div className="mt-5 rounded-lg bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                What the fee gap costs per year
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <FeeGapDollar gapBps={fee.fee_gap_bps} notional={10000} />
                <FeeGapDollar gapBps={fee.fee_gap_bps} notional={100000} />
              </div>
            </div>

            {fee.coverage_state === "partial" && (
              <p className="mt-3 text-xs text-amber-700">
                Fee coverage is partial — some holdings or blend legs are missing
                a filed expense ratio, so the gap may understate or overstate.
              </p>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

function FeeGapDollar({
  gapBps,
  notional,
}: {
  gapBps: number | null;
  notional: number;
}) {
  const d = feeDollars(gapBps, notional);
  return (
    <div>
      <div className="text-xs text-gray-500">On {fmtDollars(notional)}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-gray-900">
        {d != null ? `${fmtDollars(d)}/yr` : EM_DASH}
      </div>
    </div>
  );
}

// --- Passive blend (spec § Section 4 — blend composition + fit) ------------

function PassiveBlend({
  result: r,
  isSingleFund,
}: {
  result: SolveResult;
  isSingleFund: boolean;
}) {
  return (
    <Section
      title="Closest passive alternative"
      subtitle={
        isSingleFund
          ? "For a single holding this is exactly the fund's own passive match."
          : "One passive ETF blend solved for the combined book — not a sum of per-fund matches."
      }
      methodologyAnchor="alternatives"
    >
      <div className="rounded-xl border border-gray-200 bg-white p-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 font-medium">ETF</th>
              <th className="px-3 py-2.5 text-right font-medium">Weight</th>
              <th className="px-3 py-2.5 text-right font-medium">Expense ratio</th>
            </tr>
          </thead>
          <tbody>
            {r.blend.map((b) => (
              <tr key={b.etf_ticker} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/funds/${b.etf_ticker.toLowerCase()}`}
                    className="font-semibold text-[#1466b8] hover:underline"
                  >
                    {b.etf_ticker}
                  </Link>
                  {b.etf_name && (
                    <span className="ml-2 text-gray-500">{b.etf_name}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                  {fmtPct(b.weight_pct, 1)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                  {b.expense_ratio_bps != null ? fmtBps(b.expense_ratio_bps) : (
                    <span className="text-gray-400">no filed fee</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        Fit: R² {r.fit.r_squared != null ? r.fit.r_squared.toFixed(3) : EM_DASH} ·
        tracking error {fmtBps(r.fit.tracking_error_bps)} · {r.fit.n_obs ?? EM_DASH}{" "}
        weekly observations ({r.fit.fit_quality_label}). Window{" "}
        {fmtDate(r.fit.window_start)} → {fmtDate(r.fit.window_end)}. A higher R²
        and lower tracking error mean the blend tracks your portfolio more
        closely.
      </p>
    </Section>
  );
}

// --- Aggregate exposure x-ray (spec § Section 5) ---------------------------

function ExposureXray({ result: r }: { result: SolveResult }) {
  const ex = r.exposure;
  const rows = ex.rows ?? [];
  const hasBlend = rows.some((x) => x.passive_blend_exposure != null);
  const [from, to] = ex.as_of_range;
  const stale = ex.coverage_state === "stale";

  if (ex.coverage_state === "missing" || rows.length === 0) {
    return (
      <Section
        title="Aggregate exposure x-ray"
        subtitle="What your portfolio is exposed to, by sector, versus the passive blend."
        methodologyAnchor="exposure-xray"
      >
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          We don&apos;t have current holdings to break your portfolio&apos;s
          sector exposure down — so we suppress this rather than guess.
        </div>
      </Section>
    );
  }

  // Largest absolute difference first when we have a passive blend to compare.
  const sorted = [...rows].sort((a, b) => {
    const ad = Math.abs(a.difference ?? a.portfolio_exposure ?? 0);
    const bd = Math.abs(b.difference ?? b.portfolio_exposure ?? 0);
    return bd - ad;
  });

  return (
    <Section
      title="Aggregate exposure x-ray"
      subtitle={
        hasBlend
          ? "Your portfolio's sector mix versus the passive blend — the active sector tilts."
          : "Your portfolio's sector mix (no comparable passive holdings to difference against)."
      }
      methodologyAnchor="exposure-xray"
    >
      {stale && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Holdings older than our 180-day freshness threshold — read tilts with
          caution.
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-0 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2.5 font-medium">Sector</th>
              <th className="px-3 py-2.5 text-right font-medium">Portfolio</th>
              {hasBlend && (
                <th className="px-3 py-2.5 text-right font-medium">Passive blend</th>
              )}
              {hasBlend && (
                <th className="px-3 py-2.5 text-right font-medium">Difference</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.exposure_id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {row.exposure_name ?? "Unknown"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                  {fmtPct(row.portfolio_exposure)}
                </td>
                {hasBlend && (
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                    {row.passive_blend_exposure != null
                      ? fmtPct(row.passive_blend_exposure)
                      : EM_DASH}
                  </td>
                )}
                {hasBlend && (
                  <td className="px-3 py-2.5 text-right">
                    <DiffPill pp={row.difference} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        Holdings as of {fmtDate(from)}
        {to && to !== from ? ` to ${fmtDate(to)}` : ""}. AUM-weighted by your
        entered weights; sectors mapped through reference data. Method{" "}
        {ex.method_version}. SEC holdings are filed with a lag — the most recent
        portfolio may differ from the filed snapshot.
      </p>
    </Section>
  );
}

function DiffPill({ pp }: { pp: number | null }) {
  if (pp == null) return <span className="text-gray-400">{EM_DASH}</span>;
  if (Math.abs(pp) < 0.05) return <span className="text-xs text-gray-400">~0 pp</span>;
  const pos = pp > 0;
  const sign = pos ? "+" : "−";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        pos ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {sign}
      {Math.abs(pp).toFixed(1)} pp
    </span>
  );
}

// --- Source footer ---------------------------------------------------------

function SourceFooter({ result: r }: { result: SolveResult }) {
  return (
    <div className="border-t border-gray-200 pt-5 text-xs leading-relaxed text-gray-400">
      <p>
        Passive blend solved live for your portfolio with FundScore&apos;s
        L2-style tracking-error optimizer ({r.solver_version}), refit{" "}
        {r.as_of_date}. Expense ratios from SEC MFRR / prospectus filings; sector
        exposure from N-PORT holdings mapped through reference data. The Portfolio
        X-Ray is an informational calculator — it shows how the holdings you
        entered compare with a passive blend and source data. It is not a
        recommendation to buy, sell, hold, replace, or rebalance any investment.
      </p>
      <p className="mt-2">
        <Link href="/methodology#alternatives" className="hover:text-[#1466b8] hover:underline">
          How we choose the passive blend →
        </Link>
        <span className="mx-2">·</span>
        <Link href="/methodology#fee-fairness" className="hover:text-[#1466b8] hover:underline">
          How we compute the fee gap →
        </Link>
        <span className="mx-2">·</span>
        <Link href="/methodology#exposure-xray" className="hover:text-[#1466b8] hover:underline">
          How we build the exposure x-ray →
        </Link>
      </p>
    </div>
  );
}

// --- shared bits -----------------------------------------------------------

function Section({
  title,
  subtitle,
  methodologyAnchor,
  children,
}: {
  title: string;
  subtitle?: string;
  methodologyAnchor?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {methodologyAnchor && (
          <Link
            href={`/methodology#${methodologyAnchor}`}
            className="shrink-0 text-xs text-gray-400 hover:text-[#1466b8] hover:underline"
          >
            How we calculate this →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
  tone?: "ok" | "warn";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-gray-900";
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div
        className={`mt-0.5 tabular-nums ${
          emphasis ? "text-xl font-bold" : "text-base font-semibold"
        } ${toneClass}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function wrapperLabel(t: string): string {
  switch (t) {
    case "mutual_fund":
      return "funds";
    case "etf":
      return "ETF";
    case "stock":
      return "stocks";
    default:
      return t;
  }
}

function coverageLabel(state: string): string {
  switch (state) {
    case "available":
      return "Full";
    case "partial":
      return "Partial";
    case "suppress":
      return "Suppressed";
    default:
      return state;
  }
}
