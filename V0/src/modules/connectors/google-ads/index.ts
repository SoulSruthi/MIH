import { registerConnector } from '../_kernel/registry.js';
import type {
  SourceConnector,
  DecryptedCredentials,
  SourceConfig,
  SpendRecord,
} from '../_kernel/types.js';
import { normalizeGoogleAdsLead } from './normalizer.js';
import { fetchGoogleAdsLeads, fetchGoogleAdsSpend } from './client.js';
import { getGoogleAdsAuthUrl, exchangeGoogleAdsCode } from './oauth.js';
import type { GoogleAdsCreds } from './types.js';

// Fallback conversion rate — production should use a live FX API
const USD_TO_INR = 83.5;

const googleAdsConnector: SourceConnector = {
  kind: 'google_ads',
  displayName: 'Google Ads',
  vendorDocsUrl: 'https://developers.google.com/google-ads/api/docs/start',
  sourceChannel: 'paid_search',
  authKind: 'oauth2',
  credentialFields: [
    { name: 'customer_id', label: 'Customer ID', kind: 'text', required: true },
    { name: 'developer_token', label: 'Developer Token', kind: 'password', required: true },
    { name: 'client_id', label: 'OAuth Client ID', kind: 'text', required: true },
    { name: 'client_secret', label: 'OAuth Client Secret', kind: 'password', required: true },
  ],

  async testConnection(creds: DecryptedCredentials, config: SourceConfig) {
    const googleCreds = creds as unknown as GoogleAdsCreds;
    const customerId = (config['customer_id'] as string | undefined) ?? googleCreds.customer_id;
    if (!customerId) return { ok: false, message: 'customer_id not set in config or credentials' };
    try {
      await fetchGoogleAdsLeads(googleCreds, customerId, 'test', new Date());
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  },

  async pollLeads(creds: DecryptedCredentials, config: SourceConfig, since: Date) {
    const googleCreds = creds as unknown as GoogleAdsCreds;
    const customerId = (config['customer_id'] as string) ?? googleCreds.customer_id;
    const formId = config['form_id'] as string;
    const leads = await fetchGoogleAdsLeads(googleCreds, customerId, formId, since);
    return leads.map((l) => normalizeGoogleAdsLead(l));
  },

  normalizePayload(vendorPayload: unknown) {
    return normalizeGoogleAdsLead(vendorPayload as Parameters<typeof normalizeGoogleAdsLead>[0]);
  },

  async pollSpend(
    creds: DecryptedCredentials,
    config: SourceConfig,
    date: Date,
  ): Promise<SpendRecord[]> {
    const googleCreds = creds as unknown as GoogleAdsCreds;
    const customerId = (config['customer_id'] as string) ?? googleCreds.customer_id;
    const rows = await fetchGoogleAdsSpend(googleCreds, customerId, date);
    return rows.map((r) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      date,
      spendInr:
        Math.round((parseInt(r.costMicros, 10) / 1_000_000) * USD_TO_INR * 100) / 100,
      impressions: parseInt(r.impressions, 10),
      clicks: parseInt(r.clicks, 10),
    }));
  },

  getOAuthAuthorizationUrl(config: SourceConfig): string {
    return getGoogleAdsAuthUrl(
      config['client_id'] as string,
      config['redirect_uri'] as string,
      config['state'] as string,
    );
  },

  async exchangeOAuthCode(code: string, config: SourceConfig) {
    return exchangeGoogleAdsCode(
      code,
      config['client_id'] as string,
      config['client_secret'] as string,
      config['redirect_uri'] as string,
    );
  },
};

registerConnector(googleAdsConnector);

export { googleAdsConnector };
export { normalizeGoogleAdsLead } from './normalizer.js';
