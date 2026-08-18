// ============================================================================
// Movement 03 · #twin — the neighbourhood: before you judge the manager, judge
// the space.
// ----------------------------------------------------------------------------
// SERVED `fund_profile_facts.neighbourhood` (neighbourhood_v1_2026-08-09), gate
// `public`. Four cards, all straight reads of the served payload:
//   1  growth of $10,000 — the twin vs IVV / VT / BND, log scale, full life
//   2  up- and down-capture against world stocks
//   3  the twin's deepest drawdowns and how long back to even
//   4  calendar years, twin vs world stocks
//
// THE FOUR RULES THIS FILE EXISTS TO ENFORCE — each is an honesty requirement,
// not a styling choice:
//
//  1. THE TWIN LEG IS A HYPOTHETICAL BACKCAST. It holds today's matched mix
//     fixed and applies it to the past; nobody earned it. `buildNeighbourhood`
//     fails closed unless the payload carries BOTH `hypothetical: true` and
//     `mix_as_of`, and this component renders the "HYPOTHETICAL · MIX-AS-OF …"
//     chip from those two fields before any figure is shown. The tense follows:
//     the twin "would have turned", the single-fund reference legs "turned" —
//     those are real securities with real histories over the same window.
//  2. BND IS US INVESTMENT-GRADE, NOT GLOBAL BONDS. The served label already
//     says "US bonds (BND)" and is used verbatim; the mockup's "global bonds"
//     is a draft error that is NOT reproduced here.
//  3. HONEST SUPPRESSION. A null payload renders NOTHING — the page drops the
//     whole movement and its nav entry. 2,725 funds are honestly without a
//     neighbourhood (no twin, twin below the fit floor, no fit winner, a
//     sub-36-month window, or a blend/panel desync) and the payload carries no
//     reason code, so a specific `Absent` reason cannot be stated and a vague
//     one is worse than silence. The reasons live on /methodology#neighbourhood.
//  4. THIS IS THE TWIN'S HISTORY, NOT THE FUND'S. The panel is keyed by BLEND:
//     two funds on the same twin see the same picture. Every line of copy says
//     so, and points at movement 02 for the fund's own record.
//
// The web tier never computes a return series — see NeighbourhoodCharts.tsx.
// ============================================================================

import type { ReactNode } from "react";
import { BasisChip, Caption, Card, CardLabel, Chip, MethodLink, Movement, Takeaway } from "./chrome";
import {
  fmtDollarsMagnitude,
  fmtPctSigned,
  fmtPctWhole,
  longDay,
  longMonth,
  shortMonth,
  type NeighbourhoodDrawdown,
  type NeighbourhoodTile,
  type NeighbourhoodView,
} from "./derive";
import { NeighbourhoodGrowthChart, NeighbourhoodYearBars } from "./NeighbourhoodCharts";

const STAKE = 10_000;
const EN_DASH = "–";

/** "World stocks (VT)" → "World stocks" — prose form; the full served label
 *  keeps its ticker in the chart legend, so the ticker never leaves the page. */
function shortLabel(label: string | null): string | null {
  if (!label) return null;
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim() || label;
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="underline decoration-dotted underline-offset-2 hover:text-gray-900"
    >
      {children}
    </a>
  );
}

/** One growth tile: leg name, annualised rate, and what $10,000 became. */
function Tile({ k, tile }: { k: string; tile: NeighbourhoodTile }) {
  const ann = fmtPctSigned(tile.annPct);
  const end = fmtDollarsMagnitude(tile.endValue);
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400">{k}</div>
      {ann != null ? (
        <div className="mt-1 font-mono text-[19px] text-gray-900">
          {ann}
          <span className="text-[12px] text-gray-500">/yr</span>
        </div>
      ) : null}
      {end != null ? (
        <div className="mt-0.5 text-[10.5px] text-gray-400">
          ${STAKE.toLocaleString()} &rarr; {end}
        </div>
      ) : null}
    </div>
  );
}

/** One capture cell. */
function CaptureCell({ k, n, sub, d }: { k: string; n: string; sub?: string; d: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400">{k}</div>
      <div className="mt-0.5 font-mono text-[26px] font-semibold text-gray-900">
        {n}
        {sub ? <span className="text-[13px] font-normal text-gray-500"> {sub}</span> : null}
      </div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-gray-500">{d}</div>
    </div>
  );
}

