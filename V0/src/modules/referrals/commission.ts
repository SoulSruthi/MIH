export const REFERRAL_COMMISSION_RATE = 0.015;  // 1.5%

export type ReferralCommissionInput = {
  dealValuePaise: number;
  winningSourceType: string;  // must be 'referral' to trigger commission
  referralEventId: string | null;
};

export type ReferralCommissionResult = {
  eligible: boolean;
  commissionPaise: number;
  commissionRate: number;
  reason: 'attribution_not_referral' | 'no_referral_event' | 'deal_value_zero' | 'commissioned';
};

export function computeReferralCommission(input: ReferralCommissionInput): ReferralCommissionResult {
  if (input.winningSourceType !== 'referral') {
    return { eligible: false, commissionPaise: 0, commissionRate: REFERRAL_COMMISSION_RATE, reason: 'attribution_not_referral' };
  }
  if (!input.referralEventId) {
    return { eligible: false, commissionPaise: 0, commissionRate: REFERRAL_COMMISSION_RATE, reason: 'no_referral_event' };
  }
  if (input.dealValuePaise <= 0) {
    return { eligible: false, commissionPaise: 0, commissionRate: REFERRAL_COMMISSION_RATE, reason: 'deal_value_zero' };
  }
  const commissionPaise = Math.floor(input.dealValuePaise * REFERRAL_COMMISSION_RATE);
  return { eligible: true, commissionPaise, commissionRate: REFERRAL_COMMISSION_RATE, reason: 'commissioned' };
}
