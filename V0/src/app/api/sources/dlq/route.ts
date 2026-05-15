import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin.js';

export type DlqEntry = {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  failure_stage: string;
  error_message: string;
  retry_count: number;
  status: string;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  replayed_at: string | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
  const sourceId = searchParams.get('source_id');
  const status = searchParams.get('status'); // 'failed' | 'ignored' | 'retrying' | 'replayed' | null (all)
  const failureStage = searchParams.get('failure_stage');
  const from = (page - 1) * perPage;

  const supabase = getSupabaseAdmin();

  // sources table uses display_name and source_kind (not name/source_type)
  let query = supabase
    .from('connector_dlq')
    .select(
      'id, source_id, failure_stage, error_message, retry_count, status, raw_payload, created_at, replayed_at, sources!source_id(id, display_name, source_kind)',
      { count: 'exact' },
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (sourceId) query = query.eq('source_id', sourceId);
  if (status) query = query.eq('status', status);
  if (failureStage) query = query.eq('failure_stage', failureStage);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries: DlqEntry[] = (data ?? []).map((row: Record<string, unknown>) => {
    const src = row.sources as { id: string; display_name: string; source_kind: string } | null;
    return {
      id: row.id as string,
      source_id: row.source_id as string,
      source_name: src?.display_name ?? 'Unknown',
      source_type: src?.source_kind ?? '',
      failure_stage: row.failure_stage as string,
      error_message: row.error_message as string,
      retry_count: row.retry_count as number,
      status: row.status as string,
      raw_payload: row.raw_payload as Record<string, unknown> | null,
      created_at: row.created_at as string,
      replayed_at: row.replayed_at as string | null,
    };
  });

  return NextResponse.json({ entries, total: count ?? 0, page, per_page: perPage });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = (await req.json()) as {
    action: 'replay' | 'ignore';
    dlq_id?: string;
    source_id?: string;
  };
  if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  if (body.action === 'ignore') {
    let query = supabase
      .from('connector_dlq')
      .update({ status: 'ignored' })
      .eq('organization_id', orgId);

    if (body.dlq_id) query = query.eq('id', body.dlq_id);
    else if (body.source_id) query = query.eq('source_id', body.source_id);
    else return NextResponse.json({ error: 'dlq_id or source_id required' }, { status: 400 });

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'ignored' });
  }

  if (body.action === 'replay') {
    // Mark as 'retrying' and set replayed_at — actual re-ingestion is a V1 full feature
    let query = supabase
      .from('connector_dlq')
      .update({ status: 'retrying', replayed_at: new Date().toISOString() })
      .eq('organization_id', orgId)
      .eq('status', 'failed');

    if (body.dlq_id) query = query.eq('id', body.dlq_id);
    else if (body.source_id) query = query.eq('source_id', body.source_id);
    else return NextResponse.json({ error: 'dlq_id or source_id required' }, { status: 400 });

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('audit_log').insert({
      organization_id: orgId,
      actor_type: 'system',
      action: 'dlq.replay_requested',
      table_name: 'connector_dlq',
      record_id: body.dlq_id ?? body.source_id ?? 'batch',
      request_id: crypto.randomUUID(),
      after_state: { action: 'replay', dlq_id: body.dlq_id, source_id: body.source_id },
    });

    return NextResponse.json({ ok: true, action: 'retrying' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
