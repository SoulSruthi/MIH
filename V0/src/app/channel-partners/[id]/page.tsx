import type { Metadata } from 'next';
import { ChannelPartnerDetail } from '@/components/channel-partners/ChannelPartnerDetail';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Channel Partner Detail — MIH',
};

export default function ChannelPartnerDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <ChannelPartnerDetail id={params.id} />
    </div>
  );
}
