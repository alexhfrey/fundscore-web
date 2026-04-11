interface ScrollSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  tier?: "evidence" | "reference";
  badge?: string;
}

export function ScrollSection({
  id,
  title,
  description,
  children,
  tier,
  badge,
}: ScrollSectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 ${
        tier === "evidence" ? "border-t-[3px] border-t-[#1466b8] pt-6" : ""
      }`}
    >
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {badge && (
            <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
