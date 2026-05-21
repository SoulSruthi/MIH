'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Users,
  BarChart3,
  Plug,
  Tag,
  Settings2,
  CreditCard,
  AlertTriangle,
  Inbox,
  PlusCircle,
  LayoutDashboard,
  TrendingUp,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Link2,
  LogOut,
  GitBranch,
  Activity,
  Fingerprint,
  Target,
  Building2,
  MapPin,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
};

const NAV: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Leads',
    icon: Users,
    children: [
      { label: 'All Leads', href: '/leads', icon: Users },
      { label: 'Add Leads', href: '/leads/entry', icon: PlusCircle },
      { label: 'Raw Inbox', href: '/leads/inbox', icon: Inbox },
      { label: 'Identity Clusters', href: '/leads/clusters', icon: Fingerprint },
    ],
  },
  {
    label: 'Dashboard',
    icon: BarChart3,
    children: [
      { label: 'ROI Overview', href: '/dashboard/roi', icon: TrendingUp },
      { label: 'By Source', href: '/dashboard/roi/sources', icon: BarChart3 },
    ],
  },
  {
    label: 'Connectors',
    icon: Plug,
    children: [
      { label: 'Manage Connectors', href: '/admin/connectors', icon: Plug },
      { label: 'Marketing Sources', href: '/admin/sources', icon: Tag },
      { label: 'Source Taxonomy', href: '/admin/taxonomy', icon: GitBranch },
      { label: 'BTL Activities', href: '/admin/activities', icon: Activity },
    ],
  },
  {
    label: 'Attribution',
    icon: Target,
    children: [
      { label: 'Attribution', href: '/attribution', icon: Target },
      { label: 'Disputed Queue', href: '/attribution/disputed', icon: AlertTriangle },
    ],
  },
  {
    label: 'Projects',
    icon: Building2,
    children: [
      { label: 'All Projects', href: '/projects', icon: Building2 },
    ],
  },
  {
    label: 'Operations',
    icon: Settings2,
    children: [
      { label: 'Site Visits', href: '/site-visits', icon: MapPin },
      { label: 'Spend Tracking', href: '/admin/spend', icon: CreditCard },
      { label: 'Dedup Rules', href: '/admin/dedup-rules', icon: Settings2 },
      { label: 'Dead Letter Queue', href: '/sources/dlq', icon: Inbox },
    ],
  },
  {
    label: 'Admin',
    icon: Settings2,
    children: [
      { label: 'Team Members', href: '/admin/users', icon: Users },
      { label: 'Alerts', href: '/admin/anomalies', icon: AlertTriangle },
      { label: 'Billing', href: '/admin/billing', icon: CreditCard },
      { label: 'CRM Connection', href: '/admin/crm-connection', icon: Link2 },
    ],
  },
];

function NavGroup({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isAnyChildActive = item.children?.some((c) => c.href && pathname.startsWith(c.href));
  const [open, setOpen] = useState(isAnyChildActive ?? true);

  if (!item.children) {
    const active = item.href ? pathname === item.href : false;
    return (
      <Link
        href={item.href ?? '#'}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-0.5 ml-2 space-y-0.5 border-l border-slate-100 pl-3">
          {item.children.map((child) => {
            const active = child.href
              ? child.href === '/leads'
                ? pathname === '/leads'
                : pathname.startsWith(child.href)
              : false;
            return (
              <Link
                key={child.href}
                href={child.href ?? '#'}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, [supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-slate-200">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 font-bold text-slate-900 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white text-sm font-bold">
            M
          </span>
          MIH
        </Link>
        <span className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
          V1
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {NAV.map((item) => (
          <NavGroup key={item.label} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3 space-y-2">
        {userEmail && (
          <p className="text-xs text-slate-500 truncate" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
        <p className="text-[10px] text-slate-300">Marketing Intelligence Hub</p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between px-4 border-b border-slate-200">
              <span className="font-bold text-slate-900">MIH</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
