// ============================================================================
// Selection Evidence (spec #10) — returns-based skill + Manager Moves tiles,
// Return Attribution top contributors, and Portfolio Shifts. Suppressed for
// passive/index funds. Honest unavailable / locked states throughout.
// ============================================================================
import {
  Section,
  Card,
  Unavailable,
  AsOf,
  LockedNotice,
  Evidence,
} from "./primitives";
import {
  fmtPct,
  fmtSignedBps,
  fmtNum,
  skillBandLabel,
  skillBandChip,
  managerMovesChip,
  EM_DASH,
} from "@/lib/serving/format";
import { isLocked, type Locked } from "@/lib/serving/profile";

interface ManagerMoves {
  label: string | null;
  status: string | null;
  impact_bps_per_year: number | null;
  window_start: string | null;
  window_end: string | null;
  holdings_as_of: string | null;
  filing_lag_days: number | null;
  coverage_avg: number | null;
  n_quarters_observed: number | null;
  suppression_reason: string | null;
  locked_fields?: string[];
}
interface SkillEvidence {
  label: string | null;
  p_skill: number | null;
  p_negative_skill: number | null;
  alpha_ir: number | null;
  se_alpha_ir: number | null;
  t_years: number | null;
  peer_group: string | null;
  method_version: string | null;
  manager_moves: ManagerMoves | null;
}
interface ManagerParent {
  fund_family: string | null;
  adviser_name: string | null;
  manager_names: string[] | null;
  has_sub_adviser: boolean | null;
  skill_evidence: SkillEvidence | null;
}

interface AttrRow {
  row_id: string;
  period: string;
  dimension: string;
  member_label: string;
  contribution_to_active_return_bps: number | null;
  rank_direction: string;
  period_start_date: string;
  period_end_date: string;
}
interface ReturnAttribution {
  rows: AttrRow[];
  suppressions: { period?: string; reason?: string }[];
  method_version?: string | null;
}

interface ShiftRow {
  change_id: string;
  change_name: string;
  change_type: string;
  change_direction: string;
  change_magnitude: number | null;
  value_unit: string | null;
  surfaced_rank: number;
  holdings_as_of_current: string | null;
  holdings_as_of_prior: string | null;
}
interface PositioningChanges {
  rows: ShiftRow[];
  status: string | null;
  eval_date?: string | null;
}

export function SelectionEvidence({
  managerParent,
  returnAttribution,
  positioningChanges,
  isPassive,
}: {
  managerParent: ManagerParent | Locked | null;
  returnAttribution: ReturnAttribution | Locked | null;
  positioningChanges: PositioningChanges | Locked | null;
  isPassive: boolean;
}) {
  if (isPassive) {
    return (
      <Section id="selection-evidence" title="Selection Evidence" methodologyAnchor="skill-evidence">
        <Unavailable>
          Stock-picking evidence is not applicable because this fund is classified
          as passive/index. See Exposure X-Ray for what it delivers and Fee
          Fairness for how its cost compares.
        </Unavailable>
      </Section>
    );
  }

  return (
    <Section
      id="selection-evidence"
      title="Selection Evidence"
      subtitle="Two independent reads of whether the manager's choices have added value — from returns, and from trades."
      methodologyAnchor="skill-evidence"
    >
      <div className="space-y-4">
        <SkillAndMoves managerParent={managerParent} />
        <ReturnAttributionTiles ra={returnAttribution} />
        <PortfolioShifts pc={positioningChanges} />
      </div>
    </Section>
  );
}

function SkillAndMoves({
  managerParent,
}: {
  managerParent: ManagerParent | Locked | null;
}) {
  if (isLocked(managerParent)) {
    return (
      <LockedNotice tier={managerParent.locked}>
        See the returns-based skill evidence and the Manager Moves read.
      </LockedNotice>
    );
  }
  const se = managerParent?.skill_evidence;
  const mm = se?.manager_moves;

  const managers = managerParent?.manager_names?.filter(Boolean) ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Returns-based skill */}
      <Card>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Returns-based skill evidence
        </div>
        {se && se.label ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              <span className={`rounded-md border px-2.5 py-0.5 text-sm font-bold ${skillBandChip(se.label)}`}>
                {skillBandLabel(se.label)}
              </span>
              {se.p_skill != null && (
                <span className="text-sm text-gray-600">
                  P(positive skill) <strong className="tabular-nums">{fmtPct(se.p_skill, 0)}</strong>
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              The evidence, from the fund&apos;s own track record
              {se.t_years != null ? ` (${se.t_years.toFixed(1)} years)` : ""}, that
              returns exceeded what its passive exposures explain — after fees.
            </p>
            <Evidence summary="diagnostics">
              <ul className="space-y-0.5">
                <li>Information ratio: {fmtNum(se.alpha_ir)}{se.se_alpha_ir != null ? ` (± ${fmtNum(se.se_alpha_ir)})` : ""}</li>
                <li>P(negative skill): {fmtPct(se.p_negative_skill, 1)}</li>
                <li>Peer group: {se.peer_group ?? EM_DASH}</li>
                <li className="text-gray-400">method {se.method_version ?? EM_DASH}</li>
              </ul>
            </Evidence>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            Not enough validated return history to estimate manager-skill evidence.
          </p>
        )}
      </Card>

      {/* Manager Moves (holdings-based) */}
      <Card>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Manager Moves <span className="text-gray-300">(holdings-based)</span>
        </div>
        {mm && mm.label && mm.status === "available" ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className={`rounded-md border px-2.5 py-0.5 text-sm font-bold ${managerMovesChip(mm.label)}`}>
                {mm.label}
              </span>
              {mm.impact_bps_per_year != null ? (
                <span className="text-sm tabular-nums text-gray-600">
                  {fmtSignedBps(mm.impact_bps_per_year)}/yr
                </span>
              ) : mm.locked_fields?.includes("impact_bps_per_year") ? (
                <span className="text-xs text-indigo-600">bps figure: paid tier</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              What the manager&apos;s trades have done to this portfolio over the
              trailing window
              {mm.window_start && mm.window_end ? ` (${mm.window_start} → ${mm.window_end})` : ""},
              versus a no-trades version — not a forecast of future trades.
            </p>
            <Evidence summary="coverage">
              <ul className="space-y-0.5">
                <li>Quarters observed: {mm.n_quarters_observed ?? EM_DASH}</li>
                <li>Holdings coverage: {mm.coverage_avg != null ? fmtPct(mm.coverage_avg, 0) : EM_DASH}</li>
                <li>Holdings as of {mm.holdings_as_of ?? EM_DASH}{mm.filing_lag_days != null ? `, ${mm.filing_lag_days}-day SEC filing lag` : ""}</li>
              </ul>
            </Evidence>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            Not enough holdings history yet to tell whether recent trades are
            adding or subtracting value.
          </p>
        )}
        {managers.length > 0 && (
          <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
            Adviser: {managerParent?.adviser_name ?? managers.join(", ")}
            {managerParent?.has_sub_adviser ? " · uses a sub-adviser" : ""}
          </p>
        )}
      </Card>
    </div>
  );
}

