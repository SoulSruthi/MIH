import type { PortalKind, PortalLead } from './types';

// ---------------------------------------------------------------------------
// Per-portal payload parsers
// ---------------------------------------------------------------------------

function parse99AcresPayload(body: Record<string, unknown>): PortalLead {
  return {
    id: String(body.lead_id ?? body.id ?? crypto.randomUUID()),
    name: String(body.name ?? body.buyer_name ?? body.contact_name ?? ''),
    phone: String(body.phone ?? body.mobile ?? body.contact_number ?? body.phone_number ?? ''),
    email: body.email ? String(body.email) : undefined,
    projectName: body.project_name ? String(body.project_name) : undefined,
    campaignName: body.campaign_name ? String(body.campaign_name) : undefined,
    receivedAt: String(body.received_at ?? body.created_at ?? new Date().toISOString()),
    rawPayload: body,
  };
}

function parseMagicBricksPayload(body: Record<string, unknown>): PortalLead {
  // MagicBricks wraps lead fields in a 'data' object
  const data = (body.data ?? body) as Record<string, unknown>;
  return {
    id: String(data.leadId ?? data.lead_id ?? data.id ?? crypto.randomUUID()),
    name: String(data.buyerName ?? data.name ?? data.fullName ?? ''),
    phone: String(data.mobileNo ?? data.phone ?? data.mobile ?? ''),
    email: (data.emailId ?? data.email) ? String(data.emailId ?? data.email) : undefined,
    projectName: data.projectName ? String(data.projectName) : undefined,
    campaignName: data.source ? String(data.source) : undefined,
    receivedAt: String(data.createdDate ?? data.created_at ?? new Date().toISOString()),
    rawPayload: body,
  };
}

function parseHousingPayload(body: Record<string, unknown>): PortalLead {
  // Housing.com may wrap in a 'lead' object
  const lead = (body.lead ?? body) as Record<string, unknown>;
  return {
    id: String(lead.id ?? lead.lead_id ?? crypto.randomUUID()),
    name: String(lead.name ?? lead.full_name ?? lead.user_name ?? ''),
    phone: String(lead.phone ?? lead.mobile_number ?? lead.contact ?? ''),
    email: lead.email ? String(lead.email) : undefined,
    projectName: lead.listing_title ? String(lead.listing_title) : undefined,
    campaignName: lead.source_info ? String(lead.source_info) : undefined,
    receivedAt: String(lead.created_at ?? lead.timestamp ?? new Date().toISOString()),
    rawPayload: body,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function parsePortalWebhookPayload(kind: PortalKind, body: Record<string, unknown>): PortalLead {
  switch (kind) {
    case '99acres':     return parse99AcresPayload(body);
    case 'magicbricks': return parseMagicBricksPayload(body);
    case 'housing_com': return parseHousingPayload(body);
  }
}
