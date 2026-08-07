"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitFeedback, type FeedbackState } from "./actions";

const INITIAL: FeedbackState = { status: "idle" };

/**
 * The beta feedback affordance: a small persistent button in the bottom-right
 * of every product page that opens a two-field form.
 *
 * The point of it living in the chrome rather than on a /feedback page is that
 * it captures the CURRENT path automatically — "this page is confusing" is
 * useless without knowing which page, and a beta user will not go find a
 * contact form to tell us.
 *
 * The mailto fallback renders only when NEXT_PUBLIC_SUPPORT_EMAIL is set. No
 * address is hardcoded: shipping a support address that doesn't receive mail
 * would be worse than shipping none.
 */

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-[#1466b8] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#115899] disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send feedback"}
    </button>
  );
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [userAgent, setUserAgent] = useState("");
  // Bumped on every open so the panel — and with it the action state — REMOUNTS.
  // The site layout persists across client-side navigations, so without this a
  // user who sends one report sees the thank-you note forever and cannot send a
  // second until a full page reload. A beta tester has more than one thing to say.
  const [session, setSession] = useState(0);

  // Close on Escape, so the panel never traps a keyboard user.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          // Read in the event handler, not an effect: `navigator` doesn't
          // exist during the server render, and capturing it here costs no
          // extra render pass.
          setUserAgent(navigator.userAgent);
          setSession((n) => n + 1);
          setOpen(true);
        }}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:bg-gray-50"
      >
        Feedback
      </button>
    );
  }

  return (
    <FeedbackPanel
      key={session}
      userAgent={userAgent}
      onClose={() => setOpen(false)}
    />
  );
}

function FeedbackPanel({
  userAgent,
  onClose,
}: {
  userAgent: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [state, formAction] = useActionState(submitFeedback, INITIAL);

  return (
    <div
      role="dialog"
      aria-label="Send feedback"
      className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">
          What&apos;s broken or confusing?
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close feedback"
          className="-mt-1 rounded px-1 text-lg leading-none text-gray-400 hover:text-gray-700"
        >
          ×
        </button>
      </div>

      {state.status === "sent" ? (
        <p role="status" className="mt-3 text-sm text-gray-600">
          Thank you — that reached us, along with the page you were on. This is
          exactly what the beta is for.
        </p>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="path" value={pathname ?? ""} />
          <input type="hidden" name="userAgent" value={userAgent} />

          <label htmlFor="ops-feedback-message" className="sr-only">
            Your feedback
          </label>
          <textarea
            id="ops-feedback-message"
            name="message"
            required
            rows={4}
            maxLength={4000}
            placeholder="A number looks wrong, a section didn't load, a word didn't make sense…"
            className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-[#1466b8]"
          />

          <label htmlFor="ops-feedback-email" className="sr-only">
            Your email (optional)
          </label>
          <input
            id="ops-feedback-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email (optional, if you'd like a reply)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-[#1466b8]"
          />

          {state.status === "error" && (
            <p role="alert" className="text-xs text-rose-600">
              {state.message}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              We record the page you&apos;re on.
            </p>
            <SubmitButton />
          </div>

          {SUPPORT_EMAIL ? (
            <p className="text-xs text-gray-400">
              Or email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="underline hover:text-gray-600"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
