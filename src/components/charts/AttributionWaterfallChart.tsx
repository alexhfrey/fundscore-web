"use client";

import { AlphaWaterfallChart, WaterfallDataPoint } from "./AlphaWaterfallChart";
import {
  PerformanceAttribution,
} from "@/lib/types";

interface AttributionWaterfallChartProps {
  attribution: PerformanceAttribution;
}

function buildEquityData(attr: PerformanceAttribution): WaterfallDataPoint[] {
  const eq = attr.equity!;
  let running = 0;
  const points: WaterfallDataPoint[] = [];

  const items = [
    { name: "Market Exposure", value: eq.betaContribution },
    { name: "Sector Choices", value: eq.sectorExposure },
    { name: "Sector Timing", value: eq.sectorTiming },
    { name: "Market Timing", value: eq.marketTiming },
    { name: "Stock Picking", value: eq.stockSelection },
  ];

  for (const item of items) {
    points.push({
      name: item.name,
      start: running,
      end: running + item.value,
      fill: item.value >= 0 ? "#16a34a" : "#dc2626",
    });
    running += item.value;
  }

  points.push({
    name: "Gross Value Added",
    start: 0,
    end: eq.grossAlpha,
    fill: "#1466b8",
    isSummary: true,
  });
  points.push({
    name: "Fees Paid",
    start: eq.grossAlpha,
    end: eq.netAlpha,
    fill: "#dc2626",
  });
  points.push({
    name: "Net Value Added",
    start: 0,
    end: eq.netAlpha,
    fill: eq.netAlpha >= 0 ? "#16a34a" : "#dc2626",
    isSummary: true,
  });

  return points;
}

function buildFIData(attr: PerformanceAttribution): WaterfallDataPoint[] {
  const fi = attr.fixedIncome!;
  let running = 0;
  const points: WaterfallDataPoint[] = [];

  const items = [
    { name: "Duration Positioning", value: fi.durationEffect },
    { name: "Yield Curve", value: fi.yieldCurveEffect },
    { name: "Credit Spreads", value: fi.creditSpreadEffect },
    { name: "Sector Allocation", value: fi.sectorAllocation },
    { name: "Security Selection", value: fi.securitySelection },
  ];

  for (const item of items) {
    points.push({
      name: item.name,
      start: running,
      end: running + item.value,
      fill: item.value >= 0 ? "#16a34a" : "#dc2626",
    });
    running += item.value;
  }

  points.push({
    name: "Gross Value Added",
    start: 0,
    end: fi.grossAlpha,
    fill: "#1466b8",
    isSummary: true,
  });
  points.push({
    name: "Fees Paid",
    start: fi.grossAlpha,
    end: fi.netAlpha,
    fill: "#dc2626",
  });
  points.push({
    name: "Net Value Added",
    start: 0,
    end: fi.netAlpha,
    fill: fi.netAlpha >= 0 ? "#16a34a" : "#dc2626",
    isSummary: true,
  });

  return points;
}

function buildAllocationData(attr: PerformanceAttribution): WaterfallDataPoint[] {
  const al = attr.allocation!;
  let running = 0;
  const points: WaterfallDataPoint[] = [];

  const items = [
    { name: "Asset Allocation", value: al.assetClassAllocation },
    { name: "Equity Selection", value: al.withinEquity },
    { name: "Bond Selection", value: al.withinFixedIncome },
    { name: "Alternatives", value: al.withinAlternatives },
  ];

  for (const item of items) {
    points.push({
      name: item.name,
      start: running,
      end: running + item.value,
      fill: item.value >= 0 ? "#16a34a" : "#dc2626",
    });
    running += item.value;
  }

  points.push({
    name: "Gross Value Added",
    start: 0,
    end: al.grossAlpha,
    fill: "#1466b8",
    isSummary: true,
  });
  points.push({
    name: "Fees Paid",
    start: al.grossAlpha,
    end: al.netAlpha,
    fill: "#dc2626",
  });
  points.push({
    name: "Net Value Added",
    start: 0,
    end: al.netAlpha,
    fill: al.netAlpha >= 0 ? "#16a34a" : "#dc2626",
    isSummary: true,
  });

  return points;
}

export function AttributionWaterfallChart({
  attribution,
}: AttributionWaterfallChartProps) {
  let data: WaterfallDataPoint[];

  switch (attribution.type) {
    case "fixedIncome":
      data = buildFIData(attribution);
      break;
    case "allocation":
      data = buildAllocationData(attribution);
      break;
    default:
      data = buildEquityData(attribution);
  }

  return <AlphaWaterfallChart data={data} height={300} />;
}
