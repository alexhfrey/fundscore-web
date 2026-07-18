// ============================================================================
// Portfolio passive-blend SOLVER bridge (T7b / Portfolio X-Ray page).
// ----------------------------------------------------------------------------
// The aggregate passive-blend solve is a LIVE Python (L2 / CVXPY) optimization
// that runs on ARBITRARY user portfolios — it cannot be pre-materialized like
// the screener's canonical results. serving_architecture.md Decision 1 routes
// the Portfolio X-Ray to "DuckDB-on-Parquet, optionally + Python sidecar for
// CVXPY" and Decision 5 renders it as a dynamic route handler. The spec fixes
// the rendering and the engine family (Python for the CVXPY solve) but is silent
// on the exact bridge. Per the T7b brief, v0 = a dynamic route handler that
// shells out to the solver CLI (`uv run … --json`) and returns its JSON. No new
// long-running service; the CLI is the documented entry point (T7a memory
// portfolio_passive_solver_v0). Swap for a FastAPI sidecar in v1 if cold-start
// latency or concurrency demand it — the JSON contract here is unchanged.
//
// Nothing is fabricated here: this module ONLY parses and forwards the solver's
// own output. Missing fee / stale exposure / suppressed coverage are the
// solver's honest states, rendered as-is.
// ============================================================================
import { spawn } from "node:child_process";

export const SOLVER_VERSION = "portfolio_passive_solver_v0.1";
export const PORTFOLIO_PAGE_VERSION = "portfolio_xray_page_v0";

// The solver lives in the fund_score lake/repo, not this app. Mirror the
// screener's env-var-with-absolute-fallback convention (screener.ts).
const FUND_SCORE_REPO =
  process.env.FUND_SCORE_REPO ?? "/Users/alexfrey/Projects/fund_score";
const SOLVER_CLI = `scripts/pipeline/run_portfolio_passive_solver.py`;
const SOLVER_AS_OF = process.env.PORTFOLIO_SOLVER_AS_OF ?? "2026-06-30";
const UV_BIN = process.env.UV_BIN ?? "uv";
// The solver reads the canonical single-vintage price panel scoped to the request's
// tickers (predicate-pushdown, sub-second load — down from ~180s over the raw file glob);
// the remaining cost is the CVXPY combination search, which scales with the union pool.
// Keep a generous timeout as headroom for large multi-mandate books.
const SOLVER_TIMEOUT_MS = Number(process.env.PORTFOLIO_SOLVER_TIMEOUT_MS ?? 240_000);

// Editor limits (page spec Open Questions: draft cap 50 holdings).
export const MAX_HOLDINGS = 50;

// --- Solver result shapes (1:1 with SolveResult.to_dict()) -----------------

export interface BlendLeg {
  etf_ticker: string;
  etf_name: string | null;
  weight_pct: number;
  expense_ratio_bps: number | null;
}

export interface SolverFit {
  r_squared: number | null;
  tracking_error_bps: number | null;
  n_obs: number | null;
  window_start: string | null;
  window_end: string | null;
  fit_quality_label: string;
}

export interface SolverFee {
  portfolio_er_bps: number | null;
  blend_er_bps: number | null;
  fee_gap_bps: number | null;
  coverage_state: string; // available | partial | missing
}

export interface ExposureRow {
  exposure_type: string;
  exposure_id: string;
  exposure_name: string | null;
  portfolio_exposure: number;
  passive_blend_exposure: number | null;
  difference: number | null; // percentage points
  unit: string;
}

export interface SolverExposure {
  method_version: string;
  as_of_range: [string | null, string | null];
  coverage_state: string; // available | partial | stale | missing
  rows: ExposureRow[];
}

export interface SolverRow {
  raw_ticker: string;
  resolved_ticker: string | null;
  series_id: string | null;
  display_name: string | null;
  security_type: string; // mutual_fund | etf | stock | unsupported
  weight_pct: number | null;
  resolution_state: string; // resolved | unresolved | unsupported
  exclusion_reason: string | null;
}

// Historical buy-and-hold performance of the solved blend + the entered book.
// Total-return (dividends reinvested, net of fund fees), buy-and-hold at the
// solved weights, DAILY prices; passive legs use index-fund proxies for history
// before their ETF launched. Computed by the solver; null when a book is too
// short (<3y) or a leg can't be priced.
export interface PerfSeries {
  window_start: string;
  window_end: string;
  years: number;
  cagr: number; // decimal, e.g. 0.096
  max_drawdown: number; // negative decimal, e.g. -0.60
  uses_proxy?: boolean;
  curve?: { t: string; v: number }[]; // monthly growth of $1
}
export interface PerfCommon {
  window_start: string;
  window_end: string;
  years: number;
  portfolio_cagr: number;
  portfolio_max_drawdown: number;
  blend_cagr: number;
  blend_max_drawdown: number;
}
export interface SolverPerformance {
  basis: string; // "total_return"
  hold: string; // "buy_and_hold"
  resolution: string; // "daily"
  blend: PerfSeries | null;
  portfolio: PerfSeries | null;
  common: PerfCommon | null;
}

