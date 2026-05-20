import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type LeadDetail = {
  id: string;
  primary_name: string;
  known_names: string[];
  primary_phone_e164: string;
  primary_email: string | null;
  total_touches: number;
  first_seen_at: string;
  last_seen_at: string;
  crm_handoff_status: string;
  primary_source: { id: string; name: string; source_type: string } | null;
  raw_leads: Array<{
    id: string;
    name: string;
    phone_e164: string;
    email: string | null;
    source: { id: string; name: string; source_type: string } | null;
    source_campaign_name: string | null;
    ingested_at: string;
    dedup_status: string;
    dedup_reason: string | null;
  }>;
  crm_events: Array<{
    id: string;
    event_type: string;
    event_at: string;
    deal_value_paise: number | null;
    source: { id: string; name: string } | null;
  }>;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { id } = await params;

  // Fetch unique lead
  const { data: lead, error: leadErr } = await supabase
    .from('unique_leads')
    .select(
      'id, primary_name, known_names, primary_phone_e164, primary_email, total_touches, first_seen_at, last_seen_at, crm_handoff_status, primary_source_id, sources!primary_source_id(id, name, source_type)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Fetch raw leads that merged into this unique lead
  const { data: rawLeads } = await supabase
    .from('raw_leads')
    .select(
      'id, name, phone_e164, email, source_campaign_name, ingested_at, dedup_status, dedup_reason, sources!source_id(id, name, source_type)',
    )
    .eq('unique_lead_id', id)
    .eq('organization_id', orgId)
    .order('ingested_at', { ascending: true });

  // Fetch CRM lifecycle events
  const { data: crmEvents } = await supabase
    .from('crm_lifecycle_events')
    .select('id, event_type, event_at, deal_value_paise, sources!source_id(id, name)')
    .eq('unique_lead_id', id)
    .eq('organization_id', orgId)
    .order('event_at', { ascending: true });

  const leadRow = lead as Record<string, unknown>;

  const detail: LeadDetail = {
    id: leadRow.id as string,
    primary_name: leadRow.primary_name as string,
    known_names: (leadRow.known_names as string[]) ?? [],
    primary_phone_e164: leadRow.primary_phone_e164 as string,
    primary_email: leadRow.primary_email as string | null,
    total_touches: leadRow.total_touches as number,
    first_seen_at: leadRow.first_seen_at as string,
    last_seen_at: leadRow.last_seen_at as string,
    crm_handoff_status: leadRow.crm_handoff_status as string,
    primary_source: leadRow.sources as LeadDetail['primary_source'],
    raw_leads: (rawLeads ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      phone_e164: r.phone_e164 as string,
      email: r.email as string | null,
      source: r.sources as LeadDetail['raw_leads'][0]['source'],
      source_campaign_name: r.source_campaign_name as string | null,
      ingested_at: r.ingested_at as string,
      dedup_status: r.dedup_status as string,
      dedup_reason: r.dedup_reason as string | null,
    })),
    crm_events: (crmEvents ?? []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      event_type: e.event_type as string,
      event_at: e.event_at as string,
      deal_value_paise: e.deal_value_paise as number | null,
      source: e.sources as LeadDetail['crm_events'][0]['source'],
    })),
  };

  return NextResponse.json(detail);
}
