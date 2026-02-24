interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  subtitle,
  className = "",
  children,
}: MetricCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      {children || <p className="text-2xl font-bold text-gray-900">{value}</p>}
      {subtitle && (
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
