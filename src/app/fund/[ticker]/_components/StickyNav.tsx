"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Section {
  id: string;
  label: string;
}

interface StickyNavProps {
  sections: Section[];
}

export function StickyNav({ sections }: StickyNavProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const navRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  // Scroll active button into view on mobile
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-section="${activeId}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeId]);

  const handleClick = useCallback((id: string) => {
    setActiveId(id);
    isClickScrolling.current = true;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        isClickScrolling.current = false;
      }, 1000);
    }
  }, []);

  return (
    <nav
      className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200"
      aria-label="Page sections"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={navRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide py-2 -mx-1"
        >
          {sections.map((s) => (
            <button
              key={s.id}
              data-section={s.id}
              onClick={() => handleClick(s.id)}
              aria-current={activeId === s.id ? "true" : undefined}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex-shrink-0 ${
                activeId === s.id
                  ? "bg-blue-50 text-[#1466b8]"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
