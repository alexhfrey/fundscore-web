import { notFound } from "next/navigation";
import {
  applyGates,
  getFundFactRow,
  isLocked,
  stampByDomain,
  type Identity,
  type PassiveBaseline,
  type ValueOfferingReframed,
  type TheTake,
  type RiskAttribution as RiskAttributionData,
  type SourceStamp,
  type Locked,
} from "@/lib/serving/profile";
import { resolveSession } from "@/lib/serving/session";
import {
  IdentityStrip,
  ValueOfferingHero,
  Takeaways,
  InvestorFit,
  FeeFairness,
  ExposureXray,
  RiskAttribution,
  Alternatives,
  SelectionEvidence,
  SourceFooter,
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

  // Hero sections (gates: public; field-level value_index gated to paid).
  const vr = section<ValueOfferingReframed>(row.valueOfferingReframed);
  const vrUnlocked = isLocked(vr) ? null : (vr as ValueOfferingReframed | null);
  const theTake = section<TheTake>(row.theTake);
  const theTakeUnlocked = isLocked(theTake) ? null : (theTake as TheTake | null);
  const passive = section<PassiveBaseline>(row.passiveBaseline);
  const passiveUnlocked = isLocked(passive) ? null : (passive as PassiveBaseline | null);

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

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 1. Identity strip */}
        <IdentityStrip
          identity={identity}
          requestedTicker={ticker}
          holdingsAsOf={holdingsAsOf}
          holdingsStale={holdingsStale}
        />

        {/* 2. Value Offering hero (reframed badge) — leads the page */}
        <ValueOfferingHero
          vr={vrUnlocked}
          passive={passiveUnlocked}
          theTake={theTakeUnlocked}
        />

        <div className="mt-10 space-y-12">
          {/* 3. Takeaways (The Take renders in the hero) */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Takeaways items={isLocked(row.takeaways) ? null : (row.takeaways as any[] | null)} />

          {/* Investor Fit */}
          <InvestorFit vr={vrUnlocked} />

          {/* 4. Fee Fairness + True Active Fee */}
          <FeeFairness
            fees={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              isLocked(row.fees) ? null : (row.fees as any)
            }
            isPassive={isPassive}
            expenseStamp={expenseStamp}
          />

          {/* 5. Exposure X-Ray */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ExposureXray xray={section<any>(row.exposureXray)} />

          {/* 5b. Risk & Attribution: returns-based factor lens (betas / divergence / bias-timing-idio) */}
          <RiskAttribution
            risk={section<RiskAttributionData>(row.riskAttribution)}
            isPassive={isPassive}
          />

          {/* 6. Selection Evidence: skill + Manager Moves + Attribution + Shifts */}
          <SelectionEvidence
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            managerParent={section<any>(row.managerParent)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            returnAttribution={section<any>(row.returnAttribution)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            positioningChanges={section<any>(row.positioningChanges)}
            isPassive={isPassive}
          />

          {/* 7. Alternatives to inspect */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Alternatives alts={section<any>(row.alternatives)} />

          {/* 8. Data, methodology & disclosures */}
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
