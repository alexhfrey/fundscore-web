"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/serving/session";
import { deleteLens, saveLens } from "@/lib/serving/lens";

// Server actions for the Lens save / delete flow (query_results.md § 7).
// Auth is required (a Lens is owned by an authenticated user). Tier quota and
// query-resolution checks live in lib/serving/lens; these actions just bind the
// session, run the mutation, and route honestly on the outcome.

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Save the current canonical query as a personal Lens, then land on it.
 * Anonymous users are redirected to sign-in carrying the query so they can save
 * after authenticating. Quota-exhausted / unknown-query outcomes route back to
 * the query with an honest flag — never a silent no-op or fabricated save.
 */
export async function saveLensAction(formData: FormData): Promise<void> {
  const querySlug = String(formData.get("query_slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const changeTracking = formData.get("change_tracking") != null;

  if (!querySlug) redirect("/search");

  const userId = await requireUserId();
  if (!userId) {
    // Preserve intent: send them to sign in, then back to the query to save.
    redirect(`/signin?next=${encodeURIComponent(`/q/${querySlug}`)}`);
  }

  const { userState } = await resolveSession();
  const res = await saveLens(
    { userId, querySlug, name: name || querySlug, note, changeTracking },
    userState,
  );

  if (!res.ok) {
    redirect(`/q/${querySlug}?save=${res.reason}`);
  }

  revalidatePath("/lens");
  redirect(`/lens/${res.lens.lensSlug}?saved=1`);
}

/** Delete a Lens the caller owns, then return to My Lenses. */
export async function deleteLensAction(formData: FormData): Promise<void> {
  const lensSlug = String(formData.get("lens_slug") ?? "").trim();
  const userId = await requireUserId();
  if (!userId || !lensSlug) redirect("/lens");

  await deleteLens(userId, lensSlug);
  revalidatePath("/lens");
  redirect("/lens?deleted=1");
}
