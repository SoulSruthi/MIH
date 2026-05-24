import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getItem, updateState } from './queue';
import { executeResolutionActions } from './actions';
import type { ReconciliationItem, ReconciliationAuditEntry } from './types';

export async function resolveItem(
  id: string,
  orgId: string,
  resolution: string,
  resolvedBy: string,
  resolutionActions?: Record<string, unknown>,
): Promise<ReconciliationItem> {
  const item = await getItem(id, orgId);
  if (!item) throw new Error('Reconciliation item not found');

  if (['resolved', 'closed'].includes(item.state)) {
    throw new Error(`Item is already ${item.state}`);
  }

  // Execute downstream actions for this item type
  const actionResult = await executeResolutionActions(
    item,
    resolution,
    resolvedBy,
    resolutionActions ?? {},
  );

  const mergedActions: Record<string, unknown> = {
    ...(resolutionActions ?? {}),
    actions_taken: actionResult.actions_taken,
    execution_errors: actionResult.errors.length > 0 ? actionResult.errors : undefined,
  };

  return updateState(
    id,
    orgId,
    {
      state: 'resolved',
      resolution,
      resolution_actions: mergedActions,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    },
    resolvedBy,
    `Resolved: ${resolution}`,
  );
}

export async function buildResolutionContext(
  item: ReconciliationItem,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const context: Record<string, unknown> = {
    item_id: item.id,
    item_type: item.item_type,
    severity: item.severity,
    monetary_impact: item.monetary_impact,
    existing_context: item.context,
  };

  if (item.cluster_id) {
    const { data: cluster } = await supabase
      .schema('mih')
      .from('identity_clusters')
      .select('id, canonical_name, canonical_phone, canonical_email')
      .eq('id', item.cluster_id)
      .single();

    if (cluster) context.cluster = cluster;
  }

  const { data: auditHistory } = await supabase
    .schema('mih')
    .from('reconciliation_audit')
    .select('action, actor_id, note, created_at')
    .eq('item_id', item.id)
    .eq('org_id', item.org_id)
    .order('created_at', { ascending: true });

  context.audit_history = auditHistory ?? [];

  return context;
}

export async function getAuditTrail(
  itemId: string,
  orgId: string,
): Promise<ReconciliationAuditEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('reconciliation_audit')
    .select('*')
    .eq('item_id', itemId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ReconciliationAuditEntry[];
}

export async function addNote(
  itemId: string,
  orgId: string,
  actorId: string,
  note: string,
): Promise<ReconciliationAuditEntry> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('reconciliation_audit')
    .insert({
      org_id: orgId,
      item_id: itemId,
      action: 'note_added',
      actor_id: actorId,
      note,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ReconciliationAuditEntry;
}
