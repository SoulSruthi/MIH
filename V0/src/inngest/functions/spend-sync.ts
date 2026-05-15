import { inngest } from '../client.js';
import { getSupabaseAdmin } from '@/lib/supabase-admin.js';
import { upsertSpend } from '@/modules/spend/index.js';

interface MetaInsightsResponse {
  data?: Array<{
    spend?: string;
    impressions?: string;
    clicks?: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

type ConnectorConfig = {
  id: string;
  organization_id: string;
  credentials: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
};

function getYesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0] as string;
}

export const spendSyncFunction = inngest.createFunction(
  {
    id: 'spend-sync',
    name: 'Daily Spend Sync',
    triggers: [{ cron: '0 2 * * *' }],
  },
  async ({ logger }) => {
    const supabase = getSupabaseAdmin();
    const yesterday = getYesterdayDateString();

    let processed = 0;
    let errors = 0;

    // Fetch all org connector configs for Meta (Facebook Ads) that are enabled
    const { data: rawConfigs, error: configsError } = await supabase
      .from('org_connector_configs')
      .select(`
        id,
        organization_id,
        credentials,
        config,
        connector_definitions!inner(id, source_kind, is_auto_fetch)
      `)
      .eq('is_enabled', true)
      .eq('connector_definitions.source_kind', 'meta_ads');

    if (configsError) {
      logger.error('Failed to fetch connector configs', { error: configsError.message });
      return { processed: 0, errors: 1 };
    }

    const configs = (rawConfigs ?? []) as unknown as ConnectorConfig[];

    for (const cfg of configs) {
      const orgId: string = cfg.organization_id;
      const credentials = cfg.credentials;
      const config = cfg.config;

      const accessToken = credentials?.access_token as string | undefined;
      const adAccountId = config?.ad_account_id as string | undefined;

      if (!accessToken || !adAccountId) {
        logger.warn('Skipping Meta connector: missing access_token or ad_account_id', { orgId, configId: cfg.id });
        errors++;
        continue;
      }

      try {
        // Fetch yesterday's spend from Meta Ads API
        const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=spend,impressions,clicks&date_preset=yesterday&access_token=${accessToken}`;
        const response = await fetch(url);
        const json = (await response.json()) as MetaInsightsResponse;

        if (json.error) {
          logger.error('Meta API error', { orgId, adAccountId, error: json.error.message });
          errors++;
          continue;
        }

        const row = json.data?.[0];
        if (!row) {
          logger.warn('No data returned from Meta API for yesterday', { orgId, adAccountId });
          // Not an error — the account may have had no activity
          continue;
        }

        const spendRaw = parseFloat(row.spend ?? '0');
        // Meta returns spend in the account's currency (typically USD or INR).
        // We store in paise (smallest INR unit = 1/100 INR).
        // For now: multiply raw value × 100, treating it as an INR amount.
        // TODO: if account currency is USD, convert: spendRaw * 83 * 100
        const amountPaise = Math.round(spendRaw * 100);

        // We use the connector config id as source_id until a proper sources table
        // entry is linked to this connector config.
        await upsertSpend(supabase, {
          organizationId: orgId,
          sourceId: cfg.id,
          spendDate: yesterday,
          amountPaise,
          dataSource: 'api',
          rawPayload: row as Record<string, unknown>,
        });

        logger.info('Upserted spend', { orgId, adAccountId, yesterday, amountPaise });
        processed++;
      } catch (err) {
        logger.error('Error processing org spend', {
          orgId,
          adAccountId,
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }

    logger.info('Spend sync complete', { processed, errors });
    return { processed, errors };
  },
);
