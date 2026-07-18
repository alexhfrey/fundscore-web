"use client";

// ============================================================================
// Portfolio X-Ray result — verdict-led narrative (spec docs/product/page_specs/
// portfolio_xray.md). Reads the T7a solver output + look-through and tells the
// value-prop story HONESTLY: it leads with the punch THIS book's numbers
// actually support — usually the fee you pay over the passive alternative, and
// only claims "you're over-concentrated / same bet" when the data shows it.
//
// Editorial identity (matches the landing page): serif verdict, mono eyebrows,
// ink/paper/primary palette, dollars first / bps as fine print. NOTHING is
// computed here beyond formatting and honest synthesis of the solver's own
// numbers. Honest states throughout:
//   • coverage_state="suppress"     → blend movements drop out; the look-through
//                                      (Postgres-only) survives
//   • fee.coverage_state="missing"  → fee shown unavailable, never faked
//   • look-through partial          → covered-weight shown, never renormalised
// ============================================================================
import { useState } from "react";
import Link from "next/link";
import {
  fmtPct,
  fmtBps,
  fmtDollars,
  fmtDate,
  feeDollars,
  EM_DASH,
} from "@/lib/serving/format";
import type {
  SolveResult,
  SolverRow,
  ExposureRow,
} from "@/lib/serving/portfolio-solver";
import type { LookThroughStock } from "@/lib/serving/portfolio-lookthrough";

/* -------------------------------------------------------------------------- */
/*  Root                                                                      */
/* -------------------------------------------------------------------------- */

