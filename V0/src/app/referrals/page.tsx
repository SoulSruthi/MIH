import type { Metadata } from 'next';
import { ReferralsDashboard } from '@/components/referrals/ReferralsDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Referral Program — MIH',
};

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Referral Program</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage customer referrers, consent, and commission accruals.
        </p>
      </div>
      <ReferralsDashboard />
    </div>
  );
}
