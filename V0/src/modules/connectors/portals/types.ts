export type PortalKind = '99acres' | 'magicbricks' | 'housing_com';

export type PortalLead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  projectName?: string;
  campaignName?: string;
  receivedAt: string;
  rawPayload: Record<string, unknown>;
};

export type PortalConfig = {
  api_key: string;
  project_id: string;
};
