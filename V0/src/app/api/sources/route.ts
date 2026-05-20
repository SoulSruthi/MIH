import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSourceTree, createCustomSource, TaxonomyError } from '@/modules/taxonomy/sources';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    const tree = await getSourceTree(supabase, orgId);
    return NextResponse.json({ sources: tree });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

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

  const { parent_id, code, display_name, level, attributes } = body as {
    parent_id?: string;
    code?: string;
    display_name?: string;
    level?: string;
    attributes?: Record<string, unknown>;
  };

  if (!parent_id || !code || !display_name || !level) {
    return NextResponse.json(
      { error: 'parent_id, code, display_name, and level are required' },
      { status: 400 },
    );
  }

  try {
    const source = await createCustomSource(supabase, {
      org_id: orgId,
      parent_id,
      code,
      display_name,
      level: level as 'channel' | 'medium' | 'source' | 'sub_source',
      attributes: attributes ?? {},
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    if (err instanceof TaxonomyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
