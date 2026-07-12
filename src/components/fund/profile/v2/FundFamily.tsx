// ============================================================================
// 08 · FundFamily — the adviser-level leaderboard + the family's largest scored
// funds. SERVED fund_family_panel (fund-family-panel, gate: FREE). Two bases,
// two columns, never blended: the SI columns are Value Score bps (shrunk, net,
// vs each fund's OWN passive alternative); the 3Y columns are realized
// after-fee β-adjusted excess from the nav-series matched window. Families
// under 5 scored funds are honestly "too small to rank" (ranking_status) —
// aggregates still shown, no rank invented.
// ============================================================================
import Link from "next/link";
import type { FundFamilyPanel } from "@/lib/serving/profile-v2";
import { fmtSignedBps, fmtAum, EM_DASH } from "@/lib/serving/format";
import { ChapterHeader, Panel, PanelHead, PanelNote } from "./primitives";
import { Unavailable, LockedNotice } from "../primitives";

const bpsCls = (v: number | null | undefined) =>
  v == null ? "text-gray-400" : v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-gray-500";

export function FundFamily({
  family,
  present,
  free,
}: {
  // `family` is passed only when the caller is free-entitled (gated data never
  // reaches an anon client); `present` says the served section exists so the
  // gated state reads "locked", not "unavailable".
  family: FundFamilyPanel | null;
  present: boolean;
  free: boolean;
}) {
  if (!present) {
    return (
      <section id="s8" className="scroll-mt-24">
        <ChapterHeader index={8} title="Fund family" />
        <Unavailable>
          A family-level value comparison isn&apos;t served for this fund yet.
        </Unavailable>
      </section>
    );
  }

  if (!free || !family) {
    return (
      <section id="s8" className="scroll-mt-24">
        <ChapterHeader index={8} title="Fund family" />
        <LockedNotice tier="free">
          See how this fund&apos;s family ranks among fund families on after-fee
          value, and where the fund sits among its family&apos;s largest funds.
        </LockedNotice>
      </section>
    );
  }

  const display = family.family_display ?? family.family ?? "This family";
  const ranked = family.family_rank != null;
  const aumRange =
    family.aum_as_of_date_min != null && family.aum_as_of_date_max != null
      ? family.aum_as_of_date_min === family.aum_as_of_date_max
        ? `AUM as of ${family.aum_as_of_date_max}`
        : `AUM as of ${family.aum_as_of_date_min}–${family.aum_as_of_date_max}`
      : null;

  return (
    <section id="s8" className="scroll-mt-24">
      <ChapterHeader
        index={8}
        title="Fund family"
        asOf={
          [family.as_of ? `value as of ${family.as_of}` : null, aumRange]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        takeaway={
          ranked ? (
            <>
              {display} ranks{" "}
              <span className="tabular-nums">
                {family.family_rank} of {family.n_families_ranked ?? EM_DASH}
              </span>{" "}
              fund families on AUM-weighted after-fee value:{" "}
              <span className={`tabular-nums ${bpsCls(family.aum_weighted_value_bps)}`}>
                {fmtSignedBps(family.aum_weighted_value_bps)}/yr
              </span>{" "}
              across {family.n_funds_scored ?? EM_DASH} scored funds
              {family.total_scored_aum_usd != null ? ` (${fmtAum(family.total_scored_aum_usd)})` : ""}.
            </>
          ) : (
            <>
              {display} has {family.n_funds_scored ?? EM_DASH} scored fund
              {(family.n_funds_scored ?? 0) === 1 ? "" : "s"} — too small a family to
              rank (ranking needs at least 5). Its own read:{" "}
              <span className={`tabular-nums ${bpsCls(family.aum_weighted_value_bps)}`}>
                {fmtSignedBps(family.aum_weighted_value_bps)}/yr
              </span>{" "}
              AUM-weighted after-fee value
              {family.total_scored_aum_usd != null ? ` (${fmtAum(family.total_scored_aum_usd)})` : ""}.
            </>
          )
        }
        sub={
          <>
            Two averages, both shown: <b>AUM-weighted {fmtSignedBps(family.aum_weighted_value_bps)}/yr</b>{" "}
            counts every invested dollar equally; the <b>simple average is{" "}
            {fmtSignedBps(family.avg_value_bps)}/yr</b>
            {/* Equal / near-equal averages must not assert a "gap" (an n=1
                family's are identical by construction — DQ-critic P2). */}
            {Math.abs((family.aum_weighted_value_bps ?? 0) - (family.avg_value_bps ?? 0)) < 0.5 ? (
              <> — the two agree: its biggest funds have done about the same as its typical fund.</>
            ) : (
              <>
                {" "}
                — the gap means the family&apos;s biggest funds have done{" "}
                {(family.aum_weighted_value_bps ?? 0) > (family.avg_value_bps ?? 0)
                  ? "better"
                  : "worse"}{" "}
                than its typical fund.
              </>
            )}
          </>
        }
      />

      {/* Leaderboard */}
      {family.leaders && family.leaders.length > 0 && (
        <Panel className="p-0">
          <PanelHead
            title="Family leaderboard — AUM-weighted net value vs each fund's own passive alternative"
            right={
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span>families with ≥5 scored funds · since-inception basis</span>
                <Link
                  href="/methodology#fund-family"
                  className="shrink-0 hover:text-[#1466b8] hover:underline"
                >
                  How we calculate this →
                </Link>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-gray-200 text-right text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-2.5 text-left font-semibold">Rank</th>
                  <th className="px-5 py-2.5 text-left font-semibold">Family</th>
                  <th className="px-5 py-2.5 font-semibold">Scored funds</th>
                  <th className="px-5 py-2.5 font-semibold">AUM-wtd bps/yr</th>
                  <th className="px-5 py-2.5 font-semibold">Simple avg bps/yr</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {family.leaders.map((l) => {
                  const own = ranked && l.rank === family.family_rank;
                  return (
                    <tr
                      key={l.rank}
                      className={`border-b border-gray-50 text-right last:border-0 ${own ? "bg-gray-50 shadow-[inset_3px_0_0_#111827]" : ""}`}
                    >
                      <td className="px-5 py-2.5 text-left font-semibold text-gray-700">{l.rank}</td>
                      <td className="px-5 py-2.5 text-left font-semibold text-gray-900">{l.family}</td>
                      <td className="px-5 py-2.5 text-gray-600">{l.n_funds}</td>
                      <td className={`px-5 py-2.5 font-bold ${bpsCls(l.aum_weighted_bps)}`}>
                        {fmtSignedBps(l.aum_weighted_bps)}
                      </td>
                      <td className={`px-5 py-2.5 font-bold ${bpsCls(l.avg_bps)}`}>
                        {fmtSignedBps(l.avg_bps)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!ranked && (
            <PanelNote>
              {display} does not appear on this board — families need at least 5 scored
              funds to be ranked.
            </PanelNote>
          )}
        </Panel>
      )}

      {/* Family's largest scored funds */}
      {family.funds && family.funds.length > 0 && (
        <Panel className="p-0">
          <PanelHead
            title={`${display}'s largest scored funds`}
            asOf="net value vs each fund's own closest passive alternative"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-gray-200 text-right text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-2.5 text-left font-semibold">Fund</th>
                  <th className="px-5 py-2.5 font-semibold">Net value bps/yr</th>
                  <th className="px-5 py-2.5 font-semibold">AUM</th>
                  <th className="px-5 py-2.5 font-semibold">Passive alt</th>
                  <th className="px-5 py-2.5 font-semibold">3Y α bps/yr (β-adj)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {family.funds.map((fund) => (
                  <tr
                    key={fund.ticker}
                    className={`border-b border-gray-50 text-right last:border-0 ${fund.is_this_fund ? "bg-gray-50 shadow-[inset_3px_0_0_#111827]" : ""}`}
                  >
                    <td className="px-5 py-2.5 text-left">
                      <span className="font-semibold text-gray-900">{fund.ticker}</span>
                      {fund.name && (
                        <span className="block text-[11px] font-normal text-gray-500">
                          {fund.name}
                          {fund.is_this_fund ? " — this fund" : ""}
                        </span>
                      )}
                    </td>
                    <td className={`px-5 py-2.5 font-bold ${bpsCls(fund.value_bps)}`}>
                      {fmtSignedBps(fund.value_bps)}
                    </td>
                    <td className="px-5 py-2.5 text-gray-600">
                      {/* Unit-aware — a $105M fund must not render as "0.1". */}
                      {fund.aum_usd != null ? fmtAum(fund.aum_usd) : EM_DASH}
                    </td>
                    <td className="px-5 py-2.5 text-gray-600">{fund.passive_alt_label ?? EM_DASH}</td>
                    <td className={`px-5 py-2.5 font-bold ${bpsCls(fund.value_bps_3y)}`}>
                      {fmtSignedBps(fund.value_bps_3y)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PanelNote>
            Two bases, two columns — never added: <b>Net value</b> is the Value Score
            (since each fund&apos;s paired window, after fees, deliberately shrunk
            because the signal is mostly noise); <b>3Y α</b> is the realized
            beta-adjusted excess over the fund&apos;s passive alternative across the
            last three years, after fees — a raw realized read, not a shrunk score.
            Funds without a 3Y matched window show {EM_DASH}, never an estimate.
            Values are vs each fund&apos;s own closest passive alternative (named per
            row).
          </PanelNote>
        </Panel>
      )}
    </section>
  );
}
