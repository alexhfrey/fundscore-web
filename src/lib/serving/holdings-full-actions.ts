"use server";

import { resolveSession } from "./session";
import { effectiveHoldingsTier } from "./gating";
import { getHoldingsFullRows } from "./holdings-full";
import type { HoldingRow } from "./profile-v2";

// ============================================================================
// Server action for the lazy full-holdings fetch (serve-full-holdings).
// ----------------------------------------------------------------------------
// The client drawer calls this on its first open — one request per fund. Server
// actions are PUBLIC endpoints (a direct/replayed POST can supply any arguments),
// so the entitlement is resolved HERE from the real session via resolveSession —
// the client can NEVER pass a tier to elevate itself. The gate is then enforced
// inside getHoldingsFullRows against that session tier.
//
// production: entitlement = the real session tier, full stop. A forged POST with
//   any argument gets exactly what that session is entitled to (anon ⇒ 0 rows).
// preview (non-production only): the reviewer ?tier= override is honored via
//   effectiveHoldingsTier so /preview can walk the tier matrix in local dev; it
//   is env-gated off in production, so it cannot weaken the production gate.
// ============================================================================

export async function loadHoldingsFullRows(
  ticker: string,
  previewTierOverride?: string,
): Promise<HoldingRow[]> {
  const { userState } = await resolveSession();
  return getHoldingsFullRows(
    ticker,
    effectiveHoldingsTier(userState, previewTierOverride),
  );
}
