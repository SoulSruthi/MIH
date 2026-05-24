export type RecItemState =
  | 'open'
  | 'in_review'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'expired';

export type RecItemSeverity = 'low' | 'normal' | 'high' | 'critical';

export type RecItem = {
  id: string;
  org_id: string;
  item_type: string;
  state: RecItemState;
  severity: RecItemSeverity;
  monetary_impact: number | null;
  sla_deadline_at: string | null;
  context: Record<string, unknown>;
  resolution: string | null;
  resolution_actions: Record<string, unknown> | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type RecAuditEntry = {
  id: string;
  item_id: string;
  action: string;
  actor_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
};
