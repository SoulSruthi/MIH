import type { ReconciliationSeverity, SlaConfig } from './types';

const DEFAULT_SLA_HOURS: SlaConfig = {
  low: 168,
  normal: 72,
  high: 24,
  critical: 4,
};

export function assignSLADeadline(
  severity: ReconciliationSeverity,
  createdAt: Date = new Date(),
  config: SlaConfig = DEFAULT_SLA_HOURS,
): Date {
  const hours = config[severity];
  const deadline = new Date(createdAt.getTime());
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
}

export function checkBreached(slaDeadlineAt: string | null): boolean {
  if (!slaDeadlineAt) return false;
  return new Date(slaDeadlineAt) < new Date();
}

export function getRemainingHours(slaDeadlineAt: string | null): number | null {
  if (!slaDeadlineAt) return null;
  const deadline = new Date(slaDeadlineAt);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60));
}
