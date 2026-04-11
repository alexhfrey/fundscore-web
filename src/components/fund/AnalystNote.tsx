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

export function extractBottomLine(paragraphs: string[]): string | null {
  if (paragraphs.length === 0) return null;
  const last = paragraphs[paragraphs.length - 1];
  // Look for "Bottom line:" prefix (case-insensitive)
  const match = last.match(/^bottom\s*line:\s*/i);
  if (match) {
    const rest = last.slice(match[0].length);
    // Extract first sentence
    const sentenceEnd = rest.search(/[.!?]/);
    if (sentenceEnd >= 0) return rest.slice(0, sentenceEnd + 1);
    return rest;
  }
  return null;
}

const BEAR_WORDS = [
  "however",
  "but",
  "risk",
  "fee",
  "cost",
  "underperform",
  "concern",
  "drag",
  "challenge",
  "caution",
  "despite",
  "lag",
  "weakness",
  "volatile",
  "volatility",
  "drawback",
  "downside",
];

function isBearParagraph(text: string): boolean {
  const lower = text.toLowerCase();
  return BEAR_WORDS.some((word) => lower.includes(word));
}

function classifyParagraphs(paragraphs: string[]): {
  bull: string[];
  bear: string[];
} {
  const bull: string[] = [];
  const bear: string[] = [];

  for (const p of paragraphs) {
    if (isBearParagraph(p)) {
      bear.push(p);
    } else {
      // Put ambiguous paragraphs in whichever group has fewer items
      if (bear.length < bull.length) {
        bear.push(p);
      } else {
        bull.push(p);
      }
    }
  }

  return { bull, bear };
}

export function AnalystNote({
  note,
  generatedDate = "Jan 2026",
}: AnalystNoteProps) {
  const paragraphs = note.split("\n\n").filter(Boolean);
  const bottomLine = extractBottomLine(paragraphs);

  // Exclude the last paragraph if it is the bottom line
  const lastParagraph = paragraphs[paragraphs.length - 1];
  const isLastBottomLine =
    lastParagraph && /^bottom\s*line:\s*/i.test(lastParagraph);
  const bodyParagraphs = isLastBottomLine
    ? paragraphs.slice(0, -1)
    : paragraphs;

  const { bull, bear } = classifyParagraphs(bodyParagraphs);

  return (
    <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScaleIcon className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">
            AI Analyst Note
          </h3>
        </div>
        <span className="text-xs text-gray-400">Generated {generatedDate}</span>
      </div>
      {bottomLine && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-gray-900">
            <span className="font-bold">Bottom Line:</span> {bottomLine}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
            The Case for Keeping
          </p>
          <div className="space-y-2">
            {bull.map((p, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
            The Case for Switching
          </p>
          <div className="space-y-2">
            {bear.map((p, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
