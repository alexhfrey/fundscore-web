import { spawn } from "node:child_process";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

export type BacklogSectionName = "Open" | "Specced (in queue)" | "Done";
export type BacklogItemType = "bug" | "data" | "story" | "unknown";
export type SpecStatus = "queue" | "done" | "rejected";
export type PipelineProvider = "claude" | "codex";
export type PipelineJobKind =
  | "backlog-triage"
  | "story-spec"
  | "spec-build"
  | "spec-review"
  | "queue-next"
  | "queue-review";

export interface BacklogItem {
  lineNo: number;
  section: BacklogSectionName;
  checked: " " | "x" | "~";
  type: BacklogItemType;
  title: string;
  line: string;
}

export interface BacklogSection {
  name: BacklogSectionName;
  items: BacklogItem[];
}

export interface PipelineSpec {
  slug: string;
  status: SpecStatus;
  relPath: string;
  title: string;
  track: string;
  lane: string;
  repo: string;
  dependsOn: string;
  updatedAt: string;
  content: string;
}

export interface PipelineJob {
  id: string;
  provider: PipelineProvider;
  kind: PipelineJobKind;
  target: string;
  cwd: string;
  command: string[];
  prompt: string;
  pid?: number;
  status: "running" | "done" | "failed" | "unknown";
  exitCode?: number | null;
  signal?: string | null;
  startedAt: string;
  finishedAt?: string;
  logRelPath: string;
  logTail?: string;
}

const WEBROOT = process.cwd();
const FEATURE_ROOT = path.join(WEBROOT, "feature-pipeline");
const BACKLOG_PATH = path.join(FEATURE_ROOT, "backlog.md");
const SPECS_ROOT = path.join(FEATURE_ROOT, "specs");
const JOBS_ROOT = path.join(FEATURE_ROOT, "jobs");
const CONFIG_PATH = path.join(FEATURE_ROOT, "config", "page-types.json");
const HARNESS_ROOT = path.resolve(WEBROOT, "..", "fundscore-harness");

const SECTION_NAMES: BacklogSectionName[] = ["Open", "Specced (in queue)", "Done"];

interface SectionRange {
  name: string;
  headingLine: number;
  endLine: number;
}

const ADMIN_COOKIE = "fs_pipeline_admin";
const ADMIN_COOKIE_PATH = "/admin/pipeline";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12h session

// Set and clear must share the same path — a Path=/admin/pipeline cookie is a different cookie
// from Path=/, so deleting on the default path would leave the session live after sign-out.
function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: ADMIN_COOKIE_PATH,
    maxAge,
  };
}

function adminToken(): string {
  return process.env.PIPELINE_ADMIN_TOKEN ?? "";
}

/**
 * The console is *configured* (reachable at all) only when a real secret token is set AND the
 * environment permits it. The env flag alone never grants access: every read/mutation additionally
 * requires an authenticated request (see isAdminAuthenticated). That second factor is the point —
 * this endpoint spawns `claude`/`codex` processes and rewrites the backlog/specs, so a single env
 * var must not be sufficient to reach it.
 */
export function adminConfigured(): boolean {
  const envAllowed =
    process.env.NODE_ENV !== "production" || process.env.PIPELINE_ADMIN_ENABLED === "1";
  return envAllowed && adminToken().length > 0;
}

function tokensMatch(presented: string, secret: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True only when configured AND the request carries the matching admin-token cookie. */
export async function isAdminAuthenticated(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const presented = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  return presented.length > 0 && tokensMatch(presented, adminToken());
}

export async function assertAdminAuthenticated(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Pipeline admin requires authentication. Sign in with the admin token.");
  }
}

/** Validate a submitted token; on success set the httpOnly session cookie. Returns whether it matched. */
export async function authenticateAdmin(token: string): Promise<boolean> {
  if (!adminConfigured() || token.length === 0 || !tokensMatch(token, adminToken())) return false;
  (await cookies()).set(ADMIN_COOKIE, adminToken(), adminCookieOptions(ADMIN_COOKIE_MAX_AGE));
  return true;
}

