import type { Metadata } from 'next';
import { ChannelPartnersDashboard } from '@/components/channel-partners/ChannelPartnersDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Channel Partners — MIH',
};

export default function ChannelPartnersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Channel Partners</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage channel partners, track lead push events, and view commission summaries.
        </p>
      </div>
      <ChannelPartnersDashboard />
    </div>
  );
}
