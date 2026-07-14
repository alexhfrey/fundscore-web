"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authenticateAdmin,
  backlogLineTarget,
  closeBacklogItem,
  logoutAdmin,
  moveBacklogItem,
  moveSpec,
  saveBacklogItem,
  saveSpec,
  startPipelineJob,
  type PipelineJobKind,
  type PipelineProvider,
  type SpecStatus,
} from "@/lib/pipeline/admin";

const PIPELINE_PATH = "/admin/pipeline";

export async function authenticateAdminAction(formData: FormData): Promise<void> {
  const ok = await authenticateAdmin(stringValue(formData, "token"));
  if (!ok) throw new Error("Invalid pipeline admin token.");
  revalidatePath(PIPELINE_PATH);
}

export async function logoutAdminAction(): Promise<void> {
  await logoutAdmin();
  revalidatePath(PIPELINE_PATH);
}

export async function saveBacklogItemAction(formData: FormData): Promise<void> {
  await saveBacklogItem(
    numberValue(formData, "line_no"),
    stringValue(formData, "original_line"),
    stringValue(formData, "line"),
  );
  revalidatePath(PIPELINE_PATH);
  // The edit URL carries the pre-edit line hash; editing the text invalidates it, so returning to
  // that URL would 404 on the now-stale guard. Send the user back to the dashboard instead.
  redirect(PIPELINE_PATH);
}

export async function closeBacklogItemAction(formData: FormData): Promise<void> {
  const lineNo = numberValue(formData, "line_no");
  await closeBacklogItem(
    lineNo,
    await lineGuardValue(formData, lineNo),
  );
  revalidatePath(PIPELINE_PATH);
}

export async function moveBacklogItemAction(formData: FormData): Promise<void> {
  const direction = stringValue(formData, "direction");
  if (direction !== "up" && direction !== "down") throw new Error("Invalid move direction.");
  const lineNo = numberValue(formData, "line_no");
  await moveBacklogItem(
    lineNo,
    await lineGuardValue(formData, lineNo),
    direction,
  );
  revalidatePath(PIPELINE_PATH);
}

export async function saveSpecAction(formData: FormData): Promise<void> {
  await saveSpec(stringValue(formData, "rel_path"), stringValue(formData, "content"));
  revalidatePath(PIPELINE_PATH);
}

export async function moveSpecAction(formData: FormData): Promise<void> {
  const nextStatus = stringValue(formData, "next_status");
  if (!isSpecStatus(nextStatus)) throw new Error("Invalid spec status.");
  await moveSpec(stringValue(formData, "rel_path"), nextStatus);
  revalidatePath(PIPELINE_PATH);
}

export async function startPipelineJobAction(formData: FormData): Promise<void> {
  const provider = stringValue(formData, "provider");
  const kind = stringValue(formData, "kind");
  if (!isProvider(provider)) throw new Error("Invalid provider.");
  if (!isJobKind(kind)) throw new Error("Invalid job kind.");
  const target =
    stringValue(formData, "target_source") === "backlog_line"
      ? await backlogLineTarget(
          numberValue(formData, "line_no"),
          stringValue(formData, "line_hash"),
        )
      : stringValue(formData, "target");
  await startPipelineJob(provider, kind, target);
  revalidatePath(PIPELINE_PATH);
}

function stringValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

function numberValue(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isInteger(value)) throw new Error(`Invalid number: ${name}`);
  return value;
}

async function lineGuardValue(formData: FormData, lineNo: number): Promise<string> {
  const original = stringValue(formData, "original_line");
  if (original) return original;
  return backlogLineTarget(lineNo, stringValue(formData, "line_hash"));
}

function isProvider(value: string): value is PipelineProvider {
  return value === "claude" || value === "codex";
}

function isSpecStatus(value: string): value is SpecStatus {
  return value === "queue" || value === "done" || value === "rejected";
}

function isJobKind(value: string): value is PipelineJobKind {
  return (
    value === "backlog-triage" ||
    value === "story-spec" ||
    value === "spec-build" ||
    value === "spec-review" ||
    value === "queue-next" ||
    value === "queue-review"
  );
}
