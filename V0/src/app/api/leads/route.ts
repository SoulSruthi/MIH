import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type UniqueLeadRow = {
  id: string;
  primary_name: string;
  known_names: string[];
  primary_phone_e164: string;
  primary_email: string | null;
  primary_source: { id: string; name: string; source_type: string } | null;
  total_touches: number;
  touch_sources: unknown[];
  first_seen_at: string;
  last_seen_at: string;
  crm_handoff_status: string;
};

export type UniqueLeadsResponse = {
  leads: UniqueLeadRow[];
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
  const search = searchParams.get('search') ?? '';
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let query = supabase
    .from('unique_leads')
    .select(
      'id, primary_name, known_names, primary_phone_e164, primary_email, primary_source_id, total_touches, touch_sources, first_seen_at, last_seen_at, crm_handoff_status, sources!primary_source_id(id, name, source_type)',
      { count: 'exact' },
    )
    .eq('organization_id', orgId)
    .order('last_seen_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`primary_name.ilike.%${search}%,primary_phone_e164.ilike.%${search}%,primary_email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads: UniqueLeadRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    primary_name: row.primary_name as string,
    known_names: (row.known_names as string[]) ?? [],
    primary_phone_e164: row.primary_phone_e164 as string,
    primary_email: row.primary_email as string | null,
    primary_source: row.sources as UniqueLeadRow['primary_source'],
    total_touches: row.total_touches as number,
    touch_sources: (row.touch_sources as unknown[]) ?? [],
    first_seen_at: row.first_seen_at as string,
    last_seen_at: row.last_seen_at as string,
    crm_handoff_status: row.crm_handoff_status as string,
  }));

  const response: UniqueLeadsResponse = { leads, total: count ?? 0, page, per_page: perPage };
  return NextResponse.json(response);
}
