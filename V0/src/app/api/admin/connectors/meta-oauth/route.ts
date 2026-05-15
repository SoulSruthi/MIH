import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  if (!appId) return NextResponse.json({ error: 'META_APP_ID not configured' }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host') ?? 'localhost:3000'}`;
  const callbackUrl = `${baseUrl}/api/admin/connectors/meta-oauth/callback`;

  const url =
    `https://www.facebook.com/dialog/oauth` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&scope=leads_retrieval,pages_read_engagement` +
    `&state=${encodeURIComponent(orgId)}`;

  return NextResponse.json({ url });
}
