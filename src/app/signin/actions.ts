"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function back(mode: string, msg: string): never {
  redirect(`/signin?mode=${mode}&error=${encodeURIComponent(msg)}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back("signin", error.message);
  revalidatePath("/", "layout");
  redirect("/funds/FCNTX");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) back("signup", error.message);
  // Local Supabase has email confirmations disabled, so signUp also creates a
  // session. The on_auth_user_created trigger provisions users + entitlements.
  revalidatePath("/", "layout");
  redirect("/funds/FCNTX");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
