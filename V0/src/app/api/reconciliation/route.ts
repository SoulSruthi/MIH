import { NextRequest, NextResponse } from 'next/server';
import { createItem, listItems } from '@/modules/reconciliation/queue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const url = new URL(req.url);
  const state = url.searchParams.get('state') ?? undefined;
  const severity = url.searchParams.get('severity') ?? undefined;
  const itemType = url.searchParams.get('item_type') ?? undefined;
  const assignedTo = url.searchParams.get('assigned_to') ?? undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  try {
    const result = await listItems(orgId, { state, severity, item_type: itemType, assigned_to: assignedTo, limit, offset });
    return NextResponse.json(result);
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

  if (!body.item_type) {
    return NextResponse.json({ error: 'item_type is required' }, { status: 400 });
  }

  try {
    const item = await createItem({
      org_id: orgId,
      item_type: body.item_type as Parameters<typeof createItem>[0]['item_type'],
      severity: body.severity as Parameters<typeof createItem>[0]['severity'],
      monetary_impact: body.monetary_impact as number | undefined,
      cluster_id: body.cluster_id as string | undefined,
      origin_event_id: body.origin_event_id as string | undefined,
      context: body.context as Record<string, unknown> | undefined,
      assigned_to: body.assigned_to as string | undefined,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
