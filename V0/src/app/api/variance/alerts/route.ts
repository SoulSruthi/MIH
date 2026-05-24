import { NextRequest, NextResponse } from 'next/server';
import { listAlerts } from '@/modules/roi-reporting/variance-detector';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const url = new URL(req.url);
  const resolvedParam = url.searchParams.get('resolved');
  const severity = url.searchParams.get('severity') ?? undefined;
  const projectId = url.searchParams.get('project_id') ?? undefined;

  let resolved: boolean | undefined;
  if (resolvedParam === 'true') resolved = true;
  else if (resolvedParam === 'false') resolved = false;

  try {
    const alerts = await listAlerts(orgId, { resolved, severity, projectId });
    return NextResponse.json({ alerts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
