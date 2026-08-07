import { createHmac } from "node:crypto";

import { sql } from "drizzle-orm";
import { after, type NextRequest } from "next/server";

import { db } from "@/lib/db";

/**
 * Throttle for `POST /api/ops` — the ONE `/api/` route exempt from the
 * `early_access` gate (see route.ts's own header comment). It has to be
 * reachable without a login, which makes it an unauthenticated INSERT path on
 * a public site. Same-origin checking in route.ts refuses header-less
 * clients but not a determined one that forges `sec-fetch-site`/`origin`, so
 * without a throttle a scripted client can grow `ops_pageviews` /
 * `ops_error_events` without bound.
 *
 * Scope, deliberately: abuse here fills tables — it does not leak data,
 * reflect anything to the caller, or burn compute. This is a speed bump on a
 * write path, not a WAF, sized accordingly.
 *
 * ## Design
 *
 * Vercel serverless functions share no memory across instances, so a
 * pure in-process counter would silently not apply under real concurrent
 * load — exactly the environment this is meant to protect. Postgres is
 * already a dependency for this route (it's the thing being protected), so
 * the durable, cross-instance-correct counter lives in `ops_rate_limits`: one
 * row per hashed client key, holding a fixed 60-second window count, updated
 * with a single atomic `INSERT ... ON CONFLICT` (one round trip either way —
 * never a separate SELECT-then-INSERT, which would double the cost of every
 * check for no benefit).
 *
 * A cheap in-process pre-filter (`memoryGateAllows`) runs BEFORE that query.
 * It is honestly partial — it only sees traffic that happens to land on the
 * same warm instance, and a fresh cold start begins with an empty map — but
 * it is genuinely free (no I/O) and it is what actually SHEDS load rather
 * than moving it: a single client hammering one warm instance (the common
 * shape of an unsophisticated scripted flood — one connection, kept alive)
 * gets rejected without ever touching the database, for as long as that
 * instance stays warm. The Postgres check is the authoritative backstop that
 * makes the limit hold across the whole fleet, not just one instance.
 *
 * ## Keying without an IP
 *
 * The route never stores a raw IP (same contract `ops_pageviews` already
 * keeps — see schema/ops.ts). The forwarded client IP is only ever used as
 * HMAC-SHA256 input, keyed with `DATABASE_URL` — already server-only secret
 * material present in every environment that has a database, so this needs
 * no new secret to provision. A keyless hash of an IPv4 address would be
 * reversible by brute force (the whole address space is ~4B values, trivial
 * to precompute); an HMAC with unknown key material is not.
 *
 * ## Fail-soft
 *
 * Every failure mode here resolves to ALLOW: a missing IP header, a database
 * error, an expired connection. A broken throttle must never become a broken
 * analytics/error-reporting endpoint — the abuse this guards against is slow
 * table growth, which is worth tolerating a false negative over.
 */

const WINDOW_SECONDS = 60;
// Sized for tens of legitimate concurrent users behind one shared IP (office
// / campus NAT, or an invite email opened by many people around the same
// moment) rather than for one person — a single browsing session rarely
// posts more than one row every few seconds. It still caps a single
// determined actor to ~2 inserts/sec sustained (172,800/day) instead of
// unbounded, which is the actual goal: bound one client's throughput, not
// eliminate abuse from a client willing to rotate IPs.
const LIMIT_PER_WINDOW = 120;

// Per-instance-only fast path. Capped so a long-lived warm instance under
// sustained attack can't grow this map without bound; eviction is FIFO
// (oldest insertion order), which is good enough for a best-effort filter
// that a slower, authoritative check backs up.
const MEMORY_CAP = 5_000;
const memoryWindow = new Map<string, { windowStart: number; count: number }>();

function memoryGateAllows(key: string): boolean {
  const now = Date.now();
  const entry = memoryWindow.get(key);
  if (!entry || now - entry.windowStart > WINDOW_SECONDS * 1000) {
    if (memoryWindow.size >= MEMORY_CAP) {
      const oldest = memoryWindow.keys().next().value;
      if (oldest !== undefined) memoryWindow.delete(oldest);
    }
    memoryWindow.set(key, { windowStart: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= LIMIT_PER_WINDOW;
}

/** First forwarded IP, or null if the request carries neither header. */
function forwardedIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip");
}

function hashedClientKey(request: NextRequest): string | null {
  const ip = forwardedIp(request);
  if (!ip) return null; // nothing to key on — never block for a missing header
  const secret = process.env.DATABASE_URL;
  if (!secret) return null; // can't reach the DB anyway; the insert below will no-op too
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/**
 * True if this request may proceed. Called BEFORE the body is read or
 * `sessionEmail()` is looked up (route.ts), so a throttled request pays only
 * for this check — one cheap indexed Postgres upsert at worst, nothing at
 * all when the in-process gate already rejects it.
 */
export async function checkOpsRateLimit(request: NextRequest): Promise<boolean> {
  const key = hashedClientKey(request);
  if (!key) return true;

  if (!memoryGateAllows(key)) return false;

  try {
    const rows = (await db.execute(sql`
      INSERT INTO ops_rate_limits (key_hash, window_start, count)
      VALUES (${key}, now(), 1)
      ON CONFLICT (key_hash) DO UPDATE SET
        count = CASE
          WHEN ops_rate_limits.window_start < now() - (interval '1 second' * ${WINDOW_SECONDS})
          THEN 1
          ELSE ops_rate_limits.count + 1
        END,
        window_start = CASE
          WHEN ops_rate_limits.window_start < now() - (interval '1 second' * ${WINDOW_SECONDS})
          THEN now()
          ELSE ops_rate_limits.window_start
        END
      RETURNING count
    `)) as unknown as Record<string, unknown>[];

    const count = Number(rows[0]?.count ?? 1);
    const allowed = count <= LIMIT_PER_WINDOW;

    // Opportunistic retention for THIS table only (see schema/ops.ts): one
    // row per distinct client key ever seen, so unlike ops_pageviews /
    // ops_error_events it grows with distinct clients, not with request
    // volume — but it still grows unboundedly over months without this.
    // Deferred past the response (`after`) and gated to a small fraction of
    // accepted requests so the maintenance cost is amortized rather than
    // paid by every caller, and never by a rejected one.
    if (allowed && Math.random() < 0.002) {
      after(() =>
        db
          .execute(
            sql`DELETE FROM ops_rate_limits WHERE window_start < now() - interval '1 day'`,
          )
          .catch(() => {
            /* best-effort maintenance; never worth surfacing */
          }),
      );
    }

    return allowed;
  } catch (err) {
    console.warn(
      "[ops:rate-limit] check failed, allowing request",
      err instanceof Error ? err.message : String(err),
    );
    return true;
  }
}
