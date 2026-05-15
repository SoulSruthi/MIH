import { CrmConnectionConfig } from '@/components/admin/CrmConnectionConfig';

export default function CrmConnectionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">CRM Connection</h1>
        <p className="text-slate-500 mt-1">
          Configure your CRM integration to receive lifecycle events and sync lead data.
        </p>
      </div>
      <CrmConnectionConfig />
    </div>
  );
}
