import type { Metadata } from 'next';
import { SalesforceImport } from '@/components/reconciliation/SalesforceImport';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Salesforce Import — MIH',
};

export default function SalesforceImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Salesforce Import</h1>
        <p className="mt-1 text-sm text-slate-500">
          Import historical leads, contacts, opportunities, calls, and CRM comments from Salesforce exports.
        </p>
      </div>
      <SalesforceImport />
    </div>
  );
}
