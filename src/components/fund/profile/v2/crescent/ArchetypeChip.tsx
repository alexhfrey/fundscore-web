"use client";

// ============================================================================
// ArchetypeChip — the archetype badge + its collapsible "one click from the
// number that earned it" cutoffs panel. Client island: only the
// expand/collapse toggle needs interactivity.
// ----------------------------------------------------------------------------
// Ported from the design source of truth:
//   fund_score/docs/product/strategy/mockup_fund_profile_crescent.html
//   renderHero's chip build (~L730-732) + renderArchPanel (~L734-761).
// CONCEPT fixture data only (crescent-archetypes.ts) — never fabricated,
// never shown outside the "scored" state (caller's responsibility), and every
// number here traces to a field already on ArchetypeFixture/ArchetypeRulesFixture.
// ============================================================================
import { useState } from "react";
import type { ArchetypeFixture, ArchetypeRulesFixture } from "@/lib/fixtures/crescent-archetypes";
import { EM_DASH } from "@/lib/serving/format";
import { ProtoChip, SampleProvenance } from "../primitives";

/** Mirrors the mockup's dv computation (renderArchPanel ~L738-739): the
 *  fixture's OWN recorded deciding value at classification time — a
 *  provenance figure, distinct from the fund's live replica_r2-derived fill
 *  shown on the chip itself (which always comes from fillPctStr, passed in). */
function decidingValueStr(fixture: ArchetypeFixture): string {
  return fixture.deciding_metric === "fill"
    ? `${(fixture.deciding_value * 100).toFixed(1)}%`
    : fixture.deciding_value.toFixed(2);
}

export function ArchetypeChip({
  fixture,
  rules,
  ticker,
  fillPct,
}: {
  fixture: ArchetypeFixture;
  rules: ArchetypeRulesFixture;
  ticker: string;
  /** The fund's live fill%, from the SAME fillPctStr call the verdict
   *  sentence and Crescent mark use — never re-derived here, so the chip's
   *  own "fill X%" can never disagree with the rest of the hero. */
  fillPct: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `crescent-archetype-panel-${ticker}`;

  const rule = rules.rule_table.find((r) => r.archetype === fixture.archetype) ?? null;
  const neighborRule = fixture.neighbor_label
    ? (rules.rule_table.find((r) => r.archetype === fixture.neighbor_label) ?? null)
    : null;
  const [classifierName, classifierRunDate] = fixture.classifier_version
    .split(",")
    .map((s) => s.trim());

  return (
    <div className="mt-3 flex w-full flex-col items-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 font-mono text-[12px] text-gray-700 hover:border-gray-300"
        >
          <span
            className={`inline-block text-[9px] text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="font-semibold text-gray-900">{fixture.archetype}</span>
          {fillPct != null && <span>· fill {fillPct}%</span>}
          {fixture.borderline && (
            <span className="rounded-full border border-crescent-accent/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-crescent-accent-text">
              borderline
            </span>
          )}
        </button>
        <ProtoChip>
          {classifierName}
          {classifierRunDate ? ` · ${classifierRunDate}` : ""}
        </ProtoChip>
      </div>

      {open && (
        <div
          id={panelId}
          className="mt-3 w-full max-w-2xl rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-left"
        >
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-gray-400">
            The archetype — one click from the number that earned it
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
            <b className="text-gray-900">{ticker}</b> is labeled{" "}
            <b className="text-gray-900">{fixture.archetype}</b> by its deciding metric:{" "}
            {rule?.deciding_metric ?? EM_DASH} ={" "}
            <b className="tabular-nums text-gray-900">{decidingValueStr(fixture)}</b>, against the
            published rule &ldquo;{rule?.rule ?? EM_DASH}&rdquo;.
            {fixture.borderline && (
              <>
                {" "}It is <b className="text-gray-900">borderline</b>: {rules.borderline_definition}.
              </>
            )}
            {fixture.neighbor_label && (
              <>
                {" "}The neighboring label is {fixture.neighbor_label}
                {neighborRule?.rule ? ` (“${neighborRule.rule}”)` : ""}.
              </>
            )}
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="py-1.5 pr-3">#</th>
                  <th className="py-1.5 pr-3">Archetype</th>
                  <th className="py-1.5 pr-3">Published rule</th>
                  <th className="py-1.5 pr-3">Universe share</th>
                  <th className="py-1.5">Borderline share</th>
                </tr>
              </thead>
              <tbody>
                {rules.rule_table.map((r) => (
                  <tr
                    key={r.archetype}
                    className={`border-b border-gray-100 align-top text-gray-600 ${
                      r.archetype === fixture.archetype ? "bg-amber-50/70 text-gray-900" : ""
                    }`}
                  >
                    <td className="py-1.5 pr-3 font-mono">{r.priority ?? EM_DASH}</td>
                    <td className="py-1.5 pr-3 font-medium">{r.archetype}</td>
                    <td className="py-1.5 pr-3">{r.rule ?? EM_DASH}</td>
                    <td className="py-1.5 pr-3 font-mono">
                      {r.universe_share_pct.toFixed(1)}% ({r.universe_n})
                    </td>
                    <td className="py-1.5 font-mono">
                      {r.priority == null ? EM_DASH : `${r.borderline_share_pct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 font-mono text-[10.5px] leading-relaxed text-gray-400">
            Classifier: {fixture.classifier_version}. Rules run over the {rules.method_version}{" "}
            value-score spine, as-of {rules.spine_as_of} · N={rules.universe_N} EQ active series ·
            borderline overall {rules.borderline_overall_pct}%.
          </p>
          <SampleProvenance label={fixture.sample_label} />
        </div>
      )}
    </div>
  );
}
