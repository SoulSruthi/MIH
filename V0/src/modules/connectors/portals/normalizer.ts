import { normalizePhoneE164 } from '../_kernel/normalizer.js';
import type { RawLeadInput } from '../_kernel/types.js';
import type { PortalLead } from './types.js';

export function normalizePortalLead(lead: PortalLead): RawLeadInput {
  return {
    sourceExternalId: lead.id,
    phoneE164: normalizePhoneE164(lead.phone),
    name: lead.name || 'Unknown',
    email: lead.email ? lead.email.toLowerCase() : undefined,
    rawPayload: lead.rawPayload,
    sourceReceivedAt: new Date(lead.receivedAt),
    sourceCampaignName: lead.campaignName ?? lead.projectName,
  };
}
