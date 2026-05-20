import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // orgId

  if (!code || !state) {
    return NextResponse.redirect(new URL('/admin/connectors?error=missing_params', req.url));
  }

  const orgId = decodeURIComponent(state);

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL('/admin/connectors?error=server_misconfigured', req.url));
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host') ?? 'localhost:3000'}`;
  const callbackUrl = `${baseUrl}/api/admin/connectors/meta-oauth/callback`;

  // Exchange code for access token
  const tokenParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: callbackUrl,
    code,
  });

  let tokenData: TokenResponse;
  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`,
      { method: 'GET' },
    );
    tokenData = (await tokenRes.json()) as TokenResponse;
  } catch {
    return NextResponse.redirect(new URL('/admin/connectors?error=token_exchange_failed', req.url));
  }

  if (!tokenData.access_token) {
    const errMsg = encodeURIComponent(tokenData.error_description ?? tokenData.error ?? 'token_error');
    return NextResponse.redirect(new URL(`/admin/connectors?error=${errMsg}`, req.url));
  }

  const supabase = getSupabaseAdmin();

  const { error: upsertError } = await supabase
    .from('org_connector_configs')
    .upsert(
      {
        organization_id: orgId,
        connector_id: 'facebook_ads',
        is_enabled: true,
        config: { access_token: tokenData.access_token },
        updated_at: new Date().toISOString(),
      } as unknown as never,
      { onConflict: 'organization_id,connector_id' },
    );

  if (upsertError) {
    console.error('[meta-oauth-callback] upsert error', upsertError);
    return NextResponse.redirect(new URL('/admin/connectors?error=db_error', req.url));
  }

  return NextResponse.redirect(new URL('/admin/connectors?connected=meta', req.url));
}
