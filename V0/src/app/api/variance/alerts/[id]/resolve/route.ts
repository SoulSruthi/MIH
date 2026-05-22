import { NextRequest, NextResponse } from 'next/server';
import { resolveAlert } from '@/modules/roi-reporting/variance-detector';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const alert = await resolveAlert(params.id, orgId);
    return NextResponse.json({ alert });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
