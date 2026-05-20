import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type DedupRulesConfig = {
  id: string;
  phone_window_hours: number;
  post_window_behavior: 'new_lead' | 'merge_existing';
  email_dedup_enabled: boolean;
  fuzzy_phone_enabled: boolean;
  updated_at: string;
};

const DEFAULT_RULES = {
  phone_window_hours: 24,
  post_window_behavior: 'new_lead' as const,
  email_dedup_enabled: false,
  fuzzy_phone_enabled: false,
};

const SELECT_COLS =
  'id, phone_window_hours, post_window_behavior, email_dedup_enabled, fuzzy_phone_enabled, updated_at';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('dedup_rules')
    .select(SELECT_COLS)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    // Create default rules for this org
    const { data: created, error: createErr } = await supabase
      .from('dedup_rules')
      .insert({ organization_id: orgId, ...DEFAULT_RULES })
      .select(SELECT_COLS)
      .single();
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    return NextResponse.json({ rules: created });
  }

  return NextResponse.json({ rules: data });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = (await req.json()) as Partial<DedupRulesConfig>;

  // Validate phone_window_hours range
  if (body.phone_window_hours !== undefined) {
    const hours = body.phone_window_hours;
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      return NextResponse.json(
        { error: 'phone_window_hours must be integer 1–720' },
        { status: 400 },
      );
    }
  }

  // Validate post_window_behavior enum
  if (
    body.post_window_behavior !== undefined &&
    body.post_window_behavior !== 'new_lead' &&
    body.post_window_behavior !== 'merge_existing'
  ) {
    return NextResponse.json(
      { error: 'post_window_behavior must be "new_lead" or "merge_existing"' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.phone_window_hours !== undefined) updates.phone_window_hours = body.phone_window_hours;
  if (body.post_window_behavior !== undefined)
    updates.post_window_behavior = body.post_window_behavior;
  if (body.email_dedup_enabled !== undefined)
    updates.email_dedup_enabled = body.email_dedup_enabled;
  if (body.fuzzy_phone_enabled !== undefined) updates.fuzzy_phone_enabled = body.fuzzy_phone_enabled;

  const { data, error } = await supabase
    .from('dedup_rules')
    .update(updates)
    .eq('organization_id', orgId)
    .select(SELECT_COLS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write audit log — actor_type 'system' per schema CHECK constraint
  await supabase.from('audit_log').insert({
    organization_id: orgId,
    actor_type: 'system',
    action: 'dedup_rules.updated',
    table_name: 'dedup_rules',
    record_id: data.id,
    request_id: crypto.randomUUID(),
    after_state: updates,
  });

  return NextResponse.json({ ok: true, rules: data });
}
