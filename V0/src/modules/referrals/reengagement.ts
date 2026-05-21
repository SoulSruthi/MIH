export const DORMANCY_DAYS = 90;

export type ReferrerReengagementInput = {
  referrerId: string;
  lastReferralAt: string | null;  // ISO timestamp or null (never referred)
  nowAt?: string;                  // injectable for testing; defaults to Date.now()
};

export type ReferrerReengagementResult = {
  referrerId: string;
  isDormant: boolean;
  daysSinceLastReferral: number | null;
  dormancyThresholdDays: number;
};

export function checkReferrerDormancy(
  input: ReferrerReengagementInput,
): ReferrerReengagementResult {
  const now = input.nowAt ? new Date(input.nowAt) : new Date();

  if (!input.lastReferralAt) {
    return {
      referrerId: input.referrerId,
      isDormant: true,
      daysSinceLastReferral: null,
      dormancyThresholdDays: DORMANCY_DAYS,
    };
  }

  const lastReferral = new Date(input.lastReferralAt);
  const daysSince = Math.floor((now.getTime() - lastReferral.getTime()) / 86400000);
  return {
    referrerId: input.referrerId,
    isDormant: daysSince >= DORMANCY_DAYS,
    daysSinceLastReferral: daysSince,
    dormancyThresholdDays: DORMANCY_DAYS,
  };
}

export function filterDormantReferrers(
  referrers: ReferrerReengagementInput[],
): ReferrerReengagementResult[] {
  return referrers.map(checkReferrerDormancy).filter((r) => r.isDormant);
}
