// ============================================================================
// Movement 05 · #family — the fund family: is the shop any good?
// ----------------------------------------------------------------------------
// SERVED fund_family_panel (flipped + critic-passed 2026-07-12). The donor
// `FundFamily.tsx` carries both tables verbatim, including the two locked
// honesty rules — TWO BASES IN TWO COLUMNS, NEVER ADDED (the since-inception
// shrunk Value Score vs the realized 3Y β-adjusted excess) and the honest
// "too small to rank" state for families under 5 scored funds. It is reused
// unchanged under V4 chrome via its new `headless` mode; nothing about the
// numbers or their captions is restated here.
// ============================================================================

import { FundFamily } from "@/components/fund/profile/v2";
import type { FundFamilyPanel } from "@/lib/serving/profile-v2";
import { fmtAum, fmtSignedBps } from "@/lib/serving/format";
import { Absent, Caption, Card, LockedNote, MethodLink, Movement } from "./chrome";
import { fmtDollarsMagnitude } from "./derive";

export interface M05Props {
  family: FundFamilyPanel | null;
  present: boolean;
  free: boolean;
  /** This fund's own single-ETF passive alt label, for the basis caption. */
  ownPassiveAltLabel: string | null;
  /** The verdict's twin, which uses a DIFFERENT (multi-ETF) mirror. */
  twinMixLabel: string | null;
}

export function M05Family({
  family,
  present,
  free,
  ownPassiveAltLabel,
  twinMixLabel,
}: M05Props) {
  const display = family?.family_display ?? family?.family ?? null;
  const ranked = family?.family_rank != null;

  // Only flag the cross-basis difference when the two yardsticks are actually
  // different. For a single-ETF twin that IS the fund's passive alternative
  // (DREVX: both SPY), the note claimed a discrepancy that does not exist.
  const twinIsSameYardstick =
    ownPassiveAltLabel != null &&
    twinMixLabel != null &&
    twinMixLabel.replace(/100%\s*/, "").trim() === ownPassiveAltLabel.trim();

  const headline =
    free && family != null && ranked ? (
      <>
        {display} ranks{" "}
        <b>
          {family.family_rank} of {family.n_families_ranked}
        </b>{" "}
        fund families on after-fee value.
      </>
    ) : free && family != null ? (
      <>
        {display} runs too few scored funds for us to rank it against other families.
      </>
    ) : undefined;

  const standfirst =
    free && family != null && family.aum_weighted_value_bps != null ? (
      <>
        Across its {family.n_funds_scored} scored funds
        {family.total_scored_aum_usd != null ? ` (${fmtAum(family.total_scored_aum_usd)})` : ""}, the
        family delivered{" "}
        <b>
          {fmtDollarsMagnitude(family.aum_weighted_value_bps)} a year per $10,000
          {family.aum_weighted_value_bps < 0 ? " less" : " more"}
        </b>{" "}
        than each fund&rsquo;s own passive alternative, weighting every invested dollar equally.
        {family.avg_value_bps != null ? (
          <>
            {" "}
            The simple average is {fmtSignedBps(family.avg_value_bps)}/yr.
          </>
        ) : null}
      </>
    ) : undefined;

  return (
    <Movement
      id="family"
      index="05"
      eyebrow="the fund family — is the shop any good?"
      headline={headline}
      standfirst={standfirst}
    >
      <Card>
        {!present ? (
          <Absent
            what="A family comparison"
            reason="We rank a fund family only when we have scored several of its funds against their own passive alternatives. We have not scored enough of this one."
          />
        ) : !free ? (
          <LockedNote
            what="How this fund's family ranks on after-fee value, and where the fund sits inside it"
            tier="free"
          />
        ) : (
          <FundFamily family={family} present={present} free={free} headless />
        )}
        {free && family != null && !twinIsSameYardstick ? (
          <Caption>
            The family tables grade each fund against its own <b>single-ETF</b> alternative
            {ownPassiveAltLabel ? ` (this fund: ${ownPassiveAltLabel})` : ""}, so this fund&rsquo;s
            figure here differs from the verdict at the top of the page, which grades it against a
            {twinMixLabel ? ` closer-fitting mix (${twinMixLabel})` : " closer-fitting ETF mix"} —
            same fund, stricter mirror in the verdict. <MethodLink anchor="fund-family" />
          </Caption>
        ) : null}
      </Card>
    </Movement>
  );
}
