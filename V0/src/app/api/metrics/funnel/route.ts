import { NextRequest, NextResponse } from 'next/server';
import { getFunnelBySource, getFunnelByProject } from '@/modules/roi-reporting/funnel-aggregator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const url = new URL(req.url);
  const groupBy = url.searchParams.get('group_by') ?? 'source';
  const periodStart = url.searchParams.get('period_start') ?? undefined;
  const periodEnd = url.searchParams.get('period_end') ?? undefined;
  const projectId = url.searchParams.get('project_id') ?? undefined;

  try {
    if (groupBy === 'project') {
      const funnel = await getFunnelByProject(orgId, { periodStart, periodEnd });
      return NextResponse.json({ funnel, group_by: 'project' });
    }

    const funnel = await getFunnelBySource(orgId, { periodStart, periodEnd, projectId });
    return NextResponse.json({ funnel, group_by: 'source' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
