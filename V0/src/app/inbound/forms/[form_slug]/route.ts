import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { mihIngest } from '@/modules/mih-ingestion';

/**
 * POST /inbound/forms/:form_slug
 * Universal webform endpoint — unauthenticated.
 * Saves to mih.raw_inbox via the mihIngest module.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ form_slug: string }> },
): Promise<NextResponse> {
  const { form_slug } = await params;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Look up the webform template
  const { data: template, error: tplErr } = await supabase
    .schema('mih')
    .from('webform_templates')
    .select('*')
    .eq('form_slug', form_slug)
    .eq('is_active', true)
    .single();

  if (tplErr || !template) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  const tpl = template as {
    org_id: string;
    activity_id: string | null;
    project_id: string | null;
    thank_you_url: string | null;
  };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const phone = (body.phone ?? body.mobile ?? body.phone_number ?? '') as string;
  const email = (body.email ?? null) as string | null;
  const name = (body.name ?? body.full_name ?? null) as string | null;

  const result = await mihIngest(
    {
      phone,
      email,
      name,
      rawPayload: body,
      ingestionPath: 'webform',
      activityId: tpl.activity_id,
      projectId: tpl.project_id,
    },
    tpl.org_id,
    { supabaseAdmin: supabase },
  );

  if (result.status === 'normalize_error' || result.status === 'validation_error') {
    return NextResponse.json({ error: result.message }, { status: 422 });
  }

  return NextResponse.json(
    {
      status: result.status,
      thank_you_url: tpl.thank_you_url ?? null,
    },
    { status: result.status === 'inserted' ? 201 : 200 },
  );
}
