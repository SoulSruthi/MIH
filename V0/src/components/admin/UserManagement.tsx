'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, RefreshCw, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OrgMember, OrgRole } from '@/app/api/admin/users/route';
import { useOrgId } from '@/lib/use-org-id';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: OrgRole[] = [
  'mih_org_admin',
  'marketing_manager',
  'marketing_analyst',
  'marketing_ops',
  'org_viewer',
];

const ROLE_LABELS: Record<OrgRole, string> = {
  mih_org_admin: 'Org Admin',
  marketing_manager: 'Marketing Manager',
  marketing_analyst: 'Marketing Analyst',
  marketing_ops: 'Marketing Ops',
  org_viewer: 'Viewer',
};

type BadgeVariant = 'default' | 'secondary' | 'info' | 'warning' | 'ghost';

const ROLE_BADGE_VARIANTS: Record<OrgRole, BadgeVariant> = {
  mih_org_admin: 'default',          // blue
  marketing_manager: 'info',         // purple-ish (using info)
  marketing_analyst: 'info',         // info
  marketing_ops: 'warning',          // warning
  org_viewer: 'secondary',           // secondary
};

// Special overrides for the purple look on manager
const ROLE_BADGE_CLASS: Record<OrgRole, string> = {
  mih_org_admin: '',
  marketing_manager: 'bg-purple-100 text-purple-800 border-transparent',
  marketing_analyst: '',
  marketing_ops: '',
  org_viewer: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso));
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: OrgRole }) {
  const customClass = ROLE_BADGE_CLASS[role];
  return (
    <Badge variant={ROLE_BADGE_VARIANTS[role]} className={customClass || undefined}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

// ─── RoleSelect ───────────────────────────────────────────────────────────────

type RoleSelectProps = {
  value: OrgRole;
  onChange: (role: OrgRole) => void;
  disabled?: boolean;
};

function RoleSelect({ value, onChange, disabled }: RoleSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as OrgRole)}
      className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

// ─── InviteDialog ─────────────────────────────────────────────────────────────

type InviteDialogProps = {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: OrgRole) => Promise<void>;
};

function InviteDialog({ open, onClose, onInvite }: InviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('org_viewer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onInvite(email.trim(), role);
      setEmail('');
      setRole('org_viewer');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setEmail('');
      setRole('org_viewer');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation email to add someone to your organisation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="invite-email">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              disabled={submitting}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="invite-role">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              disabled={submitting}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              'Send Invite'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── RemoveDialog ─────────────────────────────────────────────────────────────

type RemoveDialogProps = {
  member: OrgMember | null;
  onClose: () => void;
  onConfirm: (membershipId: string) => Promise<void>;
};

function RemoveDialog({ member, onClose, onConfirm }: RemoveDialogProps) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!member) return;
    setRemoving(true);
    setError(null);
    try {
      await onConfirm(member.membership_id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog open={!!member} onOpenChange={(v) => { if (!v && !removing) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Team Member</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove{' '}
            <span className="font-medium text-slate-900">{member?.email}</span> from your
            organisation? They will lose access immediately.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={removing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={removing}
          >
            {removing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Removing…
              </>
            ) : (
              'Remove'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── UserManagement ───────────────────────────────────────────────────────────

type MembersResponse = {
  members: OrgMember[];
  error?: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

export function UserManagement() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<OrgMember | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MembersResponse;
      setMembers(json.members ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const handleInvite = useCallback(async (email: string, role: OrgRole) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': 'demo-org-id',
      },
      body: JSON.stringify({ email, role }),
    });
    const json = (await res.json()) as ApiResponse;
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? 'Invite failed');
    }
    await fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = useCallback(async (membershipId: string, newRole: OrgRole) => {
    // Optimistic update
    setMembers((prev) =>
      prev.map((m) => (m.membership_id === membershipId ? { ...m, role: newRole } : m)),
    );
    setUpdatingIds((prev) => new Set(prev).add(membershipId));

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({ membership_id: membershipId, role: newRole }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        // Revert — refetch to get ground truth
        await fetchMembers();
        setError(json.error ?? 'Role update failed');
      }
    } catch (err) {
      await fetchMembers();
      setError(err instanceof Error ? err.message : 'Role update failed');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(membershipId);
        return next;
      });
    }
  }, [fetchMembers]);

  const handleRemove = useCallback(async (membershipId: string) => {
    const res = await fetch(
      `/api/admin/users?membership_id=${encodeURIComponent(membershipId)}`,
      {
        method: 'DELETE',
        headers: { 'x-org-id': 'demo-org-id' },
      },
    );
    const json = (await res.json()) as ApiResponse;
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? 'Remove failed');
    }
    setMembers((prev) => prev.filter((m) => m.membership_id !== membershipId));
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Loading members…</div>
    );
  }

  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-500 hover:text-red-700 font-medium text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setInviteOpen(true)} size="sm">
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No members yet. Invite someone to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.membership_id}>
                    <TableCell className="font-medium text-slate-900">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={member.role} />
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {formatDate(member.joined_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <RoleSelect
                          value={member.role}
                          onChange={(newRole) => void handleRoleChange(member.membership_id, newRole)}
                          disabled={updatingIds.has(member.membership_id)}
                        />
                        {updatingIds.has(member.membership_id) && (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setRemovingMember(member)}
                          disabled={updatingIds.has(member.membership_id)}
                          aria-label={`Remove ${member.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
      />

      {/* Remove confirmation dialog */}
      <RemoveDialog
        member={removingMember}
        onClose={() => setRemovingMember(null)}
        onConfirm={handleRemove}
      />
    </>
  );
}
