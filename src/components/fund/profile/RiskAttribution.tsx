// ============================================================================
// Risk & Attribution (spec #13) — the returns-based factor lens that complements
// the holdings-based Exposure X-Ray (#4). Three sub-panels:
//   1. "What drives this fund"  — top theme active βs + FF6 style tilts.
//   2. The divergence headline   — "you hold X% but actively bet Y%".
//   3. "Did the bets pay"        — bias / timing / idio (paid-gated).
//
// COPY CHARTER (binding, carried in-section as `copy_charter`):
//   • bias/timing = the realised contribution of the exposure PATH, NOT a
//     manager-timing-skill claim. Only `idio` is a skill read.
//   • The two attribution families (this returns-factor family vs the holdings
//     Brinson #10 family in Selection Evidence) are SEPARATE — never summed.
//   • Active β ≠ total holdings %. Lead the active claim with the market-stripped β.
//   • No prediction, no personalization.
// Every number renders from the served fact section — nulls show honestly, never
// fabricated. Dual as-of (holdings vs factor eval) disclosed per panel.
// ============================================================================
import {
  Section,
  Card,
  Unavailable,
  AsOf,
  LockedNotice,
  ProofPoint,
  UnlockLine,
  Evidence,
} from "./primitives";
import {
  fmtPct,
  fmtBeta,
  fmtSignedBps,
  fmtNum,
  divergenceStateLabel,
  divergenceStateChip,
  styleTargetLabel,
  EM_DASH,
} from "@/lib/serving/format";
import {
  isLocked,
  getPreview,
  type Locked,
  type RiskAttribution as RiskAttributionData,
  type FactorBetaRow,
  type DivergenceRow,
  type FactorContributionRow,
  type DivergencePreview,
  type ThemeBetaPreview,
} from "@/lib/serving/profile";

