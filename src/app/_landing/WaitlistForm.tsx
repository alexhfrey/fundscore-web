"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { joinWaitlist, type WaitlistState } from "./actions";

const INITIAL: WaitlistState = { status: "idle" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
    >
      {pending ? "Adding…" : label}
    </button>
  );
}

export function WaitlistForm({
  source,
  label = "Join the waitlist",
  tone = "light",
}: {
  source: string;
  label?: string;
  tone?: "light" | "dark";
}) {
  const [state, formAction] = useActionState(joinWaitlist, INITIAL);

  const dark = tone === "dark";

  if (state.status === "joined") {
    return (
      <p
        role="status"
        className={`flex items-center gap-2 text-sm ${dark ? "text-white/90" : "text-ink"}`}
      >
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white"
        >
          ✓
        </span>
        You&apos;re on the list. We&apos;ll write when there&apos;s something
        worth showing you — not before.
      </p>
    );
  }

  return (
    <div>
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="source" value={source} />
        <label htmlFor={`email-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`email-${source}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-describedby={
            state.status === "error" ? `error-${source}` : undefined
          }
          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors sm:max-w-xs ${
            dark
              ? "border-white/20 bg-white/5 text-white placeholder:text-white/40 focus-visible:border-white/50"
              : "border-rule bg-white text-ink placeholder:text-ink-soft/60 focus-visible:border-primary"
          }`}
        />
        <SubmitButton label={label} />
      </form>

      {state.status === "error" && (
        <p
          id={`error-${source}`}
          role="alert"
          className={`mt-2 text-xs ${dark ? "text-rose-300" : "text-below"}`}
        >
          {state.message}
        </p>
      )}

      <p
        className={`mt-2 text-xs ${dark ? "text-white/45" : "text-ink-soft/75"}`}
      >
        One email when we open. No newsletter, no sharing your address.
      </p>
    </div>
  );
}
