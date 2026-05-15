/**
 * crm_external_id format: mih_{6-char-org-slug}_{raw_lead_uuid_no_hyphens}
 * Stable: same inputs always produce the same id.
 * Globally unique due to UUID component.
 */
export function generateCrmExternalId(orgSlug: string, rawLeadId: string): string {
  const slugPart = orgSlug.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6).padEnd(6, '0');
  const uuidPart = rawLeadId.replace(/-/g, '');
  return `mih_${slugPart}_${uuidPart}`;
}

export function parseCrmExternalId(externalId: string): { orgSlug: string; rawLeadId: string } | null {
  const match = externalId.match(/^mih_([a-z0-9]{6})_([0-9a-f]{32})$/);
  if (!match) return null;
  const [, orgSlug, uuidNoDashes] = match;
  const rawLeadId = [
    uuidNoDashes.slice(0, 8),
    uuidNoDashes.slice(8, 12),
    uuidNoDashes.slice(12, 16),
    uuidNoDashes.slice(16, 20),
    uuidNoDashes.slice(20),
  ].join('-');
  return { orgSlug, rawLeadId };
}
