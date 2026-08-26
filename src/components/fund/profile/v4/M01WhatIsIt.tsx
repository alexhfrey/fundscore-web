// ============================================================================
// Movement 01 · #whatis — what is it (the mix, and the active layer).
// ----------------------------------------------------------------------------
// Card 1 "what moves this fund"  — SERVED (passive_baseline + te_decomposition)
// Card 2 "what it holds differently" — NOT BUILT HERE. The holdings-vs-twin diff
//        is backend item L9's deliverable and is fenced out of this build; the
//        slot renders its honest reason. (Note for L9: `exposure_xray.rows[]`
//        already serves sector / country_region / stock rows at
//        `holdings_baseline='vs_benchmark'`, `baseline_ref='l2_passive_blend'`,
//        with fund_exposure, passive_exposure, difference and BOTH as-of dates,
//        at gate `free`.)
// Card 3 "what moves it differently" — SERVED (te_decomposition.bets).
// Posline "biggest recent move" — SERVED (positioning_changes, gate `free`,
//        `positioning_changes_v0.3_no_expansion`). Flipped 2026-08-25 when
//        `recent-changes-te-ranked` shipped; before that the slot carried a
//        hold-back note. It renders ONE change, chosen by the served TE-impact
//        rank, and renders nothing but its reason for the 2,782 funds that have
//        no significance-ranked change to name. See `buildRecentMove`.
//
// BASIS DISCIPLINE, the two traps this movement exists to avoid:
//  1. The bigbar and the unroll are measured over DIFFERENT windows (the twin's
//     fit window vs the te-decomposition's 3y weekly window). They are drawn as
//     two separate strips, each labelled with its own window — never as one
//     arithmetic subdivision.
//  2. `te_alloc_bps` is a CONTRIBUTION TO TRACKING ERROR, not a standalone
//     dollar swing. The mockup's "can swing a year by ±$N" column needs a
//     per-bet σ_factor (`standalone_te_bps`) that is NOT served, so that column
//     does not exist here and the served figure keeps its own name.
// ============================================================================

import { directionWords } from "@/components/fund/profile/v2/format";
import { EM_DASH } from "@/lib/serving/format";
import {
  Absent,
  Caption,
  Card,
  CardLabel,
  LockedNote,
  MethodLink,
  Movement,
  PosLine,
  Takeaway,
} from "./chrome";
import {
  buildActiveMix,
  buildConcentration,
  buildRecentMove,
  buildTwin,
  fmtBpsAsPct,
  kindAdjective,
  listPhrase,
  longDay,
  ownShare,
  type ActiveMixView,
  type RecentMoveView,
  type TwinView,
} from "./derive";

/** Last-resort reason. `Absent` must NEVER render an empty explanation. */
const FALLBACK_REASON =
  "The served data this needs is not available for this fund, so we withhold it rather than estimate it.";

/** The ordered gold ramp for the active-layer slices. Reads the crescent accent
 *  token so it tracks the light/dark/accent swap instead of hardcoding hex. */
const RAMP = [1, 0.78, 0.58, 0.42, 0.3, 0.22];

function sliceColor(i: number): string {
  return `color-mix(in srgb, var(--crescent-accent) ${Math.round(
    (RAMP[Math.min(i, RAMP.length - 1)] ?? 0.22) * 100,
  )}%, transparent)`;
}

