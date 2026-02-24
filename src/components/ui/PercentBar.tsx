interface PercentBarProps {
  value: number;
  maxValue?: number;
  color?: string;
  className?: string;
  showLabel?: boolean;
}

export function PercentBar({
  value,
  maxValue = 100,
  color = "#1466b8",
  className = "",
  showLabel = true,
}: PercentBarProps) {
  const pct = Math.min(100, (value / maxValue) * 100);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 font-medium w-12 text-right">
          {value.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
