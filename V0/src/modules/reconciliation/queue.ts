import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assignSLADeadline } from './sla';
import type {
  ReconciliationItem,
  CreateReconciliationItemInput,
} from './types';

export async function createItem(
  input: CreateReconciliationItemInput,
): Promise<ReconciliationItem> {
  const supabase = getSupabaseAdmin();

  const severity = input.severity ?? 'normal';
  const slaDeadline = assignSLADeadline(severity);

  const { data, error } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .insert({
      org_id: input.org_id,
      item_type: input.item_type,
      severity,
      monetary_impact: input.monetary_impact ?? null,
      cluster_id: input.cluster_id ?? null,
      origin_event_id: input.origin_event_id ?? null,
      context: input.context ?? {},
      assigned_to: input.assigned_to ?? null,
      sla_deadline_at: slaDeadline.toISOString(),
      state: 'open',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ReconciliationItem;
}

export async function getItem(
  id: string,
  orgId: string,
): Promise<ReconciliationItem | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error) return null;
  return data as ReconciliationItem;
}

export async function listItems(
  orgId: string,
  params: {
    state?: string;
    severity?: string;
    item_type?: string;
    assigned_to?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: ReconciliationItem[]; total: number }> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .schema('mih')
    .from('reconciliation_items')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (params.state) query = query.eq('state', params.state);
  if (params.severity) query = query.eq('severity', params.severity);
  if (params.item_type) query = query.eq('item_type', params.item_type);
  if (params.assigned_to) query = query.eq('assigned_to', params.assigned_to);
  if (params.limit) query = query.limit(params.limit);
  if (params.offset) query = query.range(params.offset, params.offset + (params.limit ?? 20) - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as ReconciliationItem[], total: count ?? 0 };
}

export async function updateState(
  id: string,
  orgId: string,
  updates: Partial<ReconciliationItem>,
  actorId?: string,
  note?: string,
): Promise<ReconciliationItem> {
  const supabase = getSupabaseAdmin();

  const existing = await getItem(id, orgId);
  if (!existing) throw new Error('Item not found');

  const { data, error } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (updates.state && updates.state !== existing.state) {
    await supabase.schema('mih').from('reconciliation_audit').insert({
      org_id: orgId,
      item_id: id,
      action: 'state_change',
      actor_id: actorId ?? null,
      old_value: { state: existing.state },
      new_value: { state: updates.state },
      note: note ?? null,
    });
  }

  return data as ReconciliationItem;
}

export async function deduplicateItem(
  orgId: string,
  itemType: string,
  clusterId?: string,
  originEventId?: string,
): Promise<ReconciliationItem | null> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .schema('mih')
    .from('reconciliation_items')
    .select('*')
    .eq('org_id', orgId)
    .eq('item_type', itemType)
    .not('state', 'in', '(resolved,closed,expired)');

  if (clusterId) query = query.eq('cluster_id', clusterId);
  if (originEventId) query = query.eq('origin_event_id', originEventId);

  const { data } = await query.single();
  return data as ReconciliationItem | null;
}
