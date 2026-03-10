"use client";

import { useState } from "react";
import { ModelBacktest } from "@/lib/types";
import { MetricCard } from "@/components/ui/MetricCard";
import { CalibrationChart } from "@/components/charts/CalibrationChart";
import { BacktestChart } from "@/components/charts/BacktestChart";
import { PerformanceLineChart } from "@/components/charts/PerformanceLineChart";
import { formatDate } from "@/lib/utils/format";

interface ModelPageContentProps {
  data: ModelBacktest;
}

export function ModelPageContent({ data }: ModelPageContentProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-10">
      {/* Model overview */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          What is FundScore?
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 leading-relaxed mb-4">
            FundScore is a forward-looking, predictive rating that estimates
            the probability of an active mutual fund outperforming its closest
            passive ETF alternative over the next year. Unlike backward-looking
            star ratings, FundScore uses machine learning on SEC N-PORT
            filings, portfolio holdings, trading patterns, and fee structures
            to predict future relative performance.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Every active fund is paired with its closest passive ETF
            alternative (selected via tracking error minimization). The
            FundScore represents the estimated probability (0-100%) that the
            active fund will deliver higher returns than simply buying the
            ETF. A score of 72 means we estimate a 72% chance the active fund
            outperforms.
          </p>
        </div>
      </section>

      {/* Model statistics */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Model Statistics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            label="Funds Scored"
            value={data.totalFundsScored.toLocaleString()}
          />
          <MetricCard
            label="Data Start"
            value={formatDate(data.dataStartDate)}
          />
          <MetricCard
            label="Last Updated"
            value={formatDate(data.lastUpdated)}
          />
          <MetricCard
            label="Overall Accuracy"
            value={`${data.rollingAccuracy[data.rollingAccuracy.length - 1].hitRate}%`}
            subtitle="Latest rolling 1Y"
          />
        </div>
      </section>

      {/* Calibration */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Calibration
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Predicted probability vs actual beat rate. Points close to the
          diagonal indicate good calibration.
        </p>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <CalibrationChart data={data.calibration} />
        </div>
      </section>

      {/* Rolling accuracy */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Rolling Accuracy
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          1-year rolling hit rate: % of predictions that were correct.
        </p>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <PerformanceLineChart
            series={[
              {
                name: "Hit Rate",
                data: data.rollingAccuracy.map((d) => ({
                  date: d.date,
                  value: d.hitRate,
                })),
                color: "#1466b8",
              },
            ]}
            height={300}
          />
        </div>
      </section>

      {/* Quintile returns */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Backtest: Quintile Performance
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Average excess return by FundScore quintile. Top-quintile funds
          consistently outperform; bottom-quintile consistently underperform.
        </p>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <BacktestChart data={data.quintileReturns} />
        </div>
      </section>

      {/* Top vs Bottom spread */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Top vs Bottom Quintile Spread
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          The return spread between buying the top-quintile and shorting the
          bottom-quintile FundScore funds.
        </p>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <PerformanceLineChart
            series={[
              {
                name: "Long/Short Spread",
                data: data.topVsBottomSpread.map((d) => ({
                  date: d.date,
                  value: d.spread,
                })),
                color: "#16a34a",
              },
            ]}
            height={300}
          />
        </div>
      </section>

      {/* Accuracy by peer group */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Accuracy by Peer Group
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Peer Group
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Accuracy
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Sample Size
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.peerGroupAccuracy.map((cat) => (
                <tr key={cat.peerGroup}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {cat.peerGroup}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-semibold ${cat.accuracy >= 65 ? "text-green-600" : cat.accuracy >= 60 ? "text-yellow-600" : "text-orange-600"}`}
                    >
                      {cat.accuracy}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {cat.sampleSize.toLocaleString()} funds
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology deep dive */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Methodology
        </h2>
        <div className="space-y-3">
          {[
            {
              id: "inputs",
              title: "Model Inputs",
              content:
                "FundScore analyzes 7 key dimensions: Performance (25%), Credit Quality (20%), Liquidity (15%), Portfolio Structure (10%), Fees (10%), Underwriting Quality (10%), and Concentration Risk (10%). Data is sourced from SEC N-PORT filings (quarterly), daily NAV data, and holdings-level analysis.",
            },
            {
              id: "passive",
              title: "Passive Alternative Selection",
              content:
                "Each active fund is matched to its closest passive ETF alternative using a tracking error minimization approach. We consider the fund's stated benchmark, actual holdings overlap, factor exposures, and historical return correlation to find the best passive substitute.",
            },
            {
              id: "scoring",
              title: "Score Computation",
              content:
                "The FundScore is computed using a gradient-boosted ensemble model trained on historical fund-vs-ETF outcomes. The model outputs a calibrated probability (0-100%) that the active fund will outperform its passive alternative over the next 12 months. Scores are updated quarterly after new N-PORT filings.",
            },
            {
              id: "labels",
              title: "Score Labels",
              content:
                "Strong Buy (75+): High probability of outperformance. Buy (60-74): Likely to outperform. Hold (40-59): Roughly even odds. Underperform (25-39): Likely to underperform. Sell (<25): High probability of underperformance vs passive.",
            },
          ].map((section) => (
            <div
              key={section.id}
              className="bg-white border border-gray-200 rounded-lg"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-semibold text-gray-900">
                  {section.title}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedSection === section.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {expandedSection === section.id && (
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
