import { normalizePhoneE164, PhoneNormalizationError } from '../_kernel/normalizer';
import type { RawLeadInput } from '../_kernel/types';
import type { MetaLeadPayload } from './types';

/** Known Meta form field name variants → canonical key. */
const FIELD_ALIASES: Record<string, string> = {
  full_name: 'name',
  first_name: 'first_name',
  last_name: 'last_name',
  phone_number: 'phone',
  phone: 'phone',
  mobile: 'phone',
  mobile_number: 'phone',
  email: 'email',
  email_address: 'email',
  city: 'city',
  location: 'city',
  budget: 'budget',
  bhk: 'bhk',
  property_type: 'bhk',
};

function extractFields(payload: MetaLeadPayload): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const { name, values } of payload.field_data) {
    const canonical = FIELD_ALIASES[name.toLowerCase()] ?? name.toLowerCase();
    if (values.length > 0) fields[canonical] = values[0].trim();
  }
  return fields;
}

function resolveName(fields: Record<string, string>): string {
  if (fields['name']) return fields['name'];
  const parts = [fields['first_name'], fields['last_name']].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return 'Unknown';
}

/**
 * Maps a Meta Lead Ads payload → RawLeadInput.
 * Throws PhoneNormalizationError if phone is missing or cannot be normalized.
 */
export function normalizeMetaLead(payload: MetaLeadPayload): RawLeadInput {
  const fields = extractFields(payload);

  const rawPhone = fields['phone'];
  if (!rawPhone) throw new PhoneNormalizationError('', 'phone_number field missing from Meta lead');

  return {
    sourceExternalId: payload.id,
    phoneE164: normalizePhoneE164(rawPhone),
    email: fields['email'] ? fields['email'].toLowerCase() : undefined,
    name: resolveName(fields),
    sourceCampaignId: payload.campaign_id,
    sourceCampaignName: payload.campaign_name,
    sourceAdId: payload.ad_id,
    sourceAdName: payload.ad_name,
    sourceReceivedAt: new Date(payload.created_time),
    rawPayload: payload,
  };
}
