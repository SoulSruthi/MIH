import { NextRequest, NextResponse } from 'next/server';
import { getReferrer, updateReferrer, updateConsent } from '@/modules/referrals/service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const referrer = await getReferrer(params.id, orgId);
  if (!referrer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ referrer });
}

export async function PATCH(
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

  try {
    if (body.consent_state !== undefined) {
      const referrer = await updateConsent(
        params.id,
        orgId,
        body.consent_state as string,
        body.consent_channels as string[] | undefined,
      );
      return NextResponse.json({ referrer });
    }

    const referrer = await updateReferrer(params.id, orgId, body);
    return NextResponse.json({ referrer });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
