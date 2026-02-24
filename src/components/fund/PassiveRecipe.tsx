import { FundDetail } from "@/lib/types";
import { FACTOR_ETF_MAP } from "@/lib/constants";

export function PassiveRecipe({ fund }: { fund: FundDetail }) {
  const tilts = fund.trading.factorTilts.filter(
    (t) => Math.abs(t.exposure) >= 0.1
  );

  const rawItems = tilts.flatMap((t) => {
    const etf = FACTOR_ETF_MAP[t.factor];
    if (!etf) return [];
    return [{ ...etf, rawWeight: Math.abs(t.exposure) }];
  });

  const totalRaw = rawItems.reduce((sum, item) => sum + item.rawWeight, 0);

  const recipe = rawItems.map((item) => ({
    ticker: item.ticker,
    name: item.name,
    expenseRatio: item.expenseRatio,
    weight: totalRaw > 0 ? (item.rawWeight / totalRaw) * 100 : 0,
  }));

  const blendedCost = recipe.reduce(
    (sum, r) => sum + (r.weight / 100) * r.expenseRatio,
    0
  );

  const savings = fund.fees.expenseRatio - blendedCost;
  const savingsPer10k = (savings / 100) * 10000;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Passive Clone Recipe</h3>
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-sm text-gray-600 mb-4">
          Approximate this fund&apos;s factor exposures using low-cost ETFs:
        </p>

        {/* ETF table */}
        <table className="min-w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Ticker</th>
              <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">ETF</th>
              <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">Weight</th>
              <th className="py-2 text-right text-xs font-semibold text-gray-500 uppercase">Expense Ratio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recipe.map((r) => (
              <tr key={r.ticker}>
                <td className="py-2 font-medium text-[#1466b8]">{r.ticker}</td>
                <td className="py-2 text-gray-700">{r.name}</td>
                <td className="py-2 text-right text-gray-900">{r.weight.toFixed(1)}%</td>
                <td className="py-2 text-right text-gray-500">{r.expenseRatio.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Blended passive cost</span>
            <span className="font-semibold text-gray-900">{blendedCost.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{fund.ticker} expense ratio</span>
            <span className="font-semibold text-gray-900">{fund.fees.expenseRatio.toFixed(2)}%</span>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="font-semibold text-green-700">Potential savings</span>
              <span className="font-semibold text-green-700">{savings.toFixed(2)}%/yr (${Math.round(savingsPer10k)} per $10,000)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
