"use client";
// ============================================================================
// SectionNav — sticky dossier spine with scroll-spy over the 8 section ids.
// Client island: tracks the active section as the reader scrolls and keeps the
// active chip in view on the horizontally-scrolling rail.
// ============================================================================
import { useEffect, useRef, useState } from "react";

const SECTIONS: { id: string; num: string; label: string }[] = [
  { id: "s1", num: "01", label: "Verdict" },
  { id: "s2", num: "02", label: "Summary" },
  { id: "s3", num: "03", label: "Performance" },
  { id: "s4", num: "04", label: "Attribution" },
  { id: "s5", num: "05", label: "Positioning" },
  { id: "s6", num: "06", label: "Changes" },
  { id: "s7", num: "07", label: "Fees" },
  { id: "s8", num: "08", label: "Family" },
];

export function SectionNav({ passiveNote }: { passiveNote?: string | null }) {
  const [active, setActive] = useState("s1");
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spy = () => {
      let cur = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 140) cur = s.id;
      }
      setActive(cur);
    };
    spy();
    document.addEventListener("scroll", spy, { passive: true });
    return () => document.removeEventListener("scroll", spy);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const el = rail.querySelector<HTMLAnchorElement>(`a[data-s="${active}"]`);
    if (el) {
      const left = el.offsetLeft;
      const right = left + el.offsetWidth;
      if (left < rail.scrollLeft || right > rail.scrollLeft + rail.clientWidth) {
        rail.scrollTo({ left: left - 40, behavior: "smooth" });
      }
    }
  }, [active]);

  return (
    <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div
          ref={railRef}
          className="flex items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                data-s={s.id}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                <span className={on ? "text-gray-400" : "text-gray-300"}>{s.num}</span>
                {s.label}
              </a>
            );
          })}
          {passiveNote && (
            <span className="ml-auto hidden shrink-0 whitespace-nowrap pl-3 text-[11px] font-semibold text-gray-400 lg:inline">
              {passiveNote}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
