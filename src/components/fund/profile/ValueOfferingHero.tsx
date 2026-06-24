// ============================================================================
// Value Offering hero — the reframed v0.3 BADGE typology (spec #7).
// Two non-predictive axes: judged selection (Axis A) and the neutral bet
// profile (Axis B). Always shown next to the named passive baseline. The 0-100
// value_index is paid-tier; anon/free see the badge + bet + take only.
// ============================================================================
import Link from "next/link";
import {
  badgeStyle,
  fmtBps,
  fmtPct,
  skillBandLabel,
} from "@/lib/serving/format";
import type {
  PassiveBaseline,
  ValueOfferingReframed,
  TheTake,
} from "@/lib/serving/profile";
import { Chip, Evidence } from "./primitives";

export function ValueOfferingHero({
  vr,
  passive,
  theTake,
}: {
  vr: ValueOfferingReframed | null;
  passive: PassiveBaseline | null;
  theTake: TheTake | null;
}) {
  const scored = vr?.status === "scored" && vr.badge;
  const style = badgeStyle(vr?.badge);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header band */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-[#13483a] to-[#1f6b54] px-6 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-50">
          Value Offering
        </span>
        <Link
          href="/methodology#value-offering"
          className="text-xs text-emerald-100/90 hover:text-white hover:underline"
        >
          How we calculate this →
        </Link>
      </div>

      <div className="px-6 py-6">
        {/* Passive baseline anchor — required in the same viewport as the score */}
        {passive?.display_name ? (
          <p className="mb-4 text-sm text-gray-600">
            Read against its closest passive alternative:{" "}
            <span className="font-semibold text-gray-900">
              {passive.display_name}
            </span>
            {passive.etf_weights && passive.etf_weights.length > 1 && (
              <span className="text-gray-500">
                {" "}
                ({passive.etf_weights.map((w) => w.etf).join(" / ")})
              </span>
            )}
          </p>
        ) : (
          <p className="mb-4 text-sm text-gray-500">
            We could not match a passive alternative for this fund, so the
            passive-relative read is limited.
          </p>
        )}

        {scored ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <Chip className={`px-3 py-1 text-base font-bold ${style.chip}`}>
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                {vr!.badge}
              </Chip>

              {/* 0-100 value_index — paid/pro only */}
              {vr!.value_index != null ? (
                <span className="text-3xl font-extrabold tabular-nums text-gray-900">
                  {vr!.value_index}
                  <span className="text-base font-medium text-gray-400">
                    /100
                  </span>
                </span>
              ) : vr!.locked_fields?.includes("value_index") ? (
                <Link
                  href="/signin"
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Unlock the 0–100 index (paid) →
                </Link>
              ) : null}
            </div>

            {/* The bet profile (Axis B) + skill band (Axis A) */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <AxisCard
                label="What kind of bet"
                value={vr!.bet_tag ?? "—"}
                detail={
                  vr!.replicability?.idio_risk_share != null
                    ? `${fmtPct(
                        vr!.replicability.idio_risk_share,
                        0,
                      )} of its active risk is stock-specific; the rest is shared sector/theme risk.`
                    : null
                }
              />
              <AxisCard
                label="Selection evidence"
                value={skillBandLabel(vr!.skill_band)}
                detail={
                  vr!.skill?.ir != null
                    ? `Information ratio ${vr!.skill.ir.toFixed(
                        2,
                      )} after fees and passive exposures.`
                    : null
                }
              />
            </div>

            {/* The Take — one-sentence synthesis */}
            {theTake?.assembled_text && (
              <p className="mt-5 border-l-2 border-emerald-300 pl-4 text-[15px] leading-relaxed text-gray-800">
                {theTake.assembled_text}
              </p>
            )}

            {/* Evidence drawer */}
            <Evidence summary="What's behind this read">
              <ul className="space-y-1">
                <li>
                  Fee: {fmtBps(vr!.fee?.active_fee_bps)} above the closest passive
                  mix (you pay {fmtBps(vr!.fee?.actual_fee_bps)} total).
                </li>
                {vr!.skill?.gross_alpha_bps != null && (
                  <li>
                    Gross selection alpha:{" "}
                    {fmtBps(vr!.skill.gross_alpha_bps)}/yr (before fees), P(positive
                    skill) {fmtPct(vr!.skill.p_positive_skill, 0)}.
                  </li>
                )}
                {vr!.replicability?.theme_ride_delta_bps != null && (
                  <li>
                    Theme-ride check:{" "}
                    {fmtBps(vr!.replicability.theme_ride_delta_bps)}/yr of the edge
                    traces to its concentrated theme tilt.
                  </li>
                )}
                <li className="text-gray-400">
                  Method {vr!.method_version} · skill as of{" "}
                  {vr!.skill_as_of ?? "—"} · holdings as of{" "}
                  {vr!.holdings_as_of ?? "—"}
                </li>
              </ul>
            </Evidence>

            <p className="mt-4 text-xs leading-relaxed text-gray-400">
              This is a current-state read of whether the fund is a reasonable way
              to get its exposure and manager — not a prediction, a probability of
              beating the market, or a buy/sell recommendation.
            </p>
          </>
        ) : (
          <UnscoredHero vr={vr} />
        )}
      </div>
    </div>
  );
}

function AxisCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string | null;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold text-gray-900">{value}</div>
      {detail && <p className="mt-1 text-xs leading-relaxed text-gray-500">{detail}</p>}
    </div>
  );
}

function UnscoredHero({ vr }: { vr: ValueOfferingReframed | null }) {
  const reason = vr?.suppression_reason;
  let message =
    "A Value Offering read isn't available for this fund. It is computed for active equity funds with sufficient return and holdings history.";
  if (reason === "passive_fund_non_applicable") {
    message =
      "This fund is classified as passive/index, so the selection-and-bet read does not apply. Below, we show what exposure it delivers and how its cost compares with similar passive vehicles.";
  } else if (vr?.status === "building" || vr?.skill_band === null) {
    message =
      "Building track record — there isn't yet enough return history to judge this fund's stock selection. We show what we can support and suppress the rest.";
  }
  return <p className="text-sm leading-relaxed text-gray-600">{message}</p>;
}
