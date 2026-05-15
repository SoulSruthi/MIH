import type { Metadata } from 'next';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'MIH — Marketing Intelligence Hub',
  description: 'Track, deduplicate, and understand your real estate leads.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white shadow-sm">
          <nav className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
            <a href="/" className="flex items-center gap-2 font-bold text-slate-900 text-lg tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white text-sm font-bold">
                M
              </span>
              MIH
            </a>
            <div className="flex items-center gap-1">
              <a
                href="/leads"
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Leads
              </a>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
