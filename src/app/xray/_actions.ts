"use server";

import { compareFunds } from "@/lib/data";
import type { FundDetail } from "@/lib/types";

export async function fetchXRayFunds(
  tickers: string[],
): Promise<FundDetail[]> {
  return compareFunds(tickers);
}
