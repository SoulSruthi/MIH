import { registerConnector } from '../_kernel/registry';
import type { SourceConnector, DecryptedCredentials, SourceConfig, RawLeadInput } from '../_kernel/types';
import { fetchLead, listLeads, listForms } from './client';
import { normalizeMetaLead } from './normalizer';
import { getAuthorizationUrl, exchangeCode, refreshToken } from './oauth';
import { pullDailySpend } from './spend';
import type { MetaSourceConfig } from './types';
import type { OAuthTokenSet } from '../_kernel/types';

const metaLeadAdsConnector: SourceConnector = {
  kind: 'meta_lead_ads',
  displayName: 'Meta Lead Ads',
  vendorDocsUrl: 'https://developers.facebook.com/docs/marketing-api/guides/lead-ads/',
  sourceChannel: 'paid_social',
  authKind: 'oauth2',
  credentialFields: [
    { name: 'meta_page_access_token', label: 'Page Access Token', kind: 'password', required: true },
    { name: 'meta_ad_account_id', label: 'Ad Account ID (act_xxxxx)', kind: 'text', required: true },
  ],

  async testConnection(creds: DecryptedCredentials, config: SourceConfig) {
    const token = creds['meta_page_access_token'];
    if (!token) return { ok: false, message: 'meta_page_access_token credential missing' };
    const metaConfig = config as unknown as MetaSourceConfig;
    if (!metaConfig.page_id) return { ok: false, message: 'page_id not set in source config' };
    try {
      await listForms(metaConfig.page_id, token);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  },

  async pollLeads(creds: DecryptedCredentials, config: SourceConfig, since: Date): Promise<RawLeadInput[]> {
    const token = creds['meta_page_access_token'];
    if (!token) throw new Error('meta_page_access_token credential missing');
    const metaConfig = config as unknown as MetaSourceConfig;
    const { page_id, form_ids } = metaConfig;

    const formIds = form_ids?.length
      ? form_ids
      : await listForms(page_id, token);

    const allLeads: RawLeadInput[] = [];
    for (const formId of formIds) {
      const raw = await listLeads(formId, token, since);
      for (const payload of raw) {
        try {
          allLeads.push(normalizeMetaLead(payload));
        } catch {
          // Normalization failure logged by poller → DLQ
        }
      }
    }
    return allLeads;
  },

  normalizePayload(vendorPayload: unknown): RawLeadInput {
    return normalizeMetaLead(vendorPayload as Parameters<typeof normalizeMetaLead>[0]);
  },

  async pollSpend(creds: DecryptedCredentials, config: SourceConfig, date: Date) {
    return pullDailySpend(creds, config, date);
  },

  getOAuthAuthorizationUrl(config: SourceConfig): string {
    return getAuthorizationUrl(config, crypto.randomUUID());
  },

  async exchangeOAuthCode(code: string): Promise<OAuthTokenSet> {
    return exchangeCode(code);
  },

  async refreshOAuthToken(token: OAuthTokenSet): Promise<OAuthTokenSet> {
    return refreshToken(token);
  },
};

registerConnector(metaLeadAdsConnector);

export { metaLeadAdsConnector };
export { normalizeMetaLead } from './normalizer';
export { verifyMetaSignature, handleVerificationChallenge, parseLeadgenNotifications } from './webhook';
export { fetchLead } from './client';
