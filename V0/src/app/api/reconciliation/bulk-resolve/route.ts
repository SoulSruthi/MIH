import { NextRequest, NextResponse } from 'next/server';
import { resolveItem } from '@/modules/reconciliation/resolver';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ids = body.ids as string[] | undefined;
  const resolution = body.resolution as string | undefined;
  const resolvedBy = (body.resolved_by as string) ?? 'system';

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
  }
  if (!resolution) {
    return NextResponse.json({ error: 'resolution is required' }, { status: 400 });
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      await resolveItem(id, orgId, resolution, resolvedBy, body.resolution_actions as Record<string, unknown> | undefined);
      results.push({ id, success: true });
    } catch (err) {
      results.push({ id, success: false, error: (err as Error).message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({ results, resolved: successCount, total: ids.length });
}
