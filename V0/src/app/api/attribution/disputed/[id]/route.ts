import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const VALID_STATES = new Set(['open', 'in_review', 'resolved', 'escalated']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let body: { state?: string; resolution_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.state) {
    return NextResponse.json({ error: 'state is required' }, { status: 400 });
  }

  if (!VALID_STATES.has(body.state)) {
    return NextResponse.json(
      { error: `Invalid state. Must be one of: ${[...VALID_STATES].join(', ')}` },
      { status: 400 },
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const updates: Record<string, unknown> = { state: body.state };
  if ('resolution_notes' in body) updates.resolution_notes = body.resolution_notes ?? null;
  if (body.state === 'resolved') updates.resolved_at = new Date().toISOString();

  const { data, error } = await supabase
    .schema('mih')
    .from('disputed_attributions')
    .update(updates)
    .eq('org_id', orgId)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Disputed attribution not found' }, { status: 404 });
  return NextResponse.json({ disputed_attribution: data });
}
