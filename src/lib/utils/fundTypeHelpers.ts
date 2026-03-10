import { AssetClassCode } from "../types";

export type FundType = "equity" | "fixedIncome" | "allocation" | "specialty";

export function getFundType(assetClass: AssetClassCode): FundType {
  switch (assetClass) {
    case "EQ":
      return "equity";
    case "FI":
    case "MU":
      return "fixedIncome";
    case "MA":
      return "allocation";
    case "ALT":
    case "RE":
    case "OT":
      return "specialty";
  }
}

export function isFixedIncome(assetClass: AssetClassCode): boolean {
  return assetClass === "FI" || assetClass === "MU";
}

export function isAllocation(assetClass: AssetClassCode): boolean {
  return assetClass === "MA";
}
