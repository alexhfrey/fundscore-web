"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
}: {
  label: string;
  pendingLabel?: string;
  tone?: "primary" | "secondary" | "strong" | "codex";
}) {
  const { pending } = useFormStatus();
  const classes = {
    primary: "border-[#1466b8] bg-[#1466b8] text-white hover:bg-[#0f4f8c]",
    secondary: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    strong: "border-gray-900 bg-gray-900 text-white hover:bg-gray-700",
    codex: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800",
  }[tone];

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`h-8 border px-3 text-xs font-semibold transition-colors disabled:cursor-wait disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500 ${classes}`}
    >
      {pending ? pendingLabel ?? "Working..." : label}
    </button>
  );
}
