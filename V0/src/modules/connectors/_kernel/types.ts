export type SourceChannel =
  | 'paid_social'
  | 'paid_search'
  | 'aggregator'
  | 'manual'
  | 'organic';

export type CredentialField = {
  name: string;
  label: string;
  kind: 'text' | 'password' | 'url';
  required: boolean;
  hint?: string;
};

export type DecryptedCredentials = Record<string, string>;
export type SourceConfig = Record<string, unknown>;

export type TestResult =
  | { ok: true }
  | { ok: false; message: string };

export type RawLeadInput = {
  sourceExternalId: string;
  phoneE164: string;
  email?: string;
  name: string;
  sourceCampaignId?: string;
  sourceCampaignName?: string;
  sourceAdId?: string;
  sourceAdName?: string;
  sourceCreativeId?: string;
  sourceKeyword?: string;
  sourceReferrerUrl?: string;
  sourceReceivedAt: Date;
  rawPayload: unknown;
};

export type SpendRecord = {
  campaignId: string;
  campaignName?: string;
  adId?: string;
  date: Date;
  spendInr: number;
  impressions?: number;
  clicks?: number;
};

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
};

export interface SourceConnector {
  kind: string;
  displayName: string;
  vendorDocsUrl: string;
  sourceChannel: SourceChannel;

  authKind: 'oauth2' | 'api_key' | 'bearer_token' | 'basic';
  credentialFields: CredentialField[];

  testConnection(creds: DecryptedCredentials, config: SourceConfig): Promise<TestResult>;
  pollLeads(creds: DecryptedCredentials, config: SourceConfig, since: Date): Promise<RawLeadInput[]>;
  normalizePayload(vendorPayload: unknown): RawLeadInput;

  pollSpend?(creds: DecryptedCredentials, config: SourceConfig, date: Date): Promise<SpendRecord[]>;
  handleWebhook?(body: unknown, headers: Record<string, string>): Promise<RawLeadInput[]>;
  getOAuthAuthorizationUrl?(config: SourceConfig): string;
  exchangeOAuthCode?(code: string, config: SourceConfig): Promise<OAuthTokenSet>;
  refreshOAuthToken?(token: OAuthTokenSet): Promise<OAuthTokenSet>;
}
