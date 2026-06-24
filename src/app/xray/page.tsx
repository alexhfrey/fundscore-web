import type { Metadata } from "next";
import { PortfolioXray } from "@/components/portfolio";

// Portfolio X-Ray surface (spec docs/product/page_specs/portfolio_xray.md, T7b /
// Phase 4 Track 4C). Per serving_architecture.md Decision 5 this is a dynamic,
// not-pre-renderable surface (per-portfolio compute). The spec also marks the
// X-Ray as not indexable — serve noindex and never publish row-level holdings in
// URLs / share-card markup (the editor keeps holdings client-side; the analysis
// POSTs to /api/portfolio/solve and nothing is persisted).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio X-Ray — FundScore.ai",
  description:
    "Enter your funds and weights to see your portfolio's closest passive alternative, blended fee gap, and aggregate sector exposure.",
  robots: { index: false, follow: false },
};

export default function XRayPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Portfolio X-Ray</h1>
        <p className="mt-2 max-w-2xl text-gray-500">
          Enter the funds and ETFs you hold. We solve one passive ETF blend for
          your whole book, then show what you&apos;d pay versus that blend and
          where your sector exposure differs from it.
        </p>
      </div>

      <PortfolioXray />
    </div>
  );
}
