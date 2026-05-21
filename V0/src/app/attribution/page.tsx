import type { Metadata } from 'next';
import Link from 'next/link';
import { AttributionDashboard } from '@/components/attribution/AttributionDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Attribution — MIH',
};

export default function AttributionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attribution</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review conversion events and understand how each booking was attributed to a marketing source.
          </p>
        </div>
        <Link
          href="/attribution/disputed"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Disputed Queue →
        </Link>
      </div>
      <AttributionDashboard />
    </div>
  );
}
