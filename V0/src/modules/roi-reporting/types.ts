export type SpendEntryKind =
  | 'api_pulled'
  | 'manual'
  | 'csv'
  | 'invoice'
  | 'recurring_amortized';

export type SpendMedium =
  | 'online'
  | 'btl'
  | 'cp'
  | 'referral'
  | 'portals'
  | 'branding'
  | 'walk_in';

export type AmortizationKind = 'monthly' | 'weekly' | 'one_time' | 'custom';

export type AlertType =
  | 'spend_overrun'
  | 'booking_shortfall'
  | 'cpb_spike'
  | 'source_underperforming';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type Granularity = 'daily' | 'weekly' | 'monthly';

export type SpendEntry = {
  id: string;
  org_id: string;
  project_id: string | null;
  source_id: string | null;
  medium: SpendMedium | null;
  entry_kind: SpendEntryKind;
  amount_paise: number;
  period_start: string;
  period_end: string;
  ingestion_source: string | null;
  external_ref: string | null;
  description: string | null;
  contract_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SpendContract = {
  id: string;
  org_id: string;
  project_id: string | null;
  source_id: string | null;
  vendor_name: string;
  total_amount_paise: number;
  amortization: AmortizationKind;
  contract_start: string;
  contract_end: string;
  is_active: boolean;
  terminated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MetricSnapshot = {
  id: string;
  org_id: string;
  granularity: Granularity;
  period_start: string;
  period_end: string;
  dimension_key: Record<string, unknown>;
  metric_set: Record<string, unknown>;
  refreshed_at: string;
  created_at: string;
};

export type VarianceAlert = {
  id: string;
  org_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  project_id: string | null;
  source_id: string | null;
  period_start: string;
  period_end: string;
  context: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
};

export type CPBMetrics = {
  total_spend: number;
  total_bookings: number;
  cpb: number;
  cpl: number;
  cpql: number;
  total_leads: number;
  total_qualified_leads: number;
  period_start: string;
  period_end: string;
};

export type FunnelBySource = {
  source_id: string;
  source_name: string;
  leads: number;
  qualified: number;
  site_visits: number;
  bookings: number;
  spend: number;
  cpb: number;
  cpl: number;
};

export type CreateSpendEntryInput = {
  org_id: string;
  project_id?: string;
  source_id?: string;
  medium?: SpendMedium;
  entry_kind: SpendEntryKind;
  amount_paise: number;
  period_start: string;
  period_end: string;
  ingestion_source?: string;
  external_ref?: string;
  description?: string;
  contract_id?: string;
  created_by?: string;
};

export type CreateSpendContractInput = {
  org_id: string;
  project_id?: string;
  source_id?: string;
  vendor_name: string;
  total_amount_paise: number;
  amortization: AmortizationKind;
  contract_start: string;
  contract_end: string;
};
