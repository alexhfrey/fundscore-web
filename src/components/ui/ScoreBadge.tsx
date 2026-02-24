import { getScoreBgClass, getScoreLabel } from "@/lib/utils/colors";

interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({
  score,
  showLabel = true,
  size = "md",
}: ScoreBadgeProps) {
  const bgClass = getScoreBgClass(score);
  const label = getScoreLabel(score);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${bgClass} ${sizeClasses[size]}`}
    >
      <span>{score}</span>
      {showLabel && <span className="font-normal">&middot; {label}</span>}
    </span>
  );
}
