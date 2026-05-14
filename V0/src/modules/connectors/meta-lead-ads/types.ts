/** Meta Graph API response shapes — only fields MIH actually uses. */

export type MetaFieldData = {
  name: string;
  values: string[];
};

export type MetaLeadPayload = {
  id: string;                 // leadgen_id
  form_id: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  created_time: string;       // ISO 8601
  field_data: MetaFieldData[];
};

export type MetaWebhookEntry = {
  id: string;                 // page_id
  time: number;
  changes: MetaWebhookChange[];
};

export type MetaWebhookChange = {
  field: string;              // 'leadgen'
  value: {
    leadgen_id: string;
    page_id: string;
    form_id: string;
    ad_id?: string;
    adgroup_id?: string;
    ad_name?: string;
    adgroup_name?: string;
    created_time: number;     // unix epoch
  };
};

export type MetaWebhookBody = {
  object: string;             // 'page'
  entry: MetaWebhookEntry[];
};

export type MetaLeadgenNotification = {
  leadgenId: string;
  pageId: string;
  formId: string;
  adId?: string;
  createdTime: Date;
};

export type MetaSourceConfig = {
  page_id: string;
  ad_account_id: string;      // format: act_<numeric_id>
  form_ids?: string[];        // empty = all forms for page
  token_expires_at?: string;  // ISO 8601
};

export type MetaInsightRecord = {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: string;              // USD string from API
  impressions: string;
  clicks: string;
  date_start: string;
  date_stop: string;
};

export type MetaOAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export type MetaLongLivedTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;         // seconds
};
