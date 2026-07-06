// ============================================================================
// Investor Fit (page spec § 2) — "may appeal to / less compelling if" tags
// derived from the fund's validated bet profile and skill band. Describes the
// FUND, never the reader (no personalization). No advice language.
// ============================================================================
import { Section, Card } from "./primitives";
import { Chip } from "./primitives";
import type { ValueOfferingReframed } from "@/lib/serving/profile";

export function InvestorFit({ vr }: { vr: ValueOfferingReframed | null }) {
  if (!vr || vr.status !== "scored") return null;

  const tags: string[] = [];
  if (vr.bet_tag) tags.push(vr.bet_tag);
  // Named bets become recognizable fit tags (top 3 by |active weight|).
  const bets = (vr.named_bets ?? [])
    .filter((b) => b.active_weight_pp != null)
    .sort((a, b) => Math.abs(b.active_weight_pp!) - Math.abs(a.active_weight_pp!))
    .slice(0, 3);
  for (const b of bets) {
    const dir = (b.active_weight_pp ?? 0) >= 0 ? "more" : "less";
    tags.push(`${dir} ${b.bet_name}`);
  }
  if (vr.replicability?.idio_risk_share != null && vr.replicability.idio_risk_share < 0.35) {
    tags.push("mostly a sector/theme bet");
  }
  const dedup = Array.from(new Set(tags)).slice(0, 6);

  const appeal =
    vr.bet_tag != null
      ? `May appeal to investors who specifically want ${vr.bet_tag} exposure and accept relying on the manager's positioning.`
      : "May appeal to investors who want this fund's specific exposure profile.";
  const less =
    vr.skill_band === "unproven" || vr.skill_band === "limited"
      ? "Less compelling if you mainly want broad market exposure at the lowest available cost, given the selection evidence is not yet established."
      : "Less compelling if you mainly want broad market exposure at the lowest available cost.";

  return (
    <Section id="investor-fit" title="Investor Fit" subtitle="Who this fund may suit — based on what it owns, not on you.">
      <Card>
        <div className="flex flex-wrap gap-2">
          {dedup.map((t) => (
            <Chip key={t} className="border-gray-200 bg-gray-50 capitalize text-gray-700">
              {t}
            </Chip>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-gray-700">{appeal}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{less}</p>
      </Card>
    </Section>
  );
}
