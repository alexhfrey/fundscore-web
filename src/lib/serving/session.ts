import { eq } from "drizzle-orm";
import { db } from "../db";
import { entitlements } from "../db/schema/serving";
import { createClient } from "../supabase/server";
import type { UserState } from "./profile";

// entitlement_tier (DB) -> UserState (gating). 'paid_retail' collapses to the
// 'paid' gate tier; 'anonymous' has no session/row.
const TIER_TO_STATE: Record<string, UserState> = {
  free: "free",
  paid_retail: "paid",
  pro: "pro",
};

export interface SessionInfo {
  userState: UserState;
  email: string | null;
}

/**
 * Resolve the caller's tier from the Supabase session. Reading cookies here
 * opts the route into dynamic rendering — intended: the profile page must gate
 * per-user. The entitlements read goes through Drizzle (postgres role, bypasses
 * RLS) keyed by the authenticated user's id, so it is safe and trusted.
 */
export async function resolveSession(): Promise<SessionInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userState: "anonymous", email: null };

  const [ent] = await db
    .select({ tier: entitlements.tier })
    .from(entitlements)
    .where(eq(entitlements.userId, user.id))
    .limit(1);

  // A signed-in user always gets at least 'free' (the trigger provisions one;
  // fall back to 'free' if the row hasn't landed yet rather than locking them
  // out as anonymous).
  const userState = ent ? (TIER_TO_STATE[ent.tier] ?? "free") : "free";
  return { userState, email: user.email ?? null };
}
