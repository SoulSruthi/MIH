/**
 * Attribution Recompute — Inngest Function (Spec 04 V1.5)
 *
 * Listens to identity/cluster.merged events and re-runs first-touch attribution
 * for all active conversion events belonging to the affected cluster.
 * Marks prior results as superseded.
 */
import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { runAttributionForConversionEvent } from '@/modules/mih-attribution/runner';

type ClusterMergedEvent = {
  data: {
    cluster_id: string;
    org_id: string;
    raw_inbox_id?: string;
  };
};

export const attributionRecomputeFunction = inngest.createFunction(
  {
    id: 'attribution-recompute-on-cluster-merged',
    name: 'Recompute Attribution on Cluster Merge',
  },
  { event: 'identity/cluster.merged' },
  async ({ event, logger }: { event: ClusterMergedEvent; logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void } }) => {
    const { cluster_id: clusterId, org_id: orgId } = event.data;

    const supabase = getSupabaseAdmin();

    // Fetch all non-reversed conversion_events for this cluster
    const { data: conversionEvents, error } = await supabase
      .schema('mih')
      .from('conversion_events')
      .select('id, event_code, occurred_at, project_id, deal_value_paise')
      .eq('org_id', orgId)
      .eq('cluster_id', clusterId)
      .is('reversed_at', null);

    if (error) {
      logger.error('Failed to fetch conversion events for recompute', {
        clusterId,
        error: error.message,
      });
      return { recomputed: 0, errors: 1 };
    }

    const events = (conversionEvents ?? []) as Array<{
      id: string;
      event_code: string;
      occurred_at: string;
      project_id: string | null;
      deal_value_paise: number | null;
    }>;

    if (events.length === 0) {
      logger.info('No conversion events to recompute', { clusterId });
      return { recomputed: 0, errors: 0 };
    }

    let recomputed = 0;
    let errors = 0;

    for (const ev of events) {
      try {
        await runAttributionForConversionEvent(
          {
            conversionEventId: ev.id,
            clusterId,
            orgId,
            conversionOccurredAt: ev.occurred_at,
            projectId: ev.project_id,
            eventCode: ev.event_code,
            dealValuePaise: ev.deal_value_paise,
          },
          supabase,
        );
        recomputed++;
        logger.info('Attribution recomputed', { conversionEventId: ev.id, clusterId });
      } catch (err) {
        errors++;
        logger.error('Error recomputing attribution', {
          conversionEventId: ev.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { recomputed, errors };
  },
);
