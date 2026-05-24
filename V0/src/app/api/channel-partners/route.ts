import { NextRequest, NextResponse } from 'next/server';
import { listCPs, createCP } from '@/modules/channel-partners/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const channelPartners = await listCPs(orgId);
    return NextResponse.json({ channel_partners: channelPartners });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const cp = await createCP({
      org_id: orgId,
      name: body.name as string,
      code: body.code as string | undefined,
      contact_name: body.contact_name as string | undefined,
      contact_email: body.contact_email as string | undefined,
      contact_phone: body.contact_phone as string | undefined,
      cp_type: body.cp_type as 'individual' | 'firm' | 'sub_broker' | undefined,
      parent_cp_id: body.parent_cp_id as string | undefined,
      default_commission_pct: body.default_commission_pct as number | undefined,
      rera_number: body.rera_number as string | undefined,
    });
    return NextResponse.json({ channel_partner: cp }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
