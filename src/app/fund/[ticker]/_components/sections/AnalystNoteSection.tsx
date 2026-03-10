import { FundDetail } from "@/lib/types";
import { AnalystNote } from "@/components/fund/AnalystNote";

interface AnalystNoteSectionProps {
  fund: FundDetail;
}

export function AnalystNoteSection({ fund }: AnalystNoteSectionProps) {
  return <AnalystNote note={fund.analystNote} />;
}
