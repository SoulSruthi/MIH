import { normalizePhoneE164 } from '../_kernel/normalizer';
import type { RawLeadInput } from '../_kernel/types';
import type { PortalLead } from './types';

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