// A theme's target_id (theme::ai_infrastructure) → human label, when no
// exposure_name is carried (the betas sub-panel has only target_id).
function themeLabel(targetId: string): string {
  return targetId
    .replace(/^theme::/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function RiskAttribution({
  risk,
  isPassive,
}: {
  risk: RiskAttributionData | Locked | null;
  isPassive: boolean;
}) {
  // Section-level lock (gate is 'free' → anon sees the upgrade affordance).
  if (isLocked(risk)) {
    const pp = getPreview(risk) as DivergencePreview | ThemeBetaPreview | null;
    return (
      <Section
        id="risk-attribution"
        title="Risk & Attribution"
        methodologyAnchor="risk-attribution"
      >
        {pp ? (
          <>
            <RiskProofPoint pp={pp} />
            <UnlockLine tier={risk.locked}>
              See all factor &amp; theme bets, and how they have played out.
            </UnlockLine>
          </>
        ) : (
          <LockedNotice tier={risk.locked}>
            See what actually drives this fund in return space — its active factor
            and theme bets beyond a cheap index, and how those bets played out.
          </LockedNotice>
        )}
      </Section>
    );
  }

  // Honest unavailable: fund absent from all three risk sources → real SQL NULL.
  if (!risk || (!risk.factor_betas && !risk.exposure_divergence && !risk.active_return_attribution)) {
    return (
      <Section
        id="risk-attribution"
        title="Risk & Attribution"
        methodologyAnchor="risk-attribution"
      >
        <Unavailable>
          A returns-based factor read isn&apos;t available for this fund — we
          don&apos;t yet have enough return history to estimate its factor and
          theme exposures.
        </Unavailable>
      </Section>
    );
  }

  return (
    <Section
      id="risk-attribution"
      title="Risk & Attribution"
      subtitle="What drives this fund in return space — its active bets beyond a cheap index, and how those bets have played out. A returns-based lens that complements the holdings-based Exposure X-Ray above."
      methodologyAnchor="risk-attribution"
    >
      <div className="space-y-4">
        <FactorBetas betas={risk.factor_betas} isPassive={isPassive} />
        <DivergenceHeadline divergence={risk.exposure_divergence} />
        <ActiveReturnAttribution attr={risk.active_return_attribution} isPassive={isPassive} />
      </div>
    </Section>
  );
}

// The single free proof point for the gated outer section: either the
// divergence headline ("hold X% but actively bet β Y") or, absent divergence,
// the top theme active beta. NEUTRAL framing — describes the bet, no verdict.
function RiskProofPoint({
  pp,
}: {
  pp: DivergencePreview | ThemeBetaPreview;
}) {
  if (pp.kind === "divergence") {
    const holdPct = fmtPct(pp.total_exposure_holdings, 0);
    const beta = fmtBeta(pp.beta_active_mkt);
    const read = divergenceStateLabel(pp.divergence_state);
    return (
      <ProofPoint
        label="Biggest hold-vs-bet gap"
        value={`${pp.exposure_name}: hold ${holdPct}, active β ${beta}`}
        readout={`This fund holds ${holdPct} in ${pp.exposure_name} but runs a ${beta} active bet on it (market stripped) — ${read.toLowerCase()}. Holding a theme isn't the same as betting on it.`}
        asOf={
          pp.holdings_as_of || pp.factor_eval_date
            ? `Holdings as of ${pp.holdings_as_of ?? EM_DASH}; return-based exposures through ${pp.factor_eval_date ?? EM_DASH}.`
            : null
        }
      />
    );
  }
  const beta = fmtBeta(pp.beta_active_mkt);
  const dir = pp.beta_active_mkt > 0 ? "overweight" : "underweight";
  return (
    <ProofPoint
      label="Biggest active theme bet"
      value={`${pp.exposure_name}: active β ${beta}`}
      readout={`Beyond the market, this fund runs a ${beta} (${dir}) active bet on ${pp.exposure_name} — its largest return-based theme bet.`}
      asOf={pp.factor_eval_date ? `Return-based exposures through ${pp.factor_eval_date}.` : null}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-panel 1 — "What drives this fund": top theme active βs + FF6 style tilts.
// ---------------------------------------------------------------------------
function FactorBetas({
  betas,
  isPassive,
}: {
  betas: RiskAttributionData["factor_betas"];
  isPassive: boolean;
}) {
  if (!betas || (betas.themes.length === 0 && betas.styles.length === 0)) {
    return (
      <Card>
        <PanelHeading>What drives this fund</PanelHeading>
        <p className="mt-2 text-sm text-gray-500">
          Not enough return history to estimate factor and theme exposures.
        </p>
      </Card>
    );
  }

  // Themes worth showing as an *active bet*: |active β| materially non-zero.
  const themes = betas.themes
    .filter((t) => t.beta_active_mkt != null)
    .sort((a, b) => Math.abs(b.beta_active_mkt ?? 0) - Math.abs(a.beta_active_mkt ?? 0))
    .slice(0, 6);
  const styles = betas.styles.filter((s) => s.beta_raw != null);

  return (
    <Card>
      <PanelHeading>What drives this fund</PanelHeading>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        Active β is the bet <em>beyond the market</em> (market exposure stripped
        out). A near-zero active β on a theme means the fund holds it only as much
        as the market does — that&apos;s market exposure, not an active bet.
      </p>

      {/* Themes — the active-bet narrative the investor recognises. */}
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Top theme bets <span className="text-gray-300">(active β, market stripped)</span>
        </div>
        <ul className="mt-1.5 space-y-1.5">
          {themes.map((t) => (
            <ThemeBetaRow key={t.target_id} t={t} />
          ))}
        </ul>
        {isPassive && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            This fund is passive — its theme exposures are market beta, so the
            active βs sit near zero by design.
          </p>
        )}
      </div>

      {/* Style tilts — FF6. Styles have no "vs market" reading → use raw β. */}
      {styles.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Style tilts <span className="text-gray-300">(Fama-French, raw β)</span>
          </div>
          <ul className="mt-1.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {styles.map((s) => (
              <li
                key={s.target_id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="truncate text-gray-700">{styleTargetLabel(s.target_id)}</span>
                <span className="shrink-0 tabular-nums text-gray-600">{fmtBeta(s.beta_raw)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AsOf>
        Return-based exposures through {betas.eval_date ?? EM_DASH}
        {betas.window_weeks != null ? ` (${betas.window_weeks}-week trailing regression)` : ""}.
        Active β = market-stripped ({betas.active_beta_control_model ?? "mkt_1f"});
        style β = raw. Method {betas.method_version ?? EM_DASH}.
      </AsOf>
    </Card>
  );
}

function ThemeBetaRow({ t }: { t: FactorBetaRow }) {
  const b = t.beta_active_mkt;
  const isBet = b != null && Math.abs(b) >= 0.05;
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="truncate text-gray-700">{themeLabel(t.target_id)}</span>
      <span className="flex shrink-0 items-baseline gap-2">
        <span
          className={`tabular-nums font-medium ${
            !isBet ? "text-gray-400" : (b ?? 0) > 0 ? "text-sky-700" : "text-rose-700"
          }`}
        >
          {fmtBeta(b)}
        </span>
        {!isBet && <span className="text-[11px] text-gray-400">market exposure</span>}
        <BetaConfidence t={t} />
      </span>
    </li>
  );
}

// t-stat / R² shown honestly — a low t-stat means the bet isn't statistically
// distinguishable from zero.
function BetaConfidence({ t }: { t: FactorBetaRow }) {
  const ts = t.beta_active_tstat;
  if (ts == null) return null;
  const strong = Math.abs(ts) >= 2;
  return (
    <Evidence summary={strong ? "t≈" + Math.abs(ts).toFixed(1) : "low confidence"}>
      <ul className="space-y-0.5">
        <li>Active β t-stat: {fmtNum(ts, 1)}{strong ? "" : " — not distinguishable from zero (|t| < 2)"}</li>
        <li>Raw β (total exposure): {fmtBeta(t.beta_raw)}{t.beta_raw_tstat != null ? ` (t ${fmtNum(t.beta_raw_tstat, 1)})` : ""}</li>
        <li>Incremental vs FF6: {fmtBeta(t.beta_incremental_ff6)}</li>
        {t.r2_active != null && <li>Regression R²: {fmtPct(t.r2_active, 0)}</li>}
        <li className="text-gray-400">confidence: {t.confidence_state ?? EM_DASH}</li>
      </ul>
    </Evidence>
  );
}

// ---------------------------------------------------------------------------
// Sub-panel 2 — the divergence headline: "you hold X% but actively bet Y%".
// ---------------------------------------------------------------------------
function DivergenceHeadline({
  divergence,
}: {
  divergence: RiskAttributionData["exposure_divergence"];
}) {
  if (!divergence || divergence.rows.length === 0) {
    return (
      <Card>
        <PanelHeading>What you hold vs what you&apos;re betting on</PanelHeading>
        <p className="mt-2 text-sm text-gray-500">
          No theme has both a holdings weight and a return-based β for this fund,
          so there&apos;s no hold-vs-bet comparison to show.
        </p>
      </Card>
    );
  }

  // Lead with the headline states (active_bet / exposure_no_active_bet) the
  // assembler already sorted to the front; cap to a focused set.
  const rows = divergence.rows.slice(0, 6);

  return (
    <Card>
      <PanelHeading>What you hold vs what you&apos;re betting on</PanelHeading>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        Two different measurements of the same exposure, never added: how much of
        a theme the fund <strong>holds</strong> (% of assets) versus how much of an
        active <strong>bet</strong> it&apos;s running on that theme (market-stripped β).
        Holding a lot of a theme isn&apos;t the same as betting on it.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-3 font-medium">Theme</th>
              <th className="px-3 py-2 text-right font-medium">You hold</th>
              <th className="px-3 py-2 text-right font-medium">Active bet (β)</th>
              <th className="py-2 pl-3 text-right font-medium">Read</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <DivergenceTableRow key={r.target_id} r={r} />
            ))}
          </tbody>
        </table>
      </div>
      <AsOf>
        Holdings as of {divergence.holdings_as_of ?? EM_DASH}; return-based
        exposures through {divergence.factor_eval_date ?? EM_DASH}. These are
        measured at different dates by design — the return regression is fresher
        because it needs only returns, not the (filing-lagged) holdings.
      </AsOf>
    </Card>
  );
}

function DivergenceTableRow({ r }: { r: DivergenceRow }) {
  const isBet = r.divergence_state === "active_bet" || r.divergence_state === "active_bet_low_holdings";
  // Plain-English read, driven off divergence_state (never conflate the two
  // numbers). For an index fund: "market exposure, not an active bet."
  let read: string;
  if (r.divergence_state === "exposure_no_active_bet") {
    read = "Market exposure, not an active bet";
  } else if (r.divergence_state === "active_bet") {
    read = (r.beta_active_mkt ?? 0) > 0 ? "Overweight bet vs the market" : "Underweight bet vs the market";
  } else if (r.divergence_state === "active_bet_low_holdings") {
    read = "A β bet without a large static weight";
  } else {
    read = "Minimal exposure either way";
  }
  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 pr-3 font-medium text-gray-900">{r.exposure_name}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
        {fmtPct(r.total_exposure_holdings, 0)}
      </td>
      <td className="px-3 py-2 text-right">
        <span
          className={`tabular-nums font-medium ${
            !isBet ? "text-gray-400" : (r.beta_active_mkt ?? 0) > 0 ? "text-sky-700" : "text-rose-700"
          }`}
        >
          {fmtBeta(r.beta_active_mkt)}
        </span>
      </td>
      <td className="py-2 pl-3 text-right">
        <span
          className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${divergenceStateChip(r.divergence_state)}`}
        >
          {divergenceStateLabel(r.divergence_state)}
        </span>
        <span className="ml-2 hidden text-[11px] text-gray-400 sm:inline">{read}</span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Sub-panel 3 — "Did the bets pay": bias / timing / idio. PAID-gated.
// ---------------------------------------------------------------------------
function ActiveReturnAttribution({
  attr,
  isPassive,
}: {
  attr: RiskAttributionData["active_return_attribution"];
  isPassive: boolean;
}) {
  if (isLocked(attr)) {
    return (
      <LockedNotice tier={attr.locked}>
        See how this fund&apos;s active bets actually played out — the realised
        contribution of each factor bet, and the residual left after factor bets.
      </LockedNotice>
    );
  }
  // Passive funds have no active-return path to decompose — that's correct, not a gap.
  if (!attr) {
    return (
      <Card>
        <PanelHeading>Did the bets pay</PanelHeading>
        <p className="mt-2 text-sm text-gray-500">
          {isPassive
            ? "This fund is passive — it runs no active bets, so there's no active-return path to decompose."
            : "Not enough holdings path history to decompose this fund's realised active return into its factor bets."}
        </p>
      </Card>
    );
  }

  const factors = [...attr.factor_contributions]
    .sort((a, b) => Math.abs(b.total_contribution_bps ?? 0) - Math.abs(a.total_contribution_bps ?? 0))
    .slice(0, 6);
  const idio = attr.idio;

  return (
    <Card>
      <PanelHeading>Did the bets pay</PanelHeading>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        How the fund&apos;s factor and theme bets contributed to its realised
        active return over the holdings path window. <strong>Bias</strong> is the
        persistent tilt; <strong>timing</strong> is the part from carrying more of
        a factor in the quarters it paid — this is the realised contribution of
        the exposure path, <em>not</em> a claim that the manager can time factors.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-3 font-medium">Factor / theme</th>
              <th className="px-3 py-2 text-right font-medium">Bias</th>
              <th className="px-3 py-2 text-right font-medium">Timing</th>
              <th className="py-2 pl-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <FactorContribRow key={f.factor_id} f={f} />
            ))}
          </tbody>
        </table>
      </div>

      {/* The idio residual — the ONLY skill read, and even then a residual. */}
      {idio && (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">
              Stock-selection residual (idiosyncratic)
            </div>
            <div
              className={`tabular-nums font-semibold ${
                (idio.idio_contribution_bps ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {fmtSignedBps(idio.idio_contribution_bps)}
            </div>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            What&apos;s left after the factor bets — the only part of this
            decomposition that reads as stock-selection skill, and even then it
            should be cross-referenced with the fund&apos;s skill evidence below,
            not taken on its own.
          </p>
          <Evidence summary="reconciliation">
            <ul className="space-y-0.5">
              <li>Realised active return: {fmtSignedBps(idio.realised_active_bps)}</li>
              <li>Reconciliation gap: {fmtSignedBps(idio.reconciliation_gap_bps)}</li>
              <li>Quarters observed: {idio.n_quarters ?? EM_DASH}</li>
            </ul>
          </Evidence>
        </div>
      )}

      <AsOf>
        Realised over {attr.window_start ?? EM_DASH} → {attr.window_end ?? EM_DASH}
        {attr.holdings_window ? ` (${attr.holdings_window})` : ""}. This
        returns-factor decomposition is a <em>separate</em> attribution family from
        the holdings-based attribution in Selection Evidence below — the two answer
        the same question two ways and are never added together. Method{" "}
        {attr.method_version ?? EM_DASH}.
      </AsOf>
    </Card>
  );
}

function FactorContribRow({ f }: { f: FactorContributionRow }) {
  const name = f.factor_id.includes("::")
    ? f.factor_id.split("::")[1].split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : f.factor_id;
  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 pr-3">
        <span className="font-medium text-gray-900">{name}</span>
        <span className="ml-2 text-[11px] uppercase tracking-wide text-gray-400">{f.factor_type}</span>
        {f.low_coverage_flag && (
          <span className="ml-2 text-[11px] text-amber-600">low coverage</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtSignedBps(f.bias_bps)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtSignedBps(f.timing_bps)}</td>
      <td className="py-2 pl-3 text-right">
        <span
          className={`tabular-nums font-semibold ${
            (f.total_contribution_bps ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {fmtSignedBps(f.total_contribution_bps)}
        </span>
      </td>
    </tr>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </div>
  );
}
