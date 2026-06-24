// ============================================================================
// Identity strip + passive baseline strip (page spec § 1 + first viewport).
// Public. Numbers only — em-dash when missing, never a guessed value.
// ============================================================================
import { fmtAum, fmtDate, EM_DASH } from "@/lib/serving/format";
import type { Identity } from "@/lib/serving/profile";

export function IdentityStrip({
  identity,
  requestedTicker,
  holdingsAsOf,
}: {
  identity: Identity;
  requestedTicker: string;
  holdingsAsOf: string | null;
}) {
  const tags = [
    identity.fund_family,
    identity.vehicle_type,
    identity.management_style,
    identity.asset_class,
    identity.peer_group,
  ].filter(Boolean) as string[];

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-3xl font-bold text-gray-900">
          {identity.ticker ?? requestedTicker.toUpperCase()}
        </h1>
        <span className="text-xl text-gray-600">{identity.fund_name}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-100 px-2.5 py-1 font-medium capitalize text-gray-600"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Latest NAV"
          value={identity.latest_nav != null ? `$${identity.latest_nav.toFixed(2)}` : EM_DASH}
        />
        <Stat label="AUM" value={fmtAum(identity.aum_usd)} />
        <Stat
          label="Holdings"
          value={identity.holdings_count != null ? `${identity.holdings_count}` : EM_DASH}
          sub={holdingsAsOf ? `as of ${fmtDate(holdingsAsOf)}` : undefined}
        />
        <Stat label="Inception" value={fmtDate(identity.inception_date)} />
      </div>

      {(identity.objective_text || identity.strategy_text) && (
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-500">
          {(identity.objective_text ?? identity.strategy_text ?? "").slice(0, 320)}
          {(identity.objective_text ?? identity.strategy_text ?? "").length > 320 ? "…" : ""}
        </p>
      )}
    </header>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}
