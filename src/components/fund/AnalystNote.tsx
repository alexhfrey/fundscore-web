interface AnalystNoteProps {
  note: string;
  generatedDate?: string;
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 21h8" />
      <path d="M12 17V3" />
      <path d="m2 11 5-5 5 5" />
      <path d="m12 11 5-5 5 5" />
      <path d="M2 11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
      <path d="M12 11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
    </svg>
  );
}

export function AnalystNote({
  note,
  generatedDate = "Jan 2026",
}: AnalystNoteProps) {
  const paragraphs = note.split("\n\n").filter(Boolean);

  return (
    <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScaleIcon className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">
            AI Analyst Note
          </h3>
        </div>
        <span className="text-xs text-gray-400">
          Generated {generatedDate}
        </span>
      </div>
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
