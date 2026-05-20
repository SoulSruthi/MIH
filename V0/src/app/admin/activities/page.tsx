'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil } from 'lucide-react';

const ORG_ID = 'demo-org-id';

const ACTIVITY_TYPES = [
  'hoarding','btl_mall','btl_apartment','flyer','event','signage',
  'noparking','tv','newspaper','theatre','influencer','postal','portal_listing',
];

type Activity = {
  id: string;
  activity_code: string;
  display_name: string;
  activity_type: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  lifecycle_state: string;
  source_id: string | null;
};

type Source = {
  id: string;
  display_name: string;
  taxonomy_path: string;
};

const LIFECYCLE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  killed: 'destructive',
  launch_only: 'outline',
};

const BLANK_FORM = {
  activity_code: '',
  display_name: '',
  activity_type: 'hoarding',
  location: '',
  start_date: '',
  end_date: '',
  source_id: '',
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Flatten sources for the select
  function flattenSources(nodes: Array<{ id: string; display_name: string; taxonomy_path: string; children?: unknown[] }>): Source[] {
    return nodes.flatMap((n) => [
      { id: n.id, display_name: n.display_name, taxonomy_path: n.taxonomy_path },
      ...flattenSources((n.children as typeof nodes) ?? []),
    ]);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [actRes, srcRes] = await Promise.all([
      fetch('/api/activities', { headers: { 'x-org-id': ORG_ID } }),
      fetch('/api/sources', { headers: { 'x-org-id': ORG_ID } }),
    ]);
    if (actRes.ok) {
      const d = await actRes.json() as { activities: Activity[] };
      setActivities(d.activities);
    }
    if (srcRes.ok) {
      const d = await srcRes.json() as { sources: Array<{ id: string; display_name: string; taxonomy_path: string; children?: unknown[] }> };
      setSources(flattenSources(d.sources));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(BLANK_FORM);
    setError('');
    setShowDialog(true);
  };

  const openEdit = (a: Activity) => {
    setEditingId(a.id);
    setForm({
      activity_code: a.activity_code,
      display_name: a.display_name,
      activity_type: a.activity_type,
      location: a.location ?? '',
      start_date: a.start_date ?? '',
      end_date: a.end_date ?? '',
      source_id: a.source_id ?? '',
    });
    setError('');
    setShowDialog(true);
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const body = {
        ...form,
        source_id: form.source_id || null,
        location: form.location || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };

      const res = editingId
        ? await fetch(`/api/activities/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
            body: JSON.stringify({ display_name: body.display_name, location: body.location, start_date: body.start_date, end_date: body.end_date }),
          })
        : await fetch('/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
            body: JSON.stringify(body),
          });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      setShowDialog(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">BTL Activities</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Manage below-the-line activities like hoardings, mall activations, events, and more.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          New Activity
        </Button>
      </div>

      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">
            {activities.length} activities
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading...</div>
          ) : activities.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No activities yet. Create your first BTL activity.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.display_name}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{a.activity_code}</TableCell>
                    <TableCell className="text-sm">{a.activity_type}</TableCell>
                    <TableCell className="text-sm text-slate-500">{a.location ?? '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {a.start_date ? `${a.start_date}${a.end_date ? ` – ${a.end_date}` : ''}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LIFECYCLE_VARIANT[a.lifecycle_state] ?? 'outline'}>
                        {a.lifecycle_state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-slate-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Activity' : 'New BTL Activity'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editingId && (
              <div>
                <label className="text-sm font-medium text-slate-700">Activity Code</label>
                <input
                  type="text"
                  value={form.activity_code}
                  onChange={(e) => setForm((f) => ({ ...f, activity_code: e.target.value }))}
                  placeholder="e.g. hoarding_bkc_2026"
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">Display Name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. BKC Hoarding Q1 2026"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            {!editingId && (
              <div>
                <label className="text-sm font-medium text-slate-700">Activity Type</label>
                <select
                  value={form.activity_type}
                  onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">Source</label>
              <select
                value={form.source_id}
                onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name} ({s.taxonomy_path})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. BKC, Mumbai"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.display_name || (!editingId && !form.activity_code)}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
