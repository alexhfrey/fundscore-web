// ============================================================================
// FundScore Takeaways (spec #8 / 3b) — template-backed evidence bullets,
// grouped under customer-safe labels. No freeform prose; each bullet carries an
// evidence drawer. The Take (3a) renders in the hero.
// ============================================================================
import { Section, Card, Evidence } from "./primitives";

interface TakeawayItem {
  takeaway_id: string;
  takeaway_type: "stands_out" | "paying_for" | "inspect_closely";
  takeaway_tone: string;
  takeaway_category: string;
  display_text: string;
  source_field_ids?: string[];
  as_of_dates?: { field_id: string; as_of_date: string | null }[];
  method_version?: string;
}

const GROUP_LABEL: Record<string, string> = {
  stands_out: "What stands out",
  paying_for: "What you are paying for",
  inspect_closely: "What to inspect closely",
};
const GROUP_ORDER = ["stands_out", "paying_for", "inspect_closely"];

const TONE_DOT: Record<string, string> = {
  positive: "bg-emerald-400",
  negative: "bg-rose-400",
  caveat: "bg-amber-400",
  neutral: "bg-gray-300",
};

export function Takeaways({ items }: { items: unknown[] | null }) {
  const takeaways = (items ?? []) as TakeawayItem[];
  // Spec: hide module entirely if fewer than two validated bullets.
  if (takeaways.length < 2) return null;

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABEL[g],
    rows: takeaways.filter((t) => t.takeaway_type === g),
  })).filter((g) => g.rows.length > 0);

  return (
    <Section
      id="takeaways"
      title="Takeaways"
      subtitle="What FundScore's analysis of this fund surfaces — each point traces to source data."
      methodologyAnchor="takeaways"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {grouped.map((g) => (
          <Card key={g.group} className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {g.label}
            </h3>
            <ul className="mt-2 space-y-3">
              {g.rows.map((t) => (
                <li key={t.takeaway_id} className="text-sm leading-relaxed text-gray-800">
                  <span className="flex gap-2">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        TONE_DOT[t.takeaway_tone] ?? "bg-gray-300"
                      }`}
                    />
                    <span>{t.display_text}</span>
                  </span>
                  {t.as_of_dates && t.as_of_dates.length > 0 && (
                    <Evidence summary="evidence">
                      <ul className="space-y-0.5">
                        {t.as_of_dates.map((a, i) => (
                          <li key={i}>
                            {a.field_id}
                            {a.as_of_date ? ` — as of ${a.as_of_date}` : ""}
                          </li>
                        ))}
                        {t.method_version && (
                          <li className="text-gray-400">method {t.method_version}</li>
                        )}
                      </ul>
                    </Evidence>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Section>
  );
}
