"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function back(mode: string, msg: string, next?: string): never {
  const n = next ? `&next=${encodeURIComponent(next)}` : "";
  redirect(`/signin?mode=${mode}&error=${encodeURIComponent(msg)}${n}`);
}

// Only allow same-origin relative paths as a post-auth destination (no open
// redirect). Falls back to a fund profile when absent/unsafe.
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "").trim();
  return next.startsWith("/") && !next.startsWith("//") ? next : "/funds/FCNTX";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back("signin", error.message, next);
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) back("signup", error.message, next);
  // Local Supabase has email confirmations disabled, so signUp also creates a
  // session. The on_auth_user_created trigger provisions users + entitlements.
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
