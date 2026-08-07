// ============================================================================
// VerdictBlock — Crescent v2 hero (Step 4, Block 1). Server component.
// ----------------------------------------------------------------------------
// Ports composeVerdict from the design source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
//   composeVerdict (~L503-517), borderPhrase (~L497-501), the hero chip build
//   (renderHero ~L720-733).
// Every number here goes through the ALREADY-COMMITTED crescent.ts helpers
// (fillFromR2 / fillPctStr / orientFromTilt / receiptModel / verdictState) —
// never re-derived — so this block, ArchetypeChip and DistributionStrip can
// never disagree on the same fund's own numbers (crescent.ts's own design
// goal, restated in its fillPctStr doc comment).
// ============================================================================
import type { Identity, ValueScore, ExposurePreview } from "@/lib/serving/profile";
import type { ArchetypeFixture, ArchetypeRulesFixture } from "@/lib/fixtures/crescent-archetypes";
import { fillFromR2, fillPctStr, orientFromTilt, receiptModel, verdictState } from "@/lib/crescent";
import {
  breakevenStateChip,
  breakevenStateChipLabel,
  coverageStateReason,
  type BreakevenState,
} from "@/lib/serving/format";
import { UnlockLine } from "../../primitives";
import { CrescentMark } from "./CrescentMark";
import { ArchetypeChip } from "./ArchetypeChip";
import { DistributionStrip } from "./DistributionStrip";

type XrayRow = Record<string, unknown>;

interface FeesShape {
  net_expense_ratio_bps?: number | null;
  fair_fee?: { passive_fee_bps?: number | null; active_fee_over_passive_bps?: number | null } | null;
}

/**
 * Top |difference| sector/theme vs-benchmark row — mirrors the server's own
 * ExposurePreview projector (gating.ts pickTopExposureDiff) so the entitled
 * path and the anonymous-tier preview fallback can never pick a different
 * row for the same fund. Exported so AnatomySection's mark orients off the
 * SAME row as the hero mark (one selection rule, two call sites).
 */
export function topVsBenchmarkTilt(rows: XrayRow[] | null): { exposure_type: string; difference: number } | null {
  if (!rows) return null;
  const cands = rows.filter(
    (r): r is XrayRow & { exposure_type: string; difference: number } =>
      r.holdings_baseline === "vs_benchmark" &&
      (r.exposure_type === "sector" || r.exposure_type === "theme") &&
      typeof r.difference === "number" &&
      Number.isFinite(r.difference as number),
  );
  if (cands.length === 0) return null;
  return cands.reduce((a, b) => (Math.abs(b.difference) > Math.abs(a.difference) ? b : a));
}

/**
 * Mirrors the mockup's borderPhrase(t) (L497-501), generalized off the
 * fixture's own `neighbor_label` instead of re-deriving the hardcoded
 * "Broad Stock-Picker"+"fill" special case baked into that mockup function —
 * same output for every fixture ticker today (FCNTX/DODGX both resolve to
 * "borderline Closet Indexer").
 */
function borderPhrase(fixture: ArchetypeFixture): string | null {
  if (!fixture.borderline) return null;
  return fixture.neighbor_label ? `borderline ${fixture.neighbor_label}` : "borderline";
}

function CrescentHeroCard({ center, strip }: { center: React.ReactNode; strip: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col items-center px-6 py-10 text-center">{center}</div>
      {strip}
    </div>
  );
}

