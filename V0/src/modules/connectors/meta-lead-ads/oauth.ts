import type { MetaOAuthTokenResponse, MetaLongLivedTokenResponse, MetaSourceConfig } from './types.js';
import type { OAuthTokenSet, SourceConfig } from '../_kernel/types.js';

const GRAPH_BASE = 'https://graph.facebook.com/v18.0';
const SCOPES = ['ads_management', 'pages_read_engagement', 'leads_retrieval'].join(',');

/** Returns the URL to redirect org admins to for Meta Business Login. */
export function getAuthorizationUrl(config: SourceConfig, state: string): string {
  const appId = requireEnv('META_APP_ID');
  const redirectUri = getRedirectUri();
  const url = new URL('https://www.facebook.com/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  void config;
  return url.toString();
}

/** Exchanges the short-lived code for a long-lived (60-day) user access token. */
export async function exchangeCode(code: string): Promise<OAuthTokenSet> {
  const appId = requireEnv('META_APP_ID');
  const appSecret = requireEnv('META_APP_SECRET');
  const redirectUri = getRedirectUri();

  // Step 1: short-lived token
  const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }),
    signal: AbortSignal.timeout(10_000),
  });
  const shortToken = await shortRes.json() as MetaOAuthTokenResponse;
  if (!shortRes.ok) throw new Error(`Meta short-lived token exchange failed: ${JSON.stringify(shortToken)}`);

  // Step 2: long-lived token
  const longRes = await fetch(`${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken.access_token,
  }), { signal: AbortSignal.timeout(10_000) });
  const longToken = await longRes.json() as MetaLongLivedTokenResponse;
  if (!longRes.ok) throw new Error(`Meta long-lived token exchange failed: ${JSON.stringify(longToken)}`);

  const expiresAt = new Date(Date.now() + longToken.expires_in * 1000);
  return { accessToken: longToken.access_token, expiresAt };
}

/** Refreshes a long-lived token (call at day 55 before expiry). */
export async function refreshToken(token: OAuthTokenSet): Promise<OAuthTokenSet> {
  const appId = requireEnv('META_APP_ID');
  const appSecret = requireEnv('META_APP_SECRET');

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: token.accessToken,
  }), { signal: AbortSignal.timeout(10_000) });
  const refreshed = await res.json() as MetaLongLivedTokenResponse;
  if (!res.ok) throw new Error(`Meta token refresh failed: ${JSON.stringify(refreshed)}`);

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  return { accessToken: refreshed.access_token, expiresAt };
}

/** Returns true if token expires within the given number of days. */
export function isTokenExpiringSoon(config: MetaSourceConfig, withinDays = 5): boolean {
  if (!config.token_expires_at) return false;
  const expiresAt = new Date(config.token_expires_at);
  const thresholdMs = withinDays * 24 * 60 * 60 * 1000;
  return expiresAt.getTime() - Date.now() < thresholdMs;
}

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base}/api/oauth/meta/callback`;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} env var is required`);
  return val;
}
