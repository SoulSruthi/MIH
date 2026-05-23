import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SEVERITY_ESCALATION: Record<string, string> = {
  low: 'normal',
  normal: 'high',
  high: 'critical',
  critical: 'critical',
};

const AUTO_EXPIRE_DAYS = 7;

export const slaExpiryFunction = inngest.createFunction(
  {
    id: 'sla-expiry',
    name: 'Daily SLA Expiry + Escalation',
    triggers: [{ cron: '0 1 * * *' }],
  },
  async ({ logger }) => {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const autoExpireCutoff = new Date(Date.now() - AUTO_EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let escalated = 0;
    let expired = 0;

    // Fetch all open/in_review items past their SLA deadline
    const { data: breachedItems, error } = await supabase
      .schema('mih')
      .from('reconciliation_items')
      .select('id, org_id, state, severity, sla_deadline_at, created_at')
      .in('state', ['open', 'in_review'])
      .lt('sla_deadline_at', now)
      .not('sla_deadline_at', 'is', null);

    if (error) {
      logger.error('Failed to fetch breached SLA items', { error: error.message });
      return { escalated: 0, expired: 0 };
    }

    for (const item of breachedItems ?? []) {
      const slaBreachedAt = new Date(item.sla_deadline_at as string);
      const daysSinceBreach = (Date.now() - slaBreachedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceBreach >= AUTO_EXPIRE_DAYS && item.state === 'open') {
        // Auto-expire
        await supabase
          .schema('mih')
          .from('reconciliation_items')
          .update({ state: 'expired', updated_at: now })
          .eq('id', item.id)
          .eq('org_id', item.org_id);

        await supabase.schema('mih').from('reconciliation_audit').insert({
          org_id: item.org_id,
          item_id: item.id,
          action: 'state_change',
          actor_id: 'system',
          old_value: { state: item.state },
          new_value: { state: 'expired' },
          note: `Auto-expired: ${AUTO_EXPIRE_DAYS}+ days unresolved past SLA deadline`,
        });

        logger.info('Auto-expired item', { id: item.id, org_id: item.org_id });
        expired++;
      } else {
        // Escalate severity
        const currentSeverity = item.severity as string;
        const newSeverity = SEVERITY_ESCALATION[currentSeverity] ?? currentSeverity;

        if (newSeverity !== currentSeverity) {
          await supabase
            .schema('mih')
            .from('reconciliation_items')
            .update({ severity: newSeverity, updated_at: now })
            .eq('id', item.id)
            .eq('org_id', item.org_id);

          await supabase.schema('mih').from('reconciliation_audit').insert({
            org_id: item.org_id,
            item_id: item.id,
            action: 'state_change',
            actor_id: 'system',
            old_value: { severity: currentSeverity },
            new_value: { severity: newSeverity },
            note: `SLA breached — severity escalated from ${currentSeverity} to ${newSeverity}`,
          });

          logger.info('Escalated severity', { id: item.id, from: currentSeverity, to: newSeverity });
          escalated++;
        }
      }
    }

    logger.info('SLA expiry check complete', { escalated, expired });
    return { escalated, expired };
  },
);
