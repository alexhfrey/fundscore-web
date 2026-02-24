export interface PerformanceData {
  monthlyReturns: MonthlyReturn[];
  trailingReturns: TrailingReturns;
  calendarYearReturns: CalendarYearReturn[];
  benchmarkMonthlyReturns: MonthlyReturn[];
  passiveAltMonthlyReturns: MonthlyReturn[];
  categoryAvgMonthlyReturns: MonthlyReturn[];
}

export interface MonthlyReturn {
  date: string;
  value: number;
}

export interface TrailingReturns {
  oneMonth: number;
  threeMonth: number;
  sixMonth: number;
  ytd: number;
  oneYear: number;
  threeYear: number;
  fiveYear: number;
  tenYear: number | null;
  sinceInception: number;
}

export interface CalendarYearReturn {
  year: number;
  fundReturn: number;
  benchmarkReturn: number;
  passiveAltReturn: number;
  categoryAvgReturn: number;
}
