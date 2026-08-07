// ============================================================================
// PreviewBanner — the amber "this is a design preview" strip. Server component
// (stays server — the Gold/Blue accent control is a client island rendered
// inline, per the app's server-shell/client-island split used everywhere
// else in v2).
// States the honesty contract: sections marked "sample" are not served yet.
// ============================================================================
import { AccentToggle } from "./AccentToggle";

export function PreviewBanner({ tier }: { tier: string }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Design preview
        </span>
        <span className="text-amber-900">
          Sections marked{" "}
          <span className="font-semibold">&ldquo;sample&rdquo;</span> are not
          served yet — their figures come from a labeled FCNTX fixture, not the
          production pipeline.
        </span>
        <AccentToggle />
        <span className="ml-auto text-[11px] text-amber-700/80">
          viewing as <span className="font-semibold capitalize">{tier}</span>
        </span>
      </div>
    </div>
  );
}
