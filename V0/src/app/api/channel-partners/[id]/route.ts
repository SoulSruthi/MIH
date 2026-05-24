import { NextRequest, NextResponse } from 'next/server';
import { getCP, updateCP } from '@/modules/channel-partners/service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const cp = await getCP(params.id, orgId);
  if (!cp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ channel_partner: cp });
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
    const cp = await updateCP(params.id, orgId, body);
    return NextResponse.json({ channel_partner: cp });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
