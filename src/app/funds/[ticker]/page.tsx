import { notFound } from "next/navigation";
import {
  applyGates,
  getFundFactRow,
  getPreview,
  isLocked,
  stampByDomain,
  type Identity,
  type PassiveBaseline,
  type ValueOfferingReframed,
  type ValueScore,
  type RiskAttribution as RiskAttributionData,
  type SourceStamp,
  type SkillPreview,
  type Locked,
} from "@/lib/serving/profile";
import { resolveSession } from "@/lib/serving/session";
import {
  buildBetsTakeaway,
  buildResultTakeaway,
  buildVerdictTakeaway,
} from "@/lib/serving/format";
import {
  IdentityStrip,
  ValueScoreHero,
  Takeaways,
  InvestorFit,
  FeeFairness,
  ExposureXray,
  RiskAttribution,
  Alternatives,
  SelectionEvidence,
  Performance,
  SourceFooter,
  SectionTakeaway,
} from "@/components/fund/profile";

// Per-user dynamic render: the page reads the Supabase session (cookies) to gate
// the score/sections by tier server-side, so gated content (e.g. the paid 0-100
// value index, return attribution) never ships to an anon client.
export const dynamic = "force-dynamic";

interface FundPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: FundPageProps) {
  const { ticker } = await params;
  const row = await getFundFactRow(ticker);
  if (!row) return { title: "Fund Not Found | FundScore.ai" };
  const id = row.identity;
  const t = id.ticker ?? ticker.toUpperCase();
  return {
    title: `${t} ${id.fund_name ?? ""} Fund Profile: Fees, Holdings, Passive Alternative | FundScore`,
    description: `See ${id.fund_name ?? t} fees, holdings, theme and sector exposure, closest passive alternative, and key exposure differences versus a low-cost benchmark.`,
  };
}

// Drizzle columns come back camelCase; gated sections are replaced with {locked}.
// Helper to read a section as its typed shape or a Locked marker or null.
function section<T>(v: unknown): T | Locked | null {
  if (v == null) return null;
  if (isLocked(v)) return v as Locked;
  return v as T;
}

