import { fetchDailyInsights } from './client.js';
import type { SpendRecord, DecryptedCredentials, SourceConfig } from '../_kernel/types.js';
import type { MetaSourceConfig } from './types.js';

const USD_TO_INR = 83.5; // Fallback rate — production should use live rate from FX API

/**
 * Pulls daily spend from the Meta Ads Insights API and converts to INR.
 * Called by the daily cron at 02:00 IST (after Meta closes the previous day's data).
 */
export async function pullDailySpend(
  creds: DecryptedCredentials,
  config: SourceConfig,
  date: Date,
): Promise<SpendRecord[]> {
  const metaConfig = config as unknown as MetaSourceConfig;
  const accessToken = creds['meta_page_access_token'];
  if (!accessToken) throw new Error('meta_page_access_token credential missing');

  const adAccountId = metaConfig.ad_account_id;
  if (!adAccountId) throw new Error('ad_account_id not configured in source config');

  const insights = await fetchDailyInsights(adAccountId, accessToken, date);

  return insights.map(row => ({
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    adId: row.ad_id,
    date,
    spendInr: Math.round(parseFloat(row.spend || '0') * USD_TO_INR * 100) / 100,
    impressions: parseInt(row.impressions ?? '0', 10),
    clicks: parseInt(row.clicks ?? '0', 10),
  }));
}
