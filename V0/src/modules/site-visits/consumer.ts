/**
 * MIH Site Visit Event Consumer (Spec 05 V0)
 *
 * Consumes CRM site-visit events and persists them to mih.site_visit_events.
 * Idempotent by (org_id, crm_event_id).
 * For 'scheduled' and 'completed' events also writes a mih.conversion_events row.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrmSiteVisitPayload, SiteVisitConsumeResult } from './types';

export type SiteVisitConsumerDeps = {
  supabaseAdmin: SupabaseClient;
  orgId: string;
  now?: () => Date;
  emitSiteVisitRecorded?: (siteVisitEventId: string, orgId: string) => Promise<void>;
  emitUnmatchedWalkIn?: (siteVisitEventId: string, orgId: string) => Promise<void>;
  /** Called after a conversion_event is written to trigger attribution engine */
  triggerAttribution?: (args: {
    conversionEventId: string;
    clusterId: string;
    conversionOccurredAt: string;
    projectId: string | null;
    eventCode: string;
  }) => Promise<void>;
};

const CONVERSION_EVENT_CODES: Partial<Record<CrmSiteVisitPayload['event_kind'], string>> = {
  scheduled: 'site_visit_scheduled',
  completed: 'site_visit_completed',
};

export async function consumeSiteVisitEvent(
  payload: CrmSiteVisitPayload,
  deps: SiteVisitConsumerDeps,
): Promise<SiteVisitConsumeResult> {
  const { supabaseAdmin, orgId } = deps;
  const now = deps.now?.() ?? new Date();

  // --- Idempotency check ---
  const { data: existing } = await supabaseAdmin
    .schema('mih')
    .from('site_visit_events')
    .select('id')
    .eq('org_id', orgId)
    .eq('crm_event_id', payload.crm_event_id)
    .limit(1);

  if (existing && (existing as Array<{ id: string }>).length > 0) {
    return {
      outcome: 'duplicate',
      siteVisitEventId: (existing as Array<{ id: string }>)[0].id,
    };
  }

  // --- Walk-in with no cluster_id ---
  if (payload.event_kind === 'walk_in_unscheduled' && !payload.cluster_id) {
    const { data: walkInRow } = await supabaseAdmin
      .schema('mih')
      .from('site_visit_events')
      .insert({
        org_id: orgId,
        crm_event_id: payload.crm_event_id,
        event_kind: payload.event_kind,
        cluster_id: null,
        project_id: payload.project_id ?? null,
        source_id: payload.source_id ?? null,
        is_fast_track: payload.is_fast_track ?? false,
        is_walk_in: payload.is_walk_in ?? true,
        cab_booked: payload.cab_booked ?? false,
        scheduled_at: payload.scheduled_at ?? null,
        completed_at: payload.completed_at ?? null,
        crm_metadata: payload.crm_metadata ?? null,
        recorded_at: now.toISOString(),
      })
      .select('id')
      .single();

    const siteVisitEventId = (walkInRow as { id: string } | null)?.id ?? '';

    await deps.emitUnmatchedWalkIn?.(siteVisitEventId, orgId);

    return { outcome: 'unmatched_walk_in', siteVisitEventId };
  }

  // --- Standard insert ---
  const { data: insertedRow } = await supabaseAdmin
    .schema('mih')
    .from('site_visit_events')
    .insert({
      org_id: orgId,
      crm_event_id: payload.crm_event_id,
      event_kind: payload.event_kind,
      cluster_id: payload.cluster_id ?? null,
      project_id: payload.project_id ?? null,
      source_id: payload.source_id ?? null,
      is_fast_track: payload.is_fast_track ?? false,
      is_walk_in: payload.is_walk_in ?? false,
      cab_booked: payload.cab_booked ?? false,
      scheduled_at: payload.scheduled_at ?? null,
      completed_at: payload.completed_at ?? null,
      crm_metadata: payload.crm_metadata ?? null,
      recorded_at: now.toISOString(),
    })
    .select('id')
    .single();

  const siteVisitEventId = (insertedRow as { id: string } | null)?.id ?? '';

  // --- Optionally write conversion_event ---
  let conversionEventId: string | null = null;
  const eventCode = CONVERSION_EVENT_CODES[payload.event_kind];

  if (eventCode) {
    const { data: convRow } = await supabaseAdmin
      .schema('mih')
      .from('conversion_events')
      .insert({
        org_id: orgId,
        cluster_id: payload.cluster_id ?? null,
        project_id: payload.project_id ?? null,
        source_id: payload.source_id ?? null,
        site_visit_event_id: siteVisitEventId,
        event_code: eventCode,
        occurred_at: payload.completed_at ?? payload.scheduled_at ?? now.toISOString(),
        crm_metadata: payload.crm_metadata ?? null,
      })
      .select('id')
      .single();

    conversionEventId = (convRow as { id: string } | null)?.id ?? null;

    // Trigger attribution engine when site visit is completed
    if (eventCode === 'site_visit_completed' && conversionEventId && payload.cluster_id) {
      await deps.triggerAttribution?.({
        conversionEventId,
        clusterId: payload.cluster_id,
        conversionOccurredAt: payload.completed_at ?? payload.scheduled_at ?? now.toISOString(),
        projectId: payload.project_id ?? null,
        eventCode,
      });
    }
  }

  await deps.emitSiteVisitRecorded?.(siteVisitEventId, orgId);

  return { outcome: 'recorded', siteVisitEventId, conversionEventId };
}
