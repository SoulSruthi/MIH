import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSourceById, updateSourceAttributes, TaxonomyError } from '@/modules/taxonomy/sources';
import type { LifecycleState } from '@/modules/taxonomy/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const source = await getSourceById(supabase, orgId, id);
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

  return NextResponse.json({ source });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { lifecycle_state, display_name, attributes } = body as {
    lifecycle_state?: LifecycleState;
    display_name?: string;
    attributes?: Record<string, unknown>;
  };

  try {
    const source = await updateSourceAttributes(supabase, orgId, id, {
      lifecycle_state,
      display_name,
      attributes,
    });
    return NextResponse.json({ source });
  } catch (err) {
    if (err instanceof TaxonomyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
