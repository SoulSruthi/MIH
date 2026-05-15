import { normalizePhoneE164 } from '../_kernel/normalizer.js';
import type { RawLeadInput } from '../_kernel/types.js';
import type { GoogleAdsLead } from './types.js';

function getColumn(cols: GoogleAdsLead['columnData'], name: string): string {
  return cols.find((c) => c.columnName === name)?.stringValue ?? '';
}

export function normalizeGoogleAdsLead(lead: GoogleAdsLead): RawLeadInput {
  const cols = lead.columnData ?? [];
  const phone = getColumn(cols, 'PHONE_NUMBER');
  const email = getColumn(cols, 'EMAIL');
  const firstName = getColumn(cols, 'FIRST_NAME');
  const lastName = getColumn(cols, 'LAST_NAME');
  const fullName =
    getColumn(cols, 'FULL_NAME') || `${firstName} ${lastName}`.trim() || 'Unknown';

  return {
    sourceExternalId: lead.id,
    phoneE164: normalizePhoneE164(phone),
    name: fullName,
    email: email || undefined,
    rawPayload: lead,
    sourceReceivedAt: new Date(lead.submittedAt),
    sourceCampaignId: lead.campaignId,
    sourceCampaignName: `Campaign ${lead.campaignId}`,
  };
}
