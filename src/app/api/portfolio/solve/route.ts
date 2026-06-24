import { NextResponse, type NextRequest } from "next/server";
import {
  runSolver,
  validatePortfolio,
  type PortfolioInput,
} from "@/lib/serving/portfolio-solver";

// Dynamic route handler for the Portfolio X-Ray aggregate passive-blend solve
// (serving_architecture.md Decision 5: "Portfolio X-Ray → Dynamic route handler
// — per-portfolio compute, not pre-renderable"). The body carries the user's
// holdings; per the page spec's privacy charter row-level holdings are NEVER
// logged or persisted — the solver is in-memory only and we forward its honest
// output without storing anything.
export const dynamic = "force-dynamic";
// The cold-start solver loads ~117M rows of pricing (~80s). Give the function
// generous headroom on platforms that cap route-handler duration.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const holdings = (body as { holdings?: PortfolioInput[] })?.holdings;
  const validated = validatePortfolio(holdings ?? []);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const res = await runSolver(validated.clean);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error.error, detail: res.error.detail },
      { status: 502 },
    );
  }
  return NextResponse.json(res.result, {
    headers: { "Cache-Control": "no-store" },
  });
}
