/**
 * MIH Portal SLA Pacing (Spec 05 V0)
 *
 * Pure function — no DB access. Computes pacing % and breach flag for each
 * portal source SLA target given actual site-visit counts and a reference date.
 */
import type { PortalSlaTarget, PortalSlaStatus } from './types';

/**
 * Returns the number of days in the month of the given date.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Compute portal SLA pacing for a list of targets.
 *
 * @param targets       List of SLA targets (source_id, project_id, target_month, target_count)
 * @param actualCounts  Map of actual visit counts. Keys are either `source_id` or
 *                      `source_id:project_id` when project_id is non-null.
 * @param today         Reference date for elapsed-days calculation
 */
export function computePortalSlaPacing(
  targets: PortalSlaTarget[],
  actualCounts: Record<string, number>,
  today: Date,
): PortalSlaStatus[] {
  return targets.map((target) => {
    // Resolve actual count — prefer specific `source_id:project_id` key, fall back to source_id
    const specificKey = target.project_id
      ? `${target.source_id}:${target.project_id}`
      : target.source_id;
    const actual_count = actualCounts[specificKey] ?? actualCounts[target.source_id] ?? 0;

    // Parse target_month (YYYY-MM)
    const [yearStr, monthStr] = target.target_month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-based

    const totalDays = daysInMonth(year, month);

    // Elapsed days: how many days of the target month have passed up to and including today
    const monthStart = new Date(year, month - 1, 1); // local midnight on 1st
    const monthEnd = new Date(year, month, 0);        // local midnight on last day

    let elapsedDays: number;
    if (today < monthStart) {
      // Month hasn't started — pacing is 0
      elapsedDays = 0;
    } else if (today >= monthEnd) {
      // Month fully elapsed
      elapsedDays = totalDays;
    } else {
      // Days elapsed = day-of-month of today (1-based)
      elapsedDays = today.getDate();
    }

    // Pacing = actual / expected_by_now
    // expected_by_now = target_count * (elapsed_days / total_days)
    // Guard against division by zero (e.g. elapsedDays = 0 or totalDays = 0)
    let pacing_pct: number;
    if (elapsedDays === 0 || totalDays === 0) {
      pacing_pct = actual_count > 0 ? Infinity : 1; // ahead of schedule or on-track if not started
    } else {
      const expectedByNow = target.target_count * (elapsedDays / totalDays);
      pacing_pct = expectedByNow === 0 ? (actual_count > 0 ? Infinity : 1) : actual_count / expectedByNow;
    }

    const is_breached = pacing_pct < 0.8;

    return {
      source_id: target.source_id,
      project_id: target.project_id,
      target_month: target.target_month,
      target_count: target.target_count,
      actual_count,
      pacing_pct,
      is_breached,
    };
  });
}