export function VerdictBlock({
  identity,
  requestedTicker,
  valueScore,
  fees,
  passiveLabel,
  exposureXrayRows,
  exposurePreview,
  archetype,
  archetypeRules,
}: {
  identity: Identity;
  requestedTicker: string;
  valueScore: ValueScore | null;
  fees: FeesShape | null;
  passiveLabel: string | null;
  /** Entitled exposure-X-ray rows (free+ tier) — null when locked or absent. */
  exposureXrayRows: XrayRow[] | null;
  /** The anonymous-tier free proof point — the same top-tilt row a locked
   *  exposure X-ray section would surface, used ONLY as a fallback. */
  exposurePreview: ExposurePreview | null;
  archetype: ArchetypeFixture | null;
  archetypeRules: ArchetypeRulesFixture | null;
}) {
  const ticker = identity.ticker ?? requestedTicker.toUpperCase();
  const state = verdictState(valueScore);
  const fill = fillFromR2(valueScore?.replica_r2);
  const fillPct = fillPctStr(valueScore?.replica_r2);
  const matchPct = fillPct != null ? (100 - Number(fillPct)).toFixed(1) : null;

  const tiltRow = topVsBenchmarkTilt(exposureXrayRows) ?? exposurePreview;
  const orientDeg = orientFromTilt(tiltRow);

  if (state === "unscored") {
    return (
      <CrescentHeroCard
        center={
          <>
            <CrescentMark fill={null} orientDeg={orientDeg} size={188} ariaLabel="Crescent mark: no verdict yet" />
            <p className="mt-3 text-lg font-semibold text-gray-900">No verdict yet</p>
            <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-gray-500">
              {coverageStateReason(valueScore?.coverage_state, passiveLabel)}
            </p>
          </>
        }
        strip={<DistributionStrip ticker={ticker} fill={null} fillPct={null} />}
      />
    );
  }

  if (state === "locked_precision") {
    const bstate = (valueScore?.breakeven_state ?? null) as BreakevenState | null;
    return (
      <CrescentHeroCard
        center={
          <>
            <CrescentMark
              fill={null}
              orientDeg={orientDeg}
              size={188}
              ariaLabel="Crescent mark: precise figures unavailable"
            />
            <p className="mt-3 text-lg font-semibold text-gray-900">Precise figures unavailable</p>
            <span
              className={`mt-2 inline-flex items-center rounded-md border px-2.5 py-1 text-[13px] font-semibold ${breakevenStateChip(bstate)}`}
            >
              {breakevenStateChipLabel(bstate)} vs {passiveLabel ?? "its passive alternative"}
            </span>
            <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-gray-500">
              {ticker}&apos;s replica-quality figure didn&apos;t load, so the exact fill and the
              Crescent mark can&apos;t be drawn right now — the breakeven read above is real.
            </p>
          </>
        }
        strip={<DistributionStrip ticker={ticker} fill={null} fillPct={null} />}
      />
    );
  }

  // state === "scored" — replica_r2 (and therefore fill/fillPct/matchPct) is
  // guaranteed present by verdictState's own contract.
  const fundName = identity.fund_name ?? ticker;
  const bp = archetype ? borderPhrase(archetype) : null;
  const receipt = receiptModel(
    fees
      ? {
          net_expense_ratio_bps: fees.net_expense_ratio_bps ?? null,
          fair_fee: fees.fair_fee
            ? {
                passive_fee_bps: fees.fair_fee.passive_fee_bps ?? null,
                active_fee_over_passive_bps: fees.fair_fee.active_fee_over_passive_bps ?? null,
              }
            : null,
        }
      : null,
  );
  const showMoney = receipt != null && receipt.multiple != null && receipt.totalDollars != null;
  const multiple = showMoney ? receipt!.multiple!.toFixed(1) : null;
  const feeDollars = showMoney ? Math.round(receipt!.totalDollars!) : null;
  const twinPhraseText = passiveLabel ? `${passiveLabel} — its free passive twin` : "its free passive twin";
  const hasScore100 = valueScore?.score100 != null;

  return (
    <CrescentHeroCard
      center={
        <>
          <CrescentMark
            fill={fill}
            orientDeg={orientDeg}
            size={188}
            ariaLabel={fillPct != null ? `Crescent: ${fillPct}% gold fill` : "Crescent mark"}
          />

          {/* How to read the mark — one quiet line (design pass 2026-07-22). */}
          <p className="mt-2.5 flex items-center gap-x-3 font-mono text-[10.5px] text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-crescent-twin" />
              its free twin
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-crescent-accent" />
              what the twin can&apos;t reproduce
            </span>
          </p>

          {archetype && archetypeRules && (
            <ArchetypeChip fixture={archetype} rules={archetypeRules} ticker={ticker} fillPct={fillPct} />
          )}

          <p className="mt-3 max-w-[50ch] font-serif text-[18px] leading-relaxed text-gray-800">
            {archetype ? (
              <>
                {fundName} is a{" "}
                <strong className="font-semibold text-crescent-accent-text">{archetype.archetype}</strong>
                {bp && <span className="text-gray-500"> ({bp})</span>}
                {". "}
              </>
            ) : (
              `${fundName}: `
            )}
            <span className="text-gray-500">
              {matchPct}% of its week-to-week behavior matches {twinPhraseText};
            </span>{" "}
            only <strong className="font-semibold text-crescent-accent-text">{fillPct}%</strong> is
            anything the twin can&apos;t reproduce.
            {showMoney && (
              <>
                {" "}
                You pay{" "}
                <strong className="font-semibold text-crescent-accent-text">
                  {multiple}× the twin&apos;s fee — ${feeDollars} per $10,000, every year
                </strong>{" "}
                — for it.
              </>
            )}
          </p>

          <div className="mt-4">
            {hasScore100 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 font-mono text-[12px] text-gray-700">
                <span className="font-semibold text-gray-900">Value Score {valueScore!.score100}</span>
                <span className="text-gray-400">· 50 = breakeven</span>
              </div>
            ) : (
              <UnlockLine tier="paid">See the fund&apos;s 0-100 Value Score.</UnlockLine>
            )}
          </div>
        </>
      }
      strip={<DistributionStrip ticker={ticker} fill={fill} fillPct={fillPct} />}
    />
  );
}
