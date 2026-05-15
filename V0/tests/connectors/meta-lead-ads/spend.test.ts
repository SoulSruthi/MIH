import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pullDailySpend } from '../../../src/modules/connectors/meta-lead-ads/spend.js';

describe('pullDailySpend', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            campaign_id: 'camp-1',
            campaign_name: 'Summer Sale',
            adset_id: 'adset-1',
            adset_name: 'Mumbai Audience',
            ad_id: 'ad-1',
            ad_name: 'Creative A',
            spend: '100.00',       // USD
            impressions: '5000',
            clicks: '120',
            date_start: '2026-05-14',
            date_stop: '2026-05-14',
          },
        ],
        paging: {},
      }),
    } as never);
  });

  it('converts USD spend to INR', async () => {
    const result = await pullDailySpend(
      { meta_page_access_token: 'token-123' },
      { ad_account_id: 'act_123456789', page_id: 'page-1' },
      new Date('2026-05-14'),
    );
    expect(result).toHaveLength(1);
    expect(result[0].campaignId).toBe('camp-1');
    expect(result[0].spendInr).toBeGreaterThan(0); // 100 USD * 83.5 = 8350 INR
    expect(result[0].impressions).toBe(5000);
    expect(result[0].clicks).toBe(120);
  });

  it('throws when access token is missing', async () => {
    await expect(
      pullDailySpend({}, { ad_account_id: 'act_123', page_id: 'page-1' }, new Date()),
    ).rejects.toThrow('meta_page_access_token credential missing');
  });

  it('throws when ad_account_id is missing from config', async () => {
    await expect(
      pullDailySpend({ meta_page_access_token: 'tok' }, { page_id: 'page-1' }, new Date()),
    ).rejects.toThrow('ad_account_id not configured');
  });
});
