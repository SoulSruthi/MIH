import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrgDedupRules } from './types.js';

const DEFAULTS: OrgDedupRules = {
  phone_window_hours: 24,
  post_window_behavior: 'new_lead',
};

export async function getOrgDedupRules(
  supabaseAdmin: SupabaseClient,
  organizationId: string,
): Promise<OrgDedupRules> {
  const { data, error } = await supabaseAdmin
    .from('dedup_rules')
    .select('phone_window_hours, post_window_behavior')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(`dedup_rules fetch failed: ${error.message}`);
  if (!data) return DEFAULTS;

  return {
    phone_window_hours: data.phone_window_hours as number,
    post_window_behavior: data.post_window_behavior as OrgDedupRules['post_window_behavior'],
  };
}
