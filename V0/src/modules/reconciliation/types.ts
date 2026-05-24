export type ReconciliationItemType =
  | 'disputed_cp_credit'
  | 'disputed_referral_credit'
  | 'manual_call_no_tracking'
  | 'unmatched_walk_in'
  | 'comment_source_override'
  | 'telecaller_claim_audit'
  | 'sales_rep_unattended_lead'
  | 'low_conf_identity_merge'
  | 'source_disabled_violation'
  | 'orphan_spend_investigation';

export type ReconciliationState =
  | 'open'
  | 'in_review'
  | 'resolved'
  | 'escalated'
  | 'closed'
  | 'expired';

export type ReconciliationSeverity = 'low' | 'normal' | 'high' | 'critical';

export type AuditAction =
  | 'state_change'
  | 'note_added'
  | 'assigned'
  | 'evidence_attached'
  | 'resolution_set';

export type ReconciliationItem = {
  id: string;
  org_id: string;
  item_type: ReconciliationItemType;
  state: ReconciliationState;
  severity: ReconciliationSeverity;
  monetary_impact: number | null;
  cluster_id: string | null;
  origin_event_id: string | null;
  sla_deadline_at: string | null;
  assigned_to: string | null;
  context: Record<string, unknown>;
  resolution: string | null;
  resolution_actions: Record<string, unknown> | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReconciliationAuditEntry = {
  id: string;
  org_id: string;
  item_id: string;
  action: AuditAction;
  actor_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
};

export type CreateReconciliationItemInput = {
  org_id: string;
  item_type: ReconciliationItemType;
  severity?: ReconciliationSeverity;
  monetary_impact?: number;
  cluster_id?: string;
  origin_event_id?: string;
  context?: Record<string, unknown>;
  assigned_to?: string;
};

export type UpdateReconciliationItemInput = {
  state?: ReconciliationState;
  severity?: ReconciliationSeverity;
  resolution?: string;
  resolution_actions?: Record<string, unknown>;
  assigned_to?: string;
  resolved_by?: string;
};

export type SlaConfig = {
  low: number;
  normal: number;
  high: number;
  critical: number;
};
