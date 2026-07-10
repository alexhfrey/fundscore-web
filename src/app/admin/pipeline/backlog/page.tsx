import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveBacklogItemAction } from "../actions";
import { SubmitButton } from "../SubmitButton";
import { isAdminAuthenticated, backlogLineTarget } from "@/lib/pipeline/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Edit Backlog Item — Pipeline Admin",
  robots: { index: false, follow: false },
};

export default async function BacklogEditPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string; hash?: string }>;
}) {
  if (!(await isAdminAuthenticated())) return <Disabled />;
  const params = await searchParams;
  const lineNo = Number(params.line);
  if (!Number.isInteger(lineNo) || !params.hash) notFound();
  const line = await backlogLineTarget(lineNo, params.hash).catch(() => null);
  if (!line) notFound();

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 border-b border-gray-200 pb-5">
          <Link href="/admin/pipeline" className="text-sm font-medium text-[#1466b8]">
            Back to pipeline
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-950">Edit backlog item</h1>
          <p className="mt-1 text-xs text-gray-500">Line {lineNo + 1} in feature-pipeline/backlog.md</p>
        </div>

        <form action={saveBacklogItemAction} className="space-y-3">
          <input type="hidden" name="line_no" value={lineNo} />
          <input type="hidden" name="original_line" value={line} />
          <textarea
            name="line"
            defaultValue={line}
            rows={12}
            className="w-full resize-y border border-gray-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-gray-800 outline-none focus:border-[#1466b8]"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Keep the format: <code>- [ ] (type) Title — context</code>
            </p>
            <SubmitButton label="Save Item" pendingLabel="Saving..." />
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
