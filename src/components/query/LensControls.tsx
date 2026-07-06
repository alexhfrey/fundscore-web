// ============================================================================
// Lens header controls (query_results.md § 7): the personal "your saved view"
// banner, the share affordance (copy the /lens/{lens_slug} link), and the
// owner-only delete control. Non-owner (shared) viewers see the banner + the
// underlying public query link, but no management controls.
// ============================================================================
import Link from "next/link";
import { fmtDate } from "@/lib/serving/format";
import { deleteLensAction } from "@/app/lens/actions";
import { CopyLinkButton } from "./CopyLinkButton";

export function LensControls({
  lensSlug,
  querySlug,
  name,
  note,
  savedOn,
  isOwner,
  justSaved,
}: {
  lensSlug: string;
  querySlug: string;
  name: string;
  note: string | null;
  savedOn: string;
  isOwner: boolean;
  justSaved: boolean;
}) {
  return (
    <div className="mb-4 space-y-3">
      {justSaved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          Lens saved. This is your personal view — share the link or revisit it
          to see what changes.
        </div>
      )}

      <div className="rounded-lg border border-[#1466b8]/20 bg-[#e8f0fe] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#0f4f8c]">
              {isOwner ? "Your saved Lens" : "Shared Lens"}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-gray-900">
              {name}
            </div>
            {note && <p className="mt-0.5 text-xs text-gray-600">{note}</p>}
            <p className="mt-1 text-[11px] text-gray-500">
              Saved {fmtDate(savedOn)} · runs the published question{" "}
              <Link
                href={`/q/${querySlug}`}
                className="text-[#1466b8] hover:underline"
              >
                /q/{querySlug.slice(0, 28)}
                {querySlug.length > 28 ? "…" : ""}
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyLinkButton path={`/lens/${lensSlug}`} label="Share Lens" />
            {isOwner && (
              <form action={deleteLensAction}>
                <input type="hidden" name="lens_slug" value={lensSlug} />
                <button
                  type="submit"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-rose-300 hover:text-rose-700"
                >
                  Delete
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
