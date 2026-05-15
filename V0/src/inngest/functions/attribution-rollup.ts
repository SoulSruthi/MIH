import { inngest } from '../client.js';
import { getSupabaseAdmin } from '@/lib/supabase-admin.js';
import { recomputeRollupsForRange } from '@/modules/attribution/index.js';

type SourceRow = { organization_id: string };

function getYesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0] as string;
}

export const attributionRollupFunction = inngest.createFunction(
  {
    id: 'attribution-rollup',
    name: 'Nightly Attribution Rollup',
    triggers: [{ cron: '0 3 * * *' }],
  },
  async ({ logger }) => {
    const supabase = getSupabaseAdmin();
    const yesterday = getYesterdayDateString();

    // Fetch all distinct organization IDs from sources table
    const { data: orgsData, error: orgsError } = await supabase
      .from('sources')
      .select('organization_id')
      .not('organization_id', 'is', null);

    if (orgsError) {
      logger.error('Failed to fetch organizations', { error: orgsError.message });
      return { processed: 0, errors: 1 };
    }

    // Deduplicate org IDs
    const orgIds = [...new Set((orgsData as unknown as SourceRow[] ?? []).map((r) => r.organization_id))];

    let totalProcessed = 0;
    let totalErrors = 0;

    for (const orgId of orgIds) {
      try {
        const result = await recomputeRollupsForRange(supabase, orgId, yesterday, yesterday);
        totalProcessed += result.processed;
        totalErrors += result.errors;
        logger.info('Rollup complete for org', { orgId, ...result });
      } catch (err) {
        logger.error('Error computing rollup for org', {
          orgId,
          error: err instanceof Error ? err.message : String(err),
        });
        totalErrors++;
      }
    }

    logger.info('Attribution rollup complete', { processed: totalProcessed, errors: totalErrors });
    return { processed: totalProcessed, errors: totalErrors };
  },
);
