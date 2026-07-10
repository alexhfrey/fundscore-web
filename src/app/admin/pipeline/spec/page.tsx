import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { saveSpecAction } from "../actions";
import { SubmitButton } from "../SubmitButton";
import { isAdminAuthenticated, readSpec } from "@/lib/pipeline/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Edit Spec — Pipeline Admin",
  robots: { index: false, follow: false },
};

export default async function SpecEditPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  if (!(await isAdminAuthenticated())) return <Disabled />;
  const { path } = await searchParams;
  if (!path) notFound();

  const spec = await readSpec(path).catch(() => null);
  if (!spec) notFound();

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin/pipeline" className="text-sm font-medium text-[#1466b8]">
              Back to pipeline
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-gray-950">{spec.title}</h1>
            <p className="mt-1 text-xs text-gray-500">{spec.relPath}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{spec.status}</Badge>
            <Badge>{spec.track || "track?"}</Badge>
            <Badge>{spec.lane || "lane?"}</Badge>
          </div>
        </div>

        <form action={saveSpecAction} className="space-y-3">
          <input type="hidden" name="rel_path" value={spec.relPath} />
          <textarea
            name="content"
            defaultValue={spec.content}
            rows={34}
            className="min-h-[70vh] w-full resize-y border border-gray-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-gray-800 outline-none focus:border-[#1466b8]"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Saves directly to the Markdown file. Refresh the dashboard after saving.
            </p>
            <SubmitButton label="Save Spec" pendingLabel="Saving..." />
          </div>
        </form>
      </div>
    </div>
  );
}

function Disabled() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="border border-gray-200 bg-white p-5">
        <h1 className="text-xl font-semibold text-gray-950">Sign in required</h1>
        <p className="mt-2 text-sm text-gray-600">
          <Link href="/admin/pipeline" className="font-medium text-[#1466b8]">
            Sign in on the pipeline console
          </Link>{" "}
          to continue.
        </p>
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
      {children}
    </span>
  );
}
