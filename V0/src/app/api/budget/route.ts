import { NextRequest, NextResponse } from 'next/server';
import { createBudget, listBudgets } from '@/modules/budget/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const budgets = await listBudgets(orgId);
    return NextResponse.json({ budgets });
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

  if (!body.fy_year) {
    return NextResponse.json({ error: 'fy_year is required' }, { status: 400 });
  }

  try {
    const budget = await createBudget({
      org_id: orgId,
      fy_year: body.fy_year as number,
      project_id: body.project_id as string | undefined,
      plan_code: body.plan_code as string | undefined,
      total_booking_target_value: body.total_booking_target_value as number | undefined,
      default_spend_pct: body.default_spend_pct as number | undefined,
      notes: body.notes as string | undefined,
    });
    return NextResponse.json({ budget }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
