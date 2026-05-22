'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { SourceCategory, SourceCategoryKind } from '@/app/api/admin/sources/route';
import { useOrgId } from '@/lib/use-org-id';

type SourcesResponse = {
  categories: SourceCategory[];
};

type CreateResponse = {
  ok?: boolean;
  error?: string;
  category?: SourceCategory;
};

const CATEGORY_TABS: SourceCategoryKind[] = ['ATL', 'BTL', 'Digital', 'Niche'];

const CATEGORY_DESCRIPTIONS: Record<SourceCategoryKind, string> = {
  ATL: 'Above-the-line — TV, radio, print, out-of-home',
  BTL: 'Below-the-line — events, direct mail, activations',
  Digital: 'Online channels — social, search, display, email',
  Niche: 'Specialised or emerging channels',
};

// ─── AddSourceDialog ──────────────────────────────────────────────────────────

type AddSourceDialogProps = {
  onCreated: (cat: SourceCategory) => void;
};

function AddSourceDialog({ onCreated }: AddSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SourceCategoryKind>('ATL');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setCategory('ATL');
    setName('');
    setDescription('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({ category, name: name.trim(), description: description.trim() || undefined }),
      });

      const json = (await res.json()) as CreateResponse;
      if (!res.ok || !json.ok) {
        setFormError(json.error ?? 'Failed to create source');
        return;
      }
      if (json.category) {
        onCreated(json.category);
      }
      reset();
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create source');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add Custom Source
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Source Category</DialogTitle>
          <DialogDescription>
            Create a new marketing source category specific to your organisation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 mt-2">
          {/* Category select */}
          <div className="space-y-1">
            <label htmlFor="src-category" className="text-sm font-medium text-slate-700">
              Category
            </label>
            <select
              id="src-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as SourceCategoryKind)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORY_TABS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="src-name" className="text-sm font-medium text-slate-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="src-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Podcast Ads"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label htmlFor="src-desc" className="text-sm font-medium text-slate-700">
              Description{' '}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="src-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this source channel…"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create Source'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── SourcesDashboard ─────────────────────────────────────────────────────────

export function SourcesDashboard() {
  const [categories, setCategories] = useState<SourceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SourceCategoryKind>('ATL');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sources', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SourcesResponse;
      setCategories(json.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const handleCreated = useCallback((newCat: SourceCategory) => {
    setCategories((prev) => {
      // Insert and re-sort by category then name
      const next = [...prev, newCat].sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });
      return next;
    });
    setActiveTab(newCat.category);
  }, []);

  const byCategory = (kind: SourceCategoryKind) =>
    categories.filter((c) => c.category === kind);

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading sources…</div>;
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <Button variant="ghost" size="sm" className="ml-3" onClick={() => void fetchCategories()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {categories.length} source{categories.length !== 1 ? 's' : ''} total
        </p>
        <AddSourceDialog onCreated={handleCreated} />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SourceCategoryKind)}>
        <TabsList>
          {CATEGORY_TABS.map((kind) => (
            <TabsTrigger key={kind} value={kind}>
              {kind}
              <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {byCategory(kind).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORY_TABS.map((kind) => {
          const items = byCategory(kind);
          return (
            <TabsContent key={kind} value={kind}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-slate-500" />
                    {kind} Sources
                  </CardTitle>
                  <p className="text-sm text-slate-500">{CATEGORY_DESCRIPTIONS[kind]}</p>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      No {kind} sources yet. Add a custom source to get started.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                            )}
                          </div>
                          {item.is_custom ? (
                            <Badge variant="warning" className="flex-shrink-0">
                              Custom
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex-shrink-0">
                              System
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
