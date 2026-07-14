"use server";

import { db } from "@/lib/db";
import { waitlistSignups } from "@/lib/db/schema";

export interface WaitlistState {
  status: "idle" | "joined" | "error";
  message?: string;
}

// Deliberately permissive: one @, a dot in the domain, no whitespace. We are not
// in the business of rejecting valid-but-unusual addresses.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const source = String(formData.get("source") ?? "coming-soon") || "coming-soon";

  if (!EMAIL.test(email) || email.length > 320) {
    return { status: "error", message: "That doesn't look like an email address." };
  }

  try {
    // Idempotent: signing up twice is a success, not a duplicate-key error.
    await db
      .insert(waitlistSignups)
      .values({ email, source })
      .onConflictDoNothing({ target: waitlistSignups.email });
  } catch (err) {
    console.error("waitlist insert failed", err);
    // Never report a save we did not make.
    return {
      status: "error",
      message: "We couldn't save that just now. Try again in a moment.",
    };
  }

  return { status: "joined" };
}
