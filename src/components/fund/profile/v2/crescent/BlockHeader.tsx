// ============================================================================
// BlockHeader — the Crescent page's section-header idiom (design pass,
// 2026-07-22): mono uppercase eyebrow + serif headline, exactly the treatment
// AnatomySection introduced ("The gold, under a microscope" / serif h2). One
// component so every block's header is the same voice: the eyebrow names the
// artifact + its basis; the headline SAYS something (data-driven where the
// caller has the data), never just labels a section.
// ============================================================================

export function BlockHeader({
  eyebrow,
  headline,
  sub,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.17em] text-gray-400">{eyebrow}</p>
      <h2 className="mt-1 max-w-[36ch] font-serif text-2xl font-semibold leading-snug tracking-tight text-gray-900">
        {headline}
      </h2>
      {sub && <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-gray-500">{sub}</p>}
    </div>
  );
}
