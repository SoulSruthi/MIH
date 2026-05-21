import type { Metadata } from 'next';
import Link from 'next/link';
import { AttributionExplain } from '@/components/attribution/AttributionExplain';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Attribution Explanation — MIH',
};

interface Props {
  params: { id: string };
}

export default function AttributionExplainPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/attribution" className="hover:text-slate-700">
            Attribution
          </Link>
          <span>/</span>
          <span className="font-mono">{params.id.slice(0, 8)}…</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Attribution Explanation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Step-by-step breakdown of how this conversion event was attributed.
        </p>
      </div>
      <AttributionExplain conversionEventId={params.id} />
    </div>
  );
}
