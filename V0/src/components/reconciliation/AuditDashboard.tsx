'use client';

import { useEffect, useState, useCallback } from 'react';

type AuditStats = {
  open_total: number;
  resolved_today: number;
  sla_breached: number;
  sla_compliance_pct: number;
  ageing_histogram: { '0-1d': number; '1-3d': number; '3-7d': number; '7d+': number };
  by_type: Record<string, number>;
};

const ORG_ID = '00000000-0000-0000-0000-000000000001';

export default function AuditDashboard() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/reconciliation/audit', { headers: { 'x-org-id': ORG_ID } });
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) return <div className="p-6 text-gray-500">Loading audit stats...</div>;
  if (!stats) return <div className="p-6 text-red-500">Failed to load audit data.</div>;

  const ageingBuckets = [
    { label: '< 1 day', key: '0-1d', color: 'bg-green-400' },
    { label: '1–3 days', key: '1-3d', color: 'bg-yellow-400' },
    { label: '3–7 days', key: '3-7d', color: 'bg-orange-400' },
    { label: '7+ days', key: '7d+', color: 'bg-red-500' },
  ] as const;
  const maxAgeing = Math.max(...Object.values(stats.ageing_histogram), 1);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reconciliation Audit Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Items" value={stats.open_total} color="blue" />
        <StatCard label="Resolved Today" value={stats.resolved_today} color="green" />
        <StatCard label="SLA Breached" value={stats.sla_breached} color={stats.sla_breached > 0 ? 'red' : 'green'} />
        <StatCard label="SLA Compliance" value={`${stats.sla_compliance_pct}%`} color={stats.sla_compliance_pct >= 80 ? 'green' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ageing histogram */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Ageing Histogram</h2>
          <div className="space-y-2">
            {ageingBuckets.map(({ label, key, color }) => {
              const count = stats.ageing_histogram[key];
              const pct = Math.round((count / maxAgeing) * 100);
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded h-5 relative">
                    <div className={`${color} h-5 rounded`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By type */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">By Item Type</h2>
          {Object.keys(stats.by_type).length === 0 ? (
            <p className="text-sm text-gray-400">No open items.</p>
          ) : (
            <ul className="space-y-1">
              {Object.entries(stats.by_type)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <li key={type} className="flex justify-between text-sm">
                    <span className="text-gray-600 capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-gray-800">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: 'blue' | 'green' | 'red' | 'amber' }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
