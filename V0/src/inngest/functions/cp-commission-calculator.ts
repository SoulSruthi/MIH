import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeCpCommission } from '@/modules/channel-partners/commission';

type AttributionResultRow = {
  winning_source_type: string | null;
  winning_raw_lead_id: string | null;
};

type CpPushEventRow = {
  channel_partner_id: string;
};

export const cpCommissionCalculatorFunction = inngest.createFunction(
  {
    id: 'cp-commission-calculator',
    name: 'CP Commission Calculator',
    triggers: [{ event: 'booking/conversion.completed' }],
  },
  async ({ event, logger }) => {
    const { org_id, conversion_event_id, deal_value_paise } = event.data as {
      org_id: string;
      conversion_event_id: string;
      deal_value_paise: number;
    };

    if (!org_id || !conversion_event_id || !deal_value_paise) {
      logger.warn('Missing required fields in booking/conversion.completed event', { event: event.data });
      return { skipped: true, reason: 'missing_fields' };
    }

    const supabase = getSupabaseAdmin();

    // Check idempotency — commission may already exist
    const { data: existing } = await supabase
      .schema('mih')
      .from('cp_commissions')
      .select('id')
      .eq('org_id', org_id)
      .eq('conversion_event_id', conversion_event_id)
      .maybeSingle();

    if (existing) {
      logger.info('CP commission already exists for conversion event', { conversion_event_id });
      return { skipped: true, reason: 'duplicate' };
    }

    // Fetch attribution result for this conversion event
    const { data: attrResult, error: attrError } = await supabase
      .schema('mih')
      .from('attribution_results')
      .select('winning_source_type, winning_raw_lead_id')
      .eq('org_id', org_id)
      .eq('conversion_event_id', conversion_event_id)
      .maybeSingle() as unknown as { data: AttributionResultRow | null; error: { message: string } | null };

    if (attrError) {
      logger.error('Failed to fetch attribution result', { error: attrError.message });
      return { error: attrError.message };
    }

    // Find the CP responsible via cp_push_events matching the cluster on the conversion event
    let channelPartnerId: string | null = null;
    if (attrResult?.winning_source_type === 'cp' && attrResult.winning_raw_lead_id) {
      // Look up raw lead → cluster_id → cp_push_event
      const { data: convEvent } = await supabase
        .schema('mih')
        .from('conversion_events')
        .select('cluster_id')
        .eq('id', conversion_event_id)
        .eq('org_id', org_id)
        .maybeSingle();

      if (convEvent?.cluster_id) {
        const { data: pushEvent } = await supabase
          .schema('mih')
          .from('cp_push_events')
          .select('channel_partner_id')
          .eq('org_id', org_id)
          .eq('cluster_id', convEvent.cluster_id)
          .order('pushed_at', { ascending: false })
          .limit(1)
          .maybeSingle() as unknown as { data: CpPushEventRow | null; error: unknown };

        channelPartnerId = pushEvent?.channel_partner_id ?? null;
      }
    }

    const result = computeCpCommission({
      dealValuePaise: deal_value_paise,
      winningSourceType: attrResult?.winning_source_type ?? '',
      channelPartnerId,
    });

    if (!result.eligible) {
      logger.info('CP commission not eligible', { reason: result.reason, conversion_event_id });
      return { skipped: true, reason: result.reason };
    }

    const { error: insertError } = await supabase
      .schema('mih')
      .from('cp_commissions')
      .insert({
        org_id,
        channel_partner_id: channelPartnerId!,
        conversion_event_id,
        deal_value_paise,
        commission_paise: result.commissionPaise,
        commission_rate: result.commissionRate,
      });

    if (insertError) {
      logger.error('Failed to insert CP commission', { error: insertError.message });
      return { error: insertError.message };
    }

    logger.info('CP commission created', {
      conversion_event_id,
      channel_partner_id: channelPartnerId,
      commission_paise: result.commissionPaise,
    });
    return { commission_paise: result.commissionPaise, channel_partner_id: channelPartnerId };
  },
);
