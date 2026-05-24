import { NextRequest, NextResponse } from 'next/server';
import { getBudgetPeriods } from '@/modules/budget/service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const periods = await getBudgetPeriods(params.id, orgId);
    return NextResponse.json({ periods });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
