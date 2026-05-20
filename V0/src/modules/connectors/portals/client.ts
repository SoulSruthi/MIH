import type { PortalKind, PortalLead, PortalConfig } from './types';

const PORTAL_BASE_URLS: Record<PortalKind, string> = {
  '99acres': 'https://api.99acres.com/api/v1',
  magicbricks: 'https://api.magicbricks.com/v1',
  housing_com: 'https://api.housing.com/v1',
};

export async function fetchPortalLeads(
  kind: PortalKind,
  config: PortalConfig,
  since: Date,
): Promise<PortalLead[]> {
  const base = PORTAL_BASE_URLS[kind];
  const sinceTs = Math.floor(since.getTime() / 1000);

  const res = await fetch(
    `${base}/leads?project_id=${encodeURIComponent(config.project_id)}&since=${sinceTs}`,
    {
      headers: {
        'X-API-Key': config.api_key,
        Accept: 'application/json',
      },
    },
  );

  if (!res.ok) {
    throw new Error(`${kind} leads fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { leads?: unknown[] };
  const leads = data.leads ?? [];

  return leads.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r['id'] ?? r['lead_id'] ?? crypto.randomUUID()),
      name: String(r['name'] ?? r['full_name'] ?? r['buyer_name'] ?? ''),
      phone: String(r['phone'] ?? r['mobile'] ?? r['contact_number'] ?? ''),
      email: r['email'] ? String(r['email']) : undefined,
      projectName: r['project_name'] ? String(r['project_name']) : undefined,
      campaignName: r['campaign_name'] ? String(r['campaign_name']) : undefined,
      receivedAt: String(r['received_at'] ?? r['created_at'] ?? new Date().toISOString()),
      rawPayload: r,
    };
  });
}
