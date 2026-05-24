import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type {
  ChannelPartner,
  CpApiKey,
  CpCommissionAccrual,
  CreateChannelPartnerInput,
  CreateAccrualInput,
  GenerateApiKeyResult,
} from './types';

export async function createCP(input: CreateChannelPartnerInput): Promise<ChannelPartner> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('channel_partners')
    .insert({
      org_id: input.org_id,
      name: input.name,
      code: input.code ?? null,
      contact_name: input.contact_name ?? null,
      contact_email: input.contact_email ?? null,
      contact_phone: input.contact_phone ?? null,
      cp_type: input.cp_type ?? 'individual',
      parent_cp_id: input.parent_cp_id ?? null,
      default_commission_pct: input.default_commission_pct ?? 0.025,
      rera_number: input.rera_number ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ChannelPartner;
}

export async function getCP(id: string, orgId: string): Promise<ChannelPartner | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('channel_partners')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error) return null;
  return data as ChannelPartner;
}

export async function listCPs(orgId: string): Promise<ChannelPartner[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('channel_partners')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChannelPartner[];
}

export async function updateCP(
  id: string,
  orgId: string,
  updates: Partial<ChannelPartner>,
): Promise<ChannelPartner> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('channel_partners')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ChannelPartner;
}

export function calculateCommission(bookingValue: number, commissionPct: number): number {
  return Math.round(bookingValue * commissionPct);
}

export async function createAccrual(input: CreateAccrualInput): Promise<CpCommissionAccrual> {
  const supabase = getSupabaseAdmin();

  const cp = await getCP(input.cp_id, input.org_id);
  if (!cp) throw new Error('Channel partner not found');

  const commissionPct = input.commission_pct ?? cp.default_commission_pct;

  const { data, error } = await supabase
    .schema('mih')
    .from('cp_commission_accruals')
    .insert({
      org_id: input.org_id,
      cp_id: input.cp_id,
      project_id: input.project_id ?? null,
      booking_value: input.booking_value,
      commission_pct: commissionPct,
      attribution_result_id: input.attribution_result_id ?? null,
      conversion_event_id: input.conversion_event_id ?? null,
      state: 'earned',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CpCommissionAccrual;
}

export async function approveAccrual(
  id: string,
  orgId: string,
  approvedBy: string,
): Promise<CpCommissionAccrual> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('cp_commission_accruals')
    .update({
      state: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CpCommissionAccrual;
}

export async function listAccruals(cpId: string, orgId: string): Promise<CpCommissionAccrual[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('cp_commission_accruals')
    .select('*')
    .eq('cp_id', cpId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CpCommissionAccrual[];
}

export async function generateApiKey(
  cpId: string,
  orgId: string,
  scopes: string[] = ['leads:write'],
  expiresAt?: string,
): Promise<GenerateApiKeyResult> {
  const supabase = getSupabaseAdmin();

  const rawKey = `cp_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { data, error } = await supabase
    .schema('mih')
    .from('cp_api_keys')
    .insert({
      org_id: orgId,
      cp_id: cpId,
      api_key_hash: keyHash,
      scopes,
      expires_at: expiresAt ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    api_key: rawKey,
    record: data as CpApiKey,
  };
}

export async function listApiKeys(cpId: string, orgId: string): Promise<CpApiKey[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('cp_api_keys')
    .select('id, org_id, cp_id, scopes, expires_at, revoked_at, last_used_at, created_at')
    .eq('cp_id', cpId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((k) => ({ ...k, api_key_hash: '[redacted]' })) as CpApiKey[];
}
