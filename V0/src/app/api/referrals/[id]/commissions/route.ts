import { NextRequest, NextResponse } from 'next/server';
import { listCommissions, createAccrual } from '@/modules/referrals/service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const commissions = await listCommissions(params.id, orgId);
    return NextResponse.json({ commissions });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.booking_value) {
    return NextResponse.json({ error: 'booking_value is required' }, { status: 400 });
  }

  try {
    const accrual = await createAccrual({
      org_id: orgId,
      referrer_id: params.id,
      booking_value: body.booking_value as number,
      commission_pct: body.commission_pct as number | undefined,
      project_id: body.project_id as string | undefined,
      reward_kind: body.reward_kind as string | undefined,
      attribution_result_id: body.attribution_result_id as string | undefined,
      conversion_event_id: body.conversion_event_id as string | undefined,
    });
    return NextResponse.json({ commission: accrual }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
