export type CpType = 'individual' | 'firm' | 'sub_broker';

export type CommissionState =
  | 'earned'
  | 'accrued'
  | 'approved'
  | 'paid'
  | 'reversed'
  | 'disputed';

export type ChannelPartner = {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  cp_type: CpType;
  parent_cp_id: string | null;
  default_commission_pct: number;
  rera_number: string | null;
  pan_number_encrypted: string | null;
  bank_details_encrypted: string | null;
  created_at: string;
  updated_at: string;
};

export type CpApiKey = {
  id: string;
  org_id: string;
  cp_id: string;
  api_key_hash: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type CpCommissionAccrual = {
  id: string;
  org_id: string;
  cp_id: string;
  attribution_result_id: string | null;
  conversion_event_id: string | null;
  project_id: string | null;
  booking_value: number;
  commission_pct: number;
  commission_value: number;
  state: CommissionState;
  payout_reference: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  reversed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CpFyTarget = {
  id: string;
  org_id: string;
  cp_id: string;
  fy_year: number;
  target_bookings_count: number;
  target_bookings_value: number;
  allocated_commission_budget: number;
  created_at: string;
};

export type CreateChannelPartnerInput = {
  org_id: string;
  name: string;
  code?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  cp_type?: CpType;
  parent_cp_id?: string;
  default_commission_pct?: number;
  rera_number?: string;
};

export type CreateAccrualInput = {
  org_id: string;
  cp_id: string;
  project_id?: string;
  booking_value: number;
  commission_pct?: number;
  attribution_result_id?: string;
  conversion_event_id?: string;
};

export type GenerateApiKeyResult = {
  api_key: string;
  record: CpApiKey;
};
