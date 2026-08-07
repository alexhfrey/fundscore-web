"use server";

import { db } from "@/lib/db";
import { opsFeedback } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * The beta feedback channel. Follows the waitlist server-action pattern
 * (src/app/_landing/actions.ts): a useActionState reducer that never reports a
 * save it did not make.
 */

export interface FeedbackState {
  status: "idle" | "sent" | "error";
  message?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 4000;

export async function submitFeedback(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const message = String(formData.get("message") ?? "").trim();
  const path = String(formData.get("path") ?? "").trim() || null;
  const typedEmail = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!message) {
    return { status: "error", message: "Tell us what happened first." };
  }

  // The signed-in email is the truth when there is a session; the typed field
  // is for anyone who isn't signed in. We never fabricate an identity, and an
  // unusable typed address is dropped rather than stored as if it were real.
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    userEmail = null;
  }
  if (!userEmail && typedEmail && EMAIL.test(typedEmail) && typedEmail.length <= 320) {
    userEmail = typedEmail;
  }

  try {
    await db.insert(opsFeedback).values({
      message: message.slice(0, MAX_MESSAGE),
      path: path ? path.slice(0, 2048) : null,
      userEmail,
      // Server actions have no request object; the widget passes it through so
      // "only broken in Safari" is answerable.
      userAgent: String(formData.get("userAgent") ?? "").slice(0, 1024) || null,
    });
  } catch (err) {
    console.error("[ops:feedback] insert failed", err);
    return {
      status: "error",
      message: "We couldn't send that just now. Try again in a moment.",
    };
  }

  return { status: "sent" };
}