export async function logoutAdmin(): Promise<void> {
  // Expire on the same path it was set, so the browser actually drops the session cookie.
  (await cookies()).set(ADMIN_COOKIE, "", adminCookieOptions(0));
}

export async function getPipelineState(): Promise<{
  enabled: boolean;
  backlog: BacklogSection[];
  specs: Record<SpecStatus, PipelineSpec[]>;
  jobs: PipelineJob[];
}> {
  const [backlog, specs, jobs] = await Promise.all([
    readBacklog(),
    readSpecs(),
    readJobs(),
  ]);
  return { enabled: adminConfigured(), backlog, specs, jobs };
}

export async function readBacklog(): Promise<BacklogSection[]> {
  const lines = await readBacklogLines();
  const ranges = getSectionRanges(lines);
  return SECTION_NAMES.map((name) => ({
    name,
    items: parseBacklogItems(lines, ranges, name),
  }));
}

export async function saveBacklogItem(
  lineNo: number,
  originalLine: string,
  nextLine: string,
): Promise<void> {
  await assertAdminAuthenticated();
  const lines = await readBacklogLines();
  assertCurrentLine(lines, lineNo, originalLine);
  const normalized = nextLine.trim();
  // A backlog item is exactly one physical line: reject embedded newlines (an unanchored regex
  // would validate only the first line, then writeBacklogLines would split the rest into stray
  // lines and desync every line-number guard below it).
  if (normalized.includes("\n") || !/^- \[[ x~]\] \((bug|data|story)\) .+$/.test(normalized)) {
    throw new Error("Backlog item must be a single line: - [ ] (type) Title — context");
  }
  lines[lineNo] = normalized;
  await writeBacklogLines(lines);
}

export async function closeBacklogItem(lineNo: number, originalLine: string): Promise<void> {
  await assertAdminAuthenticated();
  const lines = await readBacklogLines();
  assertCurrentLine(lines, lineNo, originalLine);
  const doneLine = originalLine.replace(/^- \[[ x~]\]/, "- [x]");
  lines.splice(lineNo, 1);
  const refreshedRanges = getSectionRanges(lines);
  const done = refreshedRanges.find((range) => range.name === "Done");
  if (!done) throw new Error("Could not find ## Done in backlog.md");
  let insertAt = done.headingLine + 1;
  if (lines[insertAt] === "") insertAt += 1;
  lines.splice(insertAt, 0, doneLine);
  await writeBacklogLines(lines);
}

export async function moveBacklogItem(
  lineNo: number,
  originalLine: string,
  direction: "up" | "down",
): Promise<void> {
  await assertAdminAuthenticated();
  const lines = await readBacklogLines();
  assertCurrentLine(lines, lineNo, originalLine);
  const ranges = getSectionRanges(lines);
  const currentSection = sectionForLine(ranges, lineNo);
  if (!currentSection || !isKnownSection(currentSection.name)) return;
  const itemLines = parseBacklogItems(lines, ranges, currentSection.name).map((item) => item.lineNo);
  const index = itemLines.indexOf(lineNo);
  const swapWith = direction === "up" ? itemLines[index - 1] : itemLines[index + 1];
  if (swapWith == null) return;
  [lines[lineNo], lines[swapWith]] = [lines[swapWith], lines[lineNo]];
  await writeBacklogLines(lines);
}

export async function saveSpec(relPath: string, content: string): Promise<void> {
  await assertAdminAuthenticated();
  const specPath = resolveSpecPath(relPath);
  // writeFile creates missing files, so a stale edit form (the spec was moved to done/rejected
  // since the page loaded) would resurrect it at the old queue path. Only overwrite what exists.
  await fsp.access(specPath).catch(() => {
    throw new Error("Spec no longer exists at this path (it may have been moved). Refresh and try again.");
  });
  await fsp.writeFile(specPath, normalizeTrailingNewline(content), "utf8");
}