export function XrayResult({ result: r }: { result: SolveResult }) {
  const resolved = r.rows.filter((x) => x.resolution_state === "resolved");
  const excluded = r.rows.filter((x) => x.resolution_state !== "resolved");
  const suppressed = r.coverage_state === "suppress";

  return (
    <div data-testid="xray-result" className="rise-in space-y-16">
      <Verdict result={r} resolved={resolved} />
      <IdentityStrip result={r} resolved={resolved} excluded={excluded} />

      {/* Payoff first: the cheap near-copy that makes the verdict real, then how
          that passive alternative has actually performed over the long run. */}
      {suppressed ? (
        <Suppressed result={r} />
      ) : (
        <>
          <TheAlternative result={r} />
          <TrackRecord result={r} />
        </>
      )}

      {/* Then the evidence for "it's basically the index": your own stocks. */}
      <Overlap result={r} />
      <WhatYouOwn result={r} />

      {/* What the active fee actually buys — the modest tilt off the index. */}
      {!suppressed && <YourTilts result={r} />}

      {/* Drill down: every holding / sector / country, absolute and vs the blend. */}
      <FullBreakdown result={r} />

      <SourceFooter result={r} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  1 · The verdict — honest, adaptive, dollars first                          */
/* -------------------------------------------------------------------------- */

function Verdict({
  result: r,
  resolved,
}: {
  result: SolveResult;
  resolved: SolverRow[];
}) {
  const lt = r.look_through ?? null;
  const nFunds = lt?.funds_covered ?? resolved.length;
  const hasFee = r.fee.coverage_state !== "missing" && r.fee.fee_gap_bps != null;
  const portFee = r.fee.portfolio_er_bps;
  const blendFee = r.fee.blend_er_bps;
  const gap = r.fee.fee_gap_bps;
  const feeMult = portFee && blendFee && blendFee > 0 ? portFee / blendFee : null;
  const d100k = feeDollars(gap, 100000);
  const r2 = r.fit?.r_squared ?? null;
  const r2pct = r2 != null ? Math.round(r2 * 100) : null;
  const top10 = lt?.top10_portfolio_pct ?? null;
  const top10Blend = lt?.top10_blend_pct ?? null;
  const concDelta = top10 != null && top10Blend != null ? top10 - top10Blend : null;

  // Lead with the signal that genuinely dominates THIS book — not always the fee.
  // Only compare concentration to the index when we can see the whole book (else a
  // bond-sleeve vs equity-rescaled-blend mismatch misleads).
  const cleanCoverage = lt?.coverage_state === "available";
  const validConc =
    cleanCoverage && top10 != null && top10Blend != null && top10Blend > 0 && concDelta != null;
  const extremeConc = validConc && (concDelta as number) >= 8;
  // names held MATERIALLY (>= 1% of the fund) by EVERY fund — genuine duplication
  const matAll = lt
    ? lt.top.filter(
        (s) => nFunds > 1 && s.by_fund.length === nFunds && s.by_fund.every((e) => e.weight_pct >= 1),
      )
    : [];
  const matNames = joinNames(matAll.slice(0, 3).map((s) => pretty(s.name, s.ticker)));
  const materialFee =
    hasFee && feeMult != null && feeMult >= 1.5 && (d100k == null || d100k >= 100) && (gap ?? 0) >= 8;
  const efficient =
    hasFee && d100k != null && d100k < 60 && (r2 == null || r2 >= 0.95) && !extremeConc && matAll.length < 3;
  const indexFund = !hasFee && nFunds === 1 && r2 != null && r2 >= 0.98;

  type Story = "concentration" | "fee" | "overlap" | "efficient" | "index" | "neutral";
  let story: Story;
  if (extremeConc) story = "concentration";
  else if (materialFee) story = "fee";
  else if (matAll.length >= 3) story = "overlap";
  else if (efficient) story = "efficient";
  else if (indexFund) story = "index";
  else if (hasFee && feeMult != null && feeMult >= 1.3) story = "fee";
  else story = "neutral";

  // Positive/neutral books get a black number, not the red "you're overpaying" tone.
  const positive = story === "efficient" || story === "index";

  // Copy is observational — it states what the holdings show, never what to do.
  let headline: React.ReactNode;
  let lead: string;

  if (story === "concentration") {
    headline = (
      <>
        {top10?.toFixed(0)}% of this book is{" "}
        <span className="text-primary">its ten biggest stocks.</span>
      </>
    );
    lead = `That's ${(concDelta as number).toFixed(0)}pp more than the passive blend that tracks it${hasFee ? `, which holds the same shape for ${bpsPrec(blendFee)} against your ${bpsPrec(portFee)}` : ""}.${matAll.length ? ` ${matNames} sit near the top of every one of your funds.` : ""}`;
  } else if (story === "fee") {
    headline = (
      <>
        A passive blend tracks this portfolio{" "}
        <span className="text-primary">
          {r2pct ?? EM_DASH}% — at {feeFraction(blendFee, portFee)} the fee.
        </span>
      </>
    );
    const shape =
      validConc && (concDelta as number) > 4
        ? ` Its top ten names are ${top10?.toFixed(0)}% of the book — more concentrated than the blend.`
        : validConc && (concDelta as number) < -3
          ? ` Its top ten names are ${top10?.toFixed(0)}% of the book — no more concentrated than the blend.`
          : matAll.length >= 1
            ? ` ${matNames} sit near the top of every one of your funds.`
            : top10 != null
              ? ` Its top ten names are ${top10.toFixed(0)}% of the book.`
              : "";
    lead = `Your funds charge ${bpsPrec(portFee)}; the ${blendLegWord(r)} blend${blendNames(r)} charges ${bpsPrec(blendFee)} — a gap of about ${d100k != null ? fmtDollars(d100k) : EM_DASH} a year per $100,000.${shape}`;
  } else if (story === "overlap") {
    headline = (
      <>
        The same stocks fill{" "}
        <span className="text-primary">all {nFunds} of your funds.</span>
      </>
    );
    lead = `${matNames} sit near the top of every one — ${matAll.length} of your largest names are held in all ${nFunds}.${hasFee ? ` A passive blend holds the same shape for ${bpsPrec(blendFee)} against your ${bpsPrec(portFee)}.` : ""}`;
  } else if (story === "efficient") {
    headline = (
      <>
        This portfolio already{" "}
        <span className="text-primary">looks like the index.</span>
      </>
    );
    lead = `A ${blendLegWord(r)} blend tracks it ${r2pct ?? EM_DASH}% and charges ${bpsPrec(blendFee)} against your ${bpsPrec(portFee)} — a gap of about ${d100k != null ? fmtDollars(d100k) : EM_DASH} a year per $100,000. Little fee or active tilt here to speak of.`;
  } else if (story === "index") {
    headline = (
      <>
        This is already{" "}
        <span className="text-primary">a passive index fund.</span>
      </>
    );
    lead = `${resolved[0]?.display_name ?? "It"} charges ${bpsPrec(portFee)} and holds the market directly — there's no active layer to look through${r2pct != null ? `, and it moves with its index ${r2pct}% of the time` : ""}.`;
  } else {
    headline = <>What your funds add up to.</>;
    lead = "Looked through every wrapper to the stocks underneath.";
  }

  return (
    <section>
      <Eyebrow>The verdict</Eyebrow>
      <h2 className="mt-4 max-w-3xl font-serif text-[2.1rem] leading-[1.06] font-semibold tracking-[-0.015em] text-balance text-ink sm:text-[2.9rem]">
        {headline}
      </h2>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{lead}</p>

      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-3">
        {hasFee && d100k != null ? (
          <VerdictStat
            label="Fee over a passive blend"
            value={`${fmtDollars(d100k)}/yr`}
            sub={`per $100,000 held — about ${fmtDollars(d100k * 10)} a decade`}
            tone={positive ? undefined : "below"}
            big
          />
        ) : portFee != null ? (
          <VerdictStat
            label="What this portfolio charges"
            value={bpsPrec(portFee)}
            sub="the whole fee — no active layer to compare against"
            big
          />
        ) : (
          <VerdictStat label="Fee gap" value={EM_DASH} sub="no comparable passive fee" />
        )}
        {feeMult != null ? (
          <VerdictStat
            label="Fee vs the passive blend"
            value={`${feeMult.toFixed(1)}×`}
            sub={`${bpsPrec(portFee)} vs ${bpsPrec(blendFee)}`}
            tone={positive ? undefined : "below"}
          />
        ) : top10 != null ? (
          <VerdictStat
            label="Top ten stocks"
            value={`${top10.toFixed(0)}%`}
            sub="of everything you own"
          />
        ) : (
          <VerdictStat label="Top ten stocks" value={EM_DASH} sub="not readable" />
        )}
        {r2pct != null ? (
          <VerdictStat
            label="How much a passive blend copies it"
            value={`${r2pct}%`}
            sub={`of the portfolio's moves, from a ${blendLegWord(r)} blend`}
            tone="primary"
          />
        ) : top10 != null ? (
          <VerdictStat
            label="Top ten stocks"
            value={`${top10.toFixed(0)}%`}
            sub={top10Blend != null ? `${top10Blend.toFixed(0)}% in the blend` : "of the book"}
            tone="primary"
          />
        ) : (
          <VerdictStat label="Passive fit" value={EM_DASH} sub="unavailable" />
        )}
      </div>
    </section>
  );
}

function VerdictStat({
  label,
  value,
  sub,
  tone,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "below" | "primary";
  big?: boolean;
}) {
  const valueTone =
    tone === "below" ? "text-below" : tone === "primary" ? "text-primary" : "text-ink";
  return (
    <div className="bg-white p-5 sm:p-6">
      <div className="font-mono text-[10px] font-medium uppercase leading-tight tracking-[0.12em] text-ink-soft">
        {label}
      </div>
      <div
        className={`mt-2 font-serif font-semibold tabular-nums tracking-tight ${big ? "text-[2.5rem] leading-none sm:text-[3rem]" : "text-3xl sm:text-[2.1rem]"} ${valueTone}`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-xs leading-snug text-ink-soft">{sub}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Identity strip (compact context)                                          */
/* -------------------------------------------------------------------------- */

function IdentityStrip({
  result: r,
  resolved,
  excluded,
}: {
  result: SolveResult;
  resolved: SolverRow[];
  excluded: SolverRow[];
}) {
  const byType: Record<string, number> = {};
  let wsum = 0;
  for (const row of resolved) {
    const w = row.weight_pct ?? 0;
    wsum += w;
    byType[row.security_type] = (byType[row.security_type] ?? 0) + w;
  }
  const wrapper = Object.entries(byType)
    .map(([type, w]) => ({ type, share: wsum > 0 ? w / wsum : 0 }))
    .sort((a, b) => b.share - a.share)
    .map((w) => `${fmtPct(w.share, 0)} ${wrapperLabel(w.type)}`)
    .join(" · ");

  const bits = [
    { k: "Holdings analysed", v: String(resolved.length) },
    {
      k: "Weight covered",
      v:
        r.excluded_weight_pct > 0
          ? `${fmtPct(r.eligible_weight_pct, 0)} (${fmtPct(r.excluded_weight_pct, 0)} excluded)`
          : fmtPct(r.eligible_weight_pct, 0),
    },
    { k: "Wrapper", v: wrapper || EM_DASH },
    { k: "Coverage", v: coverageLabel(r.coverage_state) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-rule py-4 text-sm">
      {bits.map((b) => (
        <div key={b.k} className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft/70">
            {b.k}
          </span>
          <span className="font-medium text-ink">{b.v}</span>
        </div>
      ))}
      {excluded.length > 0 && (
        <div className="w-full text-xs text-ink-soft">
          Excluded:{" "}
          {excluded.map((e, i) => (
            <span key={e.raw_ticker}>
              {i > 0 && ", "}
              <span className="font-semibold text-ink">{e.raw_ticker}</span> (
              {exclusionLabel(e.exclusion_reason)})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2 · The alternative — the cheap near-copy (payoff, up front)               */
/* -------------------------------------------------------------------------- */

function TheAlternative({ result: r }: { result: SolveResult }) {
  const fee = r.fee;
  const feeMissing = fee.coverage_state === "missing" || fee.fee_gap_bps == null;
  const isSingleFund =
    r.rows.filter((x) => x.resolution_state === "resolved").length === 1;
  const d100k = feeDollars(fee.fee_gap_bps, 100000);
  const r2pct = r.fit.r_squared != null ? Math.round(r.fit.r_squared * 100) : null;

  return (
    <Movement
      eyebrow="The alternative"
      title="Priced against a passive blend"
      lead={
        isSingleFund
          ? "For a single holding this is exactly the fund's own passive match."
          : "One passive ETF blend, solved for your whole book at once — not a sum of per-fund matches. What it holds, and what it charges."
      }
      methodologyAnchor="alternatives"
    >
      <Card className="border-primary/25 bg-gradient-to-br from-primary-light/40 to-white">
        {feeMissing ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            We can&apos;t show a blended fee gap for this portfolio: the matched
            passive vehicle has no SEC-filed expense ratio, so we leave the
            comparison unavailable rather than invent a fee.
            {fee.portfolio_er_bps != null && (
              <span className="mt-1 block">
                Your blended expense ratio is {fmtBps(fee.portfolio_er_bps)}.
              </span>
            )}
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            {/* The dollar punch, big */}
            <div>
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft">
                What the fee gap costs you
              </div>
              <div className="mt-2 font-serif text-[3rem] leading-none font-semibold tabular-nums text-below sm:text-[3.6rem]">
                {d100k != null ? `${fmtDollars(d100k)}` : EM_DASH}
              </div>
              <div className="mt-2 text-sm text-ink-soft">
                a year, on every <span className="font-semibold text-ink">$100,000</span>{" "}
                you hold
                {d100k != null && (
                  <> — about {fmtDollars(d100k * 10)} over a decade on a flat balance</>
                )}
                .
              </div>
              <div className="mt-5 space-y-3">
                <FeeRow label="You pay" bps={fee.portfolio_er_bps ?? 0} width={100} tone="below" />
                <FeeRow
                  label="The passive blend"
                  bps={fee.blend_er_bps ?? 0}
                  width={
                    fee.portfolio_er_bps
                      ? ((fee.blend_er_bps ?? 0) / fee.portfolio_er_bps) * 100
                      : 0
                  }
                  tone="primary"
                />
              </div>
              {fee.coverage_state === "partial" && (
                <p className="mt-3 text-xs text-below/90">
                  Fee coverage is partial — some holdings or blend legs are missing a
                  filed expense ratio, so the gap may under- or over-state.
                </p>
              )}
            </div>

            {/* The blend itself */}
            <div className="rounded-xl border border-rule bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                    <th className="px-4 py-3 font-medium">The blend that tracks you</th>
                    <th className="px-3 py-3 text-right font-medium">Weight</th>
                    <th className="px-4 py-3 text-right font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {r.blend.map((b) => (
                    <tr key={b.etf_ticker} className="border-b border-rule/60 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/funds/${b.etf_ticker.toLowerCase()}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {b.etf_ticker}
                        </Link>
                        {b.etf_name && (
                          <span className="ml-2 text-xs text-ink-soft">
                            {titleCase(b.etf_name)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink">
                        {fmtPct(b.weight_pct, 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                        {b.expense_ratio_bps != null ? (
                          fmtBps(b.expense_ratio_bps)
                        ) : (
                          <span className="text-ink-soft/60">no filed fee</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-3 text-xs leading-relaxed text-ink-soft/85">
                Moves with your portfolio{" "}
                <span className="font-semibold text-ink">{r2pct ?? EM_DASH}%</span> of the
                time ({r.fit.fit_quality_label} fit, R²{" "}
                {r.fit.r_squared != null ? r.fit.r_squared.toFixed(2) : EM_DASH}).
              </p>
            </div>
          </div>
        )}
      </Card>
    </Movement>
  );
}

function FeeRow({
  label,
  bps,
  width,
  tone,
}: {
  label: string;
  bps: number;
  width: number;
  tone: "below" | "primary";
}) {
  const bar = tone === "below" ? "bg-below" : "bg-primary";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{bpsPrec(bps)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-rule/60">
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${Math.max(3, Math.min(100, width))}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2b · Track record — how the passive blend has performed over the long run  */
/* -------------------------------------------------------------------------- */

function TrackRecord({ result: r }: { result: SolveResult }) {
  const p = r.performance;
  if (!p || !p.blend) return null;
  const b = p.blend;
  const c = p.common;

  return (
    <Movement
      eyebrow="The passive alternative, over time"
      title="How the blend has held up"
      lead={`The blend's legs go back ${b.years.toFixed(0)} years${b.uses_proxy ? " via their index-fund proxies" : ""}. Here's what a dollar in it would have done — and the worst it fell along the way.`}
      methodologyAnchor="alternatives"
    >
      <Card>
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            {b.curve && b.curve.length > 2 && <GrowthCurve curve={b.curve} />}
            <p className="mt-2 text-xs text-ink-soft/80">
              Growth of $1 in the passive blend, {yr4(b.window_start)}–{yr4(b.window_end)}{" "}
              (log scale — a straight line is steady compounding).
            </p>
          </div>
          <div>
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft">
              Compound annual return
            </div>
            <div className="mt-1 font-serif text-[3rem] leading-none font-semibold tabular-nums text-ink">
              {perfPct(b.cagr, 1)}
            </div>
            <div className="mt-1.5 text-sm text-ink-soft">
              a year, over {b.years.toFixed(0)} years ({yr4(b.window_start)}–{yr4(b.window_end)})
            </div>
            <div className="mt-5 border-t border-rule pt-4">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft">
                Worst drop, peak to trough
              </div>
              <div className="mt-1 font-serif text-3xl font-semibold tabular-nums text-below">
                {perfPct(b.max_drawdown, 0)}
              </div>
              <div className="mt-1.5 text-sm text-ink-soft">the deepest it fell before recovering</div>
            </div>
          </div>
        </div>

        {c && (
          <div className="mt-6 border-t border-rule pt-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              Your funds vs the blend, over the {c.years.toFixed(0)} years both have existed
              ({yr4(c.window_start)}–{yr4(c.window_end)})
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                  <th className="pb-2 font-medium" />
                  <th className="pb-2 text-right font-medium">Return / yr</th>
                  <th className="pb-2 text-right font-medium">Worst drop</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-rule/60">
                  <td className="py-2 text-ink">Your funds</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">
                    {perfPct(c.portfolio_cagr, 1)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {perfPct(c.portfolio_max_drawdown, 0)}
                  </td>
                </tr>
                <tr className="border-t border-rule/60">
                  <td className="py-2 text-ink">The passive blend</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink">
                    {perfPct(c.blend_cagr, 1)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">
                    {perfPct(c.blend_max_drawdown, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <FootNote>
          Total return with dividends reinvested, each series net of its own fund fees;
          bought and held at the solved weights (no rebalancing), on daily prices.
          {b.uses_proxy
            ? " The passive legs use their index-fund proxies for history before the ETF launched."
            : ""}{" "}
          Past performance is not a forecast.
        </FootNote>
      </Card>
    </Movement>
  );
}

/** Growth-of-$1 area curve, log-scaled so decades of compounding read cleanly. */
function GrowthCurve({ curve }: { curve: { t: string; v: number }[] }) {
  const W = 100;
  const H = 36;
  const logs = curve.map((p) => Math.log(Math.max(p.v, 1e-6)));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const span = hi - lo || 1;
  const coords = curve.map((p, i) => {
    const x = (i / (curve.length - 1)) * W;
    const y = H - ((Math.log(Math.max(p.v, 1e-6)) - lo) / span) * H;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  const line = "M" + coords.join(" L");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-28 w-full"
      role="img"
      aria-label="Growth of the passive blend over time, log scale"
    >
      <path d={area} fill="var(--color-primary)" opacity="0.1" />
      <path
        d={line}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function perfPct(x: number, dp: number): string {
  const v = x * 100;
  return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}%`;
}
function yr4(iso: string): string {
  return iso.slice(0, 4);
}

/* -------------------------------------------------------------------------- */
/*  3 · The overlap — one visceral image, then the grid                        */
/* -------------------------------------------------------------------------- */

const MATERIAL_PCT = 1; // a position >= 1% of a fund's NAV is a "real" holding, not a sliver

function Overlap({ result: r }: { result: SolveResult }) {
  const lt = r.look_through;
  if (!lt || lt.coverage_state === "missing" || lt.funds.length < 2) return null;

  const funds = lt.funds;
  const overlap = lt.top
    .filter((s) => s.held_by_funds > 1)
    .sort((a, b) => b.held_by_funds - a.held_by_funds || b.portfolio_pct - a.portfolio_pct)
    .slice(0, 7);
  const head = overlap[0] ?? null;
  const topTenMulti = lt.top.slice(0, 10).filter((s) => s.held_by_funds > 1).length;
  // Scale the cell bars to the largest single-fund position shown, so a 7%-of-fund
  // core reads as full and a sub-1% sliver reads as a stub.
  const scale = Math.max(...overlap.flatMap((s) => s.by_fund.map((e) => e.weight_pct)), 1);

  return (
    <Movement eyebrow="The overlap" title="Different funds, same stocks">
      {head ? (
        <Card>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-lg">
              <p className="font-serif text-2xl leading-snug font-semibold text-ink sm:text-[1.7rem]">
                You own{" "}
                <span className="text-primary">{pretty(head.name, head.ticker)}</span> in{" "}
                {head.held_by_funds === funds.length
                  ? `all ${funds.length} of your funds.`
                  : `${head.held_by_funds} of your ${funds.length} funds.`}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {perFundSentence(head)}
              </p>
              {topTenMulti >= 2 && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {topTenMulti} of your ten biggest holdings show up in more than one
                  fund — the same names doing the heavy lifting across the book.
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {funds.map((f) => (
                <span
                  key={f.ticker}
                  className="rounded-lg border border-rule bg-paper px-3 py-2 font-mono text-xs font-semibold text-ink"
                >
                  {f.ticker}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 -mx-1 overflow-x-auto border-t border-rule pt-5">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-1 pb-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">
                    Held in more than one fund
                  </th>
                  {funds.map((f) => (
                    <th
                      key={f.ticker}
                      className="px-3 pb-3 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-soft"
                    >
                      {f.ticker}
                    </th>
                  ))}
                  <th className="px-1 pb-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">
                    Of your book
                  </th>
                </tr>
              </thead>
              <tbody>
                {overlap.map((s) => (
                  <tr key={s.ticker} className="border-t border-rule/50">
                    <td className="px-1 py-3">
                      <span className="font-mono text-xs font-semibold text-ink">
                        {s.ticker}
                      </span>
                      {s.name && (
                        <span className="ml-2 text-xs text-ink-soft">
                          {pretty(s.name, s.ticker)}
                        </span>
                      )}
                    </td>
                    {funds.map((f) => {
                      const w = s.by_fund.find((e) => e.ticker === f.ticker)?.weight_pct ?? null;
                      return (
                        <td key={f.ticker} className="px-3 py-3">
                          <WeightCell weight={w} scale={scale} />
                        </td>
                      );
                    })}
                    <td className="px-1 py-3 text-right font-semibold tabular-nums text-ink">
                      {s.portfolio_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-1 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft/60">
              bar length = the stock&apos;s weight in that fund · faint = under 1%
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm leading-relaxed text-ink-soft">
            Rarer than you&apos;d think: your funds barely double up. None of your
            largest holdings show up in more than one of them — you really are holding{" "}
            {lt.distinct_stocks.toLocaleString()} distinct names, not the same few
            repackaged.
          </p>
        </Card>
      )}
    </Movement>
  );
}

function WeightCell({ weight, scale }: { weight: number | null; scale: number }) {
  if (weight == null) {
    return <div className="mx-auto h-2 w-16 rounded-full bg-rule/30" title="not held" />;
  }
  const material = weight >= MATERIAL_PCT;
  const w = Math.max(6, Math.min(100, (weight / scale) * 100));
  return (
    <div
      className="mx-auto h-2 w-16 overflow-hidden rounded-full bg-rule/40"
      title={`${weight.toFixed(2)}% of the fund`}
    >
      <div
        className={`h-full rounded-full ${material ? "bg-primary" : "bg-ink-soft/40"}`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/** Honest per-fund breakdown of the headline stock: shows it's core in some funds,
 * a sliver in others — never implying an equal position across all. */
function perFundSentence(s: LookThroughStock): string {
  const parts = s.by_fund.map(
    (e) => `${e.weight_pct < 1 ? "under 1%" : `${e.weight_pct.toFixed(0)}%`} of ${e.ticker}`,
  );
  const mat = s.by_fund.filter((e) => e.weight_pct >= MATERIAL_PCT).length;
  const n = s.by_fund.length;
  let tail: string;
  if (mat === n) tail = "a real position in each.";
  else if (mat <= 1) tail = "one real position; the rest are just slivers.";
  else
    tail = `a core position in ${mat} of them, a sliver in the ${n - mat === 1 ? "other" : "others"}.`;
  return `That's ${joinNames(parts)} — ${tail}`;
}

/* -------------------------------------------------------------------------- */
/*  4 · What you really own                                                    */
/* -------------------------------------------------------------------------- */

function WhatYouOwn({ result: r }: { result: SolveResult }) {
  const lt = r.look_through;
  if (!lt) return null;

  if (lt.coverage_state === "missing" || lt.top.length === 0) {
    return (
      <Movement eyebrow="What you really own" title="The stocks inside your funds">
        <Card>
          <p className="text-sm leading-relaxed text-ink-soft">
            We can&apos;t see through this portfolio to individual stocks — none of the
            holdings you entered have an as-filed SEC position list we can read.
            We&apos;d rather say so than show a partial picture as if it were the whole
            one.
          </p>
        </Card>
      </Movement>
    );
  }

  const stocks = lt.top.slice(0, 10);
  const maxPct = Math.max(...stocks.map((s) => s.portfolio_pct), 0.01);

  return (
    <Movement
      eyebrow="What you really own"
      title="Your funds, dissolved into stocks"
      lead={`Ten stocks are ${lt.top10_portfolio_pct.toFixed(0)}% of everything you own${lt.countries[0] ? `, and ${lt.countries[0].portfolio_pct.toFixed(0)}% of your money sits in ${countryLabel(lt.countries[0].code)}` : ""}. The other ${Math.max(0, lt.distinct_stocks - 10).toLocaleString()} names barely move the needle. The bar is your weight; the line is the passive blend's.`}
    >
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Card>
          <div className="space-y-2.5">
            {stocks.map((s) => (
              <StockBar key={s.ticker} s={s} maxPct={maxPct} />
            ))}
          </div>
        </Card>

        {lt.countries.length > 0 && (
          <Card>
            <h4 className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft">
              Where the money actually sits
            </h4>
            <p className="mt-1 text-xs text-ink-soft/80">
              {lt.countries[0]
                ? `${lt.countries[0].portfolio_pct.toFixed(0)}% is in ${countryLabel(lt.countries[0].code)}${lt.countries[0].difference != null ? ` — ${lt.countries[0].difference > 0 ? "+" : "−"}${Math.abs(lt.countries[0].difference).toFixed(0)}pp vs the blend` : ""}, by the country of the underlying company.`
                : "By the country of the underlying company."}
            </p>
            <div className="mt-4 space-y-2.5">
              {lt.countries.slice(0, 6).map((c) => (
                <div key={c.code} className="flex items-center gap-3">
                  <span className="w-7 shrink-0 font-mono text-xs font-semibold text-ink-soft">
                    {c.code}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-rule/60">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, (c.portfolio_pct / Math.max(1, lt.countries[0].portfolio_pct)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                    {c.portfolio_pct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <FootNote>
        Weights are a share of the whole portfolio you entered, via each fund&apos;s
        as-filed SEC positions
        {lt.as_of_min && lt.as_of_max
          ? ` (${fmtDate(lt.as_of_min)} to ${fmtDate(lt.as_of_max)})`
          : ""}
        . {lt.equity_weight_pct.toFixed(0)}% of your portfolio sits in individual stocks
        we can identify; the rest is cash, bonds, or positions without a resolvable
        ticker.
        {lt.coverage_state === "partial" && lt.excluded.length > 0 && (
          <>
            {" "}
            These figures cover {lt.covered_weight_pct.toFixed(0)}% of what you entered —
            we could not look through{" "}
            {lt.excluded
              .map(
                (e) =>
                  `${e.ticker} (${e.weight_pct.toFixed(0)}%, ${e.reason === "unresolved" ? "ticker not recognised" : "no filed positions"})`,
              )
              .join(", ")}
            . Nothing has been rescaled to hide the gap.
          </>
        )}
      </FootNote>
    </Movement>
  );
}

function StockBar({ s, maxPct }: { s: LookThroughStock; maxPct: number }) {
  const w = Math.max(2, (s.portfolio_pct / maxPct) * 100);
  const blendLeft = s.blend_pct == null ? null : Math.min(100, (s.blend_pct / maxPct) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 font-mono text-xs font-semibold text-ink">
        {s.ticker}
      </span>
      <div className="relative h-6 flex-1">
        <div className="absolute inset-y-0 left-0 rounded bg-primary/85" style={{ width: `${w}%` }} />
        {blendLeft != null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-ink"
            style={{ left: `calc(${blendLeft}% - 1px)` }}
            title={`passive blend ${s.blend_pct?.toFixed(2)}%`}
          />
        )}
      </div>
      <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
        {s.portfolio_pct.toFixed(1)}%
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  5 · Your tilts — what the fee buys                                         */
/* -------------------------------------------------------------------------- */

function YourTilts({ result: r }: { result: SolveResult }) {
  const ex = r.exposure;
  const rows = ex.rows ?? [];
  const hasBlend = rows.some((x) => x.passive_blend_exposure != null);
  const [from, to] = ex.as_of_range;
  const stale = ex.coverage_state === "stale";

  if (ex.coverage_state === "missing" || rows.length === 0 || !hasBlend) return null;

  const sorted = [...rows]
    .filter((x) => x.difference != null && Math.abs(x.difference) >= 0.5)
    .sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0))
    .slice(0, 7);
  if (sorted.length === 0) return null;
  const maxDiff = Math.max(...sorted.map((x) => Math.abs(x.difference ?? 0)), 1);
  const over = sorted.filter((x) => (x.difference ?? 0) > 0)[0];
  const under = sorted.filter((x) => (x.difference ?? 0) < 0)[0];

  return (
    <Movement
      eyebrow="Your tilts"
      title="Where the book leans off the index"
      lead={`Your funds don't hold the index in index proportions — they lean off it${over && under ? `: more ${over.exposure_name}, less ${under.exposure_name}` : ""}. This is where an active fee goes. Neither direction is inherently better; it's the bet the book is making.`}
    >
      {stale && (
        <div className="mb-3 inline-flex rounded-full border border-below/30 bg-below/5 px-3 py-1 text-xs font-medium text-below">
          Holdings older than our 180-day freshness threshold — read tilts with caution.
        </div>
      )}
      <Card>
        <div className="mb-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft/70">
          <span>← Less than the index</span>
          <span>More than the index →</span>
        </div>
        <div className="space-y-2.5">
          {sorted.map((row) => (
            <TiltRow key={row.exposure_id} row={row} maxDiff={maxDiff} />
          ))}
        </div>
      </Card>
      <FootNote>
        Sector weight in your book minus the passive blend&apos;s, in percentage points.
        Holdings as of {fmtDate(from)}
        {to && to !== from ? ` to ${fmtDate(to)}` : ""}.
      </FootNote>
    </Movement>
  );
}

function TiltRow({ row, maxDiff }: { row: ExposureRow; maxDiff: number }) {
  const d = row.difference ?? 0;
  const pos = d > 0;
  const w = (Math.abs(d) / maxDiff) * 48;
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-48 shrink-0 truncate text-right text-[13px] text-ink"
        title={row.exposure_name ?? ""}
      >
        {row.exposure_name ?? "Unknown"}
      </span>
      <div className="relative h-5 flex-1">
        <div className="absolute inset-y-0 left-1/2 w-px bg-rule" />
        <div
          className={`absolute inset-y-1 rounded ${pos ? "bg-primary" : "bg-ink-soft/50"}`}
          style={pos ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
        />
      </div>
      <span
        className={`w-14 shrink-0 text-left text-sm font-semibold tabular-nums ${pos ? "text-primary" : "text-ink-soft"}`}
      >
        {pos ? "+" : "−"}
        {Math.abs(d).toFixed(1)}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  6 · The full breakdown — drill down to every line                          */
/* -------------------------------------------------------------------------- */

type DrillRow = {
  key: string;
  label: string;
  sub?: string;
  abs: number; // % of the book (or of the fund, for a sector/country)
  blend: number | null;
  diff: number | null; // pp vs the passive blend — "the bet"
};

function FullBreakdown({ result: r }: { result: SolveResult }) {
  const lt = r.look_through;

  const holdings: DrillRow[] =
    lt && lt.top.length
      ? lt.top.map((s) => ({
          key: s.ticker,
          label: s.ticker,
          sub: pretty(s.name, s.ticker),
          abs: s.portfolio_pct,
          blend: s.blend_pct,
          diff: s.difference,
        }))
      : [];
  const sectors: DrillRow[] = (r.exposure.rows ?? []).map((x) => ({
    key: x.exposure_id,
    label: x.exposure_name ?? "Unknown",
    abs: x.portfolio_exposure * 100,
    blend: x.passive_blend_exposure == null ? null : x.passive_blend_exposure * 100,
    diff: x.difference,
  }));
  const countries: DrillRow[] = lt
    ? lt.countries.map((c) => ({
        key: c.code,
        label: countryLabel(c.code),
        sub: c.code,
        abs: c.portfolio_pct,
        blend: c.blend_pct,
        diff: c.difference,
      }))
    : [];

  if (!holdings.length && !sectors.length && !countries.length) return null;

  const shownStockPct = holdings.reduce((s, x) => s + x.abs, 0);
  const tailCount = lt ? Math.max(0, lt.distinct_stocks - holdings.length) : 0;
  const tailPct = lt ? Math.max(0, lt.equity_weight_pct - shownStockPct) : 0;

  return (
    <Movement
      eyebrow="The full breakdown"
      title="Every position, in full"
      lead="Everything above at the top level — here is every line we can read, in absolute terms and as a bet for or against the passive blend. Sort by weight, or by the biggest bet."
    >
      <div className="divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-white shadow-[0_1px_2px_rgba(14,35,56,0.04),0_10px_28px_-14px_rgba(14,35,56,0.15)]">
        {holdings.length > 0 && (
          <Expandable label="Holdings" count={lt?.distinct_stocks ?? holdings.length}>
            <DrillTable rows={holdings} nameHead="Stock" />
            {tailCount > 0 && (
              <p className="px-1 pt-3 text-xs leading-relaxed text-ink-soft/70">
                Showing the top {holdings.length} of{" "}
                {lt?.distinct_stocks.toLocaleString()} holdings — together{" "}
                {shownStockPct.toFixed(0)}% of your book. The other{" "}
                {tailCount.toLocaleString()} names are the remaining{" "}
                {tailPct.toFixed(1)}%.
              </p>
            )}
          </Expandable>
        )}
        {sectors.length > 0 && (
          <Expandable label="Sectors" count={sectors.length}>
            <DrillTable rows={sectors} nameHead="Sector" />
          </Expandable>
        )}
        {countries.length > 0 && (
          <Expandable label="Countries" count={countries.length}>
            <DrillTable rows={countries} nameHead="Country" />
          </Expandable>
        )}
        <Expandable label="Themes" count={null}>
          <p className="py-1 text-sm leading-relaxed text-ink-soft">
            A whole-portfolio theme breakdown (AI infrastructure, weight-loss drugs,
            reshoring, and the like) isn&apos;t available yet. We map themes for each
            fund, but funds only publish their <em>top</em> themes — so adding them up
            would quietly read &quot;not in this fund&apos;s top list&quot; as zero, and
            we won&apos;t paper over that. It&apos;s on the build list.
          </p>
        </Expandable>
      </div>
    </Movement>
  );
}

function Expandable({
  label,
  count,
  children,
}: {
  label: string;
  count: number | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-paper"
      >
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink">
          {label}
          {count != null && (
            <span className="ml-2 font-normal text-ink-soft">{count.toLocaleString()}</span>
          )}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          {open ? "Hide −" : "Show all +"}
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function DrillTable({ rows, nameHead }: { rows: DrillRow[]; nameHead: string }) {
  const [byBet, setByBet] = useState(false);
  const sorted = [...rows].sort((a, b) =>
    byBet ? Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0) : b.abs - a.abs,
  );
  const fmt = (n: number) => `${n.toFixed(n < 10 ? 2 : 1)}%`;
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setByBet((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft/70 hover:text-primary"
        >
          sort: {byBet ? "biggest bet vs blend" : "weight"} ⇅
        </button>
      </div>
      <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-rule">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white shadow-[0_1px_0_var(--color-rule)]">
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              <th className="px-4 py-2.5 font-medium">{nameHead}</th>
              <th className="px-3 py-2.5 text-right font-medium">Your book</th>
              <th className="px-3 py-2.5 text-right font-medium">Passive blend</th>
              <th className="px-4 py-2.5 text-right font-medium">The bet (pp)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.key} className="border-t border-rule/50">
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs font-semibold text-ink">{row.label}</span>
                  {row.sub && row.sub !== row.label && (
                    <span className="ml-2 text-xs text-ink-soft">{row.sub}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">{fmt(row.abs)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                  {row.blend == null ? EM_DASH : fmt(row.blend)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <DiffTag pp={row.diff} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Signed pp difference vs the passive blend — primary for a positive bet,
 * muted for a negative one. Deliberately not red/green: a tilt is neither
 * good nor bad, just a bet. */
function DiffTag({ pp }: { pp: number | null }) {
  if (pp == null) return <span className="text-xs text-ink-soft/50">{EM_DASH}</span>;
  if (Math.abs(pp) < 0.05) return <span className="text-xs text-ink-soft/50">~0</span>;
  const pos = pp > 0;
  return (
    <span
      className={`font-mono text-xs font-semibold tabular-nums ${pos ? "text-primary" : "text-ink-soft"}`}
    >
      {pos ? "+" : "−"}
      {Math.abs(pp).toFixed(1)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Suppressed / footer                                                        */
/* -------------------------------------------------------------------------- */

function Suppressed({ result: r }: { result: SolveResult }) {
  return (
    <Movement eyebrow="The alternative" title="No honest passive match for this book">
      <Card>
        <p className="text-sm leading-relaxed text-ink-soft">
          We couldn&apos;t solve a single passive ETF blend that honestly tracks this
          combination of holdings, so we suppress the fee comparison rather than force a
          blend that wouldn&apos;t fit. Everything below — the stocks you actually own
          and how your funds overlap — still stands.
        </p>
        <p className="mt-3 font-mono text-xs text-ink-soft/70">
          reason: {r.suppression_reason ?? "unknown"}
        </p>
      </Card>
    </Movement>
  );
}

function SourceFooter({ result: r }: { result: SolveResult }) {
  return (
    <div className="border-t border-rule pt-6 text-xs leading-relaxed text-ink-soft/85">
      <p>
        Passive blend solved live for your portfolio with FundScore&apos;s L2-style
        tracking-error optimizer, refit {r.as_of_date}. Expense ratios from SEC MFRR /
        prospectus filings; look-through and sector exposure from N-PORT holdings mapped
        through reference data. The Portfolio X-Ray is an informational calculator — it
        shows how the holdings you entered compare with a passive blend and source data.
        It is not a recommendation to buy, sell, hold, replace, or rebalance any
        investment.
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/methodology#alternatives" className="hover:text-primary hover:underline">
          How we choose the passive blend →
        </Link>
        <Link href="/methodology#fee-fairness" className="hover:text-primary hover:underline">
          How we compute the fee gap →
        </Link>
        <Link href="/methodology#exposure-xray" className="hover:text-primary hover:underline">
          How we build the look-through →
        </Link>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

function Movement({
  eyebrow,
  title,
  lead,
  methodologyAnchor,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  methodologyAnchor?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-20">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-ink sm:text-[1.8rem]">
            {title}
          </h3>
          {lead && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{lead}</p>}
        </div>
        {methodologyAnchor && (
          <Link
            href={`/methodology#${methodologyAnchor}`}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft/70 hover:text-primary"
          >
            How we calculate this →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
      {children}
    </p>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-rule bg-white p-5 shadow-[0_1px_2px_rgba(14,35,56,0.04),0_10px_28px_-14px_rgba(14,35,56,0.15)] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function FootNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-ink-soft/75">{children}</p>;
}

/* -------------------------------------------------------------------------- */
/*  helpers                                                                    */
/* -------------------------------------------------------------------------- */

function blendLegWord(r: SolveResult): string {
  const n = r.blend.filter((b) => b.weight_pct > 0).length;
  return n === 1 ? "single-ETF" : `${numberWord(n).toLowerCase()}-ETF`;
}

function blendNames(r: SolveResult): string {
  const legs = r.blend.filter((b) => b.weight_pct > 0).map((b) => b.etf_ticker);
  if (legs.length === 0) return "";
  if (legs.length <= 3) return ` — ${legs.join(" and ")} —`;
  return "";
}

/** blend/portfolio fee expressed as a plain fraction of the cost. */
function feeFraction(blend: number | null, port: number | null): string {
  if (!blend || !port || port <= 0) return "a fraction of";
  const r = blend / port;
  if (r <= 0.28) return "about a quarter of";
  if (r <= 0.42) return "about a third of";
  if (r <= 0.58) return "about half";
  if (r <= 0.72) return "about two-thirds of";
  return "less than";
}

/** bps with just enough precision that the shown numbers reconcile with the
 * multiple/fraction we quote — integer-rounding a sub-10bps fee would not
 * (e.g. 5.5 vs 3.2 reads as "6 vs 3" = 2×, contradicting a quoted 1.7×). */
function bpsPrec(x: number | null): string {
  if (x == null) return EM_DASH;
  const p = Math.abs(x) < 10 ? 1 : 0;
  return `${x.toFixed(p)} bps`;
}

function wrapperLabel(t: string): string {
  switch (t) {
    case "mutual_fund":
      return "funds";
    case "etf":
      return "ETF";
    case "stock":
      return "stocks";
    default:
      return t;
  }
}

function countryLabel(code: string): string {
  const m: Record<string, string> = {
    US: "the US", GB: "the UK", JP: "Japan", CN: "China", CA: "Canada",
    CH: "Switzerland", FR: "France", DE: "Germany", NL: "the Netherlands",
    TW: "Taiwan", HK: "Hong Kong", KR: "South Korea", IN: "India", DK: "Denmark",
    SE: "Sweden", AU: "Australia", IE: "Ireland",
  };
  return m[code] ?? code;
}

function coverageLabel(state: string): string {
  switch (state) {
    case "available":
      return "Full";
    case "partial":
      return "Partial";
    case "suppress":
      return "Suppressed";
    default:
      return state;
  }
}

function exclusionLabel(reason: string | null): string {
  switch (reason) {
    case "implausible_return_series":
      return "price data looks unreliable";
    case "no_priceable_returns":
      return "no price history";
    default:
      return (reason ?? "unsupported").replace(/_/g, " ");
  }
}

const NUM_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five",
  "Six", "Seven", "Eight", "Nine", "Ten",
];
function numberWord(n: number): string {
  return NUM_WORDS[n] ?? String(n);
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Company display name: strip legal suffixes, title-case. Falls back to ticker. */
function pretty(name: string | null, ticker: string): string {
  if (!name) return ticker;
  const cleaned = name
    .replace(
      /\b(CORP|CORPORATION|INC|INCORPORATED|CO|COMPANY|PLC|LTD|LIMITED|NV|SA|AG|DEL|HOLDINGS?|GROUP|CLASS [A-C])\b\.?/gi,
      "",
    )
    .replace(/[.,]+\s*$/g, "")
    .trim();
  return titleCase(cleaned || name);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\b([a-z])\b/gi, (m) => m.toUpperCase());
}
