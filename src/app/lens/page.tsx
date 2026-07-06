import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/serving/session";
import { listLenses, getQuotaState } from "@/lib/serving/lens";
import { fmtDate } from "@/lib/serving/format";

// "My Lenses" surface (query_results.md § 7: Lens management entry point — list
// the user's saved Lenses). Per-user + auth-gated → dynamic, noindex.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Lenses — FundScore",
  robots: { index: false, follow: false },
};

interface MyLensesProps {
  searchParams: Promise<{ deleted?: string }>;
}

export default async function MyLensesPage({ searchParams }: MyLensesProps) {
  const { deleted } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <SignedOut />;

  const { userState } = await resolveSession();
  const [lenses, quota] = await Promise.all([
    listLenses(user.id),
    getQuotaState(user.id, userState),
  ]);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Lenses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your saved views of the fund universe. Open one to see the current
              ranking and what&apos;s changed.
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {quota.limit == null
              ? `${quota.used} saved · unlimited`
              : `${quota.used} / ${quota.limit} saved`}
          </span>
        </div>

        {deleted === "1" && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs text-gray-600">
            Lens deleted.
          </div>
        )}

        {lenses.length === 0 ? (
          <EmptyLenses />
        ) : (
          <ul className="mt-6 space-y-3">
            {lenses.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lens/${l.lensSlug}`}
                  className="group block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-[#1466b8]/40 hover:bg-gray-50/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {l.name}
                      </div>
                      {l.note && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {l.note}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-gray-400">
                        Saved {fmtDate(l.createdAt)} ·{" "}
                        {l.changeTracking ? "tracking changes" : "tracking off"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-[#1466b8] opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 border-t border-gray-200 pt-6">
          <Link
            href="/search"
            className="text-sm font-medium text-[#1466b8] hover:underline"
          >
            Ask a new question →
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyLenses() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <h2 className="text-sm font-semibold text-gray-900">No Lenses yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        Run a question, then choose &ldquo;Save as Lens&rdquo; to keep it here and
        track how the ranking changes over time.
      </p>
      <Link
        href="/search"
        className="mt-4 inline-block rounded-lg bg-[#1466b8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f4f8c]"
      >
        Ask about funds →
      </Link>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-gray-900">Sign in to see your Lenses</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          A free account lets you save up to 3 Lenses and track how their
          rankings change.
        </p>
        <Link
          href={`/signin?next=${encodeURIComponent("/lens")}`}
          className="mt-4 inline-block rounded-lg bg-[#1466b8] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f4f8c]"
        >
          Sign in →
        </Link>
      </div>
    </div>
  );
}
