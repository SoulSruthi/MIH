import { NextRequest, NextResponse } from 'next/server';
import { getAuditTrail, addNote } from '@/modules/reconciliation/resolver';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  try {
    const audit = await getAuditTrail(params.id, orgId);
    return NextResponse.json({ audit });
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.note) {
    return NextResponse.json({ error: 'note is required' }, { status: 400 });
  }

  try {
    const entry = await addNote(
      params.id,
      orgId,
      (body.actor_id as string) ?? 'system',
      body.note as string,
    );
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