export async function readSpec(relPath: string): Promise<PipelineSpec> {
  const specPath = resolveSpecPath(relPath);
  const parent = path.basename(path.dirname(specPath));
  if (!isSpecStatus(parent)) throw new Error("Invalid spec status.");
  const [stat, content] = await Promise.all([
    fsp.stat(specPath),
    fsp.readFile(specPath, "utf8"),
  ]);
  return specFromContent(specPath, parent, stat.mtime.toISOString(), content);
}

export async function moveSpec(relPath: string, nextStatus: SpecStatus): Promise<void> {
  await assertAdminAuthenticated();
  const specPath = resolveSpecPath(relPath);
  const specFile = path.basename(specPath);
  const destDir = path.join(SPECS_ROOT, nextStatus);
  const destPath = path.join(destDir, specFile);
  if (specPath === destPath) return;
  await fsp.mkdir(destDir, { recursive: true });
  try {
    await fsp.access(destPath);
    throw new Error(`Destination already exists: ${path.relative(WEBROOT, destPath)}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const content = await fsp.readFile(specPath, "utf8");
  await fsp.writeFile(destPath, setFrontmatterValue(content, "status", statusValue(nextStatus)), "utf8");
  await fsp.unlink(specPath);
  await reconcileBacklogForSpecMove(specFile, nextStatus);
}

// When a story-linked spec moves between queue/done/rejected, keep the backlog line that points at
// it coherent instead of leaving a stale [~] pointer: rewrite the specs/<status>/<file> path, flip
// the checkbox, and relocate the item to the matching section (done → Done [x]; queue → Specced
// [~]; rejected → back to Open [ ] for re-triage). The specs/<status>/<file> pointer is always
// preserved — it is the only handle reconcile has to re-find this item, so a later Reopen
// (rejected → queue) can restore it to Specced. No-op when no backlog item references the spec.
// (2026-07-09 codex P2.)
const SPEC_MOVE_BACKLOG_TARGET: Record<
  SpecStatus,
  { checked: " " | "x" | "~"; section: BacklogSectionName }
> = {
  queue: { checked: "~", section: "Specced (in queue)" },
  done: { checked: "x", section: "Done" },
  rejected: { checked: " ", section: "Open" },
};

async function reconcileBacklogForSpecMove(
  specFile: string,
  nextStatus: SpecStatus,
): Promise<void> {
  const pointer = new RegExp(`specs/(?:queue|done|rejected)/${escapeRegExp(specFile)}`);
  const lines = await readBacklogLines();
  const idx = lines.findIndex((line) => /^- \[[ x~]\]/.test(line) && pointer.test(line));
  if (idx < 0) return;

  const target = SPEC_MOVE_BACKLOG_TARGET[nextStatus];
  const line = lines[idx]
    .replace(pointer, `specs/${nextStatus}/${specFile}`)
    .replace(/^- \[[ x~]\]/, `- [${target.checked}]`);
  relocateBacklogLine(lines, idx, line, target.section);
  await writeBacklogLines(lines);
}

function relocateBacklogLine(
  lines: string[],
  fromIdx: number,
  newLine: string,
  sectionName: BacklogSectionName,
): void {
  lines.splice(fromIdx, 1);
  const section = getSectionRanges(lines).find((range) => range.name === sectionName);
  if (!section) throw new Error(`Could not find ## ${sectionName} in backlog.md`);
  let insertAt = section.headingLine + 1;
  if (lines[insertAt] === "") insertAt += 1;
  lines.splice(insertAt, 0, newLine);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// In-flight dedup: findRunningJob() is check-then-act over job files, so two concurrent (or
// rapid-fire) start requests can both pass it before either writes its job JSON. Serialize job
// creation per (provider, kind, target) through this promise chain — the second request awaits
// the first and then sees its running job. (2026-07-09: five duplicate backlog-triage jobs
// launched 22s apart against one item.)
const jobStartLocks = new Map<string, Promise<PipelineJob>>();

export async function startPipelineJob(
  provider: PipelineProvider,
  kind: PipelineJobKind,
  target: string,
): Promise<PipelineJob> {
  await assertAdminAuthenticated();
  const lockKey = `${provider}|${kind}|${hashText(target)}`;
  const prior = jobStartLocks.get(lockKey) ?? Promise.resolve(null);
  const startPromise = prior
    .catch(() => null)
    .then(() => startPipelineJobUnlocked(provider, kind, target));
  jobStartLocks.set(lockKey, startPromise);
  try {
    return await startPromise;
  } finally {
    if (jobStartLocks.get(lockKey) === startPromise) jobStartLocks.delete(lockKey);
  }
}

async function startPipelineJobUnlocked(
  provider: PipelineProvider,
  kind: PipelineJobKind,
  target: string,
): Promise<PipelineJob> {
  await fsp.mkdir(JOBS_ROOT, { recursive: true });

  const existing = await findRunningJob(provider, kind, target);
  if (existing) return existing;

  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const prompt = await buildPrompt(provider, kind, target);
  const { command, args } = await providerCommand(provider, prompt);
  const logPath = path.join(JOBS_ROOT, `${id}.log`);
  const jobPath = path.join(JOBS_ROOT, `${id}.json`);
  const commandVector = [command, ...args];

  const job: PipelineJob = {
    id,
    provider,
    kind,
    target,
    cwd: WEBROOT,
    command: commandVector,
    prompt,
    status: "running",
    startedAt: new Date().toISOString(),
    logRelPath: path.relative(WEBROOT, logPath),
  };

  await fsp.writeFile(logPath, `$ ${commandVector.map(shellQuote).join(" ")}\n\n`, "utf8");
  await writeJob(jobPath, job);

  const out = fs.openSync(logPath, "a");
  let child;
  try {
    child = spawn(command, args, {
      cwd: WEBROOT,
      detached: true,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", out, out],
    });
  } catch (error) {
    fs.closeSync(out);
    const failed = {
      ...job,
      status: "failed" as const,
      finishedAt: new Date().toISOString(),
      logTail: String(error),
    };
    await writeJob(jobPath, failed);
    return failed;
  }

  const running = { ...job, pid: child.pid };

  // Attach lifecycle handlers before any await: spawn delivers ENOENT (e.g. a bad
  // CODEX_BIN/CLAUDE_BIN) as an async "error" event, not a throw from the try/catch above, so an
  // unhandled listener window here could crash the Next process. The terminal handlers await
  // `persist` before writing, so the running-write and the terminal-write never race the same
  // JSON file — the terminal state is always the last (winning) write, never corrupt or reverted.
  let persist: Promise<void> = Promise.resolve();
  child.on("exit", async (exitCode, signal) => {
    fs.closeSync(out);
    const finished: PipelineJob = {
      ...running,
      status: exitCode === 0 ? "done" : "failed",
      exitCode,
      signal,
      finishedAt: new Date().toISOString(),
    };
    await persist.catch(() => undefined);
    await writeJob(jobPath, finished).catch(() => undefined);
  });
  child.on("error", async (error) => {
    fs.closeSync(out);
    const failed: PipelineJob = {
      ...running,
      status: "failed",
      finishedAt: new Date().toISOString(),
      logTail: String(error),
    };
    await persist.catch(() => undefined);
    await writeJob(jobPath, failed).catch(() => undefined);
  });
  child.unref();

  persist = writeJob(jobPath, running);
  await persist;

  return running;
}

export async function backlogLineTarget(lineNo: number, lineHash: string): Promise<string> {
  const lines = await readBacklogLines();
  const line = lines[lineNo];
  if (!line || hashText(line) !== lineHash) {
    throw new Error("Backlog item changed since the page loaded. Refresh and try again.");
  }
  return line;
}

async function readBacklogLines(): Promise<string[]> {
  const raw = await fsp.readFile(BACKLOG_PATH, "utf8");
  return raw.replace(/\n$/, "").split("\n");
}

async function writeBacklogLines(lines: string[]): Promise<void> {
  await fsp.writeFile(BACKLOG_PATH, `${lines.join("\n")}\n`, "utf8");
}

function getSectionRanges(lines: string[]): SectionRange[] {
  const headings = lines
    .map((line, index) => {
      const match = line.match(/^##\s+(.+?)\s*$/);
      return match ? { name: match[1], headingLine: index } : null;
    })
    .filter((item): item is { name: string; headingLine: number } => item != null);

  return headings.map((heading, index) => ({
    ...heading,
    endLine: headings[index + 1]?.headingLine ?? lines.length,
  }));
}

function parseBacklogItems(
  lines: string[],
  ranges: SectionRange[],
  sectionName: BacklogSectionName,
): BacklogItem[] {
  const range = ranges.find((item) => item.name === sectionName);
  if (!range) return [];
  const items: BacklogItem[] = [];
  for (let lineNo = range.headingLine + 1; lineNo < range.endLine; lineNo += 1) {
    const line = lines[lineNo];
    const match = line.match(/^- \[([ x~])\]\s+\(([^)]+)\)\s*(.+)$/);
    if (!match) continue;
    const rawType = match[2];
    items.push({
      lineNo,
      section: sectionName,
      checked: match[1] as " " | "x" | "~",
      type: isBacklogItemType(rawType) ? rawType : "unknown",
      title: titleFromBody(match[3]),
      line,
    });
  }
  return items;
}

function titleFromBody(body: string): string {
  return body.split(" — ")[0]?.trim() || body.slice(0, 120);
}

function assertCurrentLine(lines: string[], lineNo: number, originalLine: string): void {
  if (!Number.isInteger(lineNo) || lineNo < 0 || lineNo >= lines.length) {
    throw new Error("Backlog item line is out of range. Refresh and try again.");
  }
  if (lines[lineNo] !== originalLine) {
    throw new Error("Backlog item changed since the page loaded. Refresh and try again.");
  }
}

function sectionForLine(ranges: SectionRange[], lineNo: number): SectionRange | null {
  return ranges.find((range) => lineNo > range.headingLine && lineNo < range.endLine) ?? null;
}

function isKnownSection(name: string): name is BacklogSectionName {
  return SECTION_NAMES.includes(name as BacklogSectionName);
}

function isBacklogItemType(type: string): type is Exclude<BacklogItemType, "unknown"> {
  return type === "bug" || type === "data" || type === "story";
}

function isSpecStatus(value: string): value is SpecStatus {
  return value === "queue" || value === "done" || value === "rejected";
}

async function readSpecs(): Promise<Record<SpecStatus, PipelineSpec[]>> {
  const statuses: SpecStatus[] = ["queue", "done", "rejected"];
  const entries = await Promise.all(statuses.map(async (status) => [status, await readSpecStatus(status)]));
  return Object.fromEntries(entries) as Record<SpecStatus, PipelineSpec[]>;
}

async function readSpecStatus(status: SpecStatus): Promise<PipelineSpec[]> {
  const dir = path.join(SPECS_ROOT, status);
  const names = await fsp.readdir(dir).catch(() => []);
  const specs = await Promise.all(
    names
      .filter((name) => name.endsWith(".md"))
      .map(async (name) => {
        const specPath = path.join(dir, name);
        const [stat, content] = await Promise.all([
          fsp.stat(specPath),
          fsp.readFile(specPath, "utf8"),
        ]);
        return specFromContent(specPath, status, stat.mtime.toISOString(), content);
      }),
  );
  return specs.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

function specFromContent(
  specPath: string,
  status: SpecStatus,
  updatedAt: string,
  content: string,
): PipelineSpec {
  const frontmatter = parseFrontmatter(content);
  const track = frontmatter.track ?? "";
  const repo = frontmatter.repo ?? "";
  return {
    slug: path.basename(specPath).replace(/\.md$/, ""),
    status,
    relPath: path.relative(WEBROOT, specPath),
    title: frontmatter.title ?? firstMarkdownHeading(content) ?? path.basename(specPath, ".md"),
    track,
    lane: frontmatter.lane ?? inferLane(track, repo),
    repo,
    dependsOn: frontmatter.depends_on ?? "",
    updatedAt,
    content,
  };
}

function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---", 4);
  if (end < 0) return {};
  const raw = content.slice(4, end).split("\n");
  const out: Record<string, string> = {};
  for (const line of raw) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function firstMarkdownHeading(content: string): string | null {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function inferLane(track: string, repo: string): string {
  if (track === "frontend" && repo !== "fund_score") return "standard";
  return "reviewed";
}

function resolveSpecPath(relPath: string): string {
  const resolved = path.resolve(WEBROOT, relPath);
  const root = path.resolve(SPECS_ROOT);
  if (!resolved.startsWith(`${root}${path.sep}`) || !resolved.endsWith(".md")) {
    throw new Error("Invalid spec path.");
  }
  return resolved;
}

function statusValue(status: SpecStatus): string {
  if (status === "queue") return "queued";
  return status;
}

function setFrontmatterValue(content: string, key: string, value: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end < 0) return content;
  const head = content.slice(0, end);
  const tail = content.slice(end);
  const re = new RegExp(`^${key}:.*$`, "m");
  if (re.test(head)) return `${head.replace(re, `${key}: ${value}`)}${tail}`;
  return `${head}\n${key}: ${value}${tail}`;
}

async function readJobs(): Promise<PipelineJob[]> {
  const names = await fsp.readdir(JOBS_ROOT).catch(() => []);
  const jobs = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const jobPath = path.join(JOBS_ROOT, name);
        const job = JSON.parse(await fsp.readFile(jobPath, "utf8")) as PipelineJob;
        return inferJobStatus(job);
      }),
  );
  return jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 20);
}

