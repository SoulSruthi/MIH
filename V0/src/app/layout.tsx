import type { Metadata } from 'next';
import '@/app/globals.css';
import { AppShell } from '@/components/layout/AppShell.js';

export const metadata: Metadata = {
  title: 'MIH — Marketing Intelligence Hub',
  description: 'Track, deduplicate, and understand your real estate leads.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
