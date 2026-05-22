'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';
import { useOrgId } from '@/lib/use-org-id';

type CP = {
  id: string;
  name: string;
  code: string | null;
  cp_type: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  rera_number: string | null;
  is_active: boolean;
  default_commission_pct: number;
};

type Commission = {
  id: string;
  booking_value: number;
  commission_pct: number;
  commission_value: number;
  state: string;
  created_at: string;
  project_id: string | null;
};

type ApiKey = {
  id: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const STATE_CLASSES: Record<string, string> = {
  earned: 'bg-blue-50 text-blue-700',
  accrued: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-slate-100 text-slate-600',
  reversed: 'bg-red-50 text-red-700',
  disputed: 'bg-orange-50 text-orange-700',
};

export function ChannelPartnerDetail({ id }: { id: string }) {
  const orgId = useOrgId();
  const [cp, setCp] = useState<CP | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cpRes, commissionsRes, keysRes] = await Promise.all([
        fetch(`/api/channel-partners/${id}`, { headers: { 'x-org-id': orgId } }),
        fetch(`/api/channel-partners/${id}/commissions`, { headers: { 'x-org-id': orgId } }),
        fetch(`/api/channel-partners/${id}/api-keys`, { headers: { 'x-org-id': orgId } }),
      ]);

      if (cpRes.ok) setCp((await cpRes.json()).channel_partner);
      if (commissionsRes.ok) setCommissions((await commissionsRes.json()).commissions ?? []);
      if (keysRes.ok) setApiKeys((await keysRes.json()).api_keys ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    setNewKeyValue(null);
    try {
      const res = await fetch(`/api/channel-partners/${id}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ scopes: ['leads:write'] }),
      });
      if (res.ok) {
        const d = await res.json();
        setNewKeyValue(d.api_key);
        await fetchAll();
      }
    } finally {
      setGeneratingKey(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 animate-pulse">Loading…</div>;
  if (!cp) return <div className="py-12 text-center text-slate-400">Channel partner not found.</div>;

  const totalCommissions = commissions.reduce((acc, c) => acc + (c.commission_value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/channel-partners" className="text-sm text-blue-600 hover:underline">← Channel Partners</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">{cp.name}</h1>
        <p className="text-sm text-slate-500 capitalize">{cp.cp_type.replace('_', ' ')} · {cp.rera_number ?? 'No RERA'}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Default Commission</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{(cp.default_commission_pct * 100).toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Total Accrued</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{formatInrLakh(totalCommissions)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Status</p>
            <p className={`text-sm font-bold mt-0.5 ${cp.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
              {cp.is_active ? 'Active' : 'Inactive'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {cp.contact_name && <p><span className="text-slate-500">Contact: </span><span className="text-slate-900">{cp.contact_name}</span></p>}
        {cp.contact_email && <p><span className="text-slate-500">Email: </span><span className="text-slate-900">{cp.contact_email}</span></p>}
        {cp.contact_phone && <p><span className="text-slate-500">Phone: </span><span className="text-slate-900">{cp.contact_phone}</span></p>}
        {cp.code && <p><span className="text-slate-500">Code: </span><span className="text-slate-900">{cp.code}</span></p>}
      </div>

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-600">Commission Accruals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {commissions.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No commissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Booking Value</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Comm %</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Commission</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-500">State</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5">{formatInrLakh(c.booking_value)}</td>
                      <td className="px-4 py-2.5 text-right">{(c.commission_pct * 100).toFixed(2)}%</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatInrLakh(c.commission_value)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATE_CLASSES[c.state] ?? ''}`}>
                          {c.state}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-600">API Keys</CardTitle>
          <Button size="sm" onClick={() => void handleGenerateKey()} disabled={generatingKey}>
            {generatingKey ? 'Generating…' : 'Generate Key'}
          </Button>
        </CardHeader>
        {newKeyValue && (
          <div className="mx-5 my-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
            <p className="text-xs text-emerald-700 font-semibold mb-1">New API Key (copy now — shown once)</p>
            <code className="text-xs font-mono text-emerald-900 break-all">{newKeyValue}</code>
          </div>
        )}
        <CardContent className="p-0">
          {apiKeys.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No API keys yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">ID</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Scopes</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-500">Status</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{k.id.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 text-slate-700">{k.scopes.join(', ')}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${k.revoked_at ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {k.revoked_at ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(k.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
