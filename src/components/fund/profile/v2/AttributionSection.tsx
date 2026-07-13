// ============================================================================
// 04 · AttributionSection — server wrapper + gating for the Attribution chapter.
// SERVED: the window summary is built from riskAttribution's
// active_return_attribution (exposure_path_v0.2) — the whole explorer is paid;
// below the gate a free proof point (the top stock detractor, from the
// returnAttribution projector) + an unlock line. The takeaway narrative is
// DERIVED from the served signs — never a hardcoded story.
// ============================================================================
import Link from "next/link";
import type { AttributionWindowSummary, RiskExplainers } from "@/lib/serving/profile-v2";
import {
  isLocked,
  getPreview,
  type Locked,
  type DetractorPreview,
} from "@/lib/serving/profile";
import { fmtSignedBps } from "@/lib/serving/format";
import { bpsSigned, factorLabel } from "./format";
import { ChapterHeader } from "./primitives";
import { Unavailable, ProofPoint, UnlockLine, LockedNotice } from "../primitives";
import { AttributionExplorer, type BrinsonRow } from "./AttributionExplorer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRA = { rows?: any[] } | Locked | null;

function shapeBrinson(ra: AnyRA): Record<string, BrinsonRow[]> {
  const out: Record<string, BrinsonRow[]> = { "1Y": [], "3Y": [], "5Y": [] };
  if (!ra || isLocked(ra) || !Array.isArray(ra.rows)) return out;
  for (const period of ["1Y", "3Y", "5Y"]) {
    const rows = ra.rows
      .filter((r) => r.period === period && r.dimension === "stock" && r.contribution_to_active_return_bps != null)
      .sort(
        (a, b) =>
          Math.abs(b.contribution_to_active_return_bps ?? 0) -
          Math.abs(a.contribution_to_active_return_bps ?? 0),
      )
      .slice(0, 10)
      .map((r) => ({
        label: String(r.member_label ?? r.member_id ?? ""),
        activeWeightPp: r.active_weight_avg != null ? r.active_weight_avg * 100 : null,
        fundRetPct: r.member_period_return_bps != null ? r.member_period_return_bps / 100 : null,
        iwfRetPct: r.passive_baseline_return_bps != null ? r.passive_baseline_return_bps / 100 : null,
        impactBps: r.contribution_to_active_return_bps ?? null,
      }));
    out[period] = rows;
  }
  return out;
}

export function AttributionSection({
  summary,
  present,
  returnAttribution,
  riskExplainers,
  paid,
  passiveLabel,
}: {
  // Built from the SERVED sub-panel — non-null only for paid callers.
  summary: AttributionWindowSummary | null;
  // The fund HAS a served decomposition (possibly locked below the caller's
  // tier) — drives locked/proof states instead of a false "Unavailable".
  present: boolean;
  returnAttribution: AnyRA;
  riskExplainers: RiskExplainers | null;
  paid: boolean;
  passiveLabel: string | null;
}) {
  const pass = passiveLabel ?? "the index";

  // No served decomposition for this fund → honest Unavailable.
  if (!present) {
    return (
      <section id="s4" className="scroll-mt-24">
        <ChapterHeader index={4} title="Performance attribution" />
        <Unavailable>
          A holdings-era return decomposition isn&apos;t served for this fund.
        </Unavailable>
      </section>
    );
  }

  // Served but below the gate (or the build had nothing to summarize): the
  // free proof point + unlock — never the decomposition numbers.
  if (!paid || !summary) {
    return (
      <section id="s4" className="scroll-mt-24">
        <ChapterHeader
          index={4}
          title="Performance attribution"
          takeaway={
            <>
              How the fund&apos;s sector, theme and macro bets and its stock-picking
              combined to a net result vs {pass} — the full bets-to-net decomposition
              is a paid detail.
            </>
          }
        />
        {paid ? (
          <LockedNotice tier="paid">
            The decomposition exists for this fund but had nothing eligible to
            summarize — see the sources footer for its status.
          </LockedNotice>
        ) : (
          <div className="mt-4">
            <DetractorProof
              preview={getPreview(returnAttribution) as DetractorPreview | null}
              pass={pass}
            />
            <UnlockLine tier="paid">
              See the full bets-to-net waterfall, the steady-tilt vs tilt-variation
              split, and the member-level Brinson tables.
            </UnlockLine>
          </div>
        )}
      </section>
    );
  }

  const led = [...(summary.factor_contributions ?? [])].sort(
    (a, b) => (b.total_bps ?? 0) - (a.total_bps ?? 0),
  )[0];
  const idio = summary.stock_selection_idio_bps ?? 0;
  const realised = summary.realised_active_bps ?? 0;
  const recon = summary.residual_reconciliation_bps ?? 0;
  const net = realised - recon;
  // The gold identity (idio = realised − Σ ALL factors) makes the factor total
  // exactly realised − idio; the assembler lists only the top rows.
  const betsTotal = realised - idio;

  // Sign-DERIVED narrative — never a hardcoded story.
  const betsVerb = betsTotal >= 0 ? "added" : "cost";
  const pickVerb = idio >= 0 ? "added" : "detracted";
  const takeaway = (
    <>
      Sector, theme &amp; macro bets {betsVerb}{" "}
      <span className={betsTotal < 0 ? "text-rose-700" : "text-emerald-700"}>
        {bpsSigned(betsTotal)} bps/yr
      </span>
      {led && (
        <>
          {" "}
          (led by {factorLabel(led.factor_id)} {bpsSigned(led.total_bps)})
        </>
      )}
      ; stock selection {pickVerb}{" "}
      <span className={idio < 0 ? "text-rose-700" : "text-emerald-700"}>{bpsSigned(idio)}</span> —
      bets + selection ={" "}
      <span className={realised < 0 ? "text-rose-700" : "text-emerald-700"}>
        {bpsSigned(realised)} bps/yr
      </span>{" "}
      gross, β-adjusted. Fees + trading ({bpsSigned(-recon)}) take the window to ≈{" "}
      <span className={net < 0 ? "text-rose-700" : "text-emerald-700"}>
        {bpsSigned(net)} bps/yr
      </span>{" "}
      net vs {pass}.
    </>
  );

  return (
    <section id="s4" className="scroll-mt-24">
      <ChapterHeader
        index={4}
        title="Performance attribution"
        asOf={
          summary.window
            ? `holdings-era window · ${summary.window}${summary.n_quarters ? ` · ${summary.n_quarters} quarters` : ""}`
            : undefined
        }
        takeaway={takeaway}
      />
      <div className="mt-1.5 flex justify-end text-[11px] text-gray-400">
        <Link
          href="/methodology#risk-attribution"
          className="hover:text-[#1466b8] hover:underline"
        >
          How we calculate this →
        </Link>
      </div>

      <AttributionExplorer
        summary={summary}
        brinson={shapeBrinson(returnAttribution)}
        betaTiltPlain={riskExplainers?.beta_tilt_plain ?? null}
        passiveLabel={passiveLabel}
      />
    </section>
  );
}

function DetractorProof({
  preview,
  pass,
}: {
  preview: DetractorPreview | null;
  pass: string;
}) {
  if (!preview) return null;
  return (
    <ProofPoint
      label={`Biggest stock drag (${preview.period}) vs ${pass}`}
      value={`${preview.member_label} ${fmtSignedBps(preview.contribution_to_active_return_bps)}`}
      readout={`Over the ${preview.period} window, ${preview.member_label} was the largest single-name drag on active return vs ${pass}. The full attribution — every bet and every member — is a paid detail.`}
      tone="negative"
    />
  );
}
