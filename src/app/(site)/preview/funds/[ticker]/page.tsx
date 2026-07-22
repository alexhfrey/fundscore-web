import { notFound } from "next/navigation";
import {
  applyGates,
  getFundFactRow,
  getPreview,
  isLocked,
  stampByDomain,
  type Identity,
  type ValueScore,
  type PassiveBaseline,
  type SourceStamp,
  type Locked,
  type TeProofPreview,
  type ExposurePreview,
  type UserState,
} from "@/lib/serving/profile";
import { resolveSession } from "@/lib/serving/session";
import { readHoldingsFullTeaser } from "@/lib/serving/holdings-full";
import { loadHoldingsFullRows as loadHoldingsFullRowsAction } from "@/lib/serving/holdings-full-actions";
import { getAttributionBlocksMeta } from "@/lib/serving/attribution-blocks";
import {
  buildAttributionWindowSummary,
  buildRiskExplainers,
  overlayV2Fixtures,
  tierAllows,
  type FundFamilyPanel,
  type NavSeries,
  type PositioningContext,
  type RiskBehavior,
  type TeDecomposition,
} from "@/lib/serving/profile-v2";
import { Alternatives, SourceFooter } from "@/components/fund/profile";
import {
  PreviewBanner,
  SectionNav,
  ProfileHero,
  VerdictBlock,
  AnatomySection,
  FeeReceipt,
  HurdlePanel,
  HistoricalPerformance,
  AttributionSection,
  CurrentPositioning,
  RecentChanges,
  FeeFairnessV2,
  FundFamily,
  TwinPanel,
} from "@/components/fund/profile/v2";
import { topVsBenchmarkTilt } from "@/components/fund/profile/v2/crescent/VerdictBlock";
import { BlockHeader } from "@/components/fund/profile/v2/crescent/BlockHeader";
import { HurdleHeadline } from "@/components/fund/profile/v2/crescent/HurdlePanel";
import { orientFromTilt } from "@/lib/crescent";

// Per-user dynamic render: reads the session to gate by tier server-side, and
// (PREVIEW ONLY) honors a ?tier= override so reviewers can walk the tier matrix.
export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ tier?: string }>;
}

export async function generateMetadata({ params }: PreviewPageProps) {
  const { ticker } = await params;
  return {
    title: `${ticker.toUpperCase()} · Profile design preview | FundScore`,
    robots: { index: false, follow: false },
  };
}

