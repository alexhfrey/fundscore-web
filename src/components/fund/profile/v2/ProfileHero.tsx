// ============================================================================
// 01 · ProfileHero — identity grid + the value verdict (NO 0-100 gauge; owner
// removed it). Server component. The verdict reads off the ALREADY-GATED served
// valueScore: the breakeven sign + passive alternative are public; the precise
// "+X bps/yr" figure is paid (nulled by applyGates below the paid tier).
// ============================================================================
import {
  breakevenStateChip,
  breakevenStateChipLabel,
  coverageStateLabel,
  coverageStateReason,
  fmtSignedBps,
  fmtDate,
  pctFromBps,
  EM_DASH,
  type BreakevenState,
} from "@/lib/serving/format";
import type { Identity, ValueScore } from "@/lib/serving/profile";
import { UnlockLine } from "../primitives";

interface FeesLite {
  net_expense_ratio_bps?: number | null;
  fair_fee?: { passive_fee_bps?: number | null } | null;
}

export function ProfileHero({
  identity,
  requestedTicker,
  valueScore,
  fees,
  holdingsAsOf,
  holdingsStale,
}: {
  identity: Identity;
  requestedTicker: string;
  valueScore: ValueScore | null;
  fees: FeesLite | null;
  holdingsAsOf: string | null;
  holdingsStale?: boolean;
}) {
  const ticker = identity.ticker ?? requestedTicker.toUpperCase();
  const vs = valueScore;
  const scored = vs?.coverage_state === "scored";
  const state = (vs?.breakeven_state ?? null) as BreakevenState | null;
  const passive = vs?.passive_alt_label ?? identity.primary_benchmark ?? null;

  const netFee = fees?.net_expense_ratio_bps ?? null;
  const passiveFee = fees?.fair_fee?.passive_fee_bps ?? vs?.passive_alt_fee_bps ?? null;
  const hasPrecise = vs != null && vs.value_bps != null;

  const tags = [identity.vehicle_type, identity.management_style, identity.asset_class]
    .filter(Boolean)
    .map((t) => String(t));

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Masthead */}
      <div className="px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{ticker}</h1>
          <span className="text-xl text-gray-600">{identity.fund_name}</span>
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-600"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-gray-500">
          {identity.latest_nav != null && (
            <span>
              NAV{" "}
              <span className="font-semibold text-gray-900">
                ${identity.latest_nav.toFixed(2)}
              </span>
            </span>
          )}
          {identity.aum_usd != null && (
            <span>
              AUM{" "}
              <span className="font-semibold text-gray-900">
                ${(identity.aum_usd / 1e9).toFixed(1)}B
              </span>
            </span>
          )}
          {identity.holdings_count != null && (
            <span>
              Holdings{" "}
              <span className="font-semibold text-gray-900">{identity.holdings_count}</span>
            </span>
          )}
          {holdingsAsOf && (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Holdings filed with a lag · as of {fmtDate(holdingsAsOf)}
              {holdingsStale ? " · stale" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Body: identity grid (left) + verdict (right) */}
      <div className="grid border-t border-gray-100 md:grid-cols-2">
        <div className="border-b border-gray-100 px-6 py-5 md:border-b-0 md:border-r">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
            Identity
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[13px]">
            <IdRow k="Fund family" v={identity.fund_family} />
            <IdRow
              k="Asset class"
              v={[identity.asset_class, identity.peer_group].filter(Boolean).join(" · ") || null}
            />
            <IdRow
              k="Fee (net expense ratio)"
              v={netFee != null ? `${pctFromBps(netFee)} / yr` : null}
            />
            <IdRow
              k="Closest passive alternative"
              v={passive}
              sub={passiveFee != null ? `· ${pctFromBps(passiveFee)}/yr` : undefined}
            />
            <IdRow k="Inception (share class)" v={fmtDate(identity.inception_date)} />
          </dl>
        </div>

        <div className="bg-gray-50/70 px-6 py-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Net value vs its closest passive alternative
          </div>
          {scored ? (
            <div className="mt-2.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {hasPrecise ? (
                  <span className="text-4xl font-extrabold tabular-nums text-gray-900">
                    {fmtSignedBps(vs!.value_bps)}
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {EM_DASH}
                  </span>
                )}
                <span className="text-sm font-medium text-gray-500">
                  {hasPrecise ? "/yr " : ""}
                  vs {passive ?? "its passive alternative"} · after fees
                </span>
              </div>
              <span
                className={`mt-3 inline-flex items-center rounded-md border px-2.5 py-1 text-[13px] font-semibold ${breakevenStateChip(state)}`}
              >
                {breakevenStateChipLabel(state)} after fees — not a win, not a loss
              </span>

              {/* FCNTX vs the base rate — the median scored active fund runs below
                  breakeven, so breakeven is a better-than-most outcome. The −80
                  median is a cohort base rate (like the "1 in 5 clears breakeven"
                  line the hero already carries), labeled as context, not the
                  fund's own figure. */}
              <dl className="mt-4 border-t border-dashed border-gray-200 text-[12.5px]">
                <AnchorRow
                  k={`${ticker} — after fees, vs ${passive ?? "its passive alt"}`}
                  v={hasPrecise ? `${fmtSignedBps(vs!.value_bps)}/yr` : EM_DASH}
                  tone={state}
                />
                <AnchorRow
                  k="Median scored active fund — vs its own passive alternative"
                  v="−80 bps/yr"
                  tone="below"
                  base
                />
              </dl>
              <p className="mt-3 text-[12.5px] leading-relaxed text-gray-500">
                Most active funds don&apos;t earn their fee back — the median
                scored active fund runs about −80 bps/yr — so breakeven is a
                better-than-most outcome. A backward-looking read; not a
                recommendation or a return forecast.
              </p>
              {!hasPrecise && (
                <UnlockLine tier="paid">
                  See the exact net figure and the fee-vs-excess math.
                </UnlockLine>
              )}
            </div>
          ) : (
            <div className="mt-2.5">
              <p className="text-[15px] font-semibold text-gray-900">
                {coverageStateLabel(vs?.coverage_state)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {coverageStateReason(vs?.coverage_state, passive)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer: the cost line — the question the whole dossier answers. */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-6 py-4">
        <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-gray-200 text-[13px]">
          <CostSeg k="You pay" v={netFee != null ? `${pctFromBps(netFee)}/yr` : EM_DASH} />
          <CostSeg
            k={passive ?? "passive"}
            v={passiveFee != null ? `${pctFromBps(passiveFee)}/yr` : EM_DASH}
          />
          <CostSeg
            k="net value after fees"
            v={hasPrecise ? `${fmtSignedBps(vs!.value_bps)}/yr` : EM_DASH}
            emphasis
          />
        </div>
        <p className="min-w-[220px] flex-1 text-[12.5px] leading-relaxed text-gray-500">
          The whole dossier answers one question:{" "}
          <span className="font-medium text-gray-700">
            what are you getting for your fees versus just holding{" "}
            {passive ?? "the index"}
            {passiveFee != null ? ` at ${pctFromBps(passiveFee)}` : ""}?
          </span>
          <br />
          <span className="text-[11px] text-amber-700">
            {vs?.as_of_date ? `Score inputs as of ${fmtDate(vs.as_of_date)}; ` : ""}
            the score&apos;s fee input predates the latest fee correction — score
            refresh pending.
          </span>
        </p>
      </div>
    </div>
  );
}

function IdRow({ k, v, sub }: { k: string; v: string | null; sub?: string }) {
  return (
    <>
      <dt className="whitespace-nowrap font-medium text-gray-500">{k}</dt>
      <dd className="font-semibold text-gray-900">
        {v ?? EM_DASH}
        {sub && <span className="ml-1 font-normal text-gray-400">{sub}</span>}
      </dd>
    </>
  );
}

function AnchorRow({
  k,
  v,
  tone,
  base,
}: {
  k: string;
  v: string;
  tone: BreakevenState | null;
  base?: boolean;
}) {
  const color =
    tone === "above" ? "text-emerald-700" : tone === "below" ? "text-amber-700" : "text-slate-700";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-gray-200 py-2 last:border-0">
      <span className="text-gray-500">
        {k}
        {base && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">base rate</span>}
      </span>
      <span className={`shrink-0 font-bold tabular-nums ${color}`}>{v}</span>
    </div>
  );
}

function CostSeg({ k, v, emphasis }: { k: string; v: string; emphasis?: boolean }) {
  return (
    <div
      className={`flex items-baseline gap-1.5 border-r border-gray-200 px-4 py-2 last:border-r-0 ${
        emphasis ? "bg-gray-50" : ""
      }`}
    >
      <span className="text-[12px] text-gray-500">{k}</span>
      <span className="font-bold tabular-nums text-gray-900">{v}</span>
    </div>
  );
}
