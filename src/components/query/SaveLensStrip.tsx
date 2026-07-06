"use client";

// ============================================================================
// Save / Share strip (query_results.md § 7 "Save As Lens And Share").
// Rendered under the ranked results on /q/{slug}. Lets an authenticated user
// save the current canonical query as a personal Lens (opt-in change tracking),
// and lets ANY user copy the shareable /q/{slug} URL.
//
// CLIENT island so the /q/{slug} page stays ISR/crawlable (Decision 5): it
// fetches the caller's own session + quota from /api/lens/quota and renders the
// right affordance (anon → sign-in CTA; free at quota → upgrade copy; otherwise
// the save form). The form posts to the saveLensAction server action, which
// re-validates auth + quota + query resolution server-side — the client state is
// only for choosing which affordance to show.
// ============================================================================
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { saveLensAction } from "@/app/lens/actions";
import { CopyLinkButton } from "./CopyLinkButton";

const SAVE_ERROR_COPY: Record<string, string> = {
  quota_exhausted:
    "You've reached your saved-Lens limit on the free plan. Upgrade for unlimited Lenses.",
  unknown_query: "We couldn't resolve this question to save it. Try again.",
  empty_name: "Give your Lens a name before saving.",
};

interface QuotaState {
  used: number;
  limit: number | null;
  exhausted: boolean;
}
interface ProbeState {
  signedIn: boolean;
  userState?: string;
  quota?: QuotaState;
}

export function SaveLensStrip({
  querySlug,
  parsedQueryText,
}: {
  querySlug: string;
  parsedQueryText: string;
}) {
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const searchParams = useSearchParams();
  const saveError = searchParams.get("save");

  useEffect(() => {
    let active = true;
    fetch("/api/lens/quota", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((d: ProbeState) => active && setProbe(d))
      .catch(() => active && setProbe({ signedIn: false }));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-10 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Save as Lens</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">
            Your saved view of the fund universe. Keep this question and
            we&apos;ll show you what changes in the ranking over time.
          </p>
        </div>
        <CopyLinkButton path={`/q/${querySlug}`} label="Share this query" />
      </div>

      {saveError && SAVE_ERROR_COPY[saveError] && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {SAVE_ERROR_COPY[saveError]}
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-4">
        {probe == null ? (
          <div className="h-9 w-44 animate-pulse rounded-md bg-gray-100" />
        ) : !probe.signedIn ? (
          <AnonCta querySlug={querySlug} />
        ) : probe.quota?.exhausted ? (
          <QuotaExhausted
            used={probe.quota.used}
            limit={probe.quota.limit}
          />
        ) : (
          <SaveForm
            querySlug={querySlug}
            parsedQueryText={parsedQueryText}
            quota={probe.quota ?? null}
          />
        )}
      </div>
    </section>
  );
}

function AnonCta({ querySlug }: { querySlug: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-600">
        Create a free account to save this as a Lens and track how the ranking
        changes.
      </p>
      <Link
        href={`/signin?mode=signup&next=${encodeURIComponent(`/q/${querySlug}`)}`}
        className="shrink-0 rounded-lg bg-[#1466b8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f4f8c]"
      >
        Create a free account →
      </Link>
    </div>
  );
}

function QuotaExhausted({
  used,
  limit,
}: {
  used: number;
  limit: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-600">
        You&apos;ve saved {used} of {limit} Lenses on the free plan. Upgrade for
        unlimited Lenses and change-tracking notifications.
      </p>
      <span className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        Free plan limit reached ({used}/{limit})
      </span>
    </div>
  );
}

function SaveForm({
  querySlug,
  parsedQueryText,
  quota,
}: {
  querySlug: string;
  parsedQueryText: string;
  quota: QuotaState | null;
}) {
  return (
    <form action={saveLensAction} className="space-y-3">
      <input type="hidden" name="query_slug" value={querySlug} />
      <div>
        <label htmlFor="lens-name" className="block text-xs font-medium text-gray-700">
          Lens name
        </label>
        <input
          id="lens-name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={parsedQueryText}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1466b8] focus:outline-none focus:ring-1 focus:ring-[#1466b8]"
        />
      </div>
      <div>
        <label htmlFor="lens-note" className="block text-xs font-medium text-gray-700">
          Note <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="lens-note"
          name="note"
          type="text"
          maxLength={240}
          placeholder="Why you're watching this"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1466b8] focus:outline-none focus:ring-1 focus:ring-[#1466b8]"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          name="change_tracking"
          defaultChecked
          className="h-4 w-4 rounded border-gray-300 text-[#1466b8] focus:ring-[#1466b8]"
        />
        Track changes to this ranking over time
      </label>
      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          className="rounded-lg bg-[#1466b8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f4f8c]"
        >
          Save as Lens
        </button>
        {quota?.limit != null && (
          <span className="text-[11px] text-gray-400">
            {quota.used}/{quota.limit} Lenses used
          </span>
        )}
      </div>
    </form>
  );
}
