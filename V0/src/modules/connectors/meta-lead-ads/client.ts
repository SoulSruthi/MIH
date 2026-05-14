import type { MetaLeadPayload, MetaInsightRecord } from './types.js';

const GRAPH_BASE = 'https://graph.facebook.com/v18.0';

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
}

async function graphFetch<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  const json = await res.json() as { error?: { message: string; code: number } } & T;
  if (!res.ok || json.error) {
    throw new MetaApiError(
      json.error?.message ?? `HTTP ${res.status}`,
      res.status,
      json.error?.code,
    );
  }
  return json;
}

/** Fetch a single lead by leadgen_id. */
export async function fetchLead(leadgenId: string, accessToken: string): Promise<MetaLeadPayload> {
  return graphFetch<MetaLeadPayload>(leadgenId, accessToken, {
    fields: 'id,form_id,ad_id,adset_id,campaign_id,ad_name,adset_name,campaign_name,created_time,field_data',
  });
}

/** List leads for a form since a given unix timestamp. */
export async function listLeads(
  formId: string,
  accessToken: string,
  since: Date,
): Promise<MetaLeadPayload[]> {
  const leads: MetaLeadPayload[] = [];
  let url: string | null = `${GRAPH_BASE}/${formId}/leads`;
  const baseParams = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,form_id,ad_id,adset_id,campaign_id,ad_name,campaign_name,created_time,field_data',
    filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(since.getTime() / 1000) }]),
    limit: '100',
  });

  while (url) {
    const fullUrl = url.includes('?') ? url : `${url}?${baseParams}`;
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(10_000) });
    const json = await res.json() as {
      data: MetaLeadPayload[];
      paging?: { next?: string };
      error?: { message: string; code: number };
    };
    if (!res.ok || json.error) {
      throw new MetaApiError(json.error?.message ?? `HTTP ${res.status}`, res.status, json.error?.code);
    }
    leads.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }

  return leads;
}

/** Fetch leadgen form IDs for a page. */
export async function listForms(pageId: string, accessToken: string): Promise<string[]> {
  const res = await graphFetch<{ data: { id: string }[] }>(
    `${pageId}/leadgen_forms`,
    accessToken,
    { fields: 'id', limit: '100' },
  );
  return res.data.map(f => f.id);
}

/** Fetch daily spend insights for an ad account. */
export async function fetchDailyInsights(
  adAccountId: string,
  accessToken: string,
  date: Date,
): Promise<MetaInsightRecord[]> {
  const dateStr = date.toISOString().slice(0, 10);
  const res = await graphFetch<{ data: MetaInsightRecord[] }>(
    adAccountId,
    accessToken,
    {
      fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,date_start,date_stop',
      level: 'ad',
      time_range: JSON.stringify({ since: dateStr, until: dateStr }),
      limit: '500',
    },
  );
  return res.data ?? [];
}
