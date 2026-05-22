export type ConsentState = 'pending' | 'opted_in' | 'opted_out' | 'revoked';

export type RewardPreference = 'cash' | 'voucher' | 'white_goods' | 'choice';

export type SubmissionChannel = 'portal' | 'webform' | 'sms_reply' | 'whatsapp' | 'ops_manual';

export type SubmissionOutcome =
  | 'accepted'
  | 'dedup_existing'
  | 'blocked_other_source_first'
  | 'invalid';

export type ReferralCommissionState =
  | 'earned'
  | 'accrued'
  | 'approved'
  | 'paid'
  | 'reversed'
  | 'disputed';

export type Referrer = {
  id: string;
  org_id: string;
  customer_cluster_id: string | null;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  last_referral_at: string | null;
  referrer_code: string | null;
  crm_customer_id: string | null;
  first_booking_at: string | null;
  bookings_count: number;
  consent_state: ConsentState;
  consent_channels: string[];
  default_commission_pct: number;
  reward_preference: RewardPreference;
  created_at: string;
  updated_at: string;
};

export type ReferralSubmission = {
  id: string;
  org_id: string;
  referrer_id: string;
  raw_inbox_id: string | null;
  outcome: SubmissionOutcome;
  submission_channel: SubmissionChannel;
  submitted_at: string;
  created_at: string;
};

export type ReferralCommissionAccrual = {
  id: string;
  org_id: string;
  referrer_id: string;
  attribution_result_id: string | null;
  conversion_event_id: string | null;
  project_id: string | null;
  booking_value: number;
  commission_pct: number;
  commission_value: number;
  reward_kind: string;
  state: ReferralCommissionState;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  reversed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateReferrerInput = {
  org_id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  customer_cluster_id?: string;
  crm_customer_id?: string;
  default_commission_pct?: number;
  reward_preference?: RewardPreference;
  consent_state?: ConsentState;
  consent_channels?: string[];
};

export type SubmitReferralInput = {
  org_id: string;
  referrer_id: string;
  raw_inbox_id?: string;
  outcome: SubmissionOutcome;
  submission_channel?: SubmissionChannel;
};

export type CreateReferralAccrualInput = {
  org_id: string;
  referrer_id: string;
  project_id?: string;
  booking_value: number;
  commission_pct?: number;
  reward_kind?: string;
  attribution_result_id?: string;
  conversion_event_id?: string;
};
