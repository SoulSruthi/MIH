import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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

interface GoogleAdsSearchResponse {
  results?: Array<{
    metrics?: {
      costMicros?: string;
    };
  }>;
  error?: {
    message: string;
    status: string;
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

    // -------------------------------------------------------------------------
    // META ADS
    // -------------------------------------------------------------------------
    // Fetch all org connector configs for Meta (Facebook Ads) that are enabled
    const { data: rawMetaConfigs, error: metaConfigsError } = await supabase
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

    if (metaConfigsError) {
      logger.error('Failed to fetch Meta connector configs', { error: metaConfigsError.message });
      errors++;
    } else {
      const metaConfigs = (rawMetaConfigs ?? []) as unknown as ConnectorConfig[];

      for (const cfg of metaConfigs) {
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

          const externalRef = `meta_act_${adAccountId}_${yesterday}`;

          const { error: upsertError } = await supabase
            .schema('mih')
            .from('spend_entries')
            .upsert(
              {
                org_id: orgId,
                source_id: cfg.id,
                period_start: yesterday,
                period_end: yesterday,
                amount_paise: amountPaise,
                ingestion_source: 'meta_ads',
                external_ref: externalRef,
                entry_kind: 'api_pull',
                raw_payload: row as Record<string, unknown>,
              },
              { onConflict: 'org_id,ingestion_source,external_ref' },
            );

          if (upsertError) {
            logger.error('Failed to upsert Meta spend entry', { orgId, adAccountId, error: upsertError.message });
            errors++;
            continue;
          }

          logger.info('Upserted spend', { orgId, adAccountId, yesterday, amountPaise, externalRef });
          processed++;
        } catch (err) {
          logger.error('Error processing org Meta spend', {
            orgId,
            adAccountId,
            error: err instanceof Error ? err.message : String(err),
          });
          errors++;
        }
      }
    }

    // -------------------------------------------------------------------------
    // GOOGLE ADS
    // -------------------------------------------------------------------------
    const { data: rawGoogleConfigs, error: googleConfigsError } = await supabase
      .from('org_connector_configs')
      .select(`
        id,
        organization_id,
        credentials,
        config,
        connector_definitions!inner(id, source_kind, is_auto_fetch)
      `)
      .eq('is_enabled', true)
      .eq('connector_definitions.source_kind', 'google_ads');

    if (googleConfigsError) {
      logger.error('Failed to fetch Google Ads connector configs', { error: googleConfigsError.message });
      errors++;
    } else {
      const googleConfigs = (rawGoogleConfigs ?? []) as unknown as ConnectorConfig[];

      for (const cfg of googleConfigs) {
        const orgId: string = cfg.organization_id;
        const credentials = cfg.credentials;
        const config = cfg.config;

        const accessToken = credentials?.access_token as string | undefined;
        const customerId = config?.customer_id as string | undefined;

        if (!accessToken || !customerId) {
          logger.warn('Skipping Google Ads connector: missing access_token or customer_id', { orgId, configId: cfg.id });
          errors++;
          continue;
        }

        try {
          // Fetch yesterday's spend from Google Ads API
          const googleAdsUrl = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`;
          const query = `SELECT metrics.cost_micros FROM customer WHERE segments.date = '${yesterday}'`;

          const response = await fetch(googleAdsUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          });
          const json = (await response.json()) as GoogleAdsSearchResponse;

          if (json.error) {
            logger.error('Google Ads API error', { orgId, customerId, error: json.error.message });
            errors++;
            continue;
          }

          const results = json.results ?? [];
          if (results.length === 0) {
            logger.warn('No data returned from Google Ads API for yesterday', { orgId, customerId });
            // Not an error — the account may have had no activity
            continue;
          }

          // Sum cost_micros across all results, convert to paise
          // cost_micros / 1e6 = amount in account currency (INR assumed)
          // paise = amount * 100
          const totalCostMicros = results.reduce((sum, r) => {
            return sum + parseInt(r.metrics?.costMicros ?? '0', 10);
          }, 0);
          const amountPaise = Math.round((totalCostMicros / 1e6) * 100);

          const externalRef = `google_${customerId}_${yesterday}`;

          const { error: upsertError } = await supabase
            .schema('mih')
            .from('spend_entries')
            .upsert(
              {
                org_id: orgId,
                source_id: cfg.id,
                period_start: yesterday,
                period_end: yesterday,
                amount_paise: amountPaise,
                ingestion_source: 'google_ads',
                external_ref: externalRef,
                entry_kind: 'api_pull',
                raw_payload: { results } as Record<string, unknown>,
              },
              { onConflict: 'org_id,ingestion_source,external_ref' },
            );

          if (upsertError) {
            logger.error('Failed to upsert Google Ads spend entry', { orgId, customerId, error: upsertError.message });
            errors++;
            continue;
          }

          logger.info('Upserted spend', { orgId, customerId, yesterday, amountPaise, externalRef });
          processed++;
        } catch (err) {
          logger.error('Error processing org Google Ads spend', {
            orgId,
            customerId,
            error: err instanceof Error ? err.message : String(err),
          });
          errors++;
        }
      }
    }

    logger.info('Spend sync complete', { processed, errors });
    return { processed, errors };
  },
);
