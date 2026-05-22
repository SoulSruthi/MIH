'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DedupRulesConfig } from '@/app/api/admin/dedup-rules/route';
import type { DedupPreview } from '@/app/api/admin/dedup-rules/preview/route';
import { useOrgId } from '@/lib/use-org-id';

// ─── Types ────────────────────────────────────────────────────────────────────

type RulesResponse = { rules: DedupRulesConfig; error?: never } | { error: string; rules?: never };
type SaveResponse = { ok: true; rules: DedupRulesConfig } | { ok?: never; error: string };

type ToastState =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }
  | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hoursToLabel(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = hours / 24;
  return Number.isInteger(days) ? `${days}d` : `${hours}h`;
}

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-center gap-2 rounded-md border px-4 py-3 text-sm',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800',
      ].join(' ')}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
      )}
      {toast.message}
    </div>
  );
}

// ─── Preview Box ──────────────────────────────────────────────────────────────

function PreviewBox({
  windowHours,
  preview,
  loading,
}: {
  windowHours: number;
  preview: DedupPreview | null;
  loading: boolean;
}) {
  return (
    <Card className="border-blue-100 bg-blue-50/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-sm text-blue-800">Dedup Preview (last 7 days)</CardTitle>
          <Badge variant="info" className="text-xs ml-auto">
            {hoursToLabel(windowHours)} window
          </Badge>
        </div>
        <CardDescription className="text-xs text-blue-600">
          Shows actual dedup rate from your current rules. Future versions will simulate the new
          window.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Loading preview…
          </div>
        ) : preview ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {preview.total_leads_last_week.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Total leads</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {preview.would_be_duplicates.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Duplicates</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">
                {preview.dedup_rate_pct !== null ? `${preview.dedup_rate_pct}%` : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Dedup rate</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-blue-600">No preview data available.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── WindowSlider ─────────────────────────────────────────────────────────────

function WindowSlider({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  id: string;
}) {
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v) && v >= 1 && v <= 720) onChange(v);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={1}
          max={720}
          step={1}
          value={value}
          onChange={handleSlider}
          className="flex-1 h-2 cursor-pointer accent-blue-600"
        />
        <input
          type="number"
          min={1}
          max={720}
          value={value}
          onChange={handleNumber}
          aria-label="Phone window hours"
          className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-500 w-10 shrink-0">{hoursToLabel(value)}</span>
      </div>
      <div className="flex justify-between text-xs text-slate-400 px-0.5">
        <span>1h</span>
        <span>24h</span>
        <span>7d</span>
        <span>30d</span>
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 cursor-pointer group"
    >
      <div className="mt-0.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
        />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-800 group-hover:text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

// ─── DedupRulesEditor ─────────────────────────────────────────────────────────

export function DedupRulesEditor() {
  const uid = useId();

  // Server state (what was last saved)
  const [savedRules, setSavedRules] = useState<DedupRulesConfig | null>(null);

  // Local draft state
  const [phoneWindowHours, setPhoneWindowHours] = useState(24);
  const [postWindowBehavior, setPostWindowBehavior] = useState<
    'new_lead' | 'merge_existing'
  >('new_lead');
  const [emailDedupEnabled, setEmailDedupEnabled] = useState(false);
  const [fuzzyPhoneEnabled, setFuzzyPhoneEnabled] = useState(false);

  // UI state
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DedupPreview | null>(null);

  // ── Fetch rules ────────────────────────────────────────────────────────────

  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/dedup-rules', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      const json = (await res.json()) as RulesResponse;
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      const r = json.rules!;
      setSavedRules(r);
      setPhoneWindowHours(r.phone_window_hours);
      setPostWindowBehavior(r.post_window_behavior);
      setEmailDedupEnabled(r.email_dedup_enabled);
      setFuzzyPhoneEnabled(r.fuzzy_phone_enabled);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dedup rules');
    } finally {
      setLoadingRules(false);
    }
  }, []);

  // ── Fetch preview ──────────────────────────────────────────────────────────

  const fetchPreview = useCallback(async (windowHours: number) => {
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/admin/dedup-rules/preview?window_hours=${windowHours}`,
        { headers: { 'x-org-id': 'demo-org-id' } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DedupPreview;
      setPreview(json);
    } catch {
      // Preview failure is non-critical — leave stale data
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (!loadingRules) {
      void fetchPreview(phoneWindowHours);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRules, fetchPreview]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/api/admin/dedup-rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({
          phone_window_hours: phoneWindowHours,
          post_window_behavior: postWindowBehavior,
          email_dedup_enabled: emailDedupEnabled,
          fuzzy_phone_enabled: fuzzyPhoneEnabled,
        } satisfies Partial<DedupRulesConfig>),
      });
      const json = (await res.json()) as SaveResponse;
      if (!res.ok || !json.ok) {
        throw new Error((json as { error: string }).error ?? `HTTP ${res.status}`);
      }
      setSavedRules(json.rules);
      setToast({ type: 'success', message: 'Dedup rules saved successfully.' });
      // Refresh preview with new window
      void fetchPreview(phoneWindowHours);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save rules',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const isDirty =
    savedRules !== null &&
    (phoneWindowHours !== savedRules.phone_window_hours ||
      postWindowBehavior !== savedRules.post_window_behavior ||
      emailDedupEnabled !== savedRules.email_dedup_enabled ||
      fuzzyPhoneEnabled !== savedRules.fuzzy_phone_enabled);

  // ── Render states ──────────────────────────────────────────────────────────

  if (loadingRules) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading dedup rules…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {loadError}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void fetchRules()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Preview box */}
      <PreviewBox
        windowHours={phoneWindowHours}
        preview={preview}
        loading={loadingPreview}
      />

      {/* Phone window */}
      <Card>
        <CardHeader>
          <CardTitle>Phone Deduplication Window</CardTitle>
          <CardDescription>
            Leads with the same phone number arriving within this window are treated as duplicates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <WindowSlider
            id={`${uid}-window`}
            value={phoneWindowHours}
            onChange={setPhoneWindowHours}
          />
          <p className="text-xs text-slate-400">
            Current: <strong>{phoneWindowHours} hours</strong> ({hoursToLabel(phoneWindowHours)})
            &mdash; max 720h (30 days)
          </p>
        </CardContent>
      </Card>

      {/* Post-window behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Post-Window Behaviour</CardTitle>
          <CardDescription>
            What happens when a duplicate arrives after the dedup window has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name={`${uid}-behavior`}
              value="new_lead"
              checked={postWindowBehavior === 'new_lead'}
              onChange={() => setPostWindowBehavior('new_lead')}
              className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <div>
              <p className="text-sm font-medium text-slate-800 group-hover:text-slate-900">
                Create new lead
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Treat the submission as a brand-new lead, even if the phone number was seen before.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name={`${uid}-behavior`}
              value="merge_existing"
              checked={postWindowBehavior === 'merge_existing'}
              onChange={() => setPostWindowBehavior('merge_existing')}
              className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <div>
              <p className="text-sm font-medium text-slate-800 group-hover:text-slate-900">
                Merge into existing lead
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Update the existing lead record rather than creating a duplicate entry.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Advanced toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Options</CardTitle>
          <CardDescription>
            Fine-tune matching behaviour for emails and fuzzy phone lookups.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleRow
            id={`${uid}-email`}
            label="Email deduplication"
            description="Also deduplicate leads that share the same email address, regardless of phone."
            checked={emailDedupEnabled}
            onChange={setEmailDedupEnabled}
          />
          <div className="border-t border-slate-100" />
          <ToggleRow
            id={`${uid}-fuzzy`}
            label="Fuzzy phone matching"
            description="Normalise phone numbers (strip spaces, country codes) before comparing. Reduces false negatives."
            checked={fuzzyPhoneEnabled}
            onChange={setFuzzyPhoneEnabled}
          />
        </CardContent>
      </Card>

      {/* Footer: last updated + save */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-slate-400">
          {savedRules?.updated_at ? (
            <>Last saved: {formatUpdatedAt(savedRules.updated_at)}</>
          ) : (
            'Not yet saved'
          )}
          {isDirty && (
            <Badge variant="ghost" className="ml-2 text-xs">
              Unsaved changes
            </Badge>
          )}
        </p>
        <Button
          onClick={() => void handleSave()}
          disabled={saving || !isDirty}
        >
          {saving ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