/**
 * The capture takeaway. Derived from the two served ratios and nothing else —
 * every branch is a restatement of figures already on the card, never a
 * judgement the data does not support.
 */
function captureTakeaway(upPct: number | null, downPct: number | null): string | null {
  if (upPct == null || downPct == null) return null;
  if (downPct > 100 && upPct < 100) return "You were not buying protection.";
  if (downPct > 100 && upPct >= 100)
    return "This space amplified world stocks in both directions.";
  if (downPct <= 100 && upPct >= 100) return "Less of the falls came through than the gains.";
  return "This space moved less than world stocks in both directions.";
}

function DrawdownRow({ d }: { d: NeighbourhoodDrawdown }) {
  const months = d.underwaterMonths;
  return (
    <tr>
      <td className="border-b border-gray-100 py-2 pr-3 text-left font-sans text-[13px] font-semibold text-gray-900">
        {shortMonth(d.peak) ?? "—"}
      </td>
      <td className="border-b border-gray-100 py-2 pr-3 text-right font-mono text-[12.5px] text-crescent-bad">
        {fmtPctSigned(d.depthPct, 0) ?? "—"}
      </td>
      <td className="border-b border-gray-100 py-2 pr-3 text-right font-mono text-[12.5px] text-gray-700">
        {shortMonth(d.trough) ?? "—"}
      </td>
      <td className="border-b border-gray-100 py-2 pr-3 text-right font-mono text-[12.5px] text-gray-700">
        {d.ongoing ? "not yet" : (shortMonth(d.recovered) ?? "—")}
      </td>
      <td className="border-b border-gray-100 py-2 text-right font-mono text-[12.5px] text-gray-900">
        {months != null ? `${months} months${d.ongoing ? ", ongoing" : ""}` : "—"}
      </td>
    </tr>
  );
}

export interface M03Props {
  fundName: string;
  /** The parsed served payload. The page omits the movement when this is null. */
  view: NeighbourhoodView;
  /** The verdict's twin mix ("68% IGE + 32% VT"), for naming the gold line. */
  twinMixLabel: string | null;
}

