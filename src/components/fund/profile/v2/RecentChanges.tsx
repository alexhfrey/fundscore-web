// ============================================================================
// 06 · RecentChanges — server shell + gating for the year-over-year holdings
// shifts. FIXTURE block (Sample chip, no methodology link). Dual as-of stamps
// are mandatory (filings lag). Gating: the top shift is free; the full list is
// paid — the full rows only reach the client island when the caller is paid.
// ============================================================================
import type { RecentChangesTe } from "@/lib/serving/profile-v2";
import { ChapterHeader, Panel, PanelNote, SampleProvenance } from "./primitives";
import { Unavailable, LockedNotice, ProofPoint, UnlockLine } from "../primitives";
import { RecentChangesTable } from "./RecentChangesTable";

export function RecentChanges({
  changes,
  present,
  free,
  paid,
}: {
  // `changes` is passed only when free-entitled; `present` says a fixture exists
  // so the gated state reads "locked", not "unavailable".
  changes: RecentChangesTe | null;
  present: boolean;
  free: boolean;
  paid: boolean;
}) {
  if (!present) {
    return (
      <section id="s6" className="scroll-mt-24">
        <ChapterHeader index={6} title="Recent changes" />
        <Unavailable>
          A year-over-year holdings comparison isn&apos;t served for this fund yet.
        </Unavailable>
      </section>
    );
  }

  // The top shift is free-gated — anon sees a single locked affordance.
  if (!free || !changes || !changes.rows || changes.rows.length === 0) {
    return (
      <section id="s6" className="scroll-mt-24">
        <ChapterHeader index={6} title="Recent changes" sample />
        <LockedNotice tier="free">
          See the fund&apos;s biggest year-over-year positioning changes, with both
          filing dates.
        </LockedNotice>
      </section>
    );
  }

  const rows = changes.rows;
  const top = [...rows].sort(
    (a, b) => Math.abs(b.change_magnitude ?? 0) - Math.abs(a.change_magnitude ?? 0),
  )[0];

  return (
    <section id="s6" className="scroll-mt-24">
      <ChapterHeader
        index={6}
        title="Recent changes"
        asOf={changes.eval_date ? `year-over-year N-PORT comparison · evaluated ${changes.eval_date}` : undefined}
        takeaway={
          <>
            The biggest year-over-year move: {top.change_name} {top.change_direction}{" "}
            <span className="tabular-nums">
              {(top.change_magnitude ?? 0) > 0 ? "+" : "−"}
              {Math.abs(top.change_magnitude ?? 0).toFixed(1)} pp
            </span>
            .
          </>
        }
        sample
      />

      <Panel className="p-0">
        {/* Dual as-of stamps — mandatory (filings lag). */}
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3">
          <Stamp date={changes.holdings_as_of_prior} label="prior filing" />
          <span className="text-lg text-gray-400">→</span>
          <Stamp date={changes.holdings_as_of_current} label="current filing" />
          <span className="ml-auto max-w-[34ch] text-[11.5px] font-medium leading-snug text-amber-700">
            ⚠ Holdings filed with a lag; both as-of dates always shown.
          </span>
        </div>

        {paid ? (
          <RecentChangesTable rows={rows} />
        ) : (
          <div className="px-5 py-4">
            <ProofPoint
              label={`Top shift · ${changes.holdings_as_of_prior ?? ""} → ${changes.holdings_as_of_current ?? ""}`}
              value={`${top.change_name} ${(top.change_magnitude ?? 0) > 0 ? "+" : "−"}${Math.abs(top.change_magnitude ?? 0).toFixed(1)} pp`}
              readout={`The largest year-over-year change in the fund's positioning. The full list of moves — with sector, theme, concentration and cash filters — is a paid detail.`}
            />
            <UnlockLine tier="paid">
              See every year-over-year positioning change with type filters.
            </UnlockLine>
          </div>
        )}

        <PanelNote>
          {changes.ranking_note ??
            "Ordered by size of change (pp). Ranking by tracking-error impact is in development — size of move ≠ size of risk consequence."}
          <SampleProvenance label={changes.sample_label} />
        </PanelNote>
      </Panel>
    </section>
  );
}

function Stamp({ date, label }: { date: string | null; label: string }) {
  return (
    <span className="inline-flex flex-col">
      <span className="text-[17px] font-bold tabular-nums text-gray-900">{date ?? "—"}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
    </span>
  );
}
