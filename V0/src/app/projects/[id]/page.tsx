import type { Metadata } from 'next';
import Link from 'next/link';
import { ProjectDetail } from '@/components/projects/ProjectDetail';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Project Detail — MIH',
};

interface Props {
  params: { id: string };
}

export default function ProjectDetailPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/projects" className="hover:text-slate-700">
            Projects
          </Link>
          <span>/</span>
          <span className="font-mono">{params.id.slice(0, 8)}…</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Project Detail</h1>
        <p className="mt-1 text-sm text-slate-500">
          Project overview, stage transitions, and predominant booking sources.
        </p>
      </div>
      <ProjectDetail projectId={params.id} />
    </div>
  );
}
