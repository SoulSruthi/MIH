import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpendContract, SpendEntry } from './types';

/** Returns an array of ISO date strings for the first day of each calendar month between start and end (inclusive). */
function getMonthStarts(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= endMonth) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

/** Returns the last day of a given calendar month (UTC). */
function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}

/** ISO week string like "2024_W03". */
function isoWeekLabel(d: Date): string {
  // Compute ISO week number and year
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const weekNum =
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / 604800000,
    );
  const weekYear = thursday.getUTCFullYear();
  return `${weekYear}_W${String(weekNum).padStart(2, '0')}`;
}

/** Returns Monday (start) for an ISO week that contains `d`. */
function isoWeekStart(d: Date): Date {
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayOfWeek);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

/** Returns Sunday (end) for the ISO week containing `d`. */
function isoWeekEnd(d: Date): Date {
  const start = isoWeekStart(d);
  const sunday = new Date(start);
  sunday.setUTCDate(start.getUTCDate() + 6);
  return sunday;
}

type SpendEntryInsert = Omit<SpendEntry, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export async function amortizeContract(
  contract: SpendContract,
  supabase: SupabaseClient,
): Promise<{ entries_created: number; entries: SpendEntry[] }> {
  const contractStart = new Date(contract.contract_start);
  const contractEnd = new Date(contract.contract_end);
  const total = contract.total_amount_paise;
  const vendorDescription = `Contract amortization: ${contract.vendor_name}`;

  const rows: SpendEntryInsert[] = [];

  if (contract.amortization === 'monthly') {
    const monthStarts = getMonthStarts(contractStart, contractEnd);
    const count = monthStarts.length;
    if (count === 0) {
      return { entries_created: 0, entries: [] };
    }
    const baseAmount = Math.floor(total / count);
    const remainder = total - baseAmount * count;

    monthStarts.forEach((monthStart, idx) => {
      const isLast = idx === count - 1;
      const amount = isLast ? baseAmount + remainder : baseAmount;
      const periodEnd = lastDayOfMonth(monthStart.getUTCFullYear(), monthStart.getUTCMonth());
      const label = `${monthStart.getUTCFullYear()}_${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;

      rows.push({
        org_id: contract.org_id,
        project_id: contract.project_id,
        source_id: contract.source_id,
        medium: 'portals',
        entry_kind: 'recurring_amortized',
        amount_paise: amount,
        period_start: monthStart.toISOString().split('T')[0] as string,
        period_end: periodEnd.toISOString().split('T')[0] as string,
        ingestion_source: 'contract',
        external_ref: `${contract.id}_month_${label}`,
        description: vendorDescription,
        contract_id: contract.id,
      });
    });
  } else if (contract.amortization === 'weekly') {
    // Enumerate all ISO weeks that overlap [contractStart, contractEnd]
    const weeks: Array<{ label: string; start: Date; end: Date }> = [];
    const cursor = isoWeekStart(contractStart);
    while (cursor <= contractEnd) {
      const weekEnd = isoWeekEnd(cursor);
      weeks.push({
        label: isoWeekLabel(cursor),
        start: new Date(cursor),
        end: weekEnd,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    const count = weeks.length;
    if (count === 0) {
      return { entries_created: 0, entries: [] };
    }
    const baseAmount = Math.floor(total / count);
    const remainder = total - baseAmount * count;

    weeks.forEach((week, idx) => {
      const isLast = idx === count - 1;
      const amount = isLast ? baseAmount + remainder : baseAmount;

      rows.push({
        org_id: contract.org_id,
        project_id: contract.project_id,
        source_id: contract.source_id,
        medium: 'portals',
        entry_kind: 'recurring_amortized',
        amount_paise: amount,
        period_start: week.start.toISOString().split('T')[0] as string,
        period_end: week.end.toISOString().split('T')[0] as string,
        ingestion_source: 'contract',
        external_ref: `${contract.id}_week_${week.label}`,
        description: vendorDescription,
        contract_id: contract.id,
      });
    });
  } else {
    // one_time or custom: single entry spanning the full period
    rows.push({
      org_id: contract.org_id,
      project_id: contract.project_id,
      source_id: contract.source_id,
      medium: 'portals',
      entry_kind: 'recurring_amortized',
      amount_paise: total,
      period_start: contract.contract_start,
      period_end: contract.contract_end,
      ingestion_source: 'contract',
      external_ref: `${contract.id}_full`,
      description: vendorDescription,
      contract_id: contract.id,
    });
  }

  if (rows.length === 0) {
    return { entries_created: 0, entries: [] };
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('spend_entries')
    .upsert(rows, { onConflict: 'org_id,ingestion_source,external_ref' })
    .select();

  if (error) throw new Error(error.message);

  const entries = (data ?? []) as SpendEntry[];
  return { entries_created: entries.length, entries };
}
