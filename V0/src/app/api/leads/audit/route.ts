import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type DedupAuditEntry = {
  raw_lead_id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  source: { id: string; name: string; source_type: string } | null;
  source_campaign_name: string | null;
  ingested_at: string;
  dedup_reason: 'within_window' | 'post_window_merge' | null;
  merged_into: {
    id: string;
    primary_name: string;
    primary_phone_e164: string;
    known_names: string[];
  } | null;
};

export type DedupAuditResponse = {
  entries: DedupAuditEntry[];
  total: number;
  page: number;
  per_page: number;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { data, error, count } = await supabase
    .from('raw_leads')
    .select(
      'id, name, phone_e164, email, source_campaign_name, ingested_at, dedup_reason, unique_lead_id, sources!source_id(id, name, source_type), unique_leads!unique_lead_id(id, primary_name, primary_phone_e164, known_names)',
      { count: 'exact' },
    )
    .eq('organization_id', orgId)
    .eq('dedup_status', 'duplicate')
    .order('ingested_at', { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries: DedupAuditEntry[] = (data ?? []).map((row: Record<string, unknown>) => ({
    raw_lead_id: row.id as string,
    name: row.name as string,
    phone_e164: row.phone_e164 as string,
    email: row.email as string | null,
    source: row.sources as DedupAuditEntry['source'],
    source_campaign_name: row.source_campaign_name as string | null,
    ingested_at: row.ingested_at as string,
    dedup_reason: row.dedup_reason as DedupAuditEntry['dedup_reason'],
    merged_into: row.unique_leads as DedupAuditEntry['merged_into'],
  }));

  const response: DedupAuditResponse = { entries, total: count ?? 0, page, per_page: perPage };
  return NextResponse.json(response);
}
