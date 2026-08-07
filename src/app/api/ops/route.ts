import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { opsPageviews } from "@/lib/db/schema";
import { recordServerError } from "@/lib/observability/record-error";
import { checkOpsRateLimit } from "@/lib/ops/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * The beta's client-side ops intake. One endpoint, two kinds:
 *
 *   { kind: "pageview", path, referrer }   ← the pageview counter
 *   { kind: "error", message, ... }        ← the client error boundaries
 *
 * This is the ONE gated-path exception (see src/lib/supabase/middleware.ts):
 * an error tracker blind to the only page the public can reach is not an error
 * tracker, and the landing page is exactly where a first-time beta invitee
 * lands. The exception is safe in a way /api/portfolio/solve is not — this
 * endpoint does no expensive compute, writes one small row, and reflects
 * nothing back to the caller.
 *
 * Guards: same-origin only, a per-client rate limit (src/lib/ops/rate-limit.ts),
 * 16 KB body cap, everything truncated, no IP stored.
 */

// Postgres.js needs a TCP socket, so this must not be edged.
export const runtime = "nodejs";

// Sized to ADMIT the largest legitimate report the client can send — a client
// error trimmed to 4 KB of message + 8 KB of stack (see reportClientError) —
// with headroom. A cap tighter than what our own reporter posts would reject
// the deep-stack errors we most need to see, so the two numbers move together.
// The real per-field bound is the truncation below; this is the abuse bound.
const MAX_BODY_BYTES = 16_384;

/**
 * Same-origin check. `sec-fetch-site` is set by every browser that can run
 * this beacon and cannot be forged by page JavaScript; the Origin header is
 * the fallback for the `keepalive`/beacon paths that omit it.
 */
function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  // "none" means a directly user-initiated navigation, which a beacon POST
  // never is — so only "same-origin" counts.
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  // Neither header present = not the browser beacon. Every browser that can run
  // this beacon sends `sec-fetch-site`, and all of them send `origin` on a
  // cross-method POST, so refusing costs no real traffic. A determined client
  // can forge either header — this does not pretend to stop that — but it keeps
  // generic scanners and header-less bots out of a public write path.
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** The signed-in email, or null. Never inferred, never defaulted. */
async function sessionEmail(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }

  // Rate limit BEFORE reading the body or looking up a session (both cost
  // more than this check) — see src/lib/ops/rate-limit.ts for the design.
  if (!(await checkOpsRateLimit(request))) {
    return new NextResponse(null, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");

  if (body.kind === "pageview") {
    const path = clip(body.path, 2048);
    if (!path || !path.startsWith("/")) {
      // Only same-site paths are meaningful, and refusing anything else keeps
      // absolute URLs (and junk) out of the table.
      return new NextResponse(null, { status: 400 });
    }
    try {
      await db.insert(opsPageviews).values({
        path,
        referrer: clip(body.referrer, 2048),
        userEmail: await sessionEmail(),
        userAgent: clip(userAgent, 1024),
      });
    } catch (err) {
      // A dropped pageview is not worth a 500 to a background beacon — but it
      // must not vanish silently either.
      console.warn(
        "[ops:pageview] persist failed",
        err instanceof Error ? err.message : String(err),
      );
    }
    return new NextResponse(null, { status: 204 });
  }

  if (body.kind === "error") {
    await recordServerError({
      source: "client",
      route: clip(body.path, 2048),
      digest: clip(body.digest, 128),
      message: clip(body.message, 8192),
      stack: clip(body.stack, 16384),
      userEmail: await sessionEmail(),
      userAgent: clip(userAgent, 1024),
    });
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, { status: 400 });
}
