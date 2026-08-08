// ============================================================================
// V4 movement nav (mockup .nav) — sticky, mono, one entry per movement.
// ----------------------------------------------------------------------------
// The nav is built from the movements the PAGE actually renders. A movement
// whose backend has not landed is absent from this list rather than linking to
// an anchor that isn't on the page.
// ============================================================================

export interface V4NavItem {
  /** The movement's `<section id>` (#exec, #whatis, …). */
  id: string;
  /** Two-digit movement number, or "—" for the sources footer. */
  index: string;
  label: string;
}

export function V4Nav({ items, note }: { items: V4NavItem[]; note?: string | null }) {
  return (
    <nav className="sticky top-0 z-30 -mx-7 mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-gray-200 bg-white/95 px-7 py-2.5 backdrop-blur">
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          className="font-mono text-[11px] tracking-[0.07em] text-gray-500 no-underline hover:text-gray-900"
        >
          <b className="text-gray-900">{it.index}</b> {it.label}
        </a>
      ))}
      {note ? (
        <span className="ml-auto font-mono text-[10.5px] text-gray-400">{note}</span>
      ) : null}
    </nav>
  );
}
