import { HistoricalScenario } from "@/lib/types";

interface HistoricalScenarioTableProps {
  scenarios: HistoricalScenario[];
}

function colorClass(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < -10) return "text-red-600 font-semibold";
  if (value < 0) return "text-red-500";
  return "text-gray-600";
}

export function HistoricalScenarioTable({
  scenarios,
}: HistoricalScenarioTableProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
              Scenario
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
              Period
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
              Market
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
              Fund
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
              Passive Alt
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
              Recovery
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scenarios.map((s) => (
            <tr key={s.name}>
              <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{s.period}</td>
              <td className={`px-4 py-3 text-right ${colorClass(s.marketReturn)}`}>
                {s.marketReturn > 0 ? "+" : ""}{s.marketReturn}%
              </td>
              <td className={`px-4 py-3 text-right ${colorClass(s.fundReturn)}`}>
                {s.fundReturn > 0 ? "+" : ""}{s.fundReturn}%
              </td>
              <td className={`px-4 py-3 text-right ${colorClass(s.passiveAltReturn)}`}>
                {s.passiveAltReturn > 0 ? "+" : ""}{s.passiveAltReturn}%
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {s.recoveryMonths} mo
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
