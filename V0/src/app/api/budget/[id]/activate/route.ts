import { NextRequest, NextResponse } from 'next/server';
import { activateBudget } from '@/modules/budget/service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  try {
    const budget = await activateBudget({
      id: params.id,
      org_id: orgId,
      approved_by: body.approved_by as string | undefined,
    });
    return NextResponse.json({ budget });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