const VALID_TIERS: UserState[] = ["anonymous", "free", "paid", "pro"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unlocked<T>(v: any): T | null {
  if (v == null || isLocked(v)) return null;
  return v as T;
}

export default async function PreviewFundPage({ params, searchParams }: PreviewPageProps) {
  const { ticker } = await params;
  const sp = await searchParams;
  const raw = await getFundFactRow(ticker);
  if (!raw) notFound();

  // Tier: session tier, overridable by ?tier= — guarded to THIS route only.
  const session = await resolveSession();
  const override =
    sp.tier && VALID_TIERS.includes(sp.tier as UserState) ? (sp.tier as UserState) : null;
  const userState: UserState = override ?? session.userState;

  const gated = applyGates(raw, userState);
  const row = await overlayV2Fixtures(gated, ticker);

  const free = tierAllows(userState, "free");
  const paid = tierAllows(userState, "paid");

  // ------------------------------------------------------------------------
  // Gate the FIXTURE sections in-page (the fixtures carry no gate metadata, so
  // applyGates can't touch them). We build the entitled payload for each and
  // pass ONLY that to the components — gated fixture numbers never reach a
  // below-the-gate client (mirrors how applyGates strips the real sections).
  // ------------------------------------------------------------------------
  // Nav series — SERVED (profile-nav-series; gate public). applyGates already
  // field-stripped below paid: passive/β-adj point legs + β nulled, and the
  // period table collapsed to ONE free proof-point row (its β-adj diff nulled).
  // No in-page strip — the gating module is the single owner of the contract.
  const navSeries = (row.navSeries as NavSeries | null) ?? null;

  // Attribution window summary — SERVED: the riskAttribution
  // active_return_attribution sub-panel (paid, applyGates strips it to
  // {locked} below) + the lazy blocks payload's quarter grid (paid,
  // presence-gated, fetched server-side only when entitled). The summary is
  // built only for paid; below the gate the section renders its proof point +
  // unlock off `attrPresent` — never the numbers.
  const ra = isLocked(row.riskAttribution) ? null : row.riskAttribution;
  const ara = ra?.active_return_attribution ?? null;
  // Presence comes from the RAW (pre-gate) row: a locked riskAttribution
  // section does NOT prove a decomposition exists (passive/short-history funds
  // carry factor/divergence data but a null sub-panel) — never tease an
  // unlock for data that isn't there (codex P2). Only the boolean crosses.
  const attrPresent = raw.riskAttribution?.active_return_attribution != null;
  const blocksMeta =
    paid && ara != null && !isLocked(ara)
      ? await getAttributionBlocksMeta(ticker, raw.gates, userState)
      : null;
  const attrSummary =
    paid && ara != null && !isLocked(ara)
      ? buildAttributionWindowSummary(ara, blocksMeta)
      : null;
  // The factor_ids the attribution serves as their own rows — the bets table's
  // cross-reference tag keys off this so it never claims a row that section 04
  // folded into "smaller factor bets" (DQ-critic P2). Paid-only, ids only.
  const attributedFactorIds = attrSummary
    ? new Set(attrSummary.factor_contributions.map((f) => f.factor_id))
    : null;

  // Positioning gauges — SERVED positioning_context (gate: free, owned by
  // applyGates; anon holds a {locked} marker). `free ?` is belt-and-braces.
  const positioningContext = free
    ? unlocked<PositioningContext>(row.positioningContext)
    : null;
  const positioningPresent = row.positioningContext != null;

  // The fund's L2 blend constituents (public l2_blend_etfs, comma-joined) —
  // names only; weights come from the positioning cohort when it covers the
  // full blend. Drives the blend-aware bets-table baseline.
  const vor = isLocked(row.valueOfferingReframed)
    ? null
    : (row.valueOfferingReframed as { l2_blend_etfs?: string | null } | null);
  const l2BlendEtfs =
    vor?.l2_blend_etfs != null && vor.l2_blend_etfs !== ""
      ? vor.l2_blend_etfs.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

  // TE decomposition (SERVED — te-decomposition-by-bet, gated 'paid' by
  // applyGates): paid → the full object; free/anon → { preview: proofPoint,
  // locked }. The whole positioning section is itself free-gated (gauges), so
  // anon sees the section-level lock and NEVER the TE proof point; free sees the
  // grouped rollup + top bet; paid sees the full bets table. The full 12-bet
  // array is stripped server-side below the paid gate (only the proof point ships).
  const teRaw = row.teDecomposition as TeDecomposition | Locked | null | undefined;
  const tePresent = teRaw != null;
  const teDecomposition =
    paid && teRaw != null && !isLocked(teRaw) ? (teRaw as TeDecomposition) : null;
  const teProof =
    free && isLocked(teRaw) ? (getPreview(teRaw) as TeProofPreview | null) : null;
  // Locked state survives a null proof point: paid detail exists but the
  // projector had nothing eligible — the UI must show the honest lock, never
  // a blank (codex P2).
  const teLocked = free && isLocked(teRaw);

  // Bridges + stock snapshot — bridges feed the paid bets table; top10 &
  // holdings feed the free holdings block (paid ⇒ free, so gate at free).
  const bridges = paid ? (row.positioningBetBridges ?? null) : null;
  const top10 = free ? (row.top10VsIwf ?? null) : null;

  // Full holdings (serve-full-holdings): the teaser (count + as-of) is read off
  // the PUBLIC holdings section (keyed to the gates.holdings_full marker) and
  // shown for ALL tiers when a list exists — anon and free both get the locked
  // "View all N holdings" affordance (never rows). The row LOADER fetches lazily
  // via a server action that resolves entitlement from the REAL session itself
  // (it never trusts a passed tier); the bound `userState` here is only a
  // /preview reviewer ?tier= override, honored server-side outside production and
  // ignored in production. null loader below paid ⇒ the teaser renders locked.
  const holdingsFullTeaser = readHoldingsFullTeaser(raw);
  const loadHoldingsFullRows =
    paid && holdingsFullTeaser != null
      ? loadHoldingsFullRowsAction.bind(null, ticker, userState)
      : null;

  // Recent changes — free-gated: paid → full; free → top shift only; anon → none.
  const rcFx = row.recentChangesTe ?? null;
  const rcPresent = rcFx != null;
  const recentChanges = !free
    ? null
    : rcFx
      ? paid
        ? rcFx
        : {
            ...rcFx,
            rows: rcFx.rows?.length
              ? [
                  [...rcFx.rows].sort(
                    (a, b) => Math.abs(b.change_magnitude ?? 0) - Math.abs(a.change_magnitude ?? 0),
                  )[0],
                ]
              : [],
          }
      : null;

  // Fund family — SERVED fund_family_panel (gate: free, owned by applyGates;
  // anon holds a {locked} marker). The base row's `fundFamily` STRING (the SEC
  // trust name) is a different field and never read here.
  const familyPresent = row.fundFamilyPanel != null;
  const fundFamily = free ? unlocked<FundFamilyPanel>(row.fundFamilyPanel) : null;

  const identity = row.identity as Identity;
  const isPassive = identity.management_style === "passive";
  const valueScore = (row.valueScore ?? null) as ValueScore | null;
  const fees = isLocked(row.fees) ? null : (row.fees as Record<string, unknown> | null);

  const passiveBaseline = unlocked<PassiveBaseline>(row.passiveBaseline);
  const passiveLabel =
    row.navSeries?.passive_label ??
    valueScore?.passive_alt_label ??
    passiveBaseline?.display_name ??
    identity.primary_benchmark ??
    null;

  const holdings = isLocked(row.holdings)
    ? null
    : (row.holdings as { as_of_date?: string } | null);
  const holdingsAsOf = holdings?.as_of_date ?? null;
  const inv = row.sourceInventory as unknown as { source_stamps?: SourceStamp[] };
  const holdingsStale = stampByDomain(inv, "holdings")?.status === "stale";

  // Risk explainers (free gauges + paid attribution panel) — DERIVED copy,
  // templated from the SAME numbers the gauges display so the educational text
  // can never contradict them. Null numbers fall back to definitions-only.
  const riskExplainers = free
    ? buildRiskExplainers({
        beta: positioningContext?.beta ?? null,
        teBps: positioningContext?.te_bps ?? null,
        passiveLabel,
      })
    : null;

  // 3Y risk detail (SERVED risk_behavior, gate: free): free+ holds the payload;
  // anon keeps the honest locked expander when the section exists but is gated.
  const rbRaw = row.riskBehavior as RiskBehavior | Locked | null | undefined;
  const riskBehavior = rbRaw != null && !isLocked(rbRaw) ? (rbRaw as RiskBehavior) : null;
  const riskLocked = isLocked(rbRaw);
  const pricingStamp = stampByDomain(inv, "pricing");
  // Basis pointer beside the expander's stated-benchmark TE when the page also
  // shows a headline TE (different basis) — derived, never fabricated.
  const headlineTeNote =
    positioningContext?.te_bps != null
      ? `the page's headline TE is ${(positioningContext.te_bps / 100).toFixed(1)}%/yr (weekly, β-adjusted vs ${passiveLabel ?? "the passive alternative"})`
      : null;
  const headlineBetaNote =
    positioningContext?.beta != null
      ? `the page's headline beta is ${positioningContext.beta.toFixed(2)} (weekly, vs ${passiveLabel ?? "the passive alternative"}) — a different basis`
      : null;

  const src = row.sourceInventory as {
    source_stamps: { source_label: string; as_of_date?: string | null }[];
    data_quality_warnings: {
      warning_id: string;
      severity: string;
      section_id: string;
      message: string;
    }[];
    profile_build_version: string;
    last_profile_build_time: string;
  };

  const exposureXray = unlocked<{ rows?: unknown[] }>(row.exposureXray);
  // The anon-tier free proof point for the Crescent hero's orientation tilt —
  // the SAME whitelisted preview a locked exposure-X-ray section would surface
  // (exposure_xray gate: free), read off the RAW pre-unlock value so it only
  // fires when the section is actually locked (free+ already has `exposureXray`
  // above). Mirrors the teProof / betsText pattern used elsewhere on this page.
  const exposurePreview = isLocked(row.exposureXray)
    ? (getPreview(row.exposureXray) as ExposurePreview | null)
    : null;

  // Block 2 (Anatomy) inputs — the idio share comes from whichever te-decomp
  // view this tier is entitled to (paid full object, else the free proof
  // point); anonymous gets neither and the anatomy movement simply doesn't
  // render. Orientation reuses the hero's own tilt-row selection so the two
  // marks can never point different ways.
  const idioRiskShare = teDecomposition?.idio_risk_share ?? teProof?.idio_risk_share ?? null;
  const anatomyOrientDeg = orientFromTilt(
    topVsBenchmarkTilt((exposureXray?.rows as Record<string, unknown>[] | undefined) ?? null) ??
      exposurePreview,
  );

  return (
    <div className="bg-white">
      <PreviewBanner tier={userState} />
      <SectionNav passiveNote={passiveLabel ? `read against ${passiveLabel} — closest passive alt` : null} />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Crescent hero (Step 4, Block 1) — masthead/identity only from
            ProfileHero, then the Crescent verdict block. */}
        <div id="b1" className="space-y-6 scroll-mt-24">
          <ProfileHero
            variant="identity"
            identity={identity}
            requestedTicker={ticker}
            valueScore={valueScore}
            fees={fees}
            holdingsAsOf={holdingsAsOf}
            holdingsStale={holdingsStale}
          />
          <VerdictBlock
            identity={identity}
            requestedTicker={ticker}
            valueScore={valueScore}
            fees={fees}
            passiveLabel={passiveLabel}
            exposureXrayRows={(exposureXray?.rows as Record<string, unknown>[] | undefined) ?? null}
            exposurePreview={exposurePreview}
            archetype={row.archetype ?? null}
            archetypeRules={row.archetypeRules ?? null}
          />
        </div>

        {/* Crescent anatomy (Step 6, Block 2) — the hatched mark + split
            sentence, with the positioning dossier (old 05) and Recent shifts
            (old 06) reparented beneath as demoted SUB-headers (step 7
            chrome) rather than standalone numbered chapters. */}
        <div id="b2" className="scroll-mt-24">
          <AnatomySection
            ticker={identity.ticker ?? ticker.toUpperCase()}
            valueScore={valueScore}
            idioRiskShare={idioRiskShare}
            orientDeg={anatomyOrientDeg}
          >
            <CurrentPositioning
              positioning={positioningContext}
              riskExplainers={riskExplainers}
              teDecomposition={teDecomposition}
              teProof={teProof}
              teLocked={teLocked}
              bridges={bridges}
              top10={top10}
              holdingsFullTeaser={holdingsFullTeaser}
              loadHoldingsFullRows={loadHoldingsFullRows}
              exposureXray={exposureXray}
              present={tePresent || row.top10VsIwf != null || positioningPresent || holdingsFullTeaser != null}
              free={free}
              paid={paid}
              passiveLabel={passiveLabel}
              l2BlendEtfs={l2BlendEtfs}
              attributedFactorIds={attributedFactorIds}
              demoted
            />
            <RecentChanges changes={recentChanges} present={rcPresent} free={free} paid={paid} demoted />
          </AnatomySection>
        </div>

        {/* Block 3 — PRICE (design pass 2026-07-22: the old 2-col proof grid
            split into two full sections so Performance can carry its own
            headline). The receipt is the statement; keep it a calm, narrow
            column. Fee-fairness ruler stays its drill-down. */}
        <section id="b3" className="mt-14 border-t border-gray-100 pt-10 scroll-mt-24">
          <BlockHeader
            eyebrow="The receipt · what the active part costs"
            headline="What you pay, line by line"
          />
          <div className="mt-6 max-w-xl space-y-3">
            <FeeReceipt
              fees={fees}
              periodTable={navSeries?.period_table ?? null}
              seriesStart={navSeries?.series_start ?? null}
              free={free}
            />
            <details className="group rounded-2xl border border-gray-200 bg-white/60 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                <span className="text-sm font-semibold text-gray-700">The full fee-fairness ruler</span>
                <span className="text-xs text-gray-400">
                  <span className="group-open:hidden">show</span>
                  <span className="hidden group-open:inline">hide</span>
                </span>
              </summary>
              <div className="border-t border-gray-100 px-5 py-6">
                <FeeFairnessV2 fees={fees} isPassive={isPassive} free={free} demoted />
              </div>
            </details>
          </div>
        </section>

        {/* Block 4 — PERFORMANCE, its own headlined section (owner ask,
            2026-07-22): serif verdict headline for the longest served window,
            the hurdle bars full-width, growth chart PROMOTED out of its
            details, Brinson attribution stays the drill-down. */}
        <section id="b4" className="mt-14 border-t border-gray-100 pt-10 scroll-mt-24">
          <BlockHeader
            eyebrow="The hurdle · after all fees vs its free twin"
            headline={<HurdleHeadline navSeries={navSeries} passiveLabel={passiveLabel} />}
          />
          <div className="mt-6 space-y-6">
            <HurdlePanel navSeries={navSeries} fees={fees} passiveLabel={passiveLabel} paid={paid} />
            <HistoricalPerformance
              navSeries={navSeries}
              showComparison={paid}
              riskBehavior={riskBehavior}
              riskLocked={riskLocked}
              pricingStamp={pricingStamp}
              headlineTeNote={headlineTeNote}
              headlineBetaNote={headlineBetaNote}
              isPassive={isPassive}
              demoted
            />
            <details className="group rounded-2xl border border-gray-200 bg-white/60 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                <span className="text-sm font-semibold text-gray-700">
                  What the bets did — realized return attribution
                </span>
                <span className="text-xs text-gray-400">
                  <span className="group-open:hidden">show</span>
                  <span className="hidden group-open:inline">hide</span>
                </span>
              </summary>
              <div className="border-t border-gray-100 px-5 py-6">
                <AttributionSection
                  summary={attrSummary}
                  present={attrPresent}
                  returnAttribution={row.returnAttribution as { rows?: unknown[] } | Locked | null}
                  riskExplainers={riskExplainers}
                  paid={paid}
                  passiveLabel={passiveLabel}
                  demoted
                />
              </div>
            </details>
          </div>
        </section>

        {/* Crescent twin + more (Step 7, Block 5) — the passive-twin lead
            card, then the remaining drill-downs that don't have a Block 3/4
            home: fund family, alternatives, sources. The old numbered-chapter
            scheme (01 Verdict / 02 Summary standalone sections, 08 Family as
            its own chapter) is retired — 01/02 are superseded by Block 1
            above; 08 lives here as a "More detail" drill-down alongside
            alternatives/sources. */}
        <div id="b5" className="mt-14 border-t border-gray-100 pt-10 scroll-mt-24 space-y-4">
          <TwinPanel
            passiveLabel={passiveLabel}
            fees={fees}
            valueScore={valueScore}
            teBps={positioningContext?.te_bps ?? null}
          />

          <details className="group rounded-2xl border border-gray-200 bg-white/60 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span className="text-lg font-bold text-gray-900">More detail</span>
              <span className="text-sm text-gray-400">
                <span className="group-open:hidden">fund family · alternatives · sources — show</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="space-y-12 border-t border-gray-100 px-5 py-8">
              <FundFamily family={fundFamily} present={familyPresent} free={free} demoted />
              {/* Alternatives handles its own Locked marker (paid gate) + preview. */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Alternatives alts={row.alternatives as any} />
              <SourceFooter
                src={src}
                profileBuildVersion={row.profileBuildVersion}
                completeness={row.dataCompletenessState}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
