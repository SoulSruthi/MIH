import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('sf_import_jobs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: { job_kind?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const jobKind = body.job_kind;
  if (!jobKind) return NextResponse.json({ error: 'job_kind required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('sf_import_jobs')
    .insert({
      org_id: orgId,
      job_kind: jobKind,
      label: body.label ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ job: data }, { status: 201 });
}
