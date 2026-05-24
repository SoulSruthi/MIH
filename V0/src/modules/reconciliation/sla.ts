import type { RecItemSeverity } from './types';

// SLA hours by severity
const SLA_HOURS: Record<RecItemSeverity, number> = {
  critical: 4,
  high: 24,
  normal: 72,
  low: 168,
};

export function computeSlaDeadline(severity: RecItemSeverity, createdAt: Date = new Date()): Date {
  const hours = SLA_HOURS[severity] ?? 72;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

export function isSlaBreached(slaDeadlineAt: string | null): boolean {
  if (!slaDeadlineAt) return false;
  return new Date(slaDeadlineAt) < new Date();
}
