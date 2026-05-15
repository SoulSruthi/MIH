import { UserManagement } from '@/components/admin/UserManagement';

export default function UsersPage() {
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
        <p className="text-slate-500 mt-1">Manage who has access to your organisation.</p>
      </div>
      <UserManagement />
    </div>
  );
}
