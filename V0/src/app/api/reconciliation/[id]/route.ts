import { NextRequest, NextResponse } from 'next/server';
import { getItem, updateState } from '@/modules/reconciliation/queue';
import { resolveItem } from '@/modules/reconciliation/resolver';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const item = await getItem(params.id, orgId);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ item });
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
    if (body.action === 'resolve') {
      if (!body.resolution) {
        return NextResponse.json({ error: 'resolution is required' }, { status: 400 });
      }
      const item = await resolveItem(
        params.id,
        orgId,
        body.resolution as string,
        (body.resolved_by as string) ?? 'system',
        body.resolution_actions as Record<string, unknown> | undefined,
      );
      return NextResponse.json({ item });
    }

    const item = await updateState(
      params.id,
      orgId,
      body,
      body.actor_id as string | undefined,
      body.note as string | undefined,
    );
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
