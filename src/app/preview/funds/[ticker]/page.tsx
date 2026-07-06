import { notFound } from "next/navigation";
import {
  applyGates,
  getFundFactRow,
  isLocked,
  stampByDomain,
  type Identity,
  type ValueScore,
  type PassiveBaseline,
  type SourceStamp,
  type Locked,
  type UserState,
} from "@/lib/serving/profile";
import { resolveSession } from "@/lib/serving/session";
import { overlayV2Fixtures, tierAllows } from "@/lib/serving/profile-v2";
import { Alternatives, SourceFooter } from "@/components/fund/profile";
import {
  PreviewBanner,
  SectionNav,
  ProfileHero,
  AISummary,
  HistoricalPerformance,
  AttributionSection,
  CurrentPositioning,
  RecentChanges,
  FeeFairnessV2,
  FundFamily,
} from "@/components/fund/profile/v2";

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
  const firstSentence = (p: string): string => {
    const m = /^(.*?[.!?])(\s|$)/.exec(p);
    return m ? m[1] : p;
  };

  // AI summary — first sentence public, full free.
  const aiFx = row.aiSummary ?? null;
  const aiSummary = aiFx
    ? free
      ? aiFx
      : {
          ...aiFx,
          paragraphs: aiFx.paragraphs?.length ? [firstSentence(aiFx.paragraphs[0])] : [],
        }
    : null;

  // Nav series — fund line public; comparison legs (passive/β-adj) + comparison
  // table columns are paid. Strip them for non-paid callers.
  const navFx = row.navSeries ?? null;
  const navSeries = navFx
    ? paid
      ? navFx
      : {
          ...navFx,
          points: navFx.points.map((p) => ({
            t: p.t,
            fund: p.fund,
            passive: null,
            beta_adj_passive: null,
          })),
          period_table: (navFx.period_table ?? []).map((r) => ({
            ...r,
            passive_ann_pct: null,
            beta_adj_passive_ann_pct: null,
            diff_bps: null,
            beta_adj_diff_bps: null,
          })),
        }
    : null;

  // Attribution window summary — the full decomposition is paid; below the gate
  // keep only the header/teaser scaffolding (window/n_quarters/label).
  const attrFx = row.attributionWindowSummary ?? null;
  const attrSummary = attrFx
    ? paid
      ? attrFx
      : {
          __sample: attrFx.__sample,
          sample_label: attrFx.sample_label,
          window: attrFx.window,
          n_quarters: attrFx.n_quarters,
          quarter_grid: [],
          default_window: null,
          factor_contributions: [],
          stock_selection_idio_bps: null,
          realised_active_bps: null,
          residual_reconciliation_bps: null,
          beta_tilt: null,
          basis_migration_note: null,
          residual_explainer: null,
        }
    : null;

  // Risk explainers — used by the free gauges + the paid attribution panel.
  const riskExplainers = free ? (row.riskExplainers ?? null) : null;

  // Positioning gauges — free.
  const positioningContext = free ? (row.positioningContext ?? null) : null;

  // TE decomposition — the whole positioning section is free-gated (gauges),
  // with the full bets table paid and the top bet free. So: paid → full;
  // free → bets[0] (the free proof) + aggregate sleeve stats; anon → nothing.
  const teFx = row.teDecomposition ?? null;
  const teDecomposition = !free
    ? null
    : teFx
      ? paid
        ? teFx
        : { ...teFx, bets: teFx.bets?.slice(0, 1) ?? [] }
      : null;
  const tePresent = teFx != null;

  // Bridges + stock snapshot — bridges feed the paid bets table; top10 &
  // holdings feed the free holdings block (paid ⇒ free, so gate at free).
  const bridges = paid ? (row.positioningBetBridges ?? null) : null;
  const top10 = free ? (row.top10VsIwf ?? null) : null;
  const holdingsFull = free ? (row.holdingsFull ?? null) : null;

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

  // Fund family — free. Prefer the real backend panel. Guard against the base
  // row's `fundFamily` STRING, which is the DB adviser name colliding with the
  // fixture panel key; only a real panel object counts as present.
  const familyPanel =
    row.fundFamilyPanel != null && typeof row.fundFamilyPanel === "object"
      ? row.fundFamilyPanel
      : row.fundFamily != null && typeof row.fundFamily === "object"
        ? row.fundFamily
        : null;
  const familyPresent = familyPanel != null;
  const fundFamily = free ? familyPanel : null;

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

  return (
    <div className="bg-white">
      <PreviewBanner tier={userState} />
      <SectionNav passiveNote={passiveLabel ? `read against ${passiveLabel} — closest passive alt` : null} />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 01 · Verdict */}
        <section id="s1" className="scroll-mt-24">
          <ProfileHero
            identity={identity}
            requestedTicker={ticker}
            valueScore={valueScore}
            fees={fees}
            holdingsAsOf={holdingsAsOf}
            holdingsStale={holdingsStale}
          />
        </section>

        <div className="mt-16 space-y-16">
          {/* 02 · Summary */}
          <AISummary summary={aiSummary} full={free} />

          {/* 03 · Historical performance */}
          <HistoricalPerformance navSeries={navSeries} showComparison={paid} />

          {/* 04 · Performance attribution */}
          <AttributionSection
            summary={attrSummary}
            returnAttribution={row.returnAttribution as { rows?: unknown[] } | Locked | null}
            riskExplainers={riskExplainers}
            paid={paid}
            passiveLabel={passiveLabel}
          />

          {/* 05 · Current positioning */}
          <CurrentPositioning
            positioning={positioningContext}
            riskExplainers={riskExplainers}
            teDecomposition={teDecomposition}
            bridges={bridges}
            top10={top10}
            holdingsFull={holdingsFull}
            exposureXray={exposureXray}
            present={tePresent || row.top10VsIwf != null || row.positioningContext != null || row.holdingsFull != null}
            free={free}
            paid={paid}
            passiveLabel={passiveLabel}
          />

          {/* 06 · Recent changes */}
          <RecentChanges changes={recentChanges} present={rcPresent} free={free} paid={paid} />

          {/* 07 · Fee fairness (REAL served fees) */}
          <FeeFairnessV2 fees={fees} isPassive={isPassive} free={free} />

          {/* 08 · Fund family */}
          <FundFamily family={fundFamily} present={familyPresent} free={free} />

          {/* More detail — reuse existing Alternatives + SourceFooter as-is */}
          <details className="group rounded-2xl border border-gray-200 bg-white/60 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span className="text-lg font-bold text-gray-900">More detail</span>
              <span className="text-sm text-gray-400">
                <span className="group-open:hidden">alternatives · sources — show</span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="space-y-12 border-t border-gray-100 px-5 py-8">
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
