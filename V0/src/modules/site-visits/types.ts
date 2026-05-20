/**
 * Types for MIH Site Visits (Spec 05 V0)
 */

export type SiteVisitEventKind =
  | 'scheduled'
  | 'rescheduled'
  | 'cab_dispatched'
  | 'customer_en_route'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'walk_in_unscheduled';

export type CrmSiteVisitPayload = {
  crm_event_id: string;
  event_kind: SiteVisitEventKind;
  cluster_id?: string | null;         // MIH cluster ID from CRM handoff
  phone?: string | null;              // fallback lookup
  project_id?: string | null;
  source_id?: string | null;
  is_fast_track?: boolean;
  is_walk_in?: boolean;
  cab_booked?: boolean;
  scheduled_at?: string | null;
  completed_at?: string | null;
  crm_metadata?: Record<string, unknown>;
};

export type SiteVisitConsumeResult =
  | { outcome: 'recorded'; siteVisitEventId: string; conversionEventId: string | null }
  | { outcome: 'duplicate'; siteVisitEventId: string }
  | { outcome: 'unmatched_walk_in'; siteVisitEventId: string }
  | { outcome: 'error'; reason: string };

export type PortalSlaTarget = {
  source_id: string;
  project_id: string | null;
  target_month: string; // YYYY-MM
  target_count: number;
};

export type PortalSlaStatus = {
  source_id: string;
  project_id: string | null;
  target_month: string;
  target_count: number;
  actual_count: number;
  pacing_pct: number;    // actual / (target * elapsed_days/total_days)
  is_breached: boolean;  // pacing < 0.80
};
