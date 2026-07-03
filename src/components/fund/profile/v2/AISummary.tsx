// ============================================================================
// 02 · AISummary — the dossier in three paragraphs. Server component; a FIXTURE
// block, so it carries a visible Sample chip and NO methodology link.
// Gating: the first sentence is public; the full summary is free. `full` is
// resolved server-side, so anon never receives the withheld paragraphs.
// ============================================================================
import type { AiSummary } from "@/lib/serving/profile-v2";
import { ChapterHeader, SampleChip, SampleProvenance } from "./primitives";
import { Unavailable, UnlockLine } from "../primitives";

/** First sentence of a paragraph (for the public teaser). */
function firstSentence(p: string): string {
  const m = /^(.*?[.!?])(\s|$)/.exec(p);
  return m ? m[1] : p;
}

export function AISummary({
  summary,
  full,
}: {
  summary: AiSummary | null;
  full: boolean;
}) {
  if (!summary || !summary.paragraphs || summary.paragraphs.length === 0) {
    return (
      <section id="s2" className="scroll-mt-24">
        <ChapterHeader index={2} title="Summary" />
        <Unavailable>
          An automated summary isn&apos;t available for this fund yet.
        </Unavailable>
      </section>
    );
  }

  const paragraphs = full
    ? summary.paragraphs
    : [firstSentence(summary.paragraphs[0])];

  return (
    <section id="s2" className="scroll-mt-24">
      <ChapterHeader
        index={2}
        title="Summary"
        asOf="grounded in the sections below"
        takeaway={
          <>
            The dossier in three paragraphs — verdict, the bets, the risk
            profile.{" "}
            <span className="font-normal text-gray-500">
              Every number here reappears with its evidence in the sections below.
            </span>
          </>
        }
        sample
      />

      <div className="mt-4 rounded-xl border border-gray-200 border-l-4 border-l-gray-900 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SampleChip>Sample · AI-generated copy</SampleChip>
          <span className="text-[11.5px] text-gray-500">
            Sample content — automated summaries are in development
          </span>
        </div>
        <div className="space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-gray-800">
              {p}
            </p>
          ))}
        </div>
        {!full && (
          <UnlockLine tier="free">
            Read the full three-paragraph summary — verdict, the bets and the risk
            profile.
          </UnlockLine>
        )}
        <p className="mt-4 text-[11.5px] leading-relaxed text-gray-400">
          AI-generated from FundScore&apos;s data. No figure is written free-form —
          each is drawn from the evidence sections below (performance ·
          attribution &amp; skill · positioning · changes · fees · family).
        </p>
        <SampleProvenance label={summary.sample_label} />
      </div>
    </section>
  );
}
