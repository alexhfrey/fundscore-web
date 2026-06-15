"use client";

import { getScoreColor } from "@/lib/utils/colors";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  textVariant?: "default" | "hero" | "mini";
}

const TEXT_CLASSES = {
  default: "text-3xl font-bold",
  hero: "text-5xl font-black",
  mini: "text-sm font-bold",
};

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  className = "",
  showLabel = true,
  label,
  textVariant = "default",
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;
  const color = getScoreColor(score);

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring-animate"
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        <span className={`${TEXT_CLASSES[textVariant]} text-gray-900`}>{score}</span>
        {showLabel && (
          <span className={`${textVariant === "mini" ? "text-[8px]" : "text-xs"} text-gray-500 mt-0.5`}>
            {label || "FundScore"}
          </span>
        )}
      </div>
    </div>
  );
}
