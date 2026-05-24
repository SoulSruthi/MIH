import type { Metadata } from 'next';
import { BudgetDetail } from '@/components/budget/BudgetDetail';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Budget Detail — MIH',
};

export default function BudgetDetailPage({ params }: { params: { id: string } }) {
  return <BudgetDetail id={params.id} />;
}
