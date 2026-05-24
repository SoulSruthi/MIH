import { ReconciliationItemDetail } from '@/components/reconciliation/ReconciliationItemDetail';

export default function ReconciliationItemPage({ params }: { params: { id: string } }) {
  return <ReconciliationItemDetail id={params.id} />;
}
