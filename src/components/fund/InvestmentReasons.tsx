import { FundDetail } from "@/lib/types";

interface Reason {
  text: string;
  magnitude: number;
}

function evaluateInvestTriggers(fund: FundDetail): Reason[] {
  const { trading, fees, risk, fundScore, scoreLabel, managerStartYear } = fund;
  const { battingAverage, winLossRatio, activeShare, sectorHitRates } = trading;
  const { expenseRatio, categoryAvgExpenseRatio } = fees;
  const alpha = risk.alpha.threeYear;
  const { upsideCaptureRatio, downsideCaptureRatio } = risk;
  const tenure = 2026 - managerStartYear;

  const candidates: (Reason | null)[] = [
    battingAverage > 0.55
      ? {
          text: `Wins on ${(battingAverage * 100).toFixed(0)}% of trades — well above average`,
          magnitude: battingAverage,
        }
      : null,

    winLossRatio > 1.2
      ? {
          text: `Wins are ${winLossRatio}x larger than losses`,
          magnitude: winLossRatio,
        }
      : null,

    expenseRatio < categoryAvgExpenseRatio * 0.8
      ? (() => {
          const pctBelow = Math.round(
            ((categoryAvgExpenseRatio - expenseRatio) / categoryAvgExpenseRatio) * 100
          );
          return {
            text: `Fees ${pctBelow}% below category average`,
            magnitude: pctBelow / 100,
          };
        })()
      : null,

    alpha > 0
      ? {
          text: `Positive 3-year alpha of ${alpha.toFixed(1)}%`,
          magnitude: alpha,
        }
      : null,

    activeShare > 0.7
      ? {
          text: `High active share (${(activeShare * 100).toFixed(0)}%) — truly active manager`,
          magnitude: activeShare,
        }
      : null,

    fundScore >= 70
      ? {
          text: `FundScore of ${fundScore} — rated ${scoreLabel}`,
          magnitude: fundScore / 100,
        }
      : null,

    tenure > 10
      ? {
          text: `Seasoned manager with ${tenure}+ year track record`,
          magnitude: tenure / 20,
        }
      : null,

    upsideCaptureRatio > downsideCaptureRatio
      ? {
          text: `Captures more upside than downside`,
          magnitude: (upsideCaptureRatio - downsideCaptureRatio) / 100,
        }
      : null,

    (() => {
      if (!sectorHitRates.length) return null;
      const best = sectorHitRates.reduce((a, b) => (a.hitRate > b.hitRate ? a : b));
      return best.hitRate > 0.6
        ? {
            text: `Strong sector expertise: ${best.sector} at ${(best.hitRate * 100).toFixed(0)}% hit rate`,
            magnitude: best.hitRate,
          }
        : null;
    })(),
  ];

  return candidates
    .filter((r): r is Reason => r !== null)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4);
}

function evaluateAvoidTriggers(fund: FundDetail): Reason[] {
  const { trading, fees, risk, fundScore, scoreLabel, managerStartYear } = fund;
  const { battingAverage, winLossRatio, activeShare } = trading;
  const { expenseRatio, categoryAvgExpenseRatio } = fees;
  const alpha = risk.alpha.threeYear;
  const { downsideCaptureRatio } = risk;
  const tenure = 2026 - managerStartYear;

  const candidates: (Reason | null)[] = [
    expenseRatio > categoryAvgExpenseRatio * 1.2
      ? (() => {
          const pctAbove = Math.round(
            ((expenseRatio - categoryAvgExpenseRatio) / categoryAvgExpenseRatio) * 100
          );
          return {
            text: `Fees ${pctAbove}% above category average`,
            magnitude: pctAbove / 100,
          };
        })()
      : null,

    alpha < 0
      ? {
          text: `Negative 3-year alpha of ${alpha.toFixed(1)}%`,
          magnitude: Math.abs(alpha),
        }
      : null,

    activeShare < 0.4
      ? {
          text: `Low active share (${(activeShare * 100).toFixed(0)}%) — possible closet indexer`,
          magnitude: 1 - activeShare,
        }
      : null,

    battingAverage < 0.45
      ? {
          text: `Wins on only ${(battingAverage * 100).toFixed(0)}% of trades`,
          magnitude: 1 - battingAverage,
        }
      : null,

    winLossRatio < 0.8
      ? {
          text: `Losses are larger than wins (${winLossRatio}x ratio)`,
          magnitude: 1 / winLossRatio,
        }
      : null,

    fundScore < 40
      ? {
          text: `FundScore of ${fundScore} — rated ${scoreLabel}`,
          magnitude: (100 - fundScore) / 100,
        }
      : null,

    tenure < 4
      ? {
          text: `Short manager tenure — only ${tenure} years`,
          magnitude: (4 - tenure) / 4,
        }
      : null,

    downsideCaptureRatio > 105
      ? {
          text: `High downside capture (${downsideCaptureRatio.toFixed(0)}%)`,
          magnitude: downsideCaptureRatio / 100,
        }
      : null,
  ];

  return candidates
    .filter((r): r is Reason => r !== null)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 4);
}

interface Props {
  fund: FundDetail;
}

export function InvestmentReasons({ fund }: Props) {
  const rawInvest = evaluateInvestTriggers(fund);
  const rawAvoid = evaluateAvoidTriggers(fund);

  const investReasons: Reason[] =
    rawInvest.length > 0
      ? rawInvest
      : [{ text: "Active management provides diversification from passive", magnitude: 0 }];

  const avoidReasons: Reason[] =
    rawAvoid.length > 0
      ? rawAvoid
      : [{ text: "Past performance doesn't guarantee future results", magnitude: 0 }];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Considerations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Reasons to Invest */}
        <div className="bg-white border border-green-200 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            Reasons to Invest
          </h4>
          <ul className="space-y-2">
            {investReasons.map((r) => (
              <li key={r.text} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                {r.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Reasons to Avoid */}
        <div className="bg-white border border-red-200 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            Reasons to Avoid
          </h4>
          <ul className="space-y-2">
            {avoidReasons.map((r) => (
              <li key={r.text} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-500 mt-0.5">✗</span>
                {r.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
