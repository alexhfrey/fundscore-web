// ============================================================================
// Shared presentational primitives for the Fund Profile composition.
// Confident Consumer aesthetic: generous rounding, calm surfaces, source/as-of
// stamps near every claim, honest unavailable states.
// ============================================================================
import Link from "next/link";

/** A top-level page section with a heading, optional as-of stamp, and body. */
export function Section({
  id,
  title,
  subtitle,
  methodologyAnchor,
  asOf,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  methodologyAnchor?: string;
  asOf?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {methodologyAnchor && (
          <Link
            href={`/methodology#${methodologyAnchor}`}
            className="shrink-0 text-xs text-gray-400 hover:text-[#1466b8] hover:underline"
          >
            How we calculate this →
          </Link>
        )}
      </div>
      {children}
      {asOf && <AsOf>{asOf}</AsOf>}
    </section>
  );
}

/** A small, muted as-of / source stamp line. */
export function AsOf({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-gray-400">{children}</p>;
}

/** A bordered card surface. */
export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** Honest "this isn't available / is suppressed" state — never fake data. */
export function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
      {children}
    </div>
  );
}

/** A tier-gate affordance shown in place of locked content. */
export function LockedNotice({
  tier,
  children,
}: {
  tier: string;
  children: React.ReactNode;
}) {
  const cta =
    tier === "paid" || tier === "pro"
      ? "Upgrade to view"
      : "Create a free account to view";
  return (
    <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-700">
      <span className="text-indigo-900">{children}</span>{" "}
      <Link href="/signin" className="font-medium underline hover:no-underline">
        {cta} →
      </Link>
    </div>
  );
}

/** Inline evidence/source affordance — a small expandable details drawer. */
export function Evidence({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-1">
      <summary className="cursor-pointer list-none text-xs text-gray-400 hover:text-gray-600">
        <span className="group-open:hidden">{summary} ▸</span>
        <span className="hidden group-open:inline">{summary} ▾</span>
      </summary>
      <div className="mt-1.5 rounded-md bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
        {children}
      </div>
    </details>
  );
}

/** A pill/chip. */
export function Chip({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
