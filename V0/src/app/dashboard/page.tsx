import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
import {
  Users,
  Plug,
  TrendingUp,
  DollarSign,
  BarChart3,
  Tag,
  Settings2,
  ArrowRight,
} from 'lucide-react';

export const metadata = {
  title: 'Dashboard — MIH',
};

const KPI_CARDS = [
  {
    label: 'Total Leads',
    value: '1,284',
    change: '+12% this month',
    positive: true,
    icon: Users,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Active Sources',
    value: '8',
    change: '3 syncing now',
    positive: true,
    icon: Plug,
    color: 'bg-green-50 text-green-600',
  },
  {
    label: 'Avg CPL',
    value: '₹342',
    change: '-8% vs last month',
    positive: true,
    icon: DollarSign,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    label: 'Pipeline Value',
    value: '₹2.4 Cr',
    change: '+24% this quarter',
    positive: true,
    icon: TrendingUp,
    color: 'bg-purple-50 text-purple-600',
  },
];

const QUICK_LINKS = [
  {
    label: 'All Leads',
    description: 'View, search, and manage deduplicated leads',
    href: '/leads',
    icon: Users,
  },
  {
    label: 'ROI Overview',
    description: 'Attribution, spend efficiency, and funnel performance',
    href: '/dashboard/roi',
    icon: BarChart3,
  },
  {
    label: 'Marketing Sources',
    description: 'Manage your connected ad platforms and portals',
    href: '/admin/sources',
    icon: Tag,
  },
  {
    label: 'Spend Tracking',
    description: 'Enter and review daily spend across sources',
    href: '/admin/spend',
    icon: DollarSign,
  },
  {
    label: 'Connectors',
    description: 'Configure integrations with Meta, Google, 99acres and more',
    href: '/admin/connectors',
    icon: Plug,
  },
  {
    label: 'Team & Admin',
    description: 'Manage team members, roles, and org settings',
    href: '/admin/users',
    icon: Settings2,
  },
];

export default async function DashboardPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        {user?.email && (
          <p className="mt-1 text-sm text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{user.email}</span>
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <div className={`rounded-lg p-2 ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p
              className={`mt-1 text-xs ${
                card.positive ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {card.change}
            </p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex-shrink-0 rounded-lg bg-slate-100 p-2.5 group-hover:bg-blue-50 transition-colors">
                <link.icon className="h-4 w-4 text-slate-600 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
                  {link.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 leading-snug">{link.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
          <span>All systems operational · Last synced 3 minutes ago</span>
        </div>
      </div>
    </div>
  );
}
