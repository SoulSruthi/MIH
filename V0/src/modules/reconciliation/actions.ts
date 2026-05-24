export const RECONCILIATION_STATES = ['open', 'in_review', 'escalated', 'resolved', 'closed', 'expired'] as const;
export const RECONCILIATION_SEVERITIES = ['low', 'normal', 'high', 'critical'] as const;

export const STATE_TRANSITIONS: Record<string, string[]> = {
  open: ['in_review', 'escalated', 'resolved'],
  in_review: ['escalated', 'resolved'],
  escalated: ['in_review', 'resolved'],
  resolved: ['closed'],
  closed: [],
  expired: [],
};

export function canTransition(fromState: string, toState: string): boolean {
  return STATE_TRANSITIONS[fromState]?.includes(toState) ?? false;
}
