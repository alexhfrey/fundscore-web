import { db } from "@/lib/db";
import { opsErrorEvents } from "@/lib/db/schema";

/**
 * The single error sink for the beta.
 *
 * Three sinks, in order of reliability:
 *   1. a structured `[ops:error]` JSON line on stderr — always, first, and
 *      synchronously, so the record survives even if the database is the thing
 *      that broke;
 *   2. a row in `ops_error_events` — the durable record the owner can query
 *      (Vercel Hobby log retention is far too short to be the only copy);
 *   3. a one-line POST to `OPS_ALERT_WEBHOOK_URL` when that env var is set —
 *      optional, absent by default, silent when absent.
 *
 * The contract that matters: **this never throws and never rejects.** An error
 * reporter that can fail the request it is reporting on is worse than no error
 * reporter at all. Every fallible step is individually swallowed.
 */

export type ErrorSource = "server" | "client";

export interface ErrorReport {
  source: ErrorSource;
  route?: string | null;
  digest?: string | null;
  message?: string | null;
  stack?: string | null;
  userEmail?: string | null;
  userAgent?: string | null;
}

/** Column-width guards. Truncating beats dropping the whole report. */
function clip(v: string | null | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function recordServerError(report: ErrorReport): Promise<void> {
  const row = {
    source: report.source,
    route: clip(report.route, 2048),
    digest: clip(report.digest, 128),
    message: clip(report.message, 8192),
    stack: clip(report.stack, 16384),
    userEmail: clip(report.userEmail, 320),
    userAgent: clip(report.userAgent, 1024),
  };

  // 1. Always log first. This is the sink that cannot itself be broken.
  try {
    console.error(`[ops:error] ${JSON.stringify(row)}`);
  } catch {
    // JSON.stringify can only fail on exotic input; there is nothing useful to
    // do about it, and it must not stop the durable write below.
  }

  // 2. Durable record. Best effort.
  try {
    await db.insert(opsErrorEvents).values(row);
  } catch (err) {
    // Deliberately console.warn, not console.error: re-entering the error path
    // from inside the error path is how you get a log loop.
    console.warn(
      "[ops:error] persist failed",
      err instanceof Error ? err.message : String(err),
    );
  }

  // 3. Optional push alert. Absent env var = no-op, no warning, no noise.
  const webhook = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `FundScore ${row.source} error on ${row.route ?? "unknown route"}: ${
          row.message ?? "(no message)"
        }`,
      }),
      // Never let a slow webhook hold a request open.
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.warn(
      "[ops:alert] webhook failed",
      err instanceof Error ? err.message : String(err),
    );
  }
}
