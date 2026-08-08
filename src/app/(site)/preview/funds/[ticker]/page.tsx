import { notFound } from "next/navigation";
import {
  applyGates,
  getFundFactRow,
  getPreview,
  isLocked,
  type Identity,
  type Locked,
  type PassiveBaseline,
  type TeProofPreview,
  type UserState,
  type ValueScore,
} from "@/lib/serving/profile";
import { resolveSession } from "@/lib/serving/session";
import { getAttributionBlocksMeta } from "@/lib/serving/attribution-blocks";
import {
  buildAttributionWindowSummary,
  buildRiskExplainers,
  tierAllows,
  type FundFamilyPanel,
  type NavSeries,
  type PositioningContext,
  type TeDecomposition,
} from "@/lib/serving/profile-v2";
import { SourceFooter } from "@/components/fund/profile";
import { PreviewBanner } from "@/components/fund/profile/v2";
import { M00Verdict } from "@/components/fund/profile/v4/M00Verdict";
import { M01WhatIsIt } from "@/components/fund/profile/v4/M01WhatIsIt";
import { M02Record } from "@/components/fund/profile/v4/M02Record";
import { M05Family } from "@/components/fund/profile/v4/M05Family";
import { M06KeyStats } from "@/components/fund/profile/v4/M06KeyStats";
import { V4Nav, type V4NavItem } from "@/components/fund/profile/v4/V4Nav";
import { buildTwin } from "@/components/fund/profile/v4/derive";

// Per-user dynamic render: reads the session to gate by tier server-side, and
// (PREVIEW ONLY) honors a ?tier= override so reviewers can walk the tier matrix.
// Owner decision (e), 2026-08-06: production KEEPS force-dynamic.
export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ tier?: string }>;
}

export async function generateMetadata({ params }: PreviewPageProps) {
  const { ticker } = await params;
  return {
    title: `${ticker.toUpperCase()} · V4 profile preview | FundScore`,
    robots: { index: false, follow: false },
  };
}

