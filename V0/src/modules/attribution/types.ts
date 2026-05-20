export type AttributionModel = 'last_touch_v1';

export type FunnelStage = 'contacted' | 'qualified' | 'site_visit' | 'deal' | 'won';

export type AttributionInput = {
  organizationId: string;
  sourceId: string;
  rollupDate: string; // YYYY-MM-DD
  model: AttributionModel;
};

export type FunnelCounts = {
  uniqueLeads: number;
  contacted: number;
  qualified: number;
  siteVisit: number;
  deals: number;
  won: number;
  wonValuePaise: number;
};

export type SpendData = {
  spendPaise: number;
};

export type AttributionRollup = {
  organizationId: string;
  sourceId: string;
  rollupDate: string;
  model: AttributionModel;
  funnel: FunnelCounts;
  spend: SpendData;
  cplPaise: number | null;
  cpaPaise: number | null;
  roasTimes100: number | null;
};
