// ============================================================================
// AnatomySection — Crescent v2 Block 2 (step 6). Server component.
// ----------------------------------------------------------------------------
// "The gold, under a microscope" (panel-validated extension design 1): what
// the part of the fund its twin can't reproduce is MADE OF. The anatomy
// movement is the hatched CrescentMark + one split sentence; everything else
// in the block is the existing positioning dossier (CurrentPositioning) and
// Recent shifts, reparented UNCHANGED as children (reparent-then-refactor —
// their own chapter headers are step-7 chrome).
//
// Bases (all served, none re-derived):
// - fill = 1 − replica_r2 via fillFromR2 — same helper as the hero, so the
//   two marks can never disagree.
// - idio_risk_share = fraction of active VARIANCE that is stock-selection
//   (te_decomposition; sleeves add in quadrature to the fund's active TE vs
//   its β-adjusted free twin). The hatched share of the gold is
//   fill × (1 − idio_risk_share) — the mockup's own fh = fill · fs formula
//   (anatomyHatch in lib/crescent.ts).
// - The idio% / lean% pair is complementary by construction (one source
//   field), so the sentence can never disagree with itself.
// The movement renders only what exists at this tier: mark needs fill AND
// idio share; the sentence needs idio share alone; neither fabricates.
// ============================================================================
import type { ValueScore } from "@/lib/serving/profile";
import { anatomyHatch, fillFromR2, fillPctStr } from "@/lib/crescent";
import { CrescentMark } from "./CrescentMark";
import { BlockHeader } from "./BlockHeader";

export function AnatomySection({
  ticker,
  valueScore,
  idioRiskShare,
  orientDeg,
  children,
}: {
  ticker: string;
  valueScore: ValueScore | null;
  /** te_decomposition idio_risk_share (fraction of active variance that is
   *  stock-selection) — paid full object or the free TeProofPreview; null
   *  below the free gate or when the decomposition doesn't exist. */
  idioRiskShare: number | null;
  /** Same detent the hero mark uses (topVsBenchmarkTilt → orientFromTilt). */
  orientDeg: number;
  /** The reparented positioning dossier (CurrentPositioning, RecentChanges). */
  children: React.ReactNode;
}) {
  const fill = fillFromR2(valueScore?.replica_r2);
  const fillPct = fillPctStr(valueScore?.replica_r2);
  const idioPct = idioRiskShare != null ? Math.round(idioRiskShare * 100) : null;
  const leanPct = idioPct != null ? 100 - idioPct : null;
  const fhatch = anatomyHatch(fill, idioRiskShare);

  return (
    <section className="mt-14 border-t border-gray-100 pt-10">
      <BlockHeader
        eyebrow="The gold, under a microscope · current positioning"
        headline={
          /* The fill-specific promise renders only when the anatomy card that
             redeems it (idio split) actually follows — review finding, step 6. */
          fillPct != null && idioPct != null
            ? `What the ${fillPct}% the twin can't reproduce is made of`
            : "What the active part is made of"
        }
        sub={
          idioPct != null ? (
            <>
              The named rows below are <strong className="font-medium text-gray-600">risk-model
              tilts</strong> — sector, theme and macro exposures measured against its free twin.
              Individual stock picks don&apos;t get named rows here; they ARE the{" "}
              <strong className="font-medium text-gray-600">own-picks share</strong> of active
              risk, and their realized payoffs are named one-by-one in the attribution drill-down
              under Performance.
            </>
          ) : undefined
        }
      />

      {idioPct != null && (
        <div className="mt-6 flex flex-col items-start gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          {fill != null && fhatch != null && (
            <CrescentMark
              variant="anatomy"
              fill={fill}
              fhatch={fhatch}
              orientDeg={orientDeg}
              size={132}
              ariaLabel={`Crescent anatomy: ${fillPct}% gold fill, of which ${leanPct}% is hatched (nameable lean)`}
            />
          )}
          <div>
            <p className="max-w-[52ch] font-serif text-[17px] leading-relaxed text-gray-800">
              Of {ticker}&apos;s active risk,{" "}
              <strong className="font-semibold text-crescent-accent-text">{idioPct}%</strong> is its
              own security picks;{" "}
              <strong className="font-semibold text-gray-600">{leanPct}%</strong> is nameable style
              &amp; sector lean.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-crescent-accent" />
                own picks
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-[3px]"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, var(--crescent-accent), var(--crescent-accent) 1.5px, var(--crescent-twin-edge) 1.5px, var(--crescent-twin-edge) 3px)",
                  }}
                />
                nameable lean
              </span>
              <span className="text-gray-400">
                share of active return variance vs its free twin
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-16">{children}</div>
    </section>
  );
}
