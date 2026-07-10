import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  authenticateAdminAction,
  closeBacklogItemAction,
  logoutAdminAction,
  moveBacklogItemAction,
  moveSpecAction,
  startPipelineJobAction,
} from "./actions";
import { SubmitButton } from "./SubmitButton";
import {
  adminConfigured,
  getPipelineState,
  hashText,
  isAdminAuthenticated,
  type BacklogItem,
  type PipelineJob,
  type PipelineJobKind,
  type PipelineProvider,
  type PipelineSpec,
  type SpecStatus,
} from "@/lib/pipeline/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Pipeline Admin — FundScore",
  robots: { index: false, follow: false },
};

const sectionLabels: Record<SpecStatus, string> = {
  queue: "Queued Specs",
  done: "Done Specs",
  rejected: "Rejected Specs",
};

export default async function PipelineAdminPage() {
  if (!adminConfigured()) return <Disabled />;
  if (!(await isAdminAuthenticated())) return <Login />;

  const { backlog, specs, jobs } = await getPipelineState();
  const openItems = backlog.find((section) => section.name === "Open")?.items ?? [];
  const speccedItems = backlog.find((section) => section.name === "Specced (in queue)")?.items ?? [];
  const doneItems = backlog.find((section) => section.name === "Done")?.items ?? [];
  const runningJobs = jobs.filter((job) => job.status === "running");

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Local pipeline admin
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-950">
              Backlog and spec queue
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <RunButton provider="claude" kind="queue-next" target="" label="Claude Next Spec" />
            <RunButton provider="codex" kind="queue-next" target="" label="Codex Next Spec" />
            <RunButton provider="claude" kind="queue-review" target="" label="Review Queue" />
            <form action={logoutAdminAction}>
              <SubmitButton label="Sign out" pendingLabel="..." tone="secondary" />
            </form>
          </div>
        </div>

        {runningJobs.length > 0 && (
          <div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {runningJobs.length === 1
              ? `Running ${runningJobs[0].provider} ${runningJobs[0].kind} job · pid ${runningJobs[0].pid ?? "unknown"}`
              : `${runningJobs.length} jobs are running`}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
          <section className="space-y-6">
            <BacklogSection title="Open" count={openItems.length} items={openItems} />
            <BacklogSection title="Specced (in queue)" count={speccedItems.length} items={speccedItems} />
            <BacklogSection title="Done" count={doneItems.length} items={doneItems.slice(0, 12)} compact />
          </section>

          <aside className="space-y-6">
            <SpecSection title={sectionLabels.queue} specs={specs.queue} editable />
            <SpecSection title={sectionLabels.done} specs={specs.done.slice(0, 12)} />
            <SpecSection title={sectionLabels.rejected} specs={specs.rejected} />
            <Jobs jobs={jobs} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function Disabled() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="border border-gray-200 bg-white p-5">
        <h1 className="text-xl font-semibold text-gray-950">Pipeline admin is unavailable</h1>
        <p className="mt-2 text-sm text-gray-600">
          Set a secret <code>PIPELINE_ADMIN_TOKEN</code> (and, in production,{" "}
          <code>PIPELINE_ADMIN_ENABLED=1</code>) to enable this local-only console.
        </p>
      </div>
    </div>
  );
}

function Login() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-950">Pipeline admin sign-in</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter the admin token (<code>PIPELINE_ADMIN_TOKEN</code>) to access the console.
        </p>
        <form action={authenticateAdminAction} className="mt-4 flex flex-col gap-3">
          <input
            type="password"
            name="token"
            autoComplete="off"
            required
            placeholder="Admin token"
            className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1466b8]"
          />
          <SubmitButton label="Sign in" pendingLabel="Signing in..." />
        </form>
      </div>
    </div>
  );
}

