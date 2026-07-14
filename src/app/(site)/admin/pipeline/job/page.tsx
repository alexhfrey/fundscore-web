import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdminAuthenticated, readJob } from "@/lib/pipeline/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Job Log — Pipeline Admin",
  robots: { index: false, follow: false },
};

export default async function JobPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!(await isAdminAuthenticated())) return <Disabled />;
  const { id } = await searchParams;
  if (!id) notFound();
  const job = await readJob(id).catch(() => null);
  if (!job) notFound();

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 border-b border-gray-200 pb-5">
          <Link href="/admin/pipeline" className="text-sm font-medium text-[#1466b8]">
            Back to pipeline
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-950">{job.kind}</h1>
          <p className="mt-1 text-xs text-gray-500">
            {job.provider} · {job.status}
            {job.pid ? ` · pid ${job.pid}` : ""}
            {job.exitCode != null ? ` · exit ${job.exitCode}` : ""}
          </p>
          <p className="mt-1 text-xs text-gray-500">{job.logRelPath}</p>
        </div>

        <pre className="max-h-[75vh] overflow-auto border border-gray-200 bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">
          {job.logTail || "No log output yet."}
        </pre>
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