/** The twin-vs-own bar. One window, named underneath. */
function BigBar({ twin, own }: { twin: TwinView; own: number }) {
  return (
    <>
      <div className="flex h-[34px] overflow-hidden rounded-lg" role="img" aria-label={`The twin reproduces ${((1 - own) * 100).toFixed(1)}% of this fund's week-to-week returns; ${(own * 100).toFixed(1)}% is its own`}>
        <div
          className="border-r border-gray-300 bg-crescent-twin"
          style={{ width: `${(1 - own) * 100}%` }}
        />
        <div style={{ width: `${own * 100}%`, background: sliceColor(0) }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-gray-400">
        <span>
          the twin · {((1 - own) * 100).toFixed(1)}%
          {twin.mixLabel ? ` — ${twin.mixLabel}` : ""}
        </span>
        <span>its own · {(own * 100).toFixed(1)}%</span>
      </div>
    </>
  );
}

/** The active layer unrolled by kind. A SEPARATE strip on its OWN window. */
function Unroll({ mix }: { mix: ActiveMixView }) {
  const total = mix.slices.reduce((a, s) => a + s.shareOfActive, 0);
  if (total <= 0) return null;
  return (
    <>
      <div className="flex h-[26px] overflow-hidden rounded-lg" role="img" aria-label="How the fund's active risk splits by kind of bet">
        {mix.slices.map((s, i) => (
          <div
            key={s.kind}
            style={{ width: `${(s.shareOfActive / total) * 100}%`, background: sliceColor(i) }}
            title={`${s.label} — ${(s.shareOfActive * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <dl className="mt-3.5 grid gap-2.5">
        {mix.slices.map((s, i) => (
          <div key={s.kind} className="grid grid-cols-[14px_1fr_120px] items-baseline gap-3">
            <span
              className="relative top-[1px] block h-3 w-3 rounded-[3px]"
              style={{ background: sliceColor(i) }}
            />
            <dt className="text-sm text-gray-900">
              <b className="font-semibold">
                {s.label} — {(s.shareOfActive * 100).toFixed(1)}%
              </b>
            </dt>
            <dd className="text-right font-mono text-[12.5px] text-gray-700">
              {s.kind === "selection"
                ? "stock picking"
                : s.nBets != null
                  ? `${s.nBets} bet${s.nBets === 1 ? "" : "s"}`
                  : EM_DASH}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** The bets table — direction + contribution to tracking error. No swing column. */
function BetsTableV4({ mix }: { mix: ActiveMixView }) {
  const rows = [...mix.namedBets]
    .filter((b) => b.teAllocBps != null)
    .sort((a, b) => Math.abs(b.teAllocBps ?? 0) - Math.abs(a.teAllocBps ?? 0));
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border-b border-gray-200 px-2 py-1.5 text-left font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Source of movement
            </th>
            <th className="border-b border-gray-200 px-2 py-1.5 text-right font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Side of the twin
            </th>
            <th className="border-b border-gray-200 px-2 py-1.5 text-right font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Adds to tracking error
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const dw = directionWords(b.kind, b.direction);
            return (
              <tr key={`${b.factorId ?? b.label}`}>
                <td className="border-b border-gray-100 px-2 py-2 text-left font-semibold text-gray-900">
                  {b.label}
                  <small className="block font-normal text-[11px] text-gray-500">
                    {kindAdjective(b.kind)}
                    {b.diversifying ? " · reduces total tracking error" : ""}
                  </small>
                </td>
                <td className="border-b border-gray-100 px-2 py-2 text-right font-mono text-[12.5px] text-gray-700">
                  {dw ? <span title={dw.title}>{dw.short}</span> : EM_DASH}
                </td>
                <td className="border-b border-gray-100 px-2 py-2 text-right font-mono text-[12.5px] text-gray-900">
                  {fmtBpsAsPct(b.teAllocBps, 2)}/yr
                </td>
              </tr>
            );
          })}
          {mix.otherBets != null ? (
            <tr>
              <td className="border-b border-gray-100 px-2 py-2 text-left italic text-gray-500">
                {mix.otherBets.label}
                <small className="block text-[11px] not-italic">
                  each too small to name on its own
                </small>
              </td>
              <td className="border-b border-gray-100 px-2 py-2 text-right font-mono text-[12.5px] text-gray-400">
                {EM_DASH}
              </td>
              <td className="border-b border-gray-100 px-2 py-2 text-right font-mono text-[12.5px] text-gray-500">
                {mix.otherBets.shareOfActive != null
                  ? `${(mix.otherBets.shareOfActive * 100).toFixed(1)}% of the active risk`
                  : EM_DASH}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The "biggest recent move" posline — one change out of the served
 * year-over-year holdings diff, chosen by ESTIMATED tracking-error impact.
 *
 * Two things this markup is responsible for, both non-negotiable:
 *
 *  1. THE DUAL AS-OF STAMPS. Every figure is attached to the filing it came
 *     from, in the same breath. The two filings are a year apart and the later
 *     one is itself 30-61 days behind the calendar, so a single date would let a
 *     reader take a stale weight for a current one. There is deliberately no
 *     branch that renders one stamp without the other — `buildRecentMove`
 *     refuses a row missing either.
 *  2. THE RANKING BASIS, IN WORDS, WITH "ESTIMATED" IN IT. The backend spec's
 *     data-integrity guardrail requires the estimate to be labelled as an
 *     estimate; the cutover spec requires the ranking to be, and to be seen to
 *     be, by significance rather than size. Where the two rankings disagree —
 *     58.8% of eligible funds — the loudest change is named too, so the claim
 *     can be checked rather than taken on trust.
 *
 * The label itself is conditioned on `earnedSuperlative`: "biggest" is only said
 * when the served row is te_rank 1.
 */
function RecentMovePosLine({ view }: { view: RecentMoveView }) {
  const m = view.move;
  if (m == null) {
    return (
      <PosLine>
        <b>Biggest recent move:</b>{" "}
        <span className="text-gray-500">{view.reason ?? FALLBACK_REASON}</span>
      </PosLine>
    );
  }

  // "META" for a single position; the others need naming as what they are.
  const subject =
    m.changeType === "sector"
      ? `its ${m.name} sector`
      : m.changeType === "theme"
        ? `its ${m.name} theme`
        : m.name;

  // A null side is rendered as "no weight" ONLY when the served direction says
  // so — `entered` had no prior book line, `exited` has no current one. Any
  // other null is drift and gets an em dash, never an invented zero. The
  // "of the portfolio" qualifier rides the FIRST side that is actually a
  // percentage, so an entered position reads "no weight … then 1.9% of the
  // portfolio" rather than "no weight of the portfolio".
  const priorPct = m.priorPct != null ? `${m.priorPct.toFixed(1)}%` : null;
  const currentPct = m.currentPct != null ? `${m.currentPct.toFixed(1)}%` : null;
  const priorText =
    priorPct != null
      ? `${priorPct} of the portfolio`
      : m.direction === "entered"
        ? "no weight"
        : EM_DASH;
  const currentText =
    currentPct != null
      ? priorPct != null
        ? currentPct
        : `${currentPct} of the portfolio`
      : m.direction === "exited"
        ? "no weight"
        : EM_DASH;

  return (
    <PosLine>
      <b>{m.earnedSuperlative ? "Biggest recent move:" : "A recent move that mattered:"}</b>{" "}
      {subject} &mdash; {priorText} in holdings filed{" "}
      {longDay(m.asOfPrior) ?? m.asOfPrior}, {currentText} in holdings filed{" "}
      {longDay(m.asOfCurrent) ?? m.asOfCurrent}. Ranked by its estimated effect on the
      fund&rsquo;s risk rather than by the size of the change
      {m.largestBySize ? <>; the biggest change by size was {m.largestBySize}</> : null}.
      {m.earnedSuperlative ? null : (
        <>
          {" "}
          Changes that scored higher are not shown for this fund, so this is not necessarily its
          largest.
        </>
      )}{" "}
      <MethodLink anchor="positioning-changes" />
    </PosLine>
  );
}

export interface M01Props {
  passiveBaseline: Parameters<typeof buildTwin>[0];
  valueScoreReplicaR2: number | null;
  teDecomposition: Parameters<typeof buildActiveMix>[0];
  teProof: Parameters<typeof buildActiveMix>[1];
  teLocked: boolean;
  exposureXray: { rows?: unknown[] } | null;
  /** The GATED `positioning_changes` value — full rows, the one-row locked proof
   *  point, or null. `buildRecentMove` resolves all three; see its header. */
  positioningChanges: unknown;
}

export function M01WhatIsIt({
  passiveBaseline,
  valueScoreReplicaR2,
  teDecomposition,
  teProof,
  teLocked,
  exposureXray,
  positioningChanges,
}: M01Props) {
  const twin = buildTwin(passiveBaseline, valueScoreReplicaR2);
  const recentMove = buildRecentMove(positioningChanges);
  const mix = buildActiveMix(teDecomposition, teProof);
  const conc = buildConcentration(exposureXray);
  const own = ownShare(twin);

  const headline =
    own != null && twin.legs.length > 0 ? (
      <>
        This fund is {((1 - own) * 100).toFixed(0)}% a{" "}
        {twin.legs.length === 1 ? "single-ETF" : `${twin.legs.length}-ETF`} mix. The other{" "}
        {(own * 100).toFixed(1)}% is the manager.
      </>
    ) : undefined;

  return (
    <Movement
      id="whatis"
      index="01"
      eyebrow="what is it — the mix, and the active layer under a microscope"
      headline={headline}
      standfirst={
        own != null ? (
          <>
            That {(own * 100).toFixed(1)}% is the only part you pay extra for. There are two ways
            to see it — what the manager <b>holds</b> differently from the twin, and what actually{" "}
            <b>moves</b> the fund differently. Different questions, and they do not always agree.
          </>
        ) : undefined
      }
    >
      {/* ---- Card 1 · what moves this fund -------------------------------- */}
      <Card>
        <CardLabel>What moves this fund</CardLabel>
        {own != null ? (
          <div className="mt-2.5">
            <BigBar twin={twin} own={own} />
            {twin.fitWindowStart && twin.fitWindowEnd ? (
              <p className="mt-2 font-mono text-[10px] text-gray-400">
                measured on weekly returns, {twin.fitWindowStart} → {twin.fitWindowEnd}
                {twin.fitWindowObs != null ? ` · ${twin.fitWindowObs} weeks` : ""}
              </p>
            ) : null}
          </div>
        ) : (
          <Absent
            what="The mix-versus-manager split"
            reason={twin.missingReason ?? FALLBACK_REASON}
            className="mt-2.5"
          />
        )}

        {mix.slices.length > 0 ? (
          <div className="mt-6 border-t border-dashed border-gray-200 pt-5">
            <CardLabel>
              And that active layer splits like this
              {mix.proofOnly ? " (summary view)" : ""}
            </CardLabel>
            <div className="mt-2.5">
              <Unroll mix={mix} />
            </div>
            <Caption>
              Shares of the fund&rsquo;s active risk, summing to 100%. Measured over three years of
              weekly returns
              {mix.windowStart && mix.windowEnd ? (
                <>
                  {" "}
                  ({longDay(mix.windowStart)} → {longDay(mix.windowEnd)})
                </>
              ) : null}
              {" "}
              — <b>a different window from the mix bar above</b>, so read this as how the active
              layer is composed, not as a slice-by-slice subdivision of that bar. Bets come from one
              fixed 35-factor vocabulary applied identically to every fund we grade, so countries and
              commodities get a seat rather than being crowded out by sectors.
              {mix.otherBets != null ? (
                <>
                  {" "}
                  Of the bets in that vocabulary, {mix.otherBets.nRolled} are individually too small
                  to name; they are already inside the slices above, not a slice of their own.
                </>
              ) : null}
              {mix.anchorLagWeeks != null ? (
                <>
                  {" "}
                  The factor data runs about {mix.anchorLagWeeks.toFixed(0)} weeks behind this
                  page&rsquo;s other figures — a structural lag in the source factor file, disclosed
                  rather than hidden.
                </>
              ) : null}{" "}
              <MethodLink anchor="te-decomposition" />
            </Caption>
          </div>
        ) : teLocked ? (
          <LockedNote what="The split of the fund's active layer" className="mt-4" />
        ) : (
          <Absent
            what="The split of the fund's active layer"
            reason={mix.missingReason ?? FALLBACK_REASON}
            className="mt-4"
          />
        )}
      </Card>

      {/* ---- Card 2 · what the manager holds differently ------------------- */}
      <Card>
        <CardLabel>What the manager holds differently</CardLabel>
        <Absent
          what="The position-by-position comparison against the twin"
          reason="Comparing what this fund holds against what its twin holds means looking through the twin's ETFs to the individual shares underneath, on the same day, on the fund's filed book. That comparison is still being built; until it is, we would rather show nothing here than a half-matched one."
          className="mt-2.5"
        />
      </Card>

      {/* ---- Card 3 · what moves it differently ---------------------------- */}
      <Card>
        <CardLabel>What moves it differently</CardLabel>
        {mix.namedBets.length > 0 ? (
          <>
            {mix.proofOnly ? (
              <Takeaway>
                One of the sources that moves this fund differently from its twin
              </Takeaway>
            ) : null}
            <BetsTableV4 mix={mix} />
            <Caption>
              Measured from three years of weekly returns
              {mix.windowStart && mix.windowEnd ? (
                <>
                  {" "}
                  ({longDay(mix.windowStart)} → {longDay(mix.windowEnd)})
                </>
              ) : null}
              , not from holdings. <b>These sources overlap</b> — a fund moving with Canadian miners
              also moves with gold and with broad commodities — so they are the same underlying
              movement seen from several angles. <b>They are not positions and do not correspond to
              what the fund holds.</b> The last column is how much each source <i>adds to the
              fund&rsquo;s tracking error</i> against its twin; it is not the amount that source
              alone could move a year&rsquo;s result, which is a different quantity we do not
              publish yet.
              {mix.teTotalBps != null ? (
                <>
                  {" "}
                  All of them together come to {fmtBpsAsPct(mix.teTotalBps)}/yr of tracking error.
                </>
              ) : null}{" "}
              <MethodLink anchor="te-decomposition" />
            </Caption>
          </>
        ) : teLocked ? (
          <LockedNote what="The named sources of movement" className="mt-2.5" />
        ) : (
          <Absent
            what="The named sources of movement"
            reason={mix.missingReason ?? FALLBACK_REASON}
            className="mt-2.5"
          />
        )}

        <PosLine>
          <b>How concentrated it is:</b>{" "}
          {conc.activeShare != null ? (
            <>
              {(conc.activeShare * 100).toFixed(1)}% of the portfolio differs from the twin
              {conc.activeShareAsOf ? `, on holdings filed ${conc.activeShareAsOf}` : ""}.
            </>
          ) : (
            <span className="text-gray-500">{conc.activeShareReason}</span>
          )}
        </PosLine>
        <RecentMovePosLine view={recentMove} />
      </Card>
    </Movement>
  );
}

/** Re-exported for the page's nav assembly. */
export const M01_TILT_HELPERS = { listPhrase, kindAdjective };
