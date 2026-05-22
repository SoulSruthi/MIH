export const CP_COMMISSION_RATE = 0.025;  // 2.5%

export type CpCommissionInput = {
  dealValuePaise: number;
  winningSourceType: string;  // must be 'cp' to trigger commission
  channelPartnerId: string | null;
};

export type CpCommissionResult = {
  eligible: boolean;
  commissionPaise: number;
  commissionRate: number;
  reason: 'attribution_not_cp' | 'no_channel_partner' | 'deal_value_zero' | 'commissioned';
};

export function computeCpCommission(input: CpCommissionInput): CpCommissionResult {
  if (input.winningSourceType !== 'cp') {
    return { eligible: false, commissionPaise: 0, commissionRate: CP_COMMISSION_RATE, reason: 'attribution_not_cp' };
  }
  if (!input.channelPartnerId) {
    return { eligible: false, commissionPaise: 0, commissionRate: CP_COMMISSION_RATE, reason: 'no_channel_partner' };
  }
  if (input.dealValuePaise <= 0) {
    return { eligible: false, commissionPaise: 0, commissionRate: CP_COMMISSION_RATE, reason: 'deal_value_zero' };
  }
  const commissionPaise = Math.floor(input.dealValuePaise * CP_COMMISSION_RATE);
  return { eligible: true, commissionPaise, commissionRate: CP_COMMISSION_RATE, reason: 'commissioned' };
}
