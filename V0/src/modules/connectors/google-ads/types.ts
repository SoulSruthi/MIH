export type GoogleAdsCampaign = {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  advertisingChannelType: string;
};

export type GoogleAdsLead = {
  id: string;
  formId: string;
  campaignId: string;
  adGroupId: string;
  columnData: Array<{ columnName: string; stringValue: string }>;
  submittedAt: string;
};

export type GoogleAdsSpend = {
  campaignId: string;
  campaignName: string;
  date: string;
  costMicros: string; // Google uses micros (millionths of currency unit)
  impressions: string;
  clicks: string;
};

export type GoogleAdsCreds = {
  customer_id: string;
  developer_token: string;
  access_token: string;
  refresh_token: string;
  client_id: string;
  client_secret: string;
};
