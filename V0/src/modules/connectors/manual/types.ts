export type ManualLeadInput = {
  name: string;
  phone: string;
  email?: string;
  sourceCampaignName?: string;
  notes?: string;
  receivedAt?: string;
};

export type ManualLeadsBatch = {
  leads: ManualLeadInput[];
  sourceId: string;
  organizationId: string;
};
