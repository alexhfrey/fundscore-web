import { notFound } from "next/navigation";
import {
  applyGates,
  getFundFactRow,
  isLocked,
  type Identity,
  type PassiveBaseline,
  type ValueOffering,
} from "@/lib/serving/profile";
import { resolveSession } from "@/lib/serving/session";

// Per-user dynamic render: the page reads the Supabase session (cookies) to gate
// the score/legs by tier, so it cannot be fully prerendered. The fact-row read
// is a single indexed lookup. (Future: PPR could restore a static anonymous
// shell with a dynamic gated hole — see serving_architecture Decision 5.)
export const dynamic = "force-dynamic";

interface FundPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: FundPageProps) {
  const { ticker } = await params;
  const row = await getFundFactRow(ticker);
  if (!row) return { title: "Fund Not Found | FundScore.ai" };
  const id = row.identity;
  return {
    title: `${id.ticker ?? ticker} — ${id.fund_name ?? ""} | FundScore.ai`,
    description: `${id.fund_name ?? ticker} — Value Offering profile vs its passive alternative on FundScore.ai.`,
  };
}

const LABEL_COLOR: Record<string, string> = {
  Strong: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Mixed: "text-amber-700 bg-amber-50 border-amber-200",
  Weak: "text-rose-700 bg-rose-50 border-rose-200",
};

function fmtAum(dollars: number | null): string {
  if (dollars == null) return "—";
  const b = dollars / 1e9;
  if (b >= 1) return `$${b.toFixed(1)}B`;
  return `$${(dollars / 1e6).toFixed(0)}M`;
}

export default async function FundPage({ params }: FundPageProps) {
  const { ticker } = await params;
  const raw = await getFundFactRow(ticker);
  if (!raw) notFound();

  const { userState } = await resolveSession();
  const row = applyGates(raw, userState);
  const id = row.identity as Identity;
  const vo = isLocked(row.valueOffering) ? null : (row.valueOffering as ValueOffering | null);
  const passive = isLocked(row.passiveBaseline)
    ? null
    : (row.passiveBaseline as PassiveBaseline | null);
  const src = row.sourceInventory as { last_profile_build_time?: string } | undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Identity strip */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-3xl font-bold text-gray-900">{id.ticker ?? ticker}</h1>
        <span className="text-xl text-gray-600">{id.fund_name}</span>
      </div>
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {[id.fund_family, id.vehicle_type, id.management_style, id.asset_class, id.peer_group]
          .filter(Boolean)
          .map((tag) => (
            <span
              key={tag as string}
              className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600"
            >
              {tag}
            </span>
          ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <Stat label="Latest NAV" value={id.latest_nav != null ? `$${id.latest_nav.toFixed(2)}` : "—"} />
        <Stat label="AUM" value={fmtAum(id.aum_usd)} />
        <Stat label="Holdings" value={id.holdings_count != null ? `${id.holdings_count}` : "—"} />
        <Stat label="Inception" value={id.inception_date ?? "—"} />
      </div>

      {/* Passive baseline strip — named alongside the score (anti-positioning rule) */}
      {passive && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          Compared with its passive alternative:{" "}
          <span className="font-semibold text-gray-900">{passive.display_name}</span>
          {passive.etf_weights?.length > 1 && (
            <span className="text-gray-500">
              {" "}
              ({passive.etf_weights.map((w) => w.etf).join(" / ")})
            </span>
          )}
        </div>
      )}

      {/* Value Offering hero */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Value Offering
          </div>
          <a
            href="/methodology#value-offering"
            className="text-xs text-gray-400 hover:text-[#1466b8] hover:underline"
          >
            How we calculate this
          </a>
        </div>

        {vo && vo.value_offering_status === "available" ? (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span
              className={`rounded-md border px-3 py-1 text-lg font-bold ${
                LABEL_COLOR[vo.value_offering_label ?? ""] ?? "text-gray-700 bg-gray-50 border-gray-200"
              }`}
            >
              {vo.value_offering_label}
            </span>
            {vo.value_offering_score != null ? (
              <span className="text-4xl font-extrabold tabular-nums text-gray-900">
                {vo.value_offering_score}
                <span className="text-lg font-medium text-gray-400">/100</span>
              </span>
            ) : (
              <a
                href="/signin"
                className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                Sign in to see the 0–100 score and 5-leg breakdown →
              </a>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            A Value Offering score isn’t available for this fund
            {vo?.suppression_reason ? ` (${vo.suppression_reason})` : ""}. Value
            Offering is computed for active equity funds with sufficient history.
          </p>
        )}

        {/* 5-leg breakdown (free+); anon sees a locked affordance */}
        {vo && vo.value_offering_status === "available" && (
          <div className="mt-5">
            {vo.legs ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Object.entries(vo.legs).map(([leg, score]) => (
                  <div key={leg} className="rounded-lg bg-gray-50 p-3">
                    <div className="text-[11px] font-medium uppercase text-gray-400">
                      {leg.replace(/_/g, " ")}
                    </div>
                    <div className="mt-0.5 text-xl font-semibold tabular-nums text-gray-800">
                      {score ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                The 5-leg breakdown (Skill Evidence, Fee Coverage, True Active Fee,
                Mandate Discipline, Tax &amp; Hidden Cost) unlocks with a free account.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source / as-of footer */}
      <p className="mt-6 text-xs text-gray-400">
        Profile build {row.profileBuildVersion}
        {src?.last_profile_build_time ? ` · assembled ${src.last_profile_build_time.slice(0, 10)}` : ""}
        {" · "}
        completeness: {row.dataCompletenessState}
        {" · "}
        <a href="/methodology" className="hover:text-[#1466b8] hover:underline">
          methodology
        </a>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}
