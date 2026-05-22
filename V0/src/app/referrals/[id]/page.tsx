import type { Metadata } from 'next';
import { ReferrerDetail } from '@/components/referrals/ReferrerDetail';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Referrer Detail — MIH',
};

export default function ReferrerDetailPage({ params }: { params: { id: string } }) {
  return <ReferrerDetail id={params.id} />;
}
