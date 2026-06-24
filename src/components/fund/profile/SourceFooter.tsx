// ============================================================================
// Data, Methodology & Disclosures (spec § 13) — the source/as-of control
// surface. Never empty. Lists source stamps, quality warnings, and the required
// no-advice disclosure. Public.
// ============================================================================
import Link from "next/link";
import { Section, Card, Evidence } from "./primitives";
import { fmtDate, EM_DASH } from "@/lib/serving/format";

interface SourceStamp {
  source_label: string;
  source_domain?: string;
  as_of_date?: string | null;
  status?: string;
}
interface Warning {
  warning_id: string;
  severity: string;
  section_id: string;
  message: string;
}
interface SourceInventory {
  source_stamps: SourceStamp[];
  data_quality_warnings: Warning[];
  profile_build_version: string;
  last_profile_build_time: string;
}

const SEV_DOT: Record<string, string> = {
  critical: "bg-rose-500",
  warn: "bg-amber-400",
  info: "bg-gray-300",
};

export function SourceFooter({
  src,
  profileBuildVersion,
  completeness,
}: {
  src: SourceInventory;
  profileBuildVersion: string;
  completeness: string;
}) {
  const warnings = src.data_quality_warnings ?? [];
  const stamps = src.source_stamps ?? [];

  return (
    <Section id="sources" title="Data, methodology & disclosures">
      <Card>
        {warnings.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Data quality notes
            </h3>
            <ul className="mt-1.5 space-y-1">
              {warnings.map((w) => (
                <li key={w.warning_id} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEV_DOT[w.severity] ?? "bg-gray-300"}`} />
                  <span>
                    {w.message}{" "}
                    <span className="text-xs text-gray-400">({w.section_id})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Evidence summary={`Sources (${stamps.length})`}>
          <ul className="space-y-0.5">
            {stamps.map((s, i) => (
              <li key={i}>
                {s.source_label}
                {s.as_of_date ? ` — as of ${fmtDate(s.as_of_date)}` : ""}
              </li>
            ))}
          </ul>
        </Evidence>

        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          FundScore is a transparency and analysis tool. It does not provide
          personalized investment advice, and nothing here predicts how a fund
          will perform. Past evidence and current holdings describe what is true
          today. Past performance does not imply future results.{" "}
          <Link href="/methodology" className="text-[#1466b8] hover:underline">
            Full methodology →
          </Link>
        </p>

        <p className="mt-3 text-xs text-gray-400">
          Profile build {profileBuildVersion} · completeness {completeness}
          {src.last_profile_build_time
            ? ` · assembled ${fmtDate(src.last_profile_build_time)}`
            : EM_DASH}
        </p>
      </Card>
    </Section>
  );
}
