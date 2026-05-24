import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveActions } from '@/modules/reconciliation/resolver';
import type { RecItem } from '@/modules/reconciliation/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  return NextResponse.json({ item: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch existing item
  const { data: existing, error: fetchErr } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let auditAction = 'updated';
  let auditNote: string | null = null;

  if (body.action === 'resolve') {
    const resolutionText = body.resolution as string;
    const resolutionOption = body.resolution_actions?.action_type as string | undefined;
    const result = resolutionOption
      ? resolveActions(existing as RecItem, resolutionOption)
      : { resolution: resolutionText, actions_taken: [] };

    updates.state = 'resolved';
    updates.resolution = resolutionText;
    updates.resolution_actions = {
      action_type: resolutionOption ?? null,
      actions_taken: result.actions_taken,
      resolved_by: body.resolved_by ?? 'unknown',
      resolved_at: new Date().toISOString(),
    };
    auditAction = 'resolved';
    auditNote = resolutionText;
  } else if (body.state) {
    updates.state = body.state;
    auditAction = `state_changed_to_${body.state}`;
  }

  const { data: updated, error: updateErr } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Write audit entry
  await supabase.schema('mih').from('reconciliation_item_audit').insert({
    item_id: params.id,
    org_id: orgId,
    action: auditAction,
    actor_id: body.resolved_by ?? null,
    old_value: { state: (existing as RecItem).state },
    new_value: { state: updates.state ?? (existing as RecItem).state },
    note: auditNote,
  });

  return NextResponse.json({ item: updated });
}
