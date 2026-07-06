import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/serving/session";
import { getQuotaState } from "@/lib/serving/lens";

// Read-only session + Lens-quota probe for the client Save-as-Lens strip on the
// ISR /q/{slug} page. Keeping this in a dynamic route handler lets the query
// page itself stay static (crawlable HTML, serving_architecture Decision 5)
// while the per-user save affordance hydrates client-side. Returns ONLY the
// caller's own auth state + quota — never gated fund content.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ signedIn: false });
  }

  const { userState } = await resolveSession();
  const quota = await getQuotaState(user.id, userState);
  return NextResponse.json({
    signedIn: true,
    userState,
    quota,
  });
}
