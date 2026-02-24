export interface FeeData {
  expenseRatio: number;
  managementFee: number;
  twelveBOneOne: number;
  otherExpenses: number;
  frontLoad: number;
  deferredLoad: number;
  redemptionFee: number;
  categoryAvgExpenseRatio: number;
  feeLevel: "Low" | "Below Average" | "Average" | "Above Average" | "High";
}
