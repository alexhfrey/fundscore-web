import { FundDetail, FactorTilt } from "../../types";

type FundInput = Omit<FundDetail, "analystNote">;

function scoreTier(score: number): "strong_buy" | "buy" | "hold" | "sell" {
  if (score >= 75) return "strong_buy";
  if (score >= 60) return "buy";
  if (score >= 40) return "hold";
  return "sell";
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatBps(n: number): string {
  return `${Math.round(n * 100)} bps`;
}

function formatAUM(aum: number): string {
  if (aum >= 1000) return `$${(aum / 1000).toFixed(0)}B`;
  return `$${aum.toFixed(1)}M`;
}

function inceptionYear(inceptionDate: string): number {
  return parseInt(inceptionDate.split("-")[0], 10);
}

function topSectors(fund: FundInput, count: number) {
  return [...fund.trading.sectorHitRates]
    .sort((a, b) => b.hitRate - a.hitRate)
    .slice(0, count);
}

function topWinners(fund: FundInput, count: number) {
  return fund.trading.recentTrades
    .filter((t) => t.outcome === "winner")
    .sort((a, b) => b.returnSince - a.returnSince)
    .slice(0, count);
}

function primaryTilts(tilts: FactorTilt[]): FactorTilt[] {
  return [...tilts]
    .sort((a, b) => Math.abs(b.exposure) - Math.abs(a.exposure))
    .slice(0, 2);
}

function paragraphOne(fund: FundInput): string {
  const tier = scoreTier(fund.fundScore);
  const year = inceptionYear(fund.inceptionDate);
  const tenure = 2026 - fund.managerStartYear;

  const verdicts: Record<string, string> = {
    strong_buy: `${fund.name} (${fund.ticker}) earns a FundScore of ${fund.fundScore}, placing it in the Strong Buy tier — among the highest-conviction active funds in the ${fund.category} category.`,
    buy: `${fund.name} (${fund.ticker}) earns a FundScore of ${fund.fundScore}, placing it in the Buy tier within the ${fund.category} category.`,
    hold: `${fund.name} (${fund.ticker}) carries a FundScore of ${fund.fundScore}, placing it in the Hold tier for the ${fund.category} category.`,
    sell: `${fund.name} (${fund.ticker}) carries a FundScore of just ${fund.fundScore}, placing it in the ${fund.fundScore >= 25 ? "Underperform" : "Sell"} tier — among the weakest active offerings in the ${fund.category} category.`,
  };

  return `${verdicts[tier]} Founded in ${year} and managing ${formatAUM(fund.aum)} in assets, the fund has operated under ${fund.manager} for ${tenure} year${tenure !== 1 ? "s" : ""}.`;
}

function paragraphTwo(fund: FundInput): string {
  const tenure = 2026 - fund.managerStartYear;
  const tier = scoreTier(fund.fundScore);

  if (tenure >= 10) {
    if (tier === "strong_buy" || tier === "buy") {
      return `Manager ${fund.manager} has been at the helm for ${tenure} years, providing meaningful leadership continuity. That tenure has coincided with a track record of consistent risk-adjusted outperformance, and the stability of the investment process is reflected in the fund's above-average batting average of ${(fund.trading.battingAverage * 100).toFixed(1)}%.`;
    }
    return `Manager ${fund.manager} has led the fund for ${tenure} years. While tenure alone does not guarantee results, the extended track record provides ample data to evaluate the investment process — and the batting average of ${(fund.trading.battingAverage * 100).toFixed(1)}% suggests the strategy has struggled to generate consistent winners.`;
  }
  if (tenure >= 5) {
    return `${fund.manager} has managed the fund for ${tenure} years — long enough to evaluate through a full market cycle. The batting average stands at ${(fund.trading.battingAverage * 100).toFixed(1)}%, which provides a reasonable baseline for assessing the manager's stock-picking acumen.`;
  }
  return `${fund.manager} took over ${tenure} year${tenure !== 1 ? "s" : ""} ago, making the current track record relatively short. The batting average of ${(fund.trading.battingAverage * 100).toFixed(1)}% is based on a limited sample and should be interpreted with caution.`;
}

function paragraphThree(fund: FundInput): string {
  const tier = scoreTier(fund.fundScore);
  const top = topSectors(fund, 2);
  const winners = topWinners(fund, 2);
  const winLoss = fund.trading.winLossRatio;
  const holdPeriod = fund.trading.avgHoldingPeriodMonths;

  let sectorStr = "";
  if (top.length >= 2) {
    sectorStr = `The fund's strongest sector hit rates are in ${top[0].sector} (${(top[0].hitRate * 100).toFixed(0)}% across ${top[0].tradeCount} trades) and ${top[1].sector} (${(top[1].hitRate * 100).toFixed(0)}% across ${top[1].tradeCount} trades).`;
  } else if (top.length === 1) {
    sectorStr = `The fund's strongest sector hit rate is in ${top[0].sector} at ${(top[0].hitRate * 100).toFixed(0)}%.`;
  }

  let asymmetryStr: string;
  if (winLoss >= 1.5) {
    asymmetryStr = `The win/loss ratio of ${winLoss.toFixed(2)}x indicates the manager wins significantly bigger than they lose — a hallmark of skilled position sizing.`;
  } else if (winLoss >= 1.0) {
    asymmetryStr = `The win/loss ratio of ${winLoss.toFixed(2)}x shows roughly symmetric outcomes between winning and losing positions.`;
  } else {
    asymmetryStr = `The win/loss ratio of ${winLoss.toFixed(2)}x is concerning — losing positions have tended to be larger than winners, suggesting issues with risk management or position sizing.`;
  }

  let winnersStr = "";
  if (winners.length >= 1 && tier !== "sell") {
    winnersStr = ` Recent successes include ${winners.map((w) => `${w.name} (${formatPct(w.returnSince)})`).join(" and ")}.`;
  }

  return `${sectorStr} ${asymmetryStr} The average holding period of ${holdPeriod} months ${holdPeriod >= 18 ? "reflects a patient, long-term approach" : "suggests a more tactical, shorter-duration trading style"}.${winnersStr}`;
}

function paragraphFour(fund: FundInput): string {
  const tilts = primaryTilts(fund.trading.factorTilts);
  const activeShare = fund.trading.activeShare;
  const conviction = fund.trading.convictionScore;

  let styleStr: string;
  if (activeShare >= 0.7 && conviction >= 3.5) {
    styleStr = `With an active share of ${(activeShare * 100).toFixed(0)}% and a conviction score of ${conviction.toFixed(1)}, this is a high-conviction, concentrated portfolio — the manager is making bold, differentiated bets relative to the benchmark.`;
  } else if (activeShare >= 0.5) {
    styleStr = `The active share of ${(activeShare * 100).toFixed(0)}% and conviction score of ${conviction.toFixed(1)} suggest a moderately active approach — the manager deviates meaningfully from the index while maintaining diversification.`;
  } else {
    styleStr = `The active share of ${(activeShare * 100).toFixed(0)}% is notably low, and the conviction score of ${conviction.toFixed(1)} indicates the portfolio closely hugs its benchmark — raising questions about whether investors are paying active fees for near-passive exposure.`;
  }

  let tiltStr = "";
  if (tilts.length >= 2) {
    tiltStr = ` The dominant factor exposures are ${tilts[0].label.toLowerCase()} and ${tilts[1].label.toLowerCase()}, positioning the fund as a ${tilts[0].factor.toLowerCase()}-oriented ${fund.assetClass.toLowerCase()} vehicle.`;
  } else if (tilts.length === 1) {
    tiltStr = ` The primary factor exposure is a ${tilts[0].label.toLowerCase()}.`;
  }

  return `${styleStr}${tiltStr}`;
}

function paragraphFive(fund: FundInput): string {
  const expense = fund.expenseRatio;
  const catAvg = fund.fees.categoryAvgExpenseRatio;
  const diff = expense - catAvg;
  const alpha3Y = fund.risk.alpha.threeYear;

  if (diff <= -0.2) {
    return `At ${formatBps(expense)}, the expense ratio sits well below the ${fund.category} category average of ${formatBps(catAvg)} — a meaningful cost advantage that compounds over time.`;
  }
  if (diff <= 0.1) {
    if (alpha3Y > 1) {
      return `The expense ratio of ${formatBps(expense)} is roughly in line with the ${fund.category} category average of ${formatBps(catAvg)}. With a three-year alpha of ${formatPct(alpha3Y)}, the fund has historically generated enough excess return to justify its fee.`;
    }
    return `The expense ratio of ${formatBps(expense)} is roughly in line with the ${fund.category} category average of ${formatBps(catAvg)}. However, with a three-year alpha of ${formatPct(alpha3Y)}, it remains an open question whether the manager is adding enough value after costs.`;
  }
  if (alpha3Y > 2) {
    return `The expense ratio of ${formatBps(expense)} exceeds the ${fund.category} category average of ${formatBps(catAvg)} by ${formatBps(diff)}. That said, the three-year alpha of ${formatPct(alpha3Y)} suggests the manager has delivered enough excess return to offset the higher cost — though fee-sensitive investors should monitor this closely.`;
  }
  return `The expense ratio of ${formatBps(expense)} exceeds the ${fund.category} category average of ${formatBps(catAvg)} by ${formatBps(diff)}. With a three-year alpha of just ${formatPct(alpha3Y)}, the fund has not consistently generated sufficient excess return to justify its fee premium.`;
}

function paragraphSix(fund: FundInput): string {
  const tier = scoreTier(fund.fundScore);

  const verdicts: Record<string, string> = {
    strong_buy: `Bottom line: ${fund.ticker} is one of the rare active funds that has historically justified its fee premium over ${fund.passiveAltTicker} (${fund.passiveAltName}). For investors seeking active management in the ${fund.category} space, this fund merits strong consideration.`,
    buy: `Bottom line: ${fund.ticker} has demonstrated sufficient skill to warrant its active management fee relative to ${fund.passiveAltTicker} (${fund.passiveAltName}), though investors should continue to monitor performance consistency.`,
    hold: `Bottom line: ${fund.ticker} occupies a middle ground — neither clearly justifying its active fee nor failing outright. Investors with existing positions may hold, but new money may be better allocated to ${fund.passiveAltTicker} (${fund.passiveAltName}) until the fund demonstrates a clearer edge.`,
    sell: `Bottom line: The data does not support an active management premium for ${fund.ticker}. Investors would likely be better served by the passive alternative, ${fund.passiveAltTicker} (${fund.passiveAltName}), which offers similar market exposure at a fraction of the cost.`,
  };

  return verdicts[tier];
}

export function generateAnalystNote(fund: FundInput): string {
  return [
    paragraphOne(fund),
    paragraphTwo(fund),
    paragraphThree(fund),
    paragraphFour(fund),
    paragraphFive(fund),
    paragraphSix(fund),
  ].join("\n\n");
}
