// ============================================================================
// Profile v2 (dossier) shared primitives — the app's calm gray/white Tailwind
// system, NOT the mock's bespoke paper/serif CSS. Translates the dossier's
// chapter → panel → note scaffolding into reusable pieces.
//
// SAMPLE MARKING: every fixture-backed block renders a visible <SampleChip>
// (off isSample()) and NEVER carries a methodology link — the registry is a
// trust surface reserved for shipped data products.
// ============================================================================
import { InfoTip } from "./InfoTip";

/** Amber "sample data" chip — the honesty marker for a fixture-backed block. */
export function SampleChip({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      {children ?? "Sample"}
    </span>
  );
}

/** Amber "prototype estimate" chip — real inputs, method not yet production. */
export function ProtoChip({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
      {children ?? "Prototype estimate"}
    </span>
  );
}

/** Dashed neutral "honest gap / in development" chip. */
export function GapChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-gray-300 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
      {children}
    </span>
  );
}

/**
 * A dossier chapter header: eyebrow ("Section NN · of total"), title, optional
 * as-of, and the takeaway line that leads the section. `sampleChip` shows the
 * sample marker inline; sample sections pass NO methodology anchor.
 *
 * `total` defaults to 5 — the Crescent v2 page (Step 7) has five top-level
 * blocks, not the old eight numbered chapters; every caller that doesn't pass
 * its own `total` (fund family / historical performance / attribution / fee
 * fairness — all now living as drill-downs, not chapters) inherits that
 * default so a stale "of 08" reading can't leak back in from an unmodified
 * call site.
 *
 * `demoted` renders the SAME title/asOf/takeaway/sub as a smaller SUB-header
 * with no "Section NN · of total" eyebrow and no big number — for a chapter
 * reparented under another top-level block (e.g. Current positioning / Recent
 * changes living inside Block 2's Anatomy section) rather than standing as
 * its own numbered chapter.
 */
export function ChapterHeader({
  index,
  title,
  asOf,
  takeaway,
  sub,
  sample,
  total = 5,
  demoted = false,
}: {
  index: number;
  title: string;
  asOf?: string | null;
  takeaway?: React.ReactNode;
  sub?: React.ReactNode;
  sample?: boolean;
  total?: number;
  demoted?: boolean;
}) {
  if (demoted) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-bold tracking-tight text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            {asOf && <span className="text-xs text-gray-400">{asOf}</span>}
            {sample && <SampleChip />}
          </div>
        </div>
        {takeaway && (
          <p className="mt-2 max-w-[74ch] text-[15px] font-semibold leading-relaxed text-gray-900">
            {takeaway}
          </p>
        )}
        {sub && (
          <p className="mt-1.5 max-w-[76ch] text-sm leading-relaxed text-gray-500">{sub}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          Section {String(index).padStart(2, "0")} · of {String(total).padStart(2, "0")}
        </span>
        <span className="h-px flex-1 bg-gray-200" />
        {sample && <SampleChip />}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
        {asOf && <span className="text-xs text-gray-400">{asOf}</span>}
      </div>
      {takeaway && (
        <p className="mt-3 max-w-[74ch] text-[17px] font-semibold leading-relaxed text-gray-900">
          {takeaway}
        </p>
      )}
      {sub && (
        <p className="mt-2 max-w-[76ch] text-sm leading-relaxed text-gray-500">{sub}</p>
      )}
    </div>
  );
}

/** A bordered panel surface (matches the app's Card aesthetic, no inner pad). */
export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/** A panel header row: title (+ optional ⓘ tip) and a right-aligned as-of note. */
export function PanelHead({
  title,
  asOf,
  tip,
  right,
}: {
  title: React.ReactNode;
  asOf?: React.ReactNode;
  tip?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pb-1.5 pt-4">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
        {title}
        {tip && <InfoTip label={typeof title === "string" ? title : "info"}>{tip}</InfoTip>}
      </h3>
      {right ?? (asOf && <span className="text-[11px] text-gray-400">{asOf}</span>)}
    </div>
  );
}

/** A footnote/explainer strip under a panel body. `tone="warn"` = amber caution. */
export function PanelNote({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-l-2 border-amber-300 bg-amber-50/60 text-amber-900"
      : "border-t border-gray-100 bg-gray-50/60 text-gray-600";
  return (
    <div className={`px-5 py-3 text-[13px] leading-relaxed ${cls}`}>{children}</div>
  );
}

/** A small provenance line printed under a sample block (the fixture's label). */
export function SampleProvenance({ label }: { label?: string | null }) {
  if (!label) return null;
  return (
    <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
      Sample provenance: {label}
    </p>
  );
}
