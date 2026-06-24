// ============================================================================
// Change-tracking diff panel (query_results.md § 7 + Acceptance: "see what
// changes"). Renders the honest entered/left diff between the prior snapshot and
// the current ranking. NEVER fabricates history: a freshly saved Lens has no
// prior snapshot → it renders "No changes yet" with the saved-on date, not a
// made-up "0 changes" against an imaginary baseline.
// ============================================================================
import { fmtDate } from "@/lib/serving/format";
import type { LensDiff } from "@/lib/serving/lens";

export function LensDiffPanel({
  diff,
  savedOn,
}: {
  diff: LensDiff;
  savedOn: string;
}) {
  const enteredN = diff.entered.length;
  const leftN = diff.left.length;
  const changed = enteredN + leftN > 0;

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Changes since you saved this
        </span>
      </div>

      {!diff.hasPrior ? (
        // First visit after save: there is genuinely nothing to compare against.
        <p className="mt-2 text-sm text-gray-600">
          No changes yet — this is your baseline, saved {fmtDate(savedOn)}.
          We&apos;ll show what enters or leaves this ranking the next time the
          data refreshes.
        </p>
      ) : !changed ? (
        <p className="mt-2 text-sm text-gray-600">
          No changes since{" "}
          {diff.priorCapturedAt ? fmtDate(diff.priorCapturedAt) : "your last visit"}.
          The same {diff.unchangedCount} funds still match this question.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-gray-700">
            {summaryLine(enteredN, leftN)}
            {diff.priorCapturedAt && (
              <span className="text-gray-400">
                {" "}
                since {fmtDate(diff.priorCapturedAt)}
              </span>
            )}
            .
          </p>
          {enteredN > 0 && (
            <DiffList
              title={`Entered (${enteredN})`}
              tone="entered"
              items={diff.entered}
            />
          )}
          {leftN > 0 && (
            <DiffList title={`Left (${leftN})`} tone="left" items={diff.left} />
          )}
        </div>
      )}
    </section>
  );
}

function summaryLine(entered: number, left: number): string {
  const parts: string[] = [];
  if (entered > 0) parts.push(`${entered} fund${entered === 1 ? "" : "s"} entered`);
  if (left > 0) parts.push(`${left} fund${left === 1 ? "" : "s"} left`);
  // capitalize
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function DiffList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "entered" | "left";
  items: { series_id: string; ticker: string; name: string }[];
}) {
  const dot = tone === "entered" ? "bg-emerald-500" : "bg-rose-500";
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </div>
      <ul className="mt-1.5 space-y-1">
        {items.map((it) => (
          <li
            key={it.series_id}
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="font-semibold text-gray-900">{it.ticker}</span>
            {it.name && <span className="truncate text-gray-500">{it.name}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
