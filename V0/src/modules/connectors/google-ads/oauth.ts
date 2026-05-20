import type { OAuthTokenSet } from '../_kernel/types';

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2';
const SCOPES = ['https://www.googleapis.com/auth/adwords'].join(' ');

export function getGoogleAdsAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_OAUTH_BASE}/auth?${params.toString()}`;
}

export async function exchangeGoogleAdsCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<OAuthTokenSet> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google OAuth exchange failed: ${res.status}`);
  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
    scope: data.scope,
  };
}
