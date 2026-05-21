import type { Metadata } from 'next';
import Link from 'next/link';
import { DisputedQueue } from '@/components/attribution/DisputedQueue';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Disputed Attributions — MIH',
};

export default function DisputedPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/attribution" className="hover:text-slate-700">
            Attribution
          </Link>
          <span>/</span>
          <span>Disputed Queue</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Disputed Attributions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and manage attribution disputes raised by the team.
        </p>
      </div>
      <DisputedQueue />
    </div>
  );
}