export function M03Neighbourhood({ fundName, view, twinMixLabel }: M03Props) {
  const { tiles, capture, drawdowns, years, labels } = view;

  const twinName = twinMixLabel ?? "the fund's passive twin";
  const twinLegend = twinMixLabel ? `The twin (${twinMixLabel})` : "The twin";
  const ivvLabel = labels.ivv ?? "US stocks (IVV)";
  const vtLabel = labels.vt ?? "World stocks (VT)";
  const bndLabel = labels.bnd ?? "US bonds (BND)";
  const ivvShort = shortLabel(ivvLabel) ?? ivvLabel;
  const vtShort = shortLabel(vtLabel) ?? vtLabel;
  const bndShort = shortLabel(bndLabel) ?? bndLabel;

  const startLong = longMonth(view.windowStart);
  const endLong = longMonth(view.windowEnd);
  const mixAsOfLong = longDay(view.mixAsOf) ?? view.mixAsOf;
  const mixChip = `HYPOTHETICAL · MIX-AS-OF ${(longDay(view.mixAsOf) ?? view.mixAsOf).toUpperCase()}`;
  const mixChipTitle = `The twin leg holds the mix as fit on ${mixAsOfLong} and applies it backwards. It is a backcast, not a track record — nobody held this mix over this window.`;

  const twinEnd = fmtDollarsMagnitude(tiles.twin.endValue);
  const vtEnd = fmtDollarsMagnitude(tiles.vt.endValue);

  // The headline compares two served end values. Tense carries the honesty:
  // the twin "would have" (backcast), VT simply "turned" (a real fund's own
  // adjusted-close history over the same window).
  const headline =
    twinEnd != null && vtEnd != null && startLong != null && endLong != null ? (
      <>
        Between {startLong} and {endLong}, {twinName} would have turned $
        {STAKE.toLocaleString()} into {twinEnd}. {vtShort} turned the same $
        {STAKE.toLocaleString()} into {vtEnd}.
      </>
    ) : undefined;

  const standfirst = (
    <>
      Owning {fundName} is first a decision to own this corner of the market{" "}
      {twinMixLabel ? <>&mdash; {twinMixLabel} &mdash;</> : null} and only second a bet on the
      manager. What follows is that decision&rsquo;s history, not the fund&rsquo;s: the panel
      belongs to the twin, so two funds matched to the same alternative see the same
      neighbourhood. {fundName}&rsquo;s own record is{" "}
      <SectionLink href="#record">section 02</SectionLink>.
    </>
  );

  const partialYears = years.filter((y) => y.partial).map((y) => y.year);
  const longest = drawdowns.reduce<NeighbourhoodDrawdown | null>(
    (best, d) =>
      d.underwaterMonths != null && (best?.underwaterMonths ?? -1) < d.underwaterMonths ? d : best,
    null,
  );

  return (
    <Movement
      id="twin"
      index="03"
      eyebrow="the neighbourhood — before you judge the manager, judge the space"
      headline={headline}
      standfirst={standfirst}
    >
      {/* The chip governs every figure in the movement, so it leads it. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip title={mixChipTitle}>{mixChip}</Chip>
        {startLong != null && endLong != null ? (
          <BasisChip title="Movement 03 asks an asset-class question, so it uses the twin's full life — a longer window than the one the fund itself is graded on.">
            THE TWIN&rsquo;S FULL LIFE · {startLong.toUpperCase()} &rarr; {endLong.toUpperCase()}
          </BasisChip>
        ) : null}
      </div>

      {/* ---- 1 · growth of $10,000, log scale, four legs ------------------ */}
      <Card>
        <CardLabel>
          Growth of ${STAKE.toLocaleString()} · log scale · each leg net of its own ETF fee
        </CardLabel>
        <Caption>
          <b>The gold line is a backcast, not a track record.</b> It holds the twin&rsquo;s mix as
          fit on {mixAsOfLong} fixed and applies it to the past &mdash; that combination of index
          funds is what someone could buy today, and nobody earned this line historically. The
          three reference legs are single funds, each its own real history over the same window.
        </Caption>
        <div className="mt-3">
          <NeighbourhoodGrowthChart
            points={view.points}
            twinLabel={twinLegend}
            ivvLabel={ivvLabel}
            vtLabel={vtLabel}
            bndLabel={bndLabel}
          />
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            k={`The twin${view.windowYears != null ? ` · ${view.windowYears.toFixed(1)} years` : ""}`}
            tile={tiles.twin}
          />
          <Tile k={vtShort} tile={tiles.vt} />
          <Tile k={ivvShort} tile={tiles.ivv} />
          <Tile k={bndShort} tile={tiles.bnd} />
        </div>
        <Caption>
          The twin is {twinName}. The reference legs are {ivvLabel}, {vtLabel} and {bndLabel}{" "}
          &mdash; &ldquo;{bndShort}&rdquo; means exactly that, a US investment-grade fund rather
          than a global one. Every leg comes from adjusted closes, so each is already net of its
          own ETF fee. The window starts {startLong ?? "where every leg is first priced"} because
          that is the earliest month all four legs are genuinely priced
          {view.bindingTicker ? (
            <>
              {" "}
              &mdash; <span title="The leg whose own first price sets the window start.">
                {view.bindingTicker}
              </span>{" "}
              binds it
            </>
          ) : null}
          ; no proxy is ever spliced in to reach further back.
          {view.nDaysDropped != null && view.nDaysDropped > 0 ? (
            <>
              {" "}
              <span title="A day with no price for one leg is skipped for every leg rather than filled, so compounding across the gap gives the true multi-day return.">
                {view.nDaysDropped} day{view.nDaysDropped === 1 ? "" : "s"} in the window had no
                price for one of the legs and were skipped for all of them.
              </span>
            </>
          ) : null}{" "}
          A log scale is used so a 50% fall looks the same wherever it happens. This is a longer
          window than the one <SectionLink href="#record">section 02</SectionLink> grades the fund
          on, deliberately: which space you own is an asset-class question and deserves the longest
          honest history. <MethodLink anchor="neighbourhood" />
        </Caption>
      </Card>

      {/* ---- 2 · capture against world stocks ----------------------------- */}
      {capture != null && (capture.upPct != null || capture.downPct != null) ? (
        <Card>
          <CardLabel>
            When {vtShort.toLowerCase()} fell · monthly
            {view.windowStart && view.windowEnd
              ? ` · ${view.windowStart.slice(0, 4)}${EN_DASH}${view.windowEnd.slice(0, 4)}`
              : ""}
          </CardLabel>
          {captureTakeaway(capture.upPct, capture.downPct) ? (
            <Takeaway>{captureTakeaway(capture.upPct, capture.downPct)}</Takeaway>
          ) : null}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {capture.downPct != null ? (
              <CaptureCell
                k={`When ${vtShort.toLowerCase()} fell`}
                n={fmtPctWhole(capture.downPct) ?? "—"}
                d={
                  <>
                    of the fall came through
                    {capture.nDownMonths != null ? (
                      <>
                        , across the {capture.nDownMonths} months {vtShort.toLowerCase()} lost money
                      </>
                    ) : null}
                    .
                  </>
                }
              />
            ) : null}
            {capture.upPct != null ? (
              <CaptureCell
                k="When they rose"
                n={fmtPctWhole(capture.upPct) ?? "—"}
                d={<>of the gain came through.</>}
              />
            ) : null}
            {capture.nDownMonthsTwinUp != null && capture.nDownMonths != null ? (
              <CaptureCell
                k="Rose anyway"
                n={String(capture.nDownMonthsTwinUp)}
                sub={`of ${capture.nDownMonths}`}
                d={<>down months where the twin still made money.</>}
              />
            ) : null}
          </div>
          <Caption>
            Monthly returns with {vtLabel} as the reference: down-capture is the twin&rsquo;s
            average return across the months world stocks fell, divided by their average return in
            those same months, and up-capture is the mirror. This is a record over one window, not
            a promise about the next fall &mdash; the year-by-year bars below show the exceptions.{" "}
            <MethodLink anchor="neighbourhood" />
          </Caption>
        </Card>
      ) : null}

      {/* ---- 3 · the holes ------------------------------------------------ */}
      {drawdowns.length > 0 ? (
        <Card>
          <CardLabel>
            The holes · the {drawdowns.length === 1 ? "deepest" : `${drawdowns.length} deepest`}, and
            how long back to even
          </CardLabel>
          {longest?.underwaterMonths != null ? (
            <Takeaway>
              {longest.ongoing ? (
                <>
                  One stretch is still under water {longest.underwaterMonths} months (
                  {(longest.underwaterMonths / 12).toFixed(1)} years) after the peak.
                </>
              ) : (
                <>
                  One stretch took {longest.underwaterMonths} months (
                  {(longest.underwaterMonths / 12).toFixed(1)} years) to get back to even.
                </>
              )}
            </Takeaway>
          ) : null}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[440px] border-collapse">
              <thead>
                <tr>
                  {["Peak", "Fell", "Trough", "Back to even", "Underwater"].map((h, i) => (
                    <th
                      key={h}
                      className={`border-b border-gray-200 py-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-gray-400 ${
                        i === 0 ? "pr-3 text-left" : "pr-3 text-right last:pr-0"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drawdowns.map((d) => (
                  <DrawdownRow key={`${d.rank}-${d.peak}`} d={d} />
                ))}
              </tbody>
            </table>
          </div>
          <Caption>
            Measured on the twin mix&rsquo;s daily closes, deepest first. Depth is never clamped,
            and a stretch that has not recovered is marked ongoing rather than closed early.
            &ldquo;Underwater&rdquo; runs from the peak to the day the peak is regained &mdash; it
            is how long someone who bought at the high waited simply to break even.{" "}
            <MethodLink anchor="neighbourhood" />
          </Caption>
        </Card>
      ) : null}

      {/* ---- 4 · year by year --------------------------------------------- */}
      {years.length > 0 ? (
        <Card>
          <CardLabel>
            Year by year · the twin vs {vtShort.toLowerCase()}
          </CardLabel>
          <div className="mt-3">
            <NeighbourhoodYearBars
              years={years}
              twinLabel={twinLegend}
              worldLabel={vtLabel}
            />
          </div>
          <Caption>
            Calendar-year returns for the twin and for {vtLabel}, on the same window as the chart
            above.
            {partialYears.length > 0 ? (
              <>
                {" "}
                {partialYears.join(" and ")}{" "}
                {partialYears.length === 1 ? "is a partial year" : "are partial years"} &mdash; the
                window opens and closes mid-year &mdash; and {partialYears.length === 1 ? "is" : "are"}{" "}
                marked with an asterisk rather than shown as full years.
              </>
            ) : null}{" "}
            The years where the two disagree are the case for owning this space at all; the years
            they track are the ones where the choice did not matter.{" "}
            <MethodLink anchor="neighbourhood" />
          </Caption>
        </Card>
      ) : null}
    </Movement>
  );
}
