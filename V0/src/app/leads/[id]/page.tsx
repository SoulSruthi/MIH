import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel';

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <LeadDetailPanel leadId={params.id} />
    </div>
  );
}
