/**
 * Auto-disable Expired Project Sources — Inngest Cron (Spec MIH V2.2)
 *
 * Runs daily at 1am IST. Disables any project_source_allowlist rows
 * where enabled=true AND auto_disable_at < now().
 */
import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const projectSourceAutoDisableFunction = inngest.createFunction(
  {
    id: 'project-source-auto-disable',
    name: 'Auto-disable Expired Project Sources',
    triggers: [{ cron: '0 1 * * *' }],
  },
  async ({ logger }: { logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void } }) => {
    const supabase = getSupabaseAdmin();

    // 1. Fetch all expired enabled rows
    const { data: expiredRows, error } = await supabase
      .schema('mih')
      .from('project_source_allowlist')
      .select('id, org_id, project_id, source_id, auto_disable_at')
      .eq('enabled', true)
      .lt('auto_disable_at', new Date().toISOString());

    if (error) {
      logger.error('Failed to fetch expired project source allowlist rows', {
        error: error.message,
      });
      return { disabled: 0 };
    }

    const rows = (expiredRows ?? []) as Array<{
      id: string;
      org_id: string;
      project_id: string;
      source_id: string;
      auto_disable_at: string;
    }>;

    if (rows.length === 0) {
      logger.info('No expired project source allowlist rows to disable');
      return { disabled: 0 };
    }

    // 2. Disable each row individually and log
    const now = new Date().toISOString();
    let disabled = 0;

    for (const row of rows) {
      const { error: updateError } = await supabase
        .schema('mih')
        .from('project_source_allowlist')
        .update({ enabled: false, updated_at: now })
        .eq('id', row.id);

      if (updateError) {
        logger.error('Failed to disable project source allowlist row', {
          id: row.id,
          error: updateError.message,
        });
        continue;
      }

      // 3. Log each disabled entry
      logger.info('Disabled expired project source', {
        org_id: row.org_id,
        project_id: row.project_id,
        source_id: row.source_id,
        auto_disable_at: row.auto_disable_at,
      });

      disabled++;
    }

    return { disabled };
  },
);
