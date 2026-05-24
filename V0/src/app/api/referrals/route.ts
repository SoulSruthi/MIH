import { NextRequest, NextResponse } from 'next/server';
import { listReferrers, createReferrer } from '@/modules/referrals/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const referrers = await listReferrers(orgId);
    return NextResponse.json({ referrers });
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
    const referrer = await createReferrer({
      org_id: orgId,
      name: body.name as string,
      contact_email: body.contact_email as string | undefined,
      contact_phone: body.contact_phone as string | undefined,
      customer_cluster_id: body.customer_cluster_id as string | undefined,
      crm_customer_id: body.crm_customer_id as string | undefined,
      default_commission_pct: body.default_commission_pct as number | undefined,
      reward_preference: body.reward_preference as 'cash' | 'voucher' | 'white_goods' | 'choice' | undefined,
      consent_state: body.consent_state as 'pending' | 'opted_in' | 'opted_out' | 'revoked' | undefined,
      consent_channels: body.consent_channels as string[] | undefined,
    });
    return NextResponse.json({ referrer }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