export interface SolveResult {
  portfolio_analysis_id: string;
  solver_run_id: string;
  solver_version: string;
  as_of_date: string;
  coverage_state: string; // available | partial | suppress
  suppression_reason: string | null;
  eligible_weight_pct: number;
  excluded_weight_pct: number;
  blend: BlendLeg[];
  fit: SolverFit;
  fee: SolverFee;
  exposure: SolverExposure;
  rows: SolverRow[];
  /** Stock-level look-through, attached by the route from Postgres. Computed
   * independently of the blend, so it survives a suppressed solve. */
  look_through?: import("./portfolio-lookthrough").LookThrough | null;
  /** Historical buy-and-hold CAGR + worst drawdown for the blend and book. */
  performance?: SolverPerformance | null;
}

export interface PortfolioInput {
  ticker: string;
  weight: number;
}

export interface SolveError {
  error: string;
  detail?: string;
}

export type SolveResponse =
  | { ok: true; result: SolveResult }
  | { ok: false; error: SolveError };

// --- Input validation -------------------------------------------------------

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

/** Validate + normalize a parsed portfolio; defensive so nothing odd reaches
 * the shelled solver. Tickers are constrained to a safe alphabet (also blocks
 * shell-injection at the boundary — the CLI arg is a single --portfolio token).
 */
export function validatePortfolio(
  input: PortfolioInput[],
): { ok: true; clean: PortfolioInput[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0)
    return { ok: false, error: "Enter at least one holding." };
  if (input.length > MAX_HOLDINGS)
    return { ok: false, error: `Too many holdings — the editor supports up to ${MAX_HOLDINGS}.` };

  const clean: PortfolioInput[] = [];
  const seen = new Set<string>();
  for (const r of input) {
    const t = String(r.ticker ?? "").trim().toUpperCase();
    if (!t) continue;
    if (!TICKER_RE.test(t))
      return { ok: false, error: `"${r.ticker}" is not a valid ticker.` };
    const w = Number(r.weight);
    if (!isFinite(w) || w < 0)
      return { ok: false, error: `Weight for ${t} must be a positive number.` };
    if (w === 0) continue;
    if (seen.has(t)) continue; // dedupe; first wins
    seen.add(t);
    clean.push({ ticker: t, weight: w });
  }
  if (clean.length === 0)
    return { ok: false, error: "Enter at least one holding with a positive weight." };
  return { ok: true, clean };
}

// --- Solver invocation ------------------------------------------------------

/** Shell out to the Python solver CLI and return its parsed JSON.
 * The CLI is the documented entry point (it constructs PortfolioPassiveSolver,
 * calls .solve(), and prints SolveResult.to_dict()). This bridge adds NO
 * computation — it only forwards the solver's own honest output.
 */
export async function runSolver(
  portfolio: PortfolioInput[],
): Promise<SolveResponse> {
  const portfolioArg = portfolio
    .map((r) => `${r.ticker}:${r.weight}`)
    .join(",");

  const args = [
    "run",
    "python",
    SOLVER_CLI,
    "--portfolio",
    portfolioArg,
    "--as-of-date",
    SOLVER_AS_OF,
    "--json",
  ];

  return new Promise<SolveResponse>((resolve) => {
    const child = spawn(UV_BIN, args, {
      cwd: FUND_SCORE_REPO,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({
        ok: false,
        error: {
          error: "The passive-blend solve timed out. Please try again.",
          detail: `timeout after ${SOLVER_TIMEOUT_MS}ms`,
        },
      });
    }, SOLVER_TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        error: {
          error: "Could not run the passive-blend solver.",
          detail: err.message,
        },
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          error: {
            error: "The passive-blend solver returned an error.",
            detail: stderr.slice(-2000) || `exit code ${code}`,
          },
        });
        return;
      }
      // The CLI prints a human header on the non-JSON path, but with --json it
      // emits ONLY the JSON object. Parse the last JSON object defensively in
      // case any stray log line leaked to stdout.
      try {
        const parsed = parseLastJson(stdout);
        resolve({ ok: true, result: parsed as SolveResult });
      } catch (e) {
        resolve({
          ok: false,
          error: {
            error: "Could not read the solver output.",
            detail: (e as Error).message,
          },
        });
      }
    });
  });
}

/** Parse the last top-level JSON object in a string (the solver prints exactly
 * one with --json; this tolerates a leading stray log line). */
function parseLastJson(s: string): unknown {
  const trimmed = s.trim();
  // Fast path: the whole thing is the JSON object.
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through to brace-scan */
    }
  }
  const start = trimmed.indexOf("{");
  if (start < 0) throw new Error("no JSON object in solver output");
  return JSON.parse(trimmed.slice(start));
}
