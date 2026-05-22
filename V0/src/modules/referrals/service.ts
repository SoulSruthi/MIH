import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type {
  Referrer,
  ReferralSubmission,
  ReferralCommissionAccrual,
  CreateReferrerInput,
  SubmitReferralInput,
  CreateReferralAccrualInput,
} from './types';

function generateReferrerCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'REF-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createReferrer(input: CreateReferrerInput): Promise<Referrer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('referrers')
    .insert({
      org_id: input.org_id,
      name: input.name,
      contact_email: input.contact_email ?? null,
      contact_phone: input.contact_phone ?? null,
      customer_cluster_id: input.customer_cluster_id ?? null,
      crm_customer_id: input.crm_customer_id ?? null,
      referrer_code: generateReferrerCode(),
      default_commission_pct: input.default_commission_pct ?? 0.015,
      reward_preference: input.reward_preference ?? 'cash',
      consent_state: input.consent_state ?? 'pending',
      consent_channels: input.consent_channels ?? [],
      is_active: true,
      bookings_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Referrer;
}

export async function getReferrer(id: string, orgId: string): Promise<Referrer | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('referrers')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error) return null;
  return data as Referrer;
}

export async function listReferrers(orgId: string): Promise<Referrer[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('referrers')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Referrer[];
}

export async function updateReferrer(
  id: string,
  orgId: string,
  updates: Partial<Referrer>,
): Promise<Referrer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('referrers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Referrer;
}

export async function updateConsent(
  id: string,
  orgId: string,
  consentState: string,
  consentChannels?: string[],
): Promise<Referrer> {
  const updates: Record<string, unknown> = { consent_state: consentState };
  if (consentChannels !== undefined) updates.consent_channels = consentChannels;
  return updateReferrer(id, orgId, updates as Partial<Referrer>);
}

export async function submitReferral(input: SubmitReferralInput): Promise<ReferralSubmission> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('referral_submissions')
    .insert({
      org_id: input.org_id,
      referrer_id: input.referrer_id,
      raw_inbox_id: input.raw_inbox_id ?? null,
      outcome: input.outcome,
      submission_channel: input.submission_channel ?? 'webform',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (input.outcome === 'accepted') {
    await supabase
      .schema('mih')
      .from('referrers')
      .update({ last_referral_at: new Date().toISOString() })
      .eq('id', input.referrer_id)
      .eq('org_id', input.org_id);
  }

  return data as ReferralSubmission;
}

export async function createAccrual(
  input: CreateReferralAccrualInput,
): Promise<ReferralCommissionAccrual> {
  const supabase = getSupabaseAdmin();

  const referrer = await getReferrer(input.referrer_id, input.org_id);
  if (!referrer) throw new Error('Referrer not found');

  const commissionPct = input.commission_pct ?? referrer.default_commission_pct;

  const { data, error } = await supabase
    .schema('mih')
    .from('referral_commission_accruals')
    .insert({
      org_id: input.org_id,
      referrer_id: input.referrer_id,
      project_id: input.project_id ?? null,
      booking_value: input.booking_value,
      commission_pct: commissionPct,
      reward_kind: input.reward_kind ?? referrer.reward_preference,
      attribution_result_id: input.attribution_result_id ?? null,
      conversion_event_id: input.conversion_event_id ?? null,
      state: 'earned',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ReferralCommissionAccrual;
}

export async function listCommissions(
  referrerId: string,
  orgId: string,
): Promise<ReferralCommissionAccrual[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('referral_commission_accruals')
    .select('*')
    .eq('referrer_id', referrerId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ReferralCommissionAccrual[];
}
