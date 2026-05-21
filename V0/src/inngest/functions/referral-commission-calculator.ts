import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeReferralCommission } from '@/modules/referrals/commission';

type AttributionResultRow = {
  winning_source_type: string | null;
};

type ReferralEventRow = {
  id: string;
};

export const referralCommissionCalculatorFunction = inngest.createFunction(
  {
    id: 'referral-commission-calculator',
    name: 'Referral Commission Calculator',
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

    // Check idempotency
    const { data: existing } = await supabase
      .schema('mih')
      .from('referral_commissions')
      .select('id')
      .eq('org_id', org_id)
      .eq('conversion_event_id', conversion_event_id)
      .maybeSingle();

    if (existing) {
      logger.info('Referral commission already exists for conversion event', { conversion_event_id });
      return { skipped: true, reason: 'duplicate' };
    }

    // Fetch attribution result
    const { data: attrResult, error: attrError } = await supabase
      .schema('mih')
      .from('attribution_results')
      .select('winning_source_type')
      .eq('org_id', org_id)
      .eq('conversion_event_id', conversion_event_id)
      .maybeSingle() as unknown as { data: AttributionResultRow | null; error: { message: string } | null };

    if (attrError) {
      logger.error('Failed to fetch attribution result', { error: attrError.message });
      return { error: attrError.message };
    }

    // Find referral_event for the cluster on this conversion
    let referralEventId: string | null = null;
    if (attrResult?.winning_source_type === 'referral') {
      const { data: convEvent } = await supabase
        .schema('mih')
        .from('conversion_events')
        .select('cluster_id')
        .eq('id', conversion_event_id)
        .eq('org_id', org_id)
        .maybeSingle();

      if (convEvent?.cluster_id) {
        const { data: refEvent } = await supabase
          .schema('mih')
          .from('referral_events')
          .select('id')
          .eq('org_id', org_id)
          .eq('referee_cluster_id', convEvent.cluster_id)
          .eq('status', 'pending')
          .order('referred_at', { ascending: false })
          .limit(1)
          .maybeSingle() as unknown as { data: ReferralEventRow | null; error: unknown };

        referralEventId = refEvent?.id ?? null;
      }
    }

    const result = computeReferralCommission({
      dealValuePaise: deal_value_paise,
      winningSourceType: attrResult?.winning_source_type ?? '',
      referralEventId,
    });

    if (!result.eligible) {
      logger.info('Referral commission not eligible', { reason: result.reason, conversion_event_id });
      return { skipped: true, reason: result.reason };
    }

    // Mark referral_event as converted
    await supabase
      .schema('mih')
      .from('referral_events')
      .update({ status: 'converted', converted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', referralEventId!)
      .eq('org_id', org_id);

    // Update referrer's last_referral_at
    const { data: refEvent } = await supabase
      .schema('mih')
      .from('referral_events')
      .select('referrer_id')
      .eq('id', referralEventId!)
      .maybeSingle();

    if (refEvent?.referrer_id) {
      await supabase
        .schema('mih')
        .from('referrers')
        .update({ last_referral_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', refEvent.referrer_id)
        .eq('org_id', org_id);
    }

    const { error: insertError } = await supabase
      .schema('mih')
      .from('referral_commissions')
      .insert({
        org_id,
        referral_event_id: referralEventId!,
        conversion_event_id,
        deal_value_paise,
        commission_paise: result.commissionPaise,
        commission_rate: result.commissionRate,
      });

    if (insertError) {
      logger.error('Failed to insert referral commission', { error: insertError.message });
      return { error: insertError.message };
    }

    logger.info('Referral commission created', {
      conversion_event_id,
      referral_event_id: referralEventId,
      commission_paise: result.commissionPaise,
    });
    return { commission_paise: result.commissionPaise, referral_event_id: referralEventId };
  },
);
