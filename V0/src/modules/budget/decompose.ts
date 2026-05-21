/**
 * Budget decomposition: annual → quarterly → monthly → weekly
 * All allocations proportional to calendar days by default.
 * Manual overrides are applied after proportional split and stored separately.
 */

export type PeriodType = 'annual' | 'quarterly' | 'monthly' | 'weekly';

export type BudgetPeriodInput = {
  period_type: PeriodType;
  period_label: string;
  start_date: string;  // ISO date 'YYYY-MM-DD'
  end_date: string;    // ISO date 'YYYY-MM-DD'
  planned_paise: number;
};

export type DecomposeResult = {
  annual: BudgetPeriodInput[];
  quarterly: BudgetPeriodInput[];
  monthly: BudgetPeriodInput[];
  weekly: BudgetPeriodInput[];
};

// Indian FY: Apr 1 – Mar 31 of the following year
export function fyStartDate(fyYear: number): Date {
  return new Date(Date.UTC(fyYear, 3, 1));  // April = month 3 (0-indexed)
}

export function fyEndDate(fyYear: number): Date {
  return new Date(Date.UTC(fyYear + 1, 2, 31));  // March = month 2 of next year
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0] as string;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

// Distribute totalPaise proportionally across buckets by their day counts.
// Ensures sum equals totalPaise (last bucket absorbs rounding remainder).
function proportionalSplit(totalPaise: number, dayCounts: number[]): number[] {
  const totalDays = dayCounts.reduce((a, b) => a + b, 0);
  const result: number[] = [];
  let allocated = 0;
  for (let i = 0; i < dayCounts.length; i++) {
    if (i === dayCounts.length - 1) {
      result.push(totalPaise - allocated);
    } else {
      const share = Math.floor((dayCounts[i]! / totalDays) * totalPaise);
      result.push(share);
      allocated += share;
    }
  }
  return result;
}

// Returns quarters for Indian FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
function fyQuarters(fyYear: number): Array<{ start: Date; end: Date; label: string }> {
  return [
    {
      start: new Date(Date.UTC(fyYear, 3, 1)),
      end: new Date(Date.UTC(fyYear, 5, 30)),
      label: `Q1 FY${fyYear}`,
    },
    {
      start: new Date(Date.UTC(fyYear, 6, 1)),
      end: new Date(Date.UTC(fyYear, 8, 30)),
      label: `Q2 FY${fyYear}`,
    },
    {
      start: new Date(Date.UTC(fyYear, 9, 1)),
      end: new Date(Date.UTC(fyYear, 11, 31)),
      label: `Q3 FY${fyYear}`,
    },
    {
      start: new Date(Date.UTC(fyYear + 1, 0, 1)),
      end: new Date(Date.UTC(fyYear + 1, 2, 31)),
      label: `Q4 FY${fyYear}`,
    },
  ];
}

// Returns all 12 months in Indian FY order (Apr–Mar)
function fyMonths(fyYear: number): Array<{ start: Date; end: Date; label: string }> {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Apr (3) through Mar (2) of next year
  const months: Array<{ start: Date; end: Date; label: string }> = [];
  for (let m = 3; m <= 11; m++) {
    const start = new Date(Date.UTC(fyYear, m, 1));
    const end = new Date(Date.UTC(fyYear, m + 1, 0));
    months.push({ start, end, label: `${MONTH_NAMES[m]} ${fyYear}` });
  }
  // Jan, Feb, Mar of next year
  for (let m = 0; m <= 2; m++) {
    const start = new Date(Date.UTC(fyYear + 1, m, 1));
    const end = new Date(Date.UTC(fyYear + 1, m + 1, 0));
    months.push({ start, end, label: `${MONTH_NAMES[m]} ${fyYear + 1}` });
  }
  return months;
}

// Generates 52 ISO weeks starting from the FY start date.
// Weeks are Mon-Sun; we anchor to the FY start date and step 7 days.
// The 52nd week absorbs any remaining days.
function fyWeeks(fyYear: number): Array<{ start: Date; end: Date; label: string }> {
  const fyStart = fyStartDate(fyYear);
  const fyEnd = fyEndDate(fyYear);
  const weeks: Array<{ start: Date; end: Date; label: string }> = [];

  let cursor = fyStart;
  let weekNum = 1;
  while (weekNum <= 52) {
    const weekEnd = weekNum < 52 ? addDays(cursor, 6) : fyEnd;
    weeks.push({
      start: cursor,
      end: weekEnd,
      label: `Week ${String(weekNum).padStart(2, '0')} FY${fyYear}`,
    });
    cursor = addDays(weekEnd, 1);
    weekNum++;
    if (cursor > fyEnd) break;
  }
  return weeks;
}

export function decomposeBudget(fyYear: number, totalPaise: number): DecomposeResult {
  const fyStart = fyStartDate(fyYear);
  const fyEnd = fyEndDate(fyYear);

  const annual: BudgetPeriodInput[] = [
    {
      period_type: 'annual',
      period_label: `Annual FY${fyYear}`,
      start_date: toISODate(fyStart),
      end_date: toISODate(fyEnd),
      planned_paise: totalPaise,
    },
  ];

  const quarters = fyQuarters(fyYear);
  const quarterDays = quarters.map((q) => daysBetween(q.start, q.end));
  const quarterAmounts = proportionalSplit(totalPaise, quarterDays);
  const quarterly: BudgetPeriodInput[] = quarters.map((q, i) => ({
    period_type: 'quarterly',
    period_label: q.label,
    start_date: toISODate(q.start),
    end_date: toISODate(q.end),
    planned_paise: quarterAmounts[i]!,
  }));

  const months = fyMonths(fyYear);
  const monthDays = months.map((m) => daysBetween(m.start, m.end));
  const monthAmounts = proportionalSplit(totalPaise, monthDays);
  const monthly: BudgetPeriodInput[] = months.map((m, i) => ({
    period_type: 'monthly',
    period_label: m.label,
    start_date: toISODate(m.start),
    end_date: toISODate(m.end),
    planned_paise: monthAmounts[i]!,
  }));

  const weeks = fyWeeks(fyYear);
  const weekDays = weeks.map((w) => daysBetween(w.start, w.end));
  const weekAmounts = proportionalSplit(totalPaise, weekDays);
  const weekly: BudgetPeriodInput[] = weeks.map((w, i) => ({
    period_type: 'weekly',
    period_label: w.label,
    start_date: toISODate(w.start),
    end_date: toISODate(w.end),
    planned_paise: weekAmounts[i]!,
  }));

  return { annual, quarterly, monthly, weekly };
}
