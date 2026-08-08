// ============================================================================
// V4 movement chrome — the shared shell every movement is built from.
// ----------------------------------------------------------------------------
// Ported from the design canon:
//   fund_score/docs/product/strategy/mockup_fund_profile_v4_2026-07-28.html
// The mockup's raw CSS classes (.movement/.eyebrow/.card/.caption/.exrow/…) map
// onto these components 1:1 so the layout can be diffed against the canon.
//
// DATA RULES these primitives exist to enforce:
//  • `Absent` is the ONLY way a movement renders a missing figure. It always
//    states WHY (honest-missing reason), never a zero, dash-in-place-of-number,
//    or "coming soon" that implies the number exists.
//  • `LockedNote` is the ONLY way a movement renders a tier-gated figure. It
//    never receives the value it is hiding — the page passes it nothing but copy.
//  • `MethodLink` is mandatory on every live movement (flip-protocol condition
//    3): a movement with no `/methodology#anchor` does not ship.
// Server components throughout (no "use client") — these hold no state.
// ============================================================================

import Link from "next/link";
import type { ReactNode } from "react";

/** One V4 movement: `<section id>` + the eyebrow/headline/standfirst block. */
export function Movement({
  id,
  index,
  eyebrow,
  headline,
  standfirst,
  children,
}: {
  /** The mockup's on-page anchor id (#exec, #whatis, …) — the nav links to it. */
  id: string;
  /** Two-digit movement number as rendered in the eyebrow ("00", "01", …). */
  index: string;
  /** The eyebrow's descriptive tail, e.g. "the whole case, five lines". */
  eyebrow: string;
  /** A CLAIM a reader could disagree with — never a description of the UI. */
  headline?: ReactNode;
  standfirst?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-11 scroll-mt-20 first:mt-0">
      <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-gray-400">
        <b className="font-semibold text-gray-900">
          {index} · {eyebrow.split(" — ")[0]}
        </b>
        {eyebrow.includes(" — ") ? ` — ${eyebrow.split(" — ").slice(1).join(" — ")}` : null}
      </p>
      {headline != null ? (
        <h2 className="mb-1.5 max-w-3xl font-serif text-[25px] font-semibold leading-[1.25] text-gray-900">
          {headline}
        </h2>
      ) : null}
      {standfirst != null ? (
        <div className="max-w-[680px] text-[13.5px] leading-relaxed text-gray-500">{standfirst}</div>
      ) : null}
      {children}
    </section>
  );
}

/** The mockup's `.card` — a bordered panel. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-3.5 rounded-[14px] border border-gray-200 bg-white px-6 py-5 ${className}`}
    >
      {children}
    </div>
  );
}

/** The mockup's small mono card label ("WHAT MOVES THIS FUND"). */
export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gray-400">
      {children}
    </div>
  );
}

/** The mockup's `.takeaway` — a one-line read under a card label. */
export function Takeaway({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[15px] font-semibold text-gray-900">{children}</p>;
}

/** The mockup's `.caption` — basis/limitation prose under a card. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2.5 max-w-[820px] text-[11.5px] leading-relaxed text-gray-500">{children}</p>
  );
}

/** The mockup's `.posline` — a dashed-rule footnote line inside a card. */
export function PosLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3.5 border-t border-dashed border-gray-200 pt-3 text-[13px] text-gray-500">
      {children}
    </p>
  );
}

/** The mockup's `.mchip` — a neutral mono chip. */
export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 font-mono text-[11.5px] text-gray-700"
    >
      {children}
    </span>
  );
}

/** The mockup's `.basischip` — names the BASIS of the figure beside it. */
export function BasisChip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 font-mono text-[11px] tracking-[0.04em] text-gray-700"
    >
      {children}
    </span>
  );
}

/**
 * The verdict badge. `tone` is derived from the served breakeven state ONLY.
 * Canon: no green/positive chip on a below-breakeven fund, and the wording is
 * PAST TENSE — the badge reports a record, never a forecast.
 */
export function VerdictBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "cleared" | "not_cleared" | "even";
}) {
  const styles =
    tone === "cleared"
      ? "bg-crescent-good/10 text-crescent-good border-crescent-good/30"
      : tone === "even"
        ? "bg-gray-100 text-gray-700 border-gray-300"
        : "bg-amber-100 text-amber-800 border-amber-400/40";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[13px] font-semibold ${styles}`}
    >
      <span aria-hidden>●</span>
      {children}
    </span>
  );
}

/**
 * Deep link to the movement's methodology artifact. Flip-protocol condition 3:
 * a live movement without one of these does not ship.
 */
export function MethodLink({
  anchor,
  children = "How we calculate this →",
}: {
  anchor: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={`/methodology#${anchor}`}
      className="text-xs text-gray-500 underline decoration-dotted underline-offset-2 hover:text-gray-900"
    >
      {children}
    </Link>
  );
}

/**
 * The honest-missing state. A movement (or one slot inside it) renders this
 * INSTEAD of a figure whenever the served value is absent, or is present but
 * known-wrong (see `reason`). It never shows a placeholder number.
 *
 * `reason` must be a real, specific cause — "this fund has no matched passive
 * twin", "the filed book is not yet served on the right basis" — never a vague
 * "unavailable".
 */
export function Absent({
  what,
  reason,
  className = "",
}: {
  what: string;
  reason: string;
  className?: string;
}) {
  return (
    <p
      className={`rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-gray-500 ${className}`}
    >
      <span className="font-semibold text-gray-700">{what} is not shown.</span> {reason}
    </p>
  );
}

/**
 * The tier-gated state. Receives NO gated value — only the name of what sits
 * behind the gate. The numbers were already stripped server-side by applyGates
 * before this component's parent ever held them.
 */
export function LockedNote({
  what,
  tier = "paid",
  className = "",
}: {
  what: string;
  tier?: string;
  className?: string;
}) {
  return (
    <p
      className={`rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-gray-500 ${className}`}
    >
      <span className="font-semibold text-gray-700">{what}</span> is part of a {tier} plan.
    </p>
  );
}