function BacklogSection({
  title,
  count,
  items,
  compact = false,
}: {
  title: string;
  count: number;
  items: BacklogItem[];
  compact?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        <span className="text-xs font-medium text-gray-500">{count}</span>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
            Empty
          </div>
        ) : (
          items.map((item, index) => (
            <BacklogItemEditor
              key={`${item.lineNo}-${hashText(item.line)}`}
              item={item}
              index={index}
              compact={compact}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BacklogItemEditor({
  item,
  index,
  compact,
}: {
  item: BacklogItem;
  index: number;
  compact: boolean;
}) {
  // Only Open items are re-triageable. Specced items reach Done when their spec ships (via the
  // spec's Mark Done, which reconciles the backlog) — closing or re-running them here would make
  // the backlog disagree with the spec queue or duplicate specs.
  const isOpen = item.section === "Open";
  const isStory = item.type === "story";
  if (compact) {
    return (
      <article className="border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
          <Badge>{item.type}</Badge>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-950">
            {item.title}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{item.line}</p>
      </article>
    );
  }

  return (
    <article className="border border-gray-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
        <Badge>{item.type}</Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-950">
          {item.title}
        </span>
      </div>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-600">{item.line}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={`/admin/pipeline/backlog?line=${item.lineNo}&hash=${hashText(item.line)}`}
          className="inline-flex h-8 items-center border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Edit
        </Link>
        <BacklogMoveButton item={item} direction="up" label="Up" />
        <BacklogMoveButton item={item} direction="down" label="Down" />
        {isOpen && (
          <>
            <CloseBacklogButton item={item} />
            <RunBacklogButton provider="claude" kind="backlog-triage" item={item} label="Claude Run" />
            <RunBacklogButton provider="codex" kind="backlog-triage" item={item} label="Codex Run" />
            {isStory && (
              <>
                <RunBacklogButton provider="claude" kind="story-spec" item={item} label="Claude Spec" />
                <RunBacklogButton provider="codex" kind="story-spec" item={item} label="Codex Spec" />
              </>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function BacklogMoveButton({
  item,
  direction,
  label,
}: {
  item: BacklogItem;
  direction: "up" | "down";
  label: string;
}) {
  return (
    <form action={moveBacklogItemAction}>
      <input type="hidden" name="line_no" value={item.lineNo} />
      <input type="hidden" name="line_hash" value={hashText(item.line)} />
      <input type="hidden" name="direction" value={direction} />
      <SubmitButton label={label} pendingLabel="Moving..." tone="secondary" />
    </form>
  );
}

function CloseBacklogButton({ item }: { item: BacklogItem }) {
  return (
    <form action={closeBacklogItemAction}>
      <input type="hidden" name="line_no" value={item.lineNo} />
      <input type="hidden" name="line_hash" value={hashText(item.line)} />
      <SubmitButton label="Close" pendingLabel="Closing..." tone="strong" />
    </form>
  );
}

function RunBacklogButton({
  provider,
  kind,
  item,
  label,
}: {
  provider: PipelineProvider;
  kind: Extract<PipelineJobKind, "backlog-triage" | "story-spec">;
  item: BacklogItem;
  label: string;
}) {
  return (
    <form action={startPipelineJobAction}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="target_source" value="backlog_line" />
      <input type="hidden" name="line_no" value={item.lineNo} />
      <input type="hidden" name="line_hash" value={hashText(item.line)} />
      <SubmitButton
        label={label}
        pendingLabel="Starting..."
        tone={provider === "codex" ? "codex" : "secondary"}
      />
    </form>
  );
}

function SpecSection({
  title,
  specs,
  editable = false,
}: {
  title: string;
  specs: PipelineSpec[];
  editable?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        <span className="text-xs font-medium text-gray-500">{specs.length}</span>
      </div>
      <div className="space-y-3">
        {specs.length === 0 ? (
          <div className="border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
            Empty
          </div>
        ) : (
          specs.map((spec) => <SpecEditor key={spec.relPath} spec={spec} editable={editable} />)
        )}
      </div>
    </section>
  );
}

function SpecEditor({ spec, editable }: { spec: PipelineSpec; editable: boolean }) {
  return (
    <article className="border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{spec.track || "track?"}</Badge>
        <Badge>{spec.lane || "lane?"}</Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-950">
          {spec.title}
        </span>
      </div>
      <div className="mt-1 truncate text-xs text-gray-500">{spec.relPath}</div>
      {spec.dependsOn && (
        <div className="mt-1 text-xs text-amber-700">depends_on: {spec.dependsOn}</div>
      )}

      {editable && (
        <Link
          href={`/admin/pipeline/spec?path=${encodeURIComponent(spec.relPath)}`}
          className="mt-3 inline-block text-sm font-medium text-[#1466b8] hover:text-[#0f4f8c]"
        >
          Edit spec
        </Link>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {spec.status === "queue" && (
          <>
            <RunButton provider="claude" kind="spec-build" target={spec.relPath} label="Claude Build" />
            <RunButton provider="codex" kind="spec-build" target={spec.relPath} label="Codex Build" />
            <RunButton provider="claude" kind="spec-review" target={spec.relPath} label="Claude Refine" />
            <RunButton provider="codex" kind="spec-review" target={spec.relPath} label="Codex Refine" />
            <SpecMoveButton spec={spec} nextStatus="done" label="Mark Done" />
            <SpecMoveButton spec={spec} nextStatus="rejected" label="Reject" />
          </>
        )}
        {spec.status !== "queue" && <SpecMoveButton spec={spec} nextStatus="queue" label="Reopen" />}
      </div>
    </article>
  );
}

function SpecMoveButton({
  spec,
  nextStatus,
  label,
}: {
  spec: PipelineSpec;
  nextStatus: SpecStatus;
  label: string;
}) {
  return (
    <form action={moveSpecAction}>
      <input type="hidden" name="rel_path" value={spec.relPath} />
      <input type="hidden" name="next_status" value={nextStatus} />
      <SubmitButton label={label} pendingLabel="Moving..." tone="secondary" />
    </form>
  );
}

function RunButton({
  provider,
  kind,
  target,
  label,
}: {
  provider: PipelineProvider;
  kind: PipelineJobKind;
  target: string;
  label: string;
}) {
  return (
    <form action={startPipelineJobAction}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="target" value={target} />
      <SubmitButton
        label={label}
        pendingLabel="Starting..."
        tone={provider === "codex" ? "codex" : "secondary"}
      />
    </form>
  );
}

function Jobs({ jobs }: { jobs: PipelineJob[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-950">Jobs</h2>
        <span className="text-xs font-medium text-gray-500">{jobs.length}</span>
      </div>
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
            Empty
          </div>
        ) : (
          jobs.map((job) => (
            <article key={job.id} className="border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{job.status}</Badge>
                <Badge>{job.provider}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-950">
                  {job.kind}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {formatDate(job.startedAt)}
                {job.pid ? ` · pid ${job.pid}` : ""}
                {job.exitCode != null ? ` · exit ${job.exitCode}` : ""}
              </div>
              <div className="mt-1 truncate text-xs text-gray-500">{job.logRelPath}</div>
              <Link
                href={`/admin/pipeline/job?id=${encodeURIComponent(job.id)}`}
                className="mt-2 inline-block text-sm font-medium text-[#1466b8] hover:text-[#0f4f8c]"
              >
                View log
              </Link>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
      {children}
    </span>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
