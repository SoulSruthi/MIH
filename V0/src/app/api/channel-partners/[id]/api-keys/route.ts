import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey, listApiKeys } from '@/modules/channel-partners/service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const keys = await listApiKeys(params.id, orgId);
    return NextResponse.json({ api_keys: keys });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

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
    // body optional
  }

  try {
    const result = await generateApiKey(
      params.id,
      orgId,
      (body.scopes as string[]) ?? ['leads:write'],
      body.expires_at as string | undefined,
    );
    return NextResponse.json(
      { api_key: result.api_key, record: result.record },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
