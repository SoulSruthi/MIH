export type DataSource = 'api' | 'manual' | 'csv';

export type SpendEntry = {
  id: string;
  organizationId: string;
  sourceId: string;
  spendDate: string; // YYYY-MM-DD
  amountPaise: number;
  currency: string;
  campaignId: string | null;
  campaignName: string | null;
  dataSource: DataSource;
  supersededBy: string | null;
  createdAt: string;
};

export type SpendInput = {
  organizationId: string;
  sourceId: string;
  spendDate: string;
  amountPaise: number;
  campaignId?: string;
  campaignName?: string;
  dataSource: DataSource;
  rawPayload?: Record<string, unknown>;
};

export type SpendSummary = {
  sourceId: string;
  sourceName: string;
  totalPaise: number;
  daysWithData: number;
  hasGaps: boolean; // true if any date in range missing spend data
};

export type SpendCompletenessStatus = 'complete' | 'partial' | 'missing';
