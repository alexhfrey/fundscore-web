// ============================================================================
// Crescent v2 — Step 2 geometry test page. DB-independent by design: the only
// imports are CrescentMark (Task A) and nothing else fund/serving-adjacent, so
// this route renders under `npm run dev` with no database configured. Not
// linked from product nav — reached only by typing the URL.
// ============================================================================
import type { Metadata } from "next";
import { CrescentMark } from "@/components/fund/profile/v2/crescent/CrescentMark";

export const metadata: Metadata = {
  title: "Crescent geometry test",
  robots: { index: false, follow: false },
};

function pct(fill: number | null): string {
  return fill == null ? "null" : `${(fill * 100).toFixed(1)}%`;
}

function MarkCell({
  fill,
  fhatch,
  orientDeg,
  size,
  variant,
  label,
}: {
  fill: number | null;
  fhatch?: number | null;
  orientDeg?: number;
  size: number;
  variant?: "hero" | "anatomy";
  label: string;
}) {
  const ariaLabel =
    fill == null
      ? "Crescent: locked, no fill scored"
      : `Crescent: ${pct(fill)} gold fill`;
  return (
    <div className="flex flex-col items-center gap-2">
      <CrescentMark
        fill={fill}
        fhatch={fhatch}
        orientDeg={orientDeg}
        size={size}
        ariaLabel={ariaLabel}
        variant={variant}
      />
      <p className="whitespace-pre text-center font-mono text-[10.5px] leading-tight text-gray-500">
        {label}
      </p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</h2>
      {note && <p className="mt-1 max-w-[70ch] text-xs text-gray-500">{note}</p>}
      <div className="mt-4 flex flex-wrap items-end gap-8 rounded-xl border border-gray-200 bg-white p-6">
        {children}
      </div>
    </section>
  );
}

const FILL_SCALE: { fill: number | null; label: string }[] = [
  { fill: 0.02, label: "f=0.020" },
  { fill: 0.052, label: "f=0.052\n(FCNTX)" },
  { fill: 0.109, label: "f=0.109\n(median)" },
  { fill: 0.249, label: "f=0.249\n(JEPSX /\nscale ceiling)" },
  { fill: 0.5, label: "f=0.500\n(geometry\nstress —\nbeyond real\nscale)" },
  { fill: 0.8, label: "f=0.800\n(geometry\nstress —\nbeyond real\nscale)" },
  { fill: null, label: "f=null\n(locked)" },
];

const ORIENTATIONS: { orientDeg: number; label: string }[] = [
  { orientDeg: 40, label: "orient=+40\n(sector)" },
  { orientDeg: -40, label: "orient=−40\n(style)" },
  { orientDeg: 140, label: "orient=+140\n(theme)" },
  { orientDeg: -140, label: "orient=−140\n(country)" },
];

const HATCHES: number[] = [0.05, 0.125, 0.25];

const SMALL_SIZES: { size: number; fills: (number | null)[] }[] = [
  { size: 56, fills: [null, 0.109, 0.249] },
  { size: 28, fills: [null, 0.109, 0.249] },
];

export default function CrescentGeometryTestPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-xs text-amber-800">
        Dev-only geometry test page. Not linked from product navigation, no DB
        or fixture data — renders the Crescent mark (Step 2 canvas port)
        directly against fixed prop values to check the port&apos;s geometry
        and theme/palette redraw behavior.
      </div>

      <h1 className="mb-6 text-2xl font-bold text-gray-900">Crescent mark — geometry test</h1>

      <Section
        title="Fill scale (188px, hero variant)"
        note="Area-honest gold phase across the real observed range plus two geometry-stress values (0.5, 0.8) beyond any real fund's scale, and the null/locked state."
      >
        {FILL_SCALE.map((row) => (
          <MarkCell key={row.label} fill={row.fill} size={188} label={row.label} />
        ))}
      </Section>

      <Section
        title="Orientation (188px, hero variant, f=0.25)"
        note="One rotation per dominant-tilt axis detent — sector +40°, style −40°, theme +140°, country −140° (src/lib/crescent.ts DETENT)."
      >
        {ORIENTATIONS.map((row) => (
          <MarkCell key={row.label} fill={0.25} orientDeg={row.orientDeg} size={188} label={row.label} />
        ))}
      </Section>

      <Section
        title="Anatomy variant (188px, f=0.25)"
        note="45° hatch overlay clipped to the moon-phase shape at fhatch (the nameable/factor share of the gold fill)."
      >
        {HATCHES.map((fh) => (
          <MarkCell
            key={fh}
            fill={0.25}
            fhatch={fh}
            size={188}
            variant="anatomy"
            label={`f=0.250\nfhatch=${fh.toFixed(3)}`}
          />
        ))}
      </Section>

      {SMALL_SIZES.map((row) => (
        <Section key={row.size} title={`Small size — ${row.size}px (ring/limb legibility)`}>
          {row.fills.map((f) => (
            <MarkCell key={`${row.size}-${pct(f)}`} fill={f} size={row.size} label={`${row.size}px\nf=${pct(f)}`} />
          ))}
        </Section>
      ))}
    </div>
  );
}
