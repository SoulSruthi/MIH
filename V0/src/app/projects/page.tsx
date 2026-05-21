import type { Metadata } from 'next';
import { ProjectsDashboard } from '@/components/projects/ProjectsDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Projects — MIH',
};

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage real-estate projects, lifecycle stages, and marketing budgets.
        </p>
      </div>
      <ProjectsDashboard />
    </div>
  );
}