export async function readJob(jobId: string): Promise<PipelineJob> {
  if (!/^[0-9T.Z:-]+-[a-f0-9]{8}$/.test(jobId)) throw new Error("Invalid job id.");
  const jobPath = path.join(JOBS_ROOT, `${jobId}.json`);
  const job = inferJobStatus(JSON.parse(await fsp.readFile(jobPath, "utf8")) as PipelineJob);
  const logPath = path.join(WEBROOT, job.logRelPath);
  return { ...job, logTail: await readTail(logPath, 40000) };
}

async function findRunningJob(
  provider: PipelineProvider,
  kind: PipelineJobKind,
  target: string,
): Promise<PipelineJob | null> {
  const names = await fsp.readdir(JOBS_ROOT).catch(() => []);
  const candidates = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const jobPath = path.join(JOBS_ROOT, name);
        const job = JSON.parse(await fsp.readFile(jobPath, "utf8")) as PipelineJob;
        return inferJobStatus(job);
      }),
  );
  return (
    candidates
      .filter(
        (job) =>
          job.status === "running" &&
          job.provider === provider &&
          job.kind === kind &&
          job.target === target,
      )
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0] ?? null
  );
}

function inferJobStatus(job: PipelineJob): PipelineJob {
  if (job.status !== "running" || !job.pid) return job;
  try {
    process.kill(job.pid, 0);
    return job;
  } catch {
    return { ...job, status: "unknown" };
  }
}

