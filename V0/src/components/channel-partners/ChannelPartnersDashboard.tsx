'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ORG_ID = 'demo-org-id';

type ChannelPartner = {
  id: string;
  name: string;
  code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
};

type CreateFormState = {
  name: string;
  code: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

const DEFAULT_FORM: CreateFormState = {
  name: '',
  code: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
};

export function ChannelPartnersDashboard() {
  const [partners, setPartners] = useState<ChannelPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/channel-partners', { headers: { 'x-org-id': ORG_ID } });
      const json = await res.json();
      setPartners(json.channel_partners ?? []);
    } catch {
      setError('Failed to load channel partners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/channel-partners', {
        method: 'POST',
        headers: { 'x-org-id': ORG_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          code: form.code || undefined,
          contact_name: form.contact_name || undefined,
          contact_email: form.contact_email || undefined,
          contact_phone: form.contact_phone || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'Failed to create channel partner');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchPartners();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 text-sm">Loading channel partners…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {partners.length} partner{partners.length !== 1 ? 's' : ''}
        </span>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Partner'}
        </Button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add Channel Partner</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              {(['name', 'code', 'contact_name', 'contact_email', 'contact_phone'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-slate-600 mb-1">
                    {field.replace(/_/g, ' ')}{field === 'name' ? ' *' : ''}
                  </label>
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    required={field === 'name'}
                  />
                </div>
              ))}
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Adding…' : 'Add Partner'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {partners.map((cp) => (
          <Card key={cp.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 text-sm">{cp.name}</span>
                    {cp.code && (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">{cp.code}</Badge>
                    )}
                    <Badge className={cp.is_active
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                    }>
                      {cp.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {cp.contact_name && (
                    <div className="text-xs text-slate-500 mt-0.5">{cp.contact_name}</div>
                  )}
                  {cp.contact_email && (
                    <div className="text-xs text-slate-400">{cp.contact_email}</div>
                  )}
                </div>
                <Link href={`/channel-partners/${cp.id}`}>
                  <Button variant="outline" size="sm">View →</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {partners.length === 0 && (
          <div className="text-slate-400 text-sm text-center py-8">No channel partners yet.</div>
        )}
      </div>
    </div>
  );
}