export default async function FundPage({ params }: FundPageProps) {
  const { ticker } = await params;
  const raw = await getFundFactRow(ticker);
  if (!raw) notFound();

  const { userState } = await resolveSession();
  const row = applyGates(raw, userState);

  const identity = row.identity as Identity;
  const isPassive = identity.management_style === "passive";

  // Hero: the Value Score verdict (CURRENT). Section is public; precise figures
  // are field-nulled below 'paid' by applyGates (verdict free, precision paid).
  const valueScore = (row.valueScore ?? null) as ValueScore | null;

  // Legacy reframed badge is retired from the hero, but its bet-profile read
  // still feeds InvestorFit ("who it suits"), so keep reading it here.
  const vr = section<ValueOfferingReframed>(row.valueOfferingReframed);
  const vrUnlocked = isLocked(vr) ? null : (vr as ValueOfferingReframed | null);
  const passive = section<PassiveBaseline>(row.passiveBaseline);
  const passiveUnlocked = isLocked(passive) ? null : (passive as PassiveBaseline | null);
  const passiveName = passiveUnlocked?.display_name ?? null;

  const holdings = isLocked(row.holdings) ? null : (row.holdings as { as_of_date?: string } | null);
  const holdingsAsOf = holdings?.as_of_date ?? null;

  const src = row.sourceInventory as {
    source_stamps: { source_label: string; as_of_date?: string | null }[];
    data_quality_warnings: { warning_id: string; severity: string; section_id: string; message: string }[];
    profile_build_version: string;
    last_profile_build_time: string;
  };

  // Inline data-freshness: read the already-served, public per-domain stamps so a
  // stale figure is never read as current. `source_inventory` is public, so this
  // adds no gated field. A `missing` stamp carries a null as_of_date and is
  // treated exactly like an absent one by each consumer.
  const inv = row.sourceInventory as unknown as { source_stamps?: SourceStamp[] };
  const expenseStamp = stampByDomain(inv, "expense");
  const holdingsStamp = stampByDomain(inv, "holdings");
  const holdingsStale = holdingsStamp?.status === "stale";

  // --- Consistent story takeaway lines (deterministic, served-fact only). ---
  // Each reads from the ALREADY-GATED row, so nothing gated above the user's
  // tier reaches the string. Locked sections expose only their whitelisted
  // preview, which is the same data the section component shows below.

  // Bets: from full exposure rows when unlocked, else the single gated-preview diff.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xrayVal = section<any>(row.exposureXray);
  let betsText: string | null = null;
  if (isLocked(xrayVal)) {
    const pp = getPreview(xrayVal) as
      | { exposure_name?: string; exposure_type?: string; difference?: number | null }
      | null;
    betsText = pp
      ? buildBetsTakeaway([
          {
            exposure_type: pp.exposure_type,
            exposure_name: pp.exposure_name,
            difference: pp.difference,
          },
        ])
      : null;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    betsText = buildBetsTakeaway((xrayVal as any)?.rows ?? null);
  }

  // Result: fund's own realized return (performance is public).
  const perf = (isLocked(row.performance) ? null : row.performance) as
    | { return_periods?: Record<string, number | null> | null }
    | null;
  const resultText = buildResultTakeaway(perf?.return_periods ?? null, isPassive);

  // Verdict: skill read (free preview or full) kept DISTINCT from attribution
  // (paid). The attribution clause only fires when the full rows are present
  // (paid+), so no gated bps figure leaks into a free/anon takeaway.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mpVal = section<any>(row.managerParent);
  let skillForVerdict:
    | { label: string | null; p_skill: number | null; alpha_ir: number | null }
    | null = null;
  if (isLocked(mpVal)) {
    const pp = getPreview(mpVal) as SkillPreview | null;
    if (pp) skillForVerdict = { label: pp.label, p_skill: pp.p_skill, alpha_ir: pp.alpha_ir };
  } else {
    const se = mpVal?.skill_evidence;
    if (se?.label != null)
      skillForVerdict = { label: se.label, p_skill: se.p_skill, alpha_ir: se.alpha_ir };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raVal = section<any>(row.returnAttribution);
  const attrRows = isLocked(raVal) ? null : (raVal?.rows ?? null);
  const verdictText = buildVerdictTakeaway(skillForVerdict, attrRows, isPassive);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ============================================================== */}
        {/* SECTION 1 — Hero: identity + value badge + fee gap + The Take.  */}
        {/* ============================================================== */}
        <IdentityStrip
          identity={identity}
          requestedTicker={ticker}
          holdingsAsOf={holdingsAsOf}
          holdingsStale={holdingsStale}
        />
        <ValueScoreHero vs={valueScore} />

        <div className="mt-12 space-y-12">
          {/* =========================================================== */}
          {/* SECTION 2 — "What's it betting on?" (Exposure X-Ray).        */}
          {/* =========================================================== */}
          <div>
            <SectionTakeaway label="The bets" text={betsText} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <ExposureXray xray={section<any>(row.exposureXray)} />
          </div>

          {/* =========================================================== */}
          {/* SECTION 3 — "How have the bets done?" (Performance).         */}
          {/* =========================================================== */}
          <div>
            <SectionTakeaway label="The result" text={resultText} />
            <Performance
              performance={perf}
              passiveName={passiveName}
              isPassive={isPassive}
            />
          </div>

          {/* =========================================================== */}
          {/* SECTION 4 — "Stock-picking, or did the bets carry it?"       */}
          {/* Skill read (Selection Evidence) + attribution (Risk &        */}
          {/* Attribution), kept DISTINCT — never summed.                  */}
          {/* =========================================================== */}
          <div>
            <SectionTakeaway label="The verdict" text={verdictText} />
            <div className="space-y-12">
              <SelectionEvidence
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                managerParent={section<any>(row.managerParent)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                returnAttribution={section<any>(row.returnAttribution)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                positioningChanges={section<any>(row.positioningChanges)}
                isPassive={isPassive}
              />
              <RiskAttribution
                risk={section<RiskAttributionData>(row.riskAttribution)}
                isPassive={isPassive}
                managementStyle={identity.management_style}
              />
            </div>
          </div>

          {/* =========================================================== */}
          {/* SECTION 5 — "More detail" (demoted below the story, one      */}
          {/* collapsible so these reads don't compete with the story).    */}
          {/* Each block keeps its own self-contained section heading.      */}
          {/* =========================================================== */}
          <details className="group rounded-2xl border border-gray-200 bg-white/60 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span className="text-lg font-bold text-gray-900">More detail</span>
              <span className="text-sm text-gray-400">
                <span className="group-open:hidden">
                  Fee parity · who it suits · takeaways · alternatives · sources — show
                </span>
                <span className="hidden group-open:inline">Hide</span>
              </span>
            </summary>
            <div className="space-y-12 border-t border-gray-100 px-5 py-8">
              <FeeFairness
                fees={
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  isLocked(row.fees) ? null : (row.fees as any)
                }
                isPassive={isPassive}
                expenseStamp={expenseStamp}
              />
              <InvestorFit vr={vrUnlocked} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Takeaways items={isLocked(row.takeaways) ? null : (row.takeaways as any[] | null)} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Alternatives alts={section<any>(row.alternatives)} />
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
