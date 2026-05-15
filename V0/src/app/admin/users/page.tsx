import { UserManagement } from '@/components/admin/UserManagement';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
        <p className="text-slate-500 mt-1">Manage who has access to your organisation.</p>
      </div>
      <UserManagement />
    </div>
  );
}
