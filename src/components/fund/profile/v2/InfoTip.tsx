"use client";
// ============================================================================
// InfoTip — the dossier's ⓘ plain-language explainer. Hover (desktop) + tap
// (mobile) reveal a small popover. Content is plain copy passed as children
// (the fixture risk_explainers / nav hover_copy strings). No data, just prose.
// ============================================================================
import { useState, useRef, useEffect } from "react";

export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={`What does ${label} mean?`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] font-bold text-gray-500 hover:border-gray-500 hover:text-gray-900"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2.5 text-[12px] font-normal leading-relaxed tracking-normal text-gray-100 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </span>
      )}
    </span>
  );
}
