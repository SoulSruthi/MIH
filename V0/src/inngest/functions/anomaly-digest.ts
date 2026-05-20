import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { detectAllAnomalies } from '@/modules/anomalies/index';
import { sendAnomalyAlertEmail } from '@/modules/notifications/email';

type SourceRow = { organization_id: string };

type SourceRollupRow = {
  source_id: string;
  sources: { name: string } | null;
  cpl_paise: number | null;
  spend_paise: number | null;
  unique_lead_count: number | null;
  rollup_date: string;
};

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0] as string;
}

export const anomalyDigestFunction = inngest.createFunction(
  {
    id: 'anomaly-digest',
    name: 'Anomaly Digest (every 6h)',
    triggers: [{ cron: '0 */6 * * *' }],
  },
  async ({ logger }) => {
    const supabase = getSupabaseAdmin();
    const sevenDaysAgo = getDateNDaysAgo(7);
    const yesterday = getDateNDaysAgo(1);
    const last24hThreshold = getDateNDaysAgo(1);

    // Fetch all organizations via sources table
    const { data: orgsData, error: orgsError } = await supabase
      .from('sources')
      .select('organization_id')
      .not('organization_id', 'is', null);

    if (orgsError) {
      logger.error('Failed to fetch organizations', { error: orgsError.message });
      return { processed: 0, errors: 1 };
    }

    // Deduplicate org IDs
    const orgIds = [
      ...new Set((orgsData as unknown as SourceRow[] ?? []).map((r) => r.organization_id)),
    ];

    let processed = 0;
    let errors = 0;

    for (const orgId of orgIds) {
      try {
        // Fetch last 7 days of rollups joined with source names
        const { data: rollups, error: rollupsError } = await supabase
          .from('attribution_rollups')
          .select(`
            source_id,
            cpl_paise,
            spend_paise,
            unique_lead_count,
            rollup_date,
            sources!inner(name)
          `)
          .eq('organization_id', orgId)
          .gte('rollup_date', sevenDaysAgo)
          .lte('rollup_date', yesterday)
          .order('rollup_date', { ascending: false });

        if (rollupsError) {
          logger.error('Failed to fetch rollups for org', { orgId, error: rollupsError.message });
          errors++;
          continue;
        }

        if (!rollups || rollups.length === 0) {
          // No data — nothing to analyze
          continue;
        }

        // Group by source_id and build SourceRollup objects for anomaly detection
        const sourceMap = new Map<string, {
          sourceId: string;
          sourceName: string;
          thisWeekCplPaise: number | null;
          lastWeekCplPaise: number | null;
          healthScore: number | null;
          leadsLast24h: number;
          wasActiveLast7d: boolean;
        }>();

        for (const rawRow of rollups) {
          const row = rawRow as unknown as SourceRollupRow;
          const sourceId = row.source_id;
          const sourceName = row.sources?.name ?? sourceId;

          if (!sourceMap.has(sourceId)) {
            sourceMap.set(sourceId, {
              sourceId,
              sourceName,
              thisWeekCplPaise: row.cpl_paise ?? null,
              lastWeekCplPaise: null,
              healthScore: null,
              leadsLast24h: 0,
              wasActiveLast7d: false,
            });
          }

          const entry = sourceMap.get(sourceId)!;
          entry.wasActiveLast7d = true;

          // Leads in the last 24h (most recent rollup date)
          if (row.rollup_date >= last24hThreshold) {
            entry.leadsLast24h += row.unique_lead_count ?? 0;
          }

          // Use most recent week CPL as thisWeek, next as lastWeek
          if (entry.thisWeekCplPaise === null || row.rollup_date === yesterday) {
            entry.thisWeekCplPaise = row.cpl_paise ?? null;
          } else if (entry.lastWeekCplPaise === null) {
            entry.lastWeekCplPaise = row.cpl_paise ?? null;
          }
        }

        const sources = [...sourceMap.values()];
        const alerts = detectAllAnomalies(sources, orgId);

        if (alerts.length === 0) {
          logger.info('No anomalies for org', { orgId });
          processed++;
          continue;
        }

        logger.info('Anomalies detected for org', { orgId, count: alerts.length });

        // Fetch org name
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .single();

        const orgName = (orgData as { name?: string } | null)?.name ?? orgId;

        // Fetch admin emails via organization_members joined with auth.users
        const { data: members, error: membersError } = await supabase
          .from('organization_members')
          .select('user_id, role')
          .eq('organization_id', orgId)
          .eq('role', 'admin');

        if (membersError) {
          logger.error('Failed to fetch org members', { orgId, error: membersError.message });
          errors++;
          continue;
        }

        type MemberRow = { user_id: string };
        const userIds = (members as unknown as MemberRow[] ?? []).map((m) => m.user_id);

        if (userIds.length === 0) {
          logger.warn('No admin members found for org', { orgId });
          processed++;
          continue;
        }

        // Get emails from auth.users via admin API
        for (const userId of userIds) {
          try {
            const { data: userData, error: userError } =
              await supabase.auth.admin.getUserById(userId);
            if (userError || !userData?.user?.email) {
              logger.warn('Could not fetch user email', { userId, error: userError?.message });
              continue;
            }
            const email = userData.user.email;
            await sendAnomalyAlertEmail(email, alerts, orgName);
            logger.info('Sent anomaly alert email', { orgId, email, alertCount: alerts.length });
          } catch (emailErr) {
            logger.error('Failed to send email', {
              userId,
              error: emailErr instanceof Error ? emailErr.message : String(emailErr),
            });
          }
        }

        processed++;
      } catch (err) {
        logger.error('Error processing anomaly digest for org', {
          orgId,
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }

    logger.info('Anomaly digest complete', { processed, errors });
    return { processed, errors };
  },
);
