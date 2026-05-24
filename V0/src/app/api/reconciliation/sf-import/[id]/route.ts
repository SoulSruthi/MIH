import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const [jobRes, errorsRes] = await Promise.all([
    supabase.schema('mih').from('sf_import_jobs').select('*').eq('id', params.id).eq('org_id', orgId).single(),
    supabase.schema('mih').from('sf_import_row_errors').select('*').eq('job_id', params.id).eq('org_id', orgId).limit(100),
  ]);

  if (jobRes.error || !jobRes.data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ job: jobRes.data, errors: errorsRes.data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: { rows?: Record<string, string>[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = body.rows ?? [];
  const supabase = getSupabaseAdmin();

  // Fetch job to determine kind
  const { data: job, error: jobErr } = await supabase
    .schema('mih')
    .from('sf_import_jobs')
    .select('id, job_kind, org_id')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Mark processing
  await supabase
    .schema('mih')
    .from('sf_import_jobs')
    .update({ status: 'processing', total_rows: rows.length })
    .eq('id', params.id);

  const jobKind = (job as Record<string, unknown>).job_kind as string;
  let processed = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      if (jobKind === 'leads') {
        const firstName = row.FirstName ?? '';
        const lastName = row.LastName ?? '';
        const name = row.Name ?? (`${firstName} ${lastName}`.trim() || 'Unknown');
        const phone = row.Phone ?? row.MobilePhone ?? '';

        if (!phone) {
          throw new Error('Missing phone number');
        }

        const { error: insertErr } = await supabase
          .schema('mih')
          .from('raw_leads')
          .insert({
            org_id: orgId,
            name,
            phone_e164: phone,
            email: row.Email ?? null,
            source_campaign_name: row.LeadSource ?? 'Salesforce Import',
            ingested_at: row.CreatedDate ? new Date(row.CreatedDate).toISOString() : new Date().toISOString(),
            dedup_status: 'pending',
            dedup_reason: 'sf_import',
          });

        if (insertErr) throw new Error(insertErr.message);

      } else if (jobKind === 'opportunities') {
        const amount = parseFloat(row.Amount ?? '0');
        const closeDate = row.CloseDate ? new Date(row.CloseDate).toISOString() : new Date().toISOString();

        const { error: insertErr } = await supabase
          .schema('mih')
          .from('conversion_events')
          .insert({
            org_id: orgId,
            event_code: row.StageName?.toLowerCase() === 'closed won' ? 'deal_won' : 'deal_created',
            occurred_at: closeDate,
            deal_value_paise: Math.round(amount * 100),
          });

        if (insertErr) throw new Error(insertErr.message);

      } else {
        // contacts, calls, comments — log as raw audit for now
        await supabase.schema('mih').from('sf_import_row_errors').insert({
          org_id: orgId,
          job_id: params.id,
          row_number: processed + errors + 1,
          raw_row: row as Record<string, unknown>,
          error_message: `Import of ${jobKind} not yet implemented — row logged for review`,
        });
        errors++;
        continue;
      }

      processed++;
    } catch (err) {
      errors++;
      await supabase.schema('mih').from('sf_import_row_errors').insert({
        org_id: orgId,
        job_id: params.id,
        row_number: processed + errors,
        raw_row: row as Record<string, unknown>,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Mark completed
  await supabase
    .schema('mih')
    .from('sf_import_jobs')
    .update({
      status: errors === rows.length && rows.length > 0 ? 'failed' : 'completed',
      processed_rows: processed,
      error_rows: errors,
      completed_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  return NextResponse.json({ processed, errors, job_id: params.id });
}
