import type { GoogleAdsCreds, GoogleAdsLead, GoogleAdsSpend } from './types';

const GOOGLE_ADS_API_VERSION = 'v17';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export async function refreshGoogleToken(creds: GoogleAdsCreds): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function fetchGoogleAdsLeads(
  creds: GoogleAdsCreds,
  customerId: string,
  formId: string,
  since: Date,
): Promise<GoogleAdsLead[]> {
  const token = await refreshGoogleToken(creds);
  const sinceStr = since.toISOString().split('T')[0];

  // GAQL query for lead form submissions
  const query = `
    SELECT
      lead_form_submission_data.id,
      lead_form_submission_data.lead_form,
      lead_form_submission_data.ad_group,
      lead_form_submission_data.campaign,
      lead_form_submission_data.column_data,
      lead_form_submission_data.submission_date_time
    FROM lead_form_submission_data
    WHERE lead_form_submission_data.submission_date_time >= '${sinceStr}'
    AND lead_form_submission_data.lead_form = '${formId}'
    ORDER BY lead_form_submission_data.submission_date_time DESC
  `;

  const res = await fetch(
    `${GOOGLE_ADS_BASE_URL}/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': creds.developer_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!res.ok) throw new Error(`Google Ads leads fetch failed: ${res.status}`);
  const rows = await res.json() as Array<{
    results: Array<{ leadFormSubmissionData: unknown }>;
  }>;

  const leads: GoogleAdsLead[] = [];
  for (const batch of rows) {
    for (const r of batch.results ?? []) {
      const d = r.leadFormSubmissionData as Record<string, unknown>;
      leads.push({
        id: d['id'] as string,
        formId: (d['leadForm'] as string)?.split('/').pop() ?? '',
        campaignId: (d['campaign'] as string)?.split('/').pop() ?? '',
        adGroupId: (d['adGroup'] as string)?.split('/').pop() ?? '',
        columnData: d['columnData'] as GoogleAdsLead['columnData'],
        submittedAt: d['submissionDateTime'] as string,
      });
    }
  }
  return leads;
}

export async function fetchGoogleAdsSpend(
  creds: GoogleAdsCreds,
  customerId: string,
  date: Date,
): Promise<GoogleAdsSpend[]> {
  const token = await refreshGoogleToken(creds);
  const dateStr = date.toISOString().split('T')[0];

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks
    FROM campaign
    WHERE segments.date = '${dateStr}'
    AND campaign.status != 'REMOVED'
  `;

  const res = await fetch(
    `${GOOGLE_ADS_BASE_URL}/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': creds.developer_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!res.ok) throw new Error(`Google Ads spend fetch failed: ${res.status}`);
  const rows = await res.json() as Array<{
    results: Array<Record<string, unknown>>;
  }>;

  const records: GoogleAdsSpend[] = [];
  for (const batch of rows) {
    for (const r of batch.results ?? []) {
      const campaign = r['campaign'] as Record<string, string>;
      const segments = r['segments'] as Record<string, string>;
      const metrics = r['metrics'] as Record<string, string>;
      records.push({
        campaignId: campaign['id'],
        campaignName: campaign['name'],
        date: segments['date'],
        costMicros: metrics['costMicros'] ?? '0',
        impressions: metrics['impressions'] ?? '0',
        clicks: metrics['clicks'] ?? '0',
      });
    }
  }
  return records;
}
