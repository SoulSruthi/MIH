import { normalizePhoneE164 } from '../_kernel/normalizer';
import type { RawLeadInput } from '../_kernel/types';
import type { ManualLeadInput } from './types';

export function normalizeManualLead(lead: ManualLeadInput): RawLeadInput {
  return {
    sourceExternalId: crypto.randomUUID(),
    phoneE164: normalizePhoneE164(lead.phone.trim()),
    name: lead.name.trim() || 'Unknown',
    email: lead.email?.trim().toLowerCase() || undefined,
    rawPayload: lead,
    sourceReceivedAt: lead.receivedAt ? new Date(lead.receivedAt) : new Date(),
    sourceCampaignName: lead.sourceCampaignName,
  };
}
