import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deduplicateItem, createItem } from '@/modules/reconciliation/queue';

const ORPHAN_THRESHOLD_PAISE = 5_000_000; // ₹50K

export const orphanSpendDetectionFunction = inngest.createFunction(
  {
    id: 'orphan-spend-detection',
    name: 'Weekly Orphan Spend Detection',
    triggers: [{ cron: '0 19 * * 0' }],
  },
  async ({ logger }) => {
    const supabase = getSupabaseAdmin();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string;
    const today = new Date().toISOString().split('T')[0] as string;

    let checked = 0;
    let itemsCreated = 0;

    // Aggregate spend per (org_id, source_id) over past 30 days
    const { data: spendRows, error: spendError } = await supabase
      .schema('mih')
      .from('spend_entries')
      .select('org_id, source_id, amount_paise')
      .gte('period_start', thirtyDaysAgo)
      .lte('period_end', today)
      .not('source_id', 'is', null);

    if (spendError) {
      logger.error('Failed to fetch spend entries', { error: spendError.message });
      return { checked: 0, items_created: 0 };
    }

    // Aggregate in memory by (org_id, source_id)
    const spendMap = new Map<string, { orgId: string; sourceId: string; totalPaise: number }>();
    for (const row of spendRows ?? []) {
      const key = `${row.org_id}::${row.source_id}`;
      const existing = spendMap.get(key);
      if (existing) {
        existing.totalPaise += (row.amount_paise as number);
      } else {
        spendMap.set(key, {
          orgId: row.org_id as string,
          sourceId: row.source_id as string,
          totalPaise: row.amount_paise as number,
        });
      }
    }

    for (const { orgId, sourceId, totalPaise } of spendMap.values()) {
      if (totalPaise <= ORPHAN_THRESHOLD_PAISE) continue;

      checked++;

      // Count bookings (attribution results) for this source in the period
      const { count: bookingsCount } = await supabase
        .schema('mih')
        .from('attribution_results')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('winning_source_id', sourceId)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00Z`);

      if ((bookingsCount ?? 0) > 0) continue;

      // Count raw leads for this source
      const { count: leadsCount } = await supabase
        .schema('mih')
        .from('raw_leads')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('source_id', sourceId)
        .gte('ingested_at', `${thirtyDaysAgo}T00:00:00Z`);

      if ((leadsCount ?? 0) === 0) continue;

      // Orphan condition: high spend, 0 bookings, leads exist
      const existing = await deduplicateItem(orgId, 'orphan_spend_investigation', undefined, sourceId);
      if (existing) {
        logger.info('Orphan item already exists, skipping', { orgId, sourceId });
        continue;
      }

      await createItem({
        org_id: orgId,
        item_type: 'orphan_spend_investigation',
        severity: 'high',
        monetary_impact: totalPaise,
        origin_event_id: sourceId,
        context: {
          source_id: sourceId,
          total_spend_paise: totalPaise,
          bookings_count: 0,
          leads_count: leadsCount ?? 0,
          period_start: thirtyDaysAgo,
          period_end: today,
        },
      });

      logger.info('Created orphan spend item', { orgId, sourceId, totalPaise });
      itemsCreated++;
    }

    logger.info('Orphan spend detection complete', { checked, items_created: itemsCreated });
    return { checked, items_created: itemsCreated };
  },
);
