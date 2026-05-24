import type { Metadata } from 'next';
import { ReconciliationItemDetail } from '@/components/reconciliation/ReconciliationItemDetail';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reconciliation Item — MIH',
};

export default function ReconciliationDetailPage({ params }: { params: { id: string } }) {
  return <ReconciliationItemDetail id={params.id} />;
}
