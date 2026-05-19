'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { email: 'superadmin@demo.mih', role: 'Super Admin', org: '(all orgs)' },
  { email: 'orgadmin1@demo.mih', role: 'Org Admin', org: 'Prestige Realty' },
  { email: 'orgadmin2@demo.mih', role: 'Org Admin', org: 'Godrej Properties' },
  { email: 'manager@demo.mih', role: 'Marketing Manager', org: 'Prestige Realty' },
  { email: 'analyst@demo.mih', role: 'Marketing Analyst', org: 'Prestige Realty' },
  { email: 'ops@demo.mih', role: 'Marketing Ops', org: 'Prestige Realty' },
  { email: 'viewer@demo.mih', role: 'Org Viewer', org: 'Prestige Realty' },
];

const DEMO_PASSWORD = 'demo@mih@2026';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white text-xl font-bold mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-slate-900">MIH</h1>
          <p className="text-sm text-slate-500 mt-1">Marketing Intelligence Hub</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Demo accounts collapsible */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setDemoOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-amber-700 text-xs font-bold">D</span>
              Demo Accounts
            </span>
            {demoOpen ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {demoOpen && (
            <div className="border-t border-slate-100 px-5 pb-4">
              <p className="text-xs text-slate-500 pt-3 pb-2">
                Shared password: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{DEMO_PASSWORD}</code>
              </p>
              <div className="space-y-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account.email)}
                    className="w-full flex items-start justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50 transition-colors group"
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-800 group-hover:text-blue-700 transition-colors">
                        {account.email}
                      </p>
                      <p className="text-xs text-slate-400">{account.role} · {account.org}</p>
                    </div>
                    <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                      Fill
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
