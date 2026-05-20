'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronRight, ChevronDown, Plus, RefreshCw } from 'lucide-react';

type LifecycleState = 'active' | 'launch_only' | 'paused' | 'killed';

type SourceNode = {
  id: string;
  code: string;
  display_name: string;
  level: string;
  lifecycle_state: LifecycleState;
  taxonomy_path: string;
  is_platform_managed: boolean;
  parent_id: string | null;
  children: SourceNode[];
};

const LIFECYCLE_BADGE: Record<LifecycleState, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  launch_only: { label: 'Launch Only', variant: 'outline' },
  paused: { label: 'Paused', variant: 'secondary' },
  killed: { label: 'Killed', variant: 'destructive' },
};

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  active: ['paused', 'launch_only', 'killed'],
  launch_only: ['active', 'paused', 'killed'],
  paused: ['active', 'killed'],
  killed: [],
};

function SourceRow({
  source,
  depth,
  orgId,
  onRefresh,
}: {
  source: SourceNode;
  depth: number;
  orgId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [updating, setUpdating] = useState(false);
  const badge = LIFECYCLE_BADGE[source.lifecycle_state];

  const handleLifecycleChange = async (newState: LifecycleState) => {
    if (updating) return;
    setUpdating(true);
    try {
      await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ lifecycle_state: newState }),
      });
      onRefresh();
    } finally {
      setUpdating(false);
    }
  };

  const transitions = VALID_TRANSITIONS[source.lifecycle_state];

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 group"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {source.children.length > 0 ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">
          {source.display_name}
        </span>
        <span className="text-xs text-slate-400 font-mono hidden sm:block">{source.code}</span>
        <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
        {!source.is_platform_managed && transitions.length > 0 && (
          <div className="hidden group-hover:flex items-center gap-1">
            {transitions.map((t) => (
              <button
                key={t}
                onClick={() => handleLifecycleChange(t)}
                disabled={updating}
                className="text-xs px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-50"
              >
                → {t}
              </button>
            ))}
          </div>
        )}
        {source.is_platform_managed && (
          <span className="text-xs text-slate-300 hidden group-hover:block">Platform</span>
        )}
      </div>
      {expanded && source.children.map((child) => (
        <SourceRow key={child.id} source={child} depth={depth + 1} orgId={orgId} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

export default function TaxonomyPage() {
  const orgId = 'demo-org-id';
  const [tree, setTree] = useState<SourceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    parent_id: '',
    code: '',
    display_name: '',
    level: 'source' as SourceNode['level'],
  });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sources', { headers: { 'x-org-id': orgId } });
      if (res.ok) {
        const { sources } = await res.json() as { sources: SourceNode[] };
        setTree(sources);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void fetchTree(); }, [fetchTree]);

  const handleAdd = async () => {
    setAddError('');
    setAdding(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify(addForm),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setAddError(data.error ?? 'Failed to create source');
        return;
      }
      setShowAddDialog(false);
      setAddForm({ parent_id: '', code: '', display_name: '', level: 'source' });
      await fetchTree();
    } finally {
      setAdding(false);
    }
  };

  // Flatten tree for parent selector
  function flattenTree(nodes: SourceNode[], depth = 0): Array<SourceNode & { depth: number }> {
    return nodes.flatMap((n) => [{ ...n, depth }, ...flattenTree(n.children, depth + 1)]);
  }
  const flatSources = flattenTree(tree);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Source Taxonomy</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Browse the hierarchical channel → medium → source taxonomy. Platform-managed sources cannot be modified.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTree} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Custom Source
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Badge variant="default" className="text-xs">Active</Badge>
              <Badge variant="outline" className="text-xs">Launch Only</Badge>
              <Badge variant="secondary" className="text-xs">Paused</Badge>
              <Badge variant="destructive" className="text-xs">Killed</Badge>
            </span>
            <span>Hover a custom source to change lifecycle state</span>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading taxonomy...</div>
          ) : tree.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No sources found for this organisation.</div>
          ) : (
            tree.map((root) => (
              <SourceRow key={root.id} source={root} depth={0} orgId={orgId} onRefresh={fetchTree} />
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Parent Source</label>
              <select
                value={addForm.parent_id}
                onChange={(e) => setAddForm((f) => ({ ...f, parent_id: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select parent...</option>
                {flatSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {'  '.repeat(s.depth)}{s.display_name} ({s.taxonomy_path})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Code (snake_case)</label>
              <input
                type="text"
                value={addForm.code}
                onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. my_custom_source"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Display Name</label>
              <input
                type="text"
                value={addForm.display_name}
                onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. My Custom Source"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Level</label>
              <select
                value={addForm.level}
                onChange={(e) => setAddForm((f) => ({ ...f, level: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="medium">medium</option>
                <option value="source">source</option>
                <option value="sub_source">sub_source</option>
              </select>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={adding || !addForm.parent_id || !addForm.code || !addForm.display_name}>
              {adding ? 'Adding...' : 'Add Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
