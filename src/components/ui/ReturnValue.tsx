import { formatReturnPercent } from "@/lib/utils/format";
import { getReturnColor } from "@/lib/utils/colors";

interface ReturnValueProps {
  value: number | null;
  decimals?: number;
  className?: string;
}

export function ReturnValue({
  value,
  decimals = 2,
  className = "",
}: ReturnValueProps) {
  if (value === null || value === undefined) {
    return <span className={`text-gray-400 ${className}`}>--</span>;
  }

  return (
    <span className={`font-medium ${getReturnColor(value)} ${className}`}>
      {formatReturnPercent(value, decimals)}
    </span>
  );
}