async function readTail(filePath: string, bytes: number): Promise<string> {
  const handle = await fsp.open(filePath, "r").catch(() => null);
  if (!handle) return "";
  try {
    const stat = await handle.stat();
    const size = Math.min(bytes, stat.size);
    const buffer = Buffer.alloc(size);
    await handle.read(buffer, 0, size, Math.max(0, stat.size - size));
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

async function writeJob(jobPath: string, job: PipelineJob): Promise<void> {
  // Atomic write: readJobs/findRunningJob JSON.parse every job file concurrently, so an in-place
  // truncate-then-write could expose empty/partial JSON and fail the whole admin page. Stage to a
  // temp file (ignored by the .json readers) and rename over the target — readers only ever see a
  // complete old or complete new file.
  const tmpPath = `${jobPath}.${randomUUID().slice(0, 8)}.tmp`;
  await fsp.writeFile(tmpPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
  await fsp.rename(tmpPath, jobPath);
}

async function providerCommand(
  provider: PipelineProvider,
  prompt: string,
): Promise<{ command: string; args: string[] }> {
  const fundScoreRoot = await fundScoreRootPath();
  if (provider === "claude") {
    return {
      command: process.env.CLAUDE_BIN || "claude",
      args: [
        "--permission-mode",
        "auto",
        "--add-dir",
        fundScoreRoot,
        "--add-dir",
        HARNESS_ROOT,
        "-p",
        prompt,
      ],
    };
  }
  return {
    command: process.env.CODEX_BIN || "codex",
    args: [
      "--ask-for-approval",
      "never",
      "exec",
      "-C",
      WEBROOT,
      "--add-dir",
      fundScoreRoot,
      "--add-dir",
      HARNESS_ROOT,
      "--sandbox",
      "workspace-write",
      prompt,
    ],
  };
}

async function fundScoreRootPath(): Promise<string> {
  const raw = await fsp.readFile(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as { product?: { fund_score_repo?: string } };
  return parsed.product?.fund_score_repo ?? path.resolve(WEBROOT, "..", "fund_score");
}

async function buildPrompt(
  provider: PipelineProvider,
  kind: PipelineJobKind,
  target: string,
): Promise<string> {
  const common = [
    "You are running from the local FundScore pipeline admin console.",
    `Work in fundscore-web at ${WEBROOT}.`,
    `fund_score is ${await fundScoreRootPath()}.`,
    `fundscore-harness is ${HARNESS_ROOT}.`,
    "Follow AGENTS.md, feature-pipeline/README.md, and the lean/standard/reviewed lane rules.",
    "Process exactly the requested target. Do not drain unrelated backlog/spec items.",
    "If a gate blocks or owner input is required, stop and report the blocker honestly.",
  ].join("\n");

  const codexHint =
    provider === "codex"
      ? "\nFor queued spec builds, use the fundscore-implement-spec skill/procedure when applicable."
      : "";

  switch (kind) {
    case "backlog-triage":
      return `${common}${codexHint}\n\nProcess this exact backlog item using .claude/commands/triage.md and the shared fundscore-data commands. Do not pick a different item just because it is higher in the file.\n\nBACKLOG ITEM:\n${target}`;
    case "story-spec":
      return `${common}${codexHint}\n\nTurn this exact story backlog item into a queued spec using .claude/commands/spec-story.md. Include lane frontmatter. Do not implement code unless explicitly asked later.\n\nSTORY ITEM:\n${target}`;
    case "spec-build":
      return `${common}${codexHint}\n\nImplement exactly this queued spec and then stop. Do not drain the queue.\n\nSPEC:\n${target}`;
    case "spec-review":
      return `${common}${codexHint}\n\nReview and refine exactly this queued spec using the decision-altitude spec review rules. Do not implement code.\n\nSPEC:\n${target}`;
    case "queue-next":
      return `${common}${codexHint}\n\nImplement the next ready queued spec using .claude/commands/implement-next.md. One spec only, then stop.`;
    case "queue-review":
      return `${common}${codexHint}\n\nReview queued specs using .claude/commands/review-specs.md. Do not implement code.`;
  }
}

function normalizeTrailingNewline(value: string): string {
  return `${value.replace(/\s+$/, "")}\n`;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function hashText(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}
