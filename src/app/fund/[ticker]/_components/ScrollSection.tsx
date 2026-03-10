interface ScrollSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function ScrollSection({ id, title, description, children }: ScrollSectionProps) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
