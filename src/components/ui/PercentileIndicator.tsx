interface PercentileIndicatorProps {
  value: number; // 0-100 percentile
  lowerIsBetter?: boolean;
  label?: string;
}

function ordinal(n: number): string {
  const r = Math.round(n);
  const s = ["th", "st", "nd", "rd"];
  const v = r % 100;
  return r + (s[(v - 20) % 10] || s[v] || s[0]);
}

function tierLabel(value: number, lowerIsBetter: boolean): { text: string; favorable: boolean } {
  // For lowerIsBetter (e.g. fees), a low percentile is good
  if (lowerIsBetter) {
    if (value < 34) return { text: "(top third)", favorable: true };
    if (value <= 66) return { text: "(middle third)", favorable: false };
    return { text: "(bottom third)", favorable: false };
  }
  // Standard: higher is better
  if (value >= 67) return { text: "(top third)", favorable: true };
  if (value >= 34) return { text: "(middle third)", favorable: false };
  return { text: "(bottom third)", favorable: false };
}

export function PercentileIndicator({
  value,
  lowerIsBetter = false,
  label,
}: PercentileIndicatorProps) {
  const isFavorable = lowerIsBetter ? value <= 33 : value >= 67;
  const isUnfavorable = lowerIsBetter ? value >= 67 : value <= 33;
  const pillColor = isFavorable
    ? "text-green-700 bg-green-50"
    : isUnfavorable
      ? "text-red-700 bg-red-50"
      : "text-amber-700 bg-amber-50";
  const dotColor = isFavorable
    ? "bg-green-500"
    : isUnfavorable
      ? "bg-red-500"
      : "bg-amber-500";
  const tier = tierLabel(value, lowerIsBetter);
  const tierColor = tier.favorable
    ? "text-green-600"
    : isUnfavorable
      ? "text-red-600"
      : "text-amber-600";

  return (
    <div>
      {label && <span className="text-xs text-gray-500 mb-1 block">{label}</span>}
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${pillColor}`}
        >
          {ordinal(value)} percentile
        </span>
        <span className="text-[10px] text-gray-400">in peer group</span>
        <span className={`text-[10px] font-medium ${tierColor}`}>{tier.text}</span>
      </div>
      <div className="mt-1.5 relative h-1 bg-gray-100 rounded-full">
        <div
          className={`absolute top-1/2 w-2 h-2 rounded-full ${dotColor} border border-white shadow-sm`}
          style={{
            left: `${Math.min(97, Math.max(3, value))}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    </div>
  );
}
