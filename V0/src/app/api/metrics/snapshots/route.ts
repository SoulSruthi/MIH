import { NextRequest, NextResponse } from 'next/server';
import { listSnapshots, refreshMetricSnapshot } from '@/modules/roi-reporting/snapshot-refresher';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const url = new URL(req.url);
  const granularity = url.searchParams.get('granularity') as 'daily' | 'weekly' | 'monthly' | null;
  const limit = parseInt(url.searchParams.get('limit') ?? '30', 10);

  try {
    const snapshots = await listSnapshots(orgId, granularity ?? undefined, limit);
    return NextResponse.json({ snapshots });
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

  if (!body.granularity || !body.period_start || !body.period_end) {
    return NextResponse.json(
      { error: 'granularity, period_start, period_end are required' },
      { status: 400 },
    );
  }

  try {
    const snapshot = await refreshMetricSnapshot(
      orgId,
      body.granularity as 'daily' | 'weekly' | 'monthly',
      body.period_start as string,
      body.period_end as string,
      (body.dimension_key as Record<string, unknown>) ?? {},
    );
    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