const VALID_TIERS: UserState[] = ["anonymous", "free", "paid", "pro"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unlocked<T>(v: any): T | null {
  if (v == null || isLocked(v)) return null;
  return v as T;
}

/**
 * The V4 movement tree, built on the preview route per the cutover spec's
 * per-movement protocol.
 *
 * Movements 03 (the neighbourhood) and 04 (the manager and their names) are NOT
 * in this build — their backends are not landed — and are deliberately absent
 * from the nav rather than linking to anchors the page does not carry. The
 * final route cutover is a separate item.
 *
 * GATING: `applyGates` is the single owner of the public/free/paid split. Every
 * value below is read off the GATED row. The RAW row is used only for presence
 * booleans, which carry no gated number — a locked section must be able to say
 * "this exists, it is gated" without leaking what it holds.
 */
export default async function PreviewFundPage({ params, searchParams }: PreviewPageProps) {
  const { ticker } = await params;
  const sp = await searchParams;
  const raw = await getFundFactRow(ticker);
  if (!raw) notFound();

  const session = await resolveSession();
  const override =
    sp.tier && VALID_TIERS.includes(sp.tier as UserState) ? (sp.tier as UserState) : null;
  const userState: UserState = override ?? session.userState;

  const row = applyGates(raw, userState);

  const free = tierAllows(userState, "free");
  const paid = tierAllows(userState, "paid");

  const identity = row.identity as Identity;
  const valueScore = unlocked<ValueScore>(row.valueScore);
  const fees = unlocked<Record<string, unknown>>(row.fees);
  const passiveBaseline = unlocked<PassiveBaseline>(row.passiveBaseline);
  const exposureXray = unlocked<{ rows?: unknown[] }>(row.exposureXray);
  const holdings = unlocked<Record<string, unknown>>(row.holdings);
  const managerParent = unlocked<Record<string, unknown>>(row.managerParent);

  // nav_series: section gate public; applyGates field-strips the passive /
  // β-adjusted legs and collapses the period table below the paid tier.
  const navSeries = unlocked<NavSeries>(row.navSeries);
  // Presence-only boolean off the RAW row: does the paired-window β-adjusted
  // figure actually EXIST? Below the paid tier applyGates nulls it, so the
  // gated row alone cannot tell "you need to upgrade" from "nobody gets this".
  // Carries no value across the boundary — same pattern as `attrPresent`.
  const rawPairedBetaAdjPresent =
    Array.isArray(raw.navSeries?.period_table) &&
    raw.navSeries.period_table.some(
      (r: { period?: string; beta_adj_diff_bps?: number | null }) =>
        r?.period === "SI" && r?.beta_adj_diff_bps != null,
    );

  // te_decomposition: gate `paid`. paid → the full object; free → the
  // whitelisted proof point (rollup + one bet); anon → the lock, no proof point.
  const teRaw = row.teDecomposition as TeDecomposition | Locked | null | undefined;
  const teDecomposition = paid && teRaw != null && !isLocked(teRaw) ? teRaw : null;
  const teProof = free && isLocked(teRaw) ? (getPreview(teRaw) as TeProofPreview | null) : null;
  const teLocked = isLocked(teRaw);

  // fund_family_panel: gate `free` (fail-closed default in GATED_SECTIONS).
  const familyPresent = row.fundFamilyPanel != null;
  const family = free ? unlocked<FundFamilyPanel>(row.fundFamilyPanel) : null;

  // Attribution (movement 02, card 2). Presence comes from the RAW row: a
  // locked risk_attribution does NOT prove a decomposition exists — passive and
  // short-history funds carry factor data with a null sub-panel — so teasing an
  // unlock off the section alone would tease data that isn't there.
  const ra = isLocked(row.riskAttribution) ? null : row.riskAttribution;
  const ara = ra?.active_return_attribution ?? null;
  const attrPresent = raw.riskAttribution?.active_return_attribution != null;
  const blocksMeta =
    paid && ara != null && !isLocked(ara)
      ? await getAttributionBlocksMeta(ticker, raw.gates, userState)
      : null;
  const attrSummary =
    paid && ara != null && !isLocked(ara) ? buildAttributionWindowSummary(ara, blocksMeta) : null;

  const twin = buildTwin(passiveBaseline, valueScore?.replica_r2 ?? null);
  const passiveLabel =
    navSeries?.passive_label ??
    valueScore?.passive_alt_label ??
    passiveBaseline?.display_name ??
    identity.primary_benchmark ??
    null;

  // Derived ⓘ copy for the attribution drill-down, templated from the SAME
  // numbers the page displays (never a fixture, never an independent estimate).
  const positioningContext = free
    ? unlocked<PositioningContext>(row.positioningContext)
    : null;
  const riskExplainers = free
    ? buildRiskExplainers({
        beta: positioningContext?.beta ?? null,
        teBps: positioningContext?.te_bps ?? null,
        passiveLabel,
      })
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

  const navItems: V4NavItem[] = [
    { id: "exec", index: "00", label: "Verdict" },
    { id: "whatis", index: "01", label: "What is it" },
    { id: "record", index: "02", label: "The record" },
    { id: "family", index: "05", label: "Fund family" },
    { id: "stats", index: "06", label: "Key stats" },
    { id: "sources", index: "—", label: "Sources" },
  ];

  return (
    <div className="bg-white">
      <PreviewBanner tier={userState} />

      <div className="mx-auto max-w-[1060px] px-7 pb-20">
        {/* ---- ID row (mockup .topbar + .idrow) --------------------------- */}
        <div className="flex items-center justify-between pb-1.5 pt-4">
          <div className="font-mono text-[11px] tracking-[0.08em] text-gray-500">
            <b className="text-gray-900">FUNDSCORE.AI</b> / FUNDS /{" "}
            {identity.ticker ?? ticker.toUpperCase()}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3.5 gap-y-2">
          <h1 className="font-mono text-[30px] tracking-[0.01em] text-gray-900">
            {identity.ticker ?? ticker.toUpperCase()}
          </h1>
          {identity.fund_name ? (
            <span className="font-serif text-[22px] text-gray-700">{identity.fund_name}</span>
          ) : null}
          {[identity.vehicle_type, identity.management_style, identity.peer_group]
            .filter((t): t is string => typeof t === "string" && t.length > 0)
            .map((t) => (
              <span
                key={t}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11.5px] text-gray-500"
              >
                {t}
              </span>
            ))}
          {/* Value Score is a CATALOG CHIP in V4, never a headline hero. The
              precise 0-100 is paid — applyGates already nulled it below that. */}
          {valueScore?.score100 != null ? (
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.04em] text-gray-500">
              VALUE SCORE {valueScore.score100} / 100 · 50 = BREAKEVEN
            </span>
          ) : null}
        </div>

        <V4Nav
          items={navItems}
          note={twin.mixLabel ? `graded against its passive twin — ${twin.mixLabel}` : null}
        />

        <M00Verdict
          fundName={identity.fund_name ?? identity.ticker ?? ticker.toUpperCase()}
          ticker={identity.ticker ?? ticker.toUpperCase()}
          passiveBaseline={passiveBaseline}
          valueScore={valueScore}
          fees={fees}
          navSeries={navSeries}
          rawPairedBetaAdjPresent={rawPairedBetaAdjPresent}
          teDecomposition={teDecomposition}
          teProof={teProof}
          teLocked={teLocked}
          exposureXray={exposureXray}
          paid={paid}
        />

        <M01WhatIsIt
          passiveBaseline={passiveBaseline}
          valueScoreReplicaR2={valueScore?.replica_r2 ?? null}
          teDecomposition={teDecomposition}
          teProof={teProof}
          teLocked={teLocked}
          exposureXray={exposureXray}
        />

        <M02Record
          fundName={identity.fund_name ?? identity.ticker ?? ticker.toUpperCase()}
          passiveBaseline={passiveBaseline}
          valueScoreReplicaR2={valueScore?.replica_r2 ?? null}
          navSeries={navSeries}
          rawPairedBetaAdjPresent={rawPairedBetaAdjPresent}
          paid={paid}
          passiveLabel={passiveLabel}
          beta={navSeries?.beta ?? valueScore?.beta ?? null}
          attrSummary={attrSummary}
          attrPresent={attrPresent}
          returnAttribution={row.returnAttribution as { rows?: unknown[] } | Locked | null}
          riskExplainers={riskExplainers}
        />

        <M05Family
          family={family}
          present={familyPresent}
          free={free}
          ownPassiveAltLabel={valueScore?.passive_alt_label ?? null}
          twinMixLabel={twin.mixLabel}
        />

        <M06KeyStats
          identity={identity}
          fees={fees}
          holdings={holdings}
          managerParent={managerParent}
          passiveBaseline={passiveBaseline}
          valueScoreReplicaR2={valueScore?.replica_r2 ?? null}
          exposureXray={exposureXray}
          family={family}
        />

        <div id="sources" className="mt-12 scroll-mt-20 border-t border-gray-200 pt-6">
          <SourceFooter
            src={src}
            profileBuildVersion={row.profileBuildVersion}
            completeness={row.dataCompletenessState}
          />
        </div>
      </div>
    </div>
  );
}
