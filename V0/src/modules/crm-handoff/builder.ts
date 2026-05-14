export type CrmLeadPayload = {
  organization_id: string;
  external_id: string;
  name: string;
  phone_e164: string;
  email?: string;
  source: string;
  source_channel: string;
  source_received_at: string;
  source_campaign_id?: string;
  source_campaign_name?: string;
  source_ad_id?: string;
  source_ad_name?: string;
  preference?: {
    bhk?: number;
    budget_band?: string;
    locality?: string;
  };
  mih_intent_score?: number;
  mih_quality_grade?: string;
  raw_payload: object;
};

export type CrmLeadResponse = {
  lead_id: string;
  status: 'created' | 'duplicate_merged';
  allocated_to_user_id?: string | null;
  crm_lead_url?: string;
  merged_with_external_id?: string;
};

type UniqueLead = {
  crm_external_id: string;
  primary_phone_e164: string;
  primary_email: string | null;
  primary_name: string;
  first_seen_at: string;
  primary_source_id: string;
  touch_sources: unknown[];
  preference_bhk: string | null;
  preference_budget_band: string | null;
  preference_location: string | null;
  mih_intent_score: number | null;
  mih_quality_grade: string | null;
};

type Source = {
  source_type: string;
  name: string;
};

type RawLead = {
  source_campaign_id: string | null;
  source_campaign_name: string | null;
  source_ad_id: string | null;
  source_ad_name: string | null;
  payload: unknown;
};

function sourceTypeToChannel(sourceType: string): string {
  const map: Record<string, string> = {
    meta_lead_ads: 'paid_social',
    google_ads: 'paid_search',
    '99acres': 'aggregator',
    magicbricks: 'aggregator',
    housing_com: 'aggregator',
    justdial: 'aggregator',
    webform: 'organic_web',
    walk_in: 'walk_in',
    csv_upload: 'walk_in',
    channel_partner: 'cp',
  };
  return map[sourceType] ?? 'organic_web';
}

export function buildCrmPayload(
  uniqueLead: UniqueLead,
  source: Source,
  crmOrgId: string,
  primaryRawLead?: RawLead | null,
): CrmLeadPayload {
  const payload: CrmLeadPayload = {
    organization_id: crmOrgId,
    external_id: uniqueLead.crm_external_id,
    name: uniqueLead.primary_name,
    phone_e164: uniqueLead.primary_phone_e164,
    source: source.source_type,
    source_channel: sourceTypeToChannel(source.source_type),
    source_received_at: uniqueLead.first_seen_at,
    raw_payload: (primaryRawLead?.payload as object) ?? {},
  };

  if (uniqueLead.primary_email) payload.email = uniqueLead.primary_email;

  if (primaryRawLead) {
    if (primaryRawLead.source_campaign_id) payload.source_campaign_id = primaryRawLead.source_campaign_id;
    if (primaryRawLead.source_campaign_name) payload.source_campaign_name = primaryRawLead.source_campaign_name;
    if (primaryRawLead.source_ad_id) payload.source_ad_id = primaryRawLead.source_ad_id;
    if (primaryRawLead.source_ad_name) payload.source_ad_name = primaryRawLead.source_ad_name;
  }

  const pref: CrmLeadPayload['preference'] = {};
  if (uniqueLead.preference_bhk) {
    const bhkNum = parseInt(uniqueLead.preference_bhk, 10);
    if (!isNaN(bhkNum)) pref.bhk = bhkNum;
  }
  if (uniqueLead.preference_budget_band) pref.budget_band = uniqueLead.preference_budget_band;
  if (uniqueLead.preference_location) pref.locality = uniqueLead.preference_location;

  if (Object.keys(pref).length > 0) payload.preference = pref;

  if (uniqueLead.mih_intent_score !== null) payload.mih_intent_score = uniqueLead.mih_intent_score;
  if (uniqueLead.mih_quality_grade !== null) payload.mih_quality_grade = uniqueLead.mih_quality_grade;

  return payload;
}