function ReturnAttributionTiles({ ra }: { ra: ReturnAttribution | Locked | null }) {
  if (isLocked(ra)) {
    return (
      <LockedNotice tier={ra.locked}>
        See which stocks, sectors and themes drove this fund&apos;s return versus
        its passive alternative.
      </LockedNotice>
    );
  }
  if (!ra || !ra.rows || ra.rows.length === 0) {
    const suppressed = ra?.suppressions && ra.suppressions.length > 0;
    return (
      <Unavailable>
        {suppressed
          ? "Return attribution is suppressed for this fund — its portfolio was too internationally weighted for our US-priced holdings store to attribute without distortion."
          : "Return attribution isn't available for this fund yet."}
      </Unavailable>
    );
  }

  // Show 3Y stock contributors when present, else best available period.
  const period =
    ["3Y", "5Y", "1Y"].find((p) =>
      ra.rows.some((r) => r.period === p && r.dimension === "stock"),
    ) ??
    ra.rows[0].period;
  const dim = ra.rows.some((r) => r.period === period && r.dimension === "stock")
    ? "stock"
    : "sector";
  const scoped = ra.rows.filter((r) => r.period === period && r.dimension === dim);
  const contributors = scoped.filter((r) => r.rank_direction === "positive").slice(0, 4);
  const detractors = scoped.filter((r) => r.rank_direction === "negative").slice(0, 4);
  const win = scoped[0];

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          What drove {period} active return
        </h3>
        <span className="text-xs text-gray-400">
          {dim === "stock" ? "by stock" : "by sector"} · vs passive
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ContribList title="Top contributors" rows={contributors} positive />
        <ContribList title="Top detractors" rows={detractors} positive={false} />
      </div>
      {win && (
        <AsOf>
          Brinson allocation over {win.period_start_date} → {win.period_end_date}.
          Per-member contributions are exact; the residual is real trading
          quarterly holdings can&apos;t resolve. Method {ra.method_version ?? EM_DASH}.
        </AsOf>
      )}
    </Card>
  );
}

function ContribList({
  title,
  rows,
  positive,
}: {
  title: string;
  rows: AttrRow[];
  positive: boolean;
}) {
  if (rows.length === 0)
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</div>
        <p className="mt-1 text-xs text-gray-400">None over this window.</p>
      </div>
    );
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</div>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.row_id} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-gray-700">{r.member_label}</span>
            <span
              className={`shrink-0 tabular-nums ${
                positive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {fmtSignedBps(r.contribution_to_active_return_bps)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PortfolioShifts({ pc }: { pc: PositioningChanges | Locked | null }) {
  if (isLocked(pc)) {
    return (
      <LockedNotice tier={pc.locked}>
        See how this fund&apos;s exposures moved between its two most recent
        filings.
      </LockedNotice>
    );
  }
  if (!pc || !pc.rows || pc.rows.length === 0) {
    return (
      <Unavailable>
        No qualifying prior filing within the lookback window, so no portfolio
        shifts are shown.
      </Unavailable>
    );
  }
  const shifts = [...pc.rows].sort((a, b) => a.surfaced_rank - b.surfaced_rank).slice(0, 6);
  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Recent portfolio shifts</h3>
      <ul className="divide-y divide-gray-50">
        {shifts.map((s) => (
          <li key={s.change_id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span className="text-gray-700">
              <span className="font-medium">{s.change_name}</span>
              <span className="ml-2 text-[11px] uppercase tracking-wide text-gray-400">
                {s.change_type}
              </span>
            </span>
            <span className="shrink-0 text-gray-600">
              <span
                className={
                  s.change_direction === "increased" || s.change_direction === "entered"
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {s.change_direction}
              </span>
              {s.change_magnitude != null && (
                <span className="ml-2 tabular-nums text-gray-500">
                  {s.change_magnitude > 0 ? "+" : "−"}
                  {Math.abs(s.change_magnitude).toFixed(1)} {s.value_unit ?? "pp"}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <AsOf>
        Current holdings {shifts[0]?.holdings_as_of_current ?? EM_DASH} vs the prior
        filing {shifts[0]?.holdings_as_of_prior ?? EM_DASH}. Describes what changed,
        not whether it will pay off.
      </AsOf>
    </Card>
  );
}
