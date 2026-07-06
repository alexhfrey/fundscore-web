// ============================================================================
// 08 · FundFamily — the adviser-level leaderboard + the family's largest scored
// funds. FIXTURE block (Sample chip, no methodology link). Gated FREE. The
// 3-year value column is an honest gap (pending the nav-series backend spec) —
// never estimated.
// ============================================================================
import type { FundFamilyPanel } from "@/lib/serving/profile-v2";
import { fmtSignedBps, fmtAum, EM_DASH } from "@/lib/serving/format";
import { ChapterHeader, Panel, PanelHead, PanelNote, SampleProvenance, GapChip } from "./primitives";
import { Unavailable, LockedNotice } from "../primitives";

const bpsCls = (v: number | null | undefined) =>
  v == null ? "text-gray-400" : v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-gray-500";

export function FundFamily({
  family,
  present,
  free,
}: {
  // `family` is passed only when the caller is free-entitled (gated data never
  // reaches an anon client); `present` says a fixture exists for this fund so
  // the gated state reads "locked", not "unavailable".
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
        <ChapterHeader index={8} title="Fund family" sample />
        <LockedNotice tier="free">
          See how this fund&apos;s family ranks among fund families on after-fee
          value, and where the fund sits among its family&apos;s largest funds.
        </LockedNotice>
      </section>
    );
  }

  const display = family.family_display ?? family.family ?? "This family";

  return (
    <section id="s8" className="scroll-mt-24">
      <ChapterHeader
        index={8}
        title="Fund family"
        asOf={family.as_of ? `as of ${family.as_of}` : undefined}
        takeaway={
          <>
            {display} ranks{" "}
            <span className="tabular-nums">
              {family.family_rank ?? EM_DASH} of {family.n_families_ranked ?? EM_DASH}
            </span>{" "}
            fund families on AUM-weighted after-fee value:{" "}
            <span className={`tabular-nums ${bpsCls(family.aum_weighted_value_bps)}`}>
              {fmtSignedBps(family.aum_weighted_value_bps)}/yr
            </span>{" "}
            across {family.n_funds_scored ?? EM_DASH} scored funds
            {family.total_scored_aum_usd != null ? ` (${fmtAum(family.total_scored_aum_usd)})` : ""}.
          </>
        }
        sub={
          <>
            Two averages, both shown: <b>AUM-weighted {fmtSignedBps(family.aum_weighted_value_bps)}/yr</b>{" "}
            counts every invested dollar equally; the <b>simple average is{" "}
            {fmtSignedBps(family.avg_value_bps)}/yr</b> — the gap means the family&apos;s
            biggest funds have done{" "}
            {(family.aum_weighted_value_bps ?? 0) > (family.avg_value_bps ?? 0) ? "better" : "worse"}{" "}
            than its typical fund.
          </>
        }
        sample
      />

      {/* Leaderboard */}
      {family.leaders && family.leaders.length > 0 && (
        <Panel className="p-0">
          <PanelHead
            title="Family leaderboard — AUM-weighted net value vs each fund's own passive alternative"
            asOf="families with ≥5 scored funds · since-inception basis"
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
                  const own = l.rank === family.family_rank;
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
          {family.rank_basis && <PanelNote>{family.rank_basis}</PanelNote>}
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
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-gray-200 text-right text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-2.5 text-left font-semibold">Fund</th>
                  <th className="px-5 py-2.5 font-semibold">Net value bps/yr</th>
                  <th className="px-5 py-2.5 font-semibold">AUM $B</th>
                  <th className="px-5 py-2.5 font-semibold">Passive alt</th>
                  <th className="px-5 py-2.5 font-semibold">3Y value</th>
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
                      {fund.aum_usd != null ? (fund.aum_usd / 1e9).toFixed(1) : EM_DASH}
                    </td>
                    <td className="px-5 py-2.5 text-gray-600">{fund.passive_alt_label ?? EM_DASH}</td>
                    <td className="px-5 py-2.5 italic text-gray-400">pending</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PanelNote>
            <span className="inline-flex items-center gap-2">
              <GapChip>3-year value in development</GapChip>
            </span>{" "}
            The 3-year value column ships when computed, never estimated. Values are
            since-inception, after fees, vs each fund&apos;s own closest passive
            alternative (named per row).
            <SampleProvenance label={family.sample_label} />
          </PanelNote>
        </Panel>
      )}
    </section>
  );
}
