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
//   • Active β ≠ total holdings %. Lead the active claim with the HEADLINE β —
//     stripped of the fund's named baseline (its passive alternative / L2 blend
//     when one exists, else the market). Name the baseline per row; never call an
//     L2-baseline bet "vs the market".
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
  factorBetaHeadline,
  divergenceHeadlineBeta,
  isPassiveAltBaseline,
  baselineNoun,
  activeBetAssessable,
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

// The fund-level factor-beta baseline: `l2_blend` when ANY served theme/divergence
// row is measured vs the L2 passive blend, else `market_fallback`. All of a fund's
// rows share the same baseline in practice; this resolver is defensive against a
// mixed payload (any real L2 row wins).
function fundFactorBaseline(risk: RiskAttributionData): string | null {
  const themes = risk.factor_betas?.themes ?? [];
  const div = risk.exposure_divergence?.rows ?? [];
  for (const r of [...themes, ...div]) {
    if (isPassiveAltBaseline(r.active_baseline)) return "l2_blend";
  }
  if (themes.length > 0 || div.length > 0) return "market_fallback";
  return null;
}

export function RiskAttribution({
  risk,
  isPassive,
  managementStyle,
}: {
  risk: RiskAttributionData | Locked | null;
  isPassive: boolean;
  managementStyle: string | null;
}) {
  // Section-level lock (gate is 'free' → anon sees the upgrade affordance).
  if (isLocked(risk)) {
    const pp = getPreview(risk) as DivergencePreview | ThemeBetaPreview | null;
    // The free proof point IS the active-bet / divergence headline. Suppress it
    // for an active fund whose β baseline fell back to the market — that single
    // number would read as an active bet when it's only a market-relative figure.
    const ppAssessable = pp ? activeBetAssessable(managementStyle, pp.active_baseline) : true;
    return (
      <Section
        id="risk-attribution"
        title="Risk & Attribution"
        methodologyAnchor="risk-attribution"
      >
        {pp && ppAssessable ? (
          <>
            <RiskProofPoint pp={pp} />
            <UnlockLine tier={risk.locked}>
              See all factor &amp; theme bets, and how they have played out.
            </UnlockLine>
          </>
        ) : pp && !ppAssessable ? (
          <>
            <ActiveBetUnassessable what="bets" />
            <UnlockLine tier={risk.locked}>
              We&apos;ll show this fund&apos;s active bets once its passive
              alternative has enough shared return history to price.
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

  // Suppress the "active bet (β)" verdict when this fund is ACTIVELY managed but
  // its factor-beta baseline fell back to the broad market (`market_fallback`) —
  // the served β is then the market-baseline number, which for an active fund
  // misleads even though it reads "vs the market." We show an honest "not enough
  // shared history" state for the active-bet reading instead. Index/passive funds
  // on market_fallback (VOO) and active funds on l2_blend (FCNTX) stay assessable.
  const assessable = activeBetAssessable(managementStyle, fundFactorBaseline(risk));

  return (
    <Section
      id="risk-attribution"
      title="Risk & Attribution"
      subtitle="What drives this fund in return space — its active bets beyond a cheap index, and how those bets have played out. A returns-based lens that complements the holdings-based Exposure X-Ray above."
      methodologyAnchor="risk-attribution"
    >
      <div className="space-y-4">
        <FactorBetas betas={risk.factor_betas} isPassive={isPassive} assessable={assessable} />
        <DivergenceHeadline divergence={risk.exposure_divergence} assessable={assessable} />
        <ActiveReturnAttribution attr={risk.active_return_attribution} isPassive={isPassive} />
      </div>
    </Section>
  );
}

// The honest suppressed state for an active fund whose active-β baseline fell back
// to the market: we can't yet measure its active bets against its passive
// alternative because the matched index couldn't be priced over the return window.
function ActiveBetUnassessable({ what }: { what: "bets" | "divergence" }) {
  return (
    <Unavailable>
      We can&apos;t yet measure this fund&apos;s active bets against its passive
      alternative — its matched index couldn&apos;t be priced over the return
      window, so there isn&apos;t enough shared history to separate an active bet
      from baseline exposure.{" "}
      {what === "bets"
        ? "What it owns is shown in the Exposure X-Ray above."
        : "What it holds is shown in the Exposure X-Ray above."}
    </Unavailable>
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
    const beta = fmtBeta(pp.beta_active_headline);
    const baseline = baselineNoun(pp.active_baseline);
    const read = divergenceStateLabel(pp.divergence_state, pp.active_baseline);
    return (
      <ProofPoint
        label="Biggest hold-vs-bet gap"
        value={`${pp.exposure_name}: hold ${holdPct}, active β ${beta}`}
        readout={`This fund holds ${holdPct} in ${pp.exposure_name} but runs a ${beta} active bet on it vs ${baseline} — ${read.toLowerCase()}. Holding a theme isn't the same as betting on it.`}
        asOf={
          pp.holdings_as_of || pp.factor_eval_date
            ? `Holdings as of ${pp.holdings_as_of ?? EM_DASH}; return-based exposures through ${pp.factor_eval_date ?? EM_DASH}.`
            : null
        }
      />
    );
  }
  const beta = fmtBeta(pp.beta_active_headline);
  const dir = pp.beta_active_headline > 0 ? "overweight" : "underweight";
  const baseline = baselineNoun(pp.active_baseline);
  return (
    <ProofPoint
      label="Biggest active theme bet"
      value={`${pp.exposure_name}: active β ${beta}`}
      readout={`Beyond ${baseline}, this fund runs a ${beta} (${dir}) active bet on ${pp.exposure_name} — its largest return-based theme bet.`}
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
  assessable,
}: {
  betas: RiskAttributionData["factor_betas"];
  isPassive: boolean;
  assessable: boolean;
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

  // Themes worth showing as an *active bet*: |headline β| materially non-zero.
  const themes = betas.themes
    .filter((t) => factorBetaHeadline(t) != null)
    .sort((a, b) => Math.abs(factorBetaHeadline(b) ?? 0) - Math.abs(factorBetaHeadline(a) ?? 0))
    .slice(0, 6);
  const styles = betas.styles.filter((s) => s.beta_raw != null);

  // Per-fund baseline (theme rows share it): an L2 passive blend when one exists,
  // else the market. Names the bet honestly instead of always saying "market".
  const usesPassiveAlt = themes.some((t) => isPassiveAltBaseline(t.active_baseline));
  const baselineNounPhrase = usesPassiveAlt ? "its passive alternative" : "the market";
  const baselineShort = usesPassiveAlt ? "passive alt stripped" : "market stripped";

  return (
    <Card>
      <PanelHeading>What drives this fund</PanelHeading>
      {assessable ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Active β is the bet <em>beyond {baselineNounPhrase}</em> ({usesPassiveAlt
              ? "the fund's closest passive index blend"
              : "broad market"} exposure stripped out). A near-zero active β on a theme
            means the fund holds it only as much as {baselineNounPhrase} does —
            that&apos;s baseline exposure, not an active bet.
          </p>

          {/* Themes — the active-bet narrative the investor recognises. */}
          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Top theme bets <span className="text-gray-300">(active β, {baselineShort})</span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {themes.map((t) => (
                <ThemeBetaRow key={t.target_id} t={t} baselineNounPhrase={baselineNounPhrase} />
              ))}
            </ul>
            {isPassive && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                This fund is passive — its theme exposures are market beta, so the
                active βs sit near zero by design.
              </p>
            )}
          </div>
        </>
      ) : (
        // Active fund whose active-β baseline fell back to the market: the served
        // β is the market-baseline number, which would misread as an active bet.
        // Suppress the active-bet verdict; keep the market βs only as a labeled
        // transparency drawer, never as the headline reading.
        <div className="mt-2">
          <ActiveBetUnassessable what="bets" />
          {themes.length > 0 && (
            <Evidence summary="Show market-relative βs (transparency only — not an active-bet reading)">
              <ul className="space-y-0.5">
                {themes.map((t) => (
                  <li key={t.target_id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{themeLabel(t.target_id)}</span>
                    <span className="shrink-0 tabular-nums">
                      β vs market {fmtBeta(t.beta_active_mkt)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-gray-400">
                These are the fund&apos;s exposures relative to the broad market, not
                relative to its passive alternative — so they can&apos;t be read as
                active bets for this fund.
              </p>
            </Evidence>
          )}
        </div>
      )}

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
        {assessable ? (
          <>
            {" "}Active β is stripped of {baselineNounPhrase}
            {usesPassiveAlt
              ? " (the fund's L2 passive blend)"
              : ` (${betas.active_beta_control_model ?? "mkt_1f"})`}; style β = raw.
          </>
        ) : (
          <>
            {" "}This fund&apos;s passive alternative couldn&apos;t be priced over the
            return window, so an active-bet β vs that alternative isn&apos;t available
            yet; style β = raw.
          </>
        )}
        {" "}Method {betas.method_version ?? EM_DASH}.
      </AsOf>
    </Card>
  );
}

function ThemeBetaRow({
  t,
  baselineNounPhrase,
}: {
  t: FactorBetaRow;
  baselineNounPhrase: string;
}) {
  const b = factorBetaHeadline(t);
  const isBet = b != null && Math.abs(b) >= 0.05;
  // When the bet is near-zero, the fund just tracks the baseline on this theme —
  // name the baseline so it reads "passive-alt exposure" not "market exposure"
  // for L2-baseline funds.
  const baselineWord = baselineNounPhrase === "the market" ? "market" : "passive-alt";
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
        {!isBet && <span className="text-[11px] text-gray-400">{baselineWord} exposure</span>}
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
        {/* Both baselines, for transparency — headline picks the L2 blend when present. */}
        {isPassiveAltBaseline(t.active_baseline) && t.beta_active_l2 != null && (
          <li>
            Active β vs passive alt: {fmtBeta(t.beta_active_l2)}; vs market:{" "}
            {fmtBeta(t.beta_active_mkt)}
          </li>
        )}
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
  assessable,
}: {
  divergence: RiskAttributionData["exposure_divergence"];
  assessable: boolean;
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

  // Per-fund baseline (rows share it): the bet is measured vs the fund's passive
  // alternative (L2 blend) when one exists, else the broad market.
  const usesPassiveAlt = rows.some((r) => isPassiveAltBaseline(r.active_baseline));
  const baselineNounPhrase = usesPassiveAlt ? "its passive alternative" : "the market";

  // Active fund whose active-β baseline fell back to the market: the "active bet"
  // side of the comparison is the market-baseline β, which would misread as a real
  // active bet. Suppress the hold-vs-bet verdict; keep the holdings exposures (what
  // the fund actually owns) since those are a real, served measurement.
  if (!assessable) {
    const heldRows = rows.filter((r) => r.total_exposure_holdings != null);
    return (
      <Card>
        <PanelHeading>What you hold vs what you&apos;re betting on</PanelHeading>
        <div className="mt-2">
          <ActiveBetUnassessable what="divergence" />
        </div>
        {heldRows.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              What it holds <span className="text-gray-300">(% of assets)</span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {heldRows.map((r) => (
                <li
                  key={r.target_id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="truncate text-gray-700">{r.exposure_name}</span>
                  <span className="shrink-0 tabular-nums text-gray-700">
                    {fmtPct(r.total_exposure_holdings, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <AsOf>
          Holdings as of {divergence.holdings_as_of ?? EM_DASH}. We can show what the
          fund holds, but not yet how much of an active bet that represents vs its
          passive alternative — its matched index couldn&apos;t be priced over the
          return window.
        </AsOf>
      </Card>
    );
  }

  return (
    <Card>
      <PanelHeading>What you hold vs what you&apos;re betting on</PanelHeading>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        Two different measurements of the same exposure, never added: how much of
        a theme the fund <strong>holds</strong> (% of assets) versus how much of an
        active <strong>bet</strong> it&apos;s running on that theme (β vs{" "}
        {baselineNounPhrase}). Holding a lot of a theme isn&apos;t the same as
        betting on it.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="py-2 pr-3 font-medium">Theme</th>
              <th className="px-3 py-2 text-right font-medium">You hold</th>
              <th className="px-3 py-2 text-right font-medium">
                Active bet (β vs {usesPassiveAlt ? "passive alt" : "market"})
              </th>
              <th className="py-2 pl-3 text-right font-medium">Read</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <DivergenceTableRow key={r.target_id} r={r} baselineNounPhrase={baselineNounPhrase} />
            ))}
          </tbody>
        </table>
      </div>
      <AsOf>
        Active bet β is stripped of {baselineNounPhrase}
        {usesPassiveAlt ? " (the fund's L2 passive blend)" : ""}. Holdings as of{" "}
        {divergence.holdings_as_of ?? EM_DASH}; return-based exposures through{" "}
        {divergence.factor_eval_date ?? EM_DASH}. These are measured at different
        dates by design — the return regression is fresher because it needs only
        returns, not the (filing-lagged) holdings.
      </AsOf>
    </Card>
  );
}

function DivergenceTableRow({
  r,
  baselineNounPhrase,
}: {
  r: DivergenceRow;
  baselineNounPhrase: string;
}) {
  const isBet = r.divergence_state === "active_bet" || r.divergence_state === "active_bet_low_holdings";
  // Headline active β — stripped of the fund's NAMED baseline (its passive
  // alternative / L2 blend when one exists, else the market). This is the
  // artifact-free number; never lead with the raw market-stripped β.
  const headlineBeta = divergenceHeadlineBeta(r);
  // Plain-English read, driven off divergence_state (never conflate the two
  // numbers). For an index fund: "<baseline> exposure, not an active bet."
  let read: string;
  if (r.divergence_state === "exposure_no_active_bet") {
    read = `Matches ${baselineNounPhrase}, not an active bet`;
  } else if (r.divergence_state === "active_bet") {
    read =
      (headlineBeta ?? 0) > 0
        ? `Overweight bet vs ${baselineNounPhrase}`
        : `Underweight bet vs ${baselineNounPhrase}`;
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
            !isBet ? "text-gray-400" : (headlineBeta ?? 0) > 0 ? "text-sky-700" : "text-rose-700"
          }`}
        >
          {fmtBeta(headlineBeta)}
        </span>
      </td>
      <td className="py-2 pl-3 text-right">
        <span
          className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${divergenceStateChip(r.divergence_state)}`}
        >
          {divergenceStateLabel(r.divergence_state, r.active_baseline)}
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
            What&apos;s left after the factor and theme bets over this short
            holdings window. On its own this is <strong>not</strong> a gross-alpha
            or skill claim — a short-window idiosyncratic residual does not persist
            and can even disagree in sign with the long-run returns-based read. For
            whether the manager has an edge, defer to the Selection Evidence skill
            verdict (P(positive skill) and the gross information ratio).
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
