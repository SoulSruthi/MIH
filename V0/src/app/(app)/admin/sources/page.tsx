import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SourceCard } from './_components/source-card';

const KNOWN_CONNECTORS = [
  { source_type: 'meta_lead_ads', display_name: 'Meta Lead Ads', description: 'Facebook & Instagram lead forms' },
  { source_type: 'google_ads', display_name: 'Google Ads', description: 'Google Lead Form extensions (V1)' },
  { source_type: '99acres', display_name: '99acres', description: 'Auto-import via email parser (V1)' },
  { source_type: 'magicbricks', display_name: 'MagicBricks', description: 'Auto-import via email parser (V1)' },
  { source_type: 'housing_com', display_name: 'Housing.com', description: 'Auto-import via email parser (V1)' },
  { source_type: 'justdial', display_name: 'JustDial', description: 'API connector (V1)' },
  { source_type: 'webform', display_name: 'Web Form', description: 'Embed snippet on your website' },
  { source_type: 'walk_in', display_name: 'Walk-in / Manual', description: 'Manual lead entry' },
] as const;

export default async function SourcesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const hdrs = await headers();
  const orgId = hdrs.get('x-org-id') ?? (sp.org_id ?? '');

  if (!orgId) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No organization context.</p>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();

  // Load connected sources for this org
  const { data: connectedSources } = await supabase
    .from('sources')
    .select('id, name, source_type, state, health_score, last_sync_at, last_sync_status')
    .eq('organization_id', orgId);

  const connectedByType = new Map(
    (connectedSources ?? []).map((s: Record<string, unknown>) => [s.source_type as string, s]),
  );

  const successToast = sp.success === '1';

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Source Management</h1>
          <p className="text-sm text-muted-foreground">
            Connect and manage your lead sources. Leads flow automatically once connected.
          </p>
        </div>

        {successToast && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400">
            ✓ Source connected successfully. First sync will begin shortly.
          </div>
        )}

        {/* Connected Sources */}
        {connectedSources && connectedSources.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connected ({connectedSources.length})
            </h2>
            <div className="space-y-3">
              {connectedSources.map((src: Record<string, unknown>) => {
                const known = KNOWN_CONNECTORS.find((k) => k.source_type === (src.source_type as string));
                return (
                  <SourceCard
                    key={src.id as string}
                    orgId={orgId}
                    source={{
                      id: src.id as string,
                      name: src.name as string,
                      source_type: src.source_type as string,
                      display_name: known?.display_name ?? (src.name as string),
                      state: (src.state as string) as 'active',
                      health_score: (src.health_score as number) ?? 100,
                      last_sync_at: (src.last_sync_at as string) ?? null,
                      last_sync_status: (src.last_sync_status as string) ?? null,
                      connected: true,
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Available Connectors */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available Connectors
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {KNOWN_CONNECTORS.filter((k) => !connectedByType.has(k.source_type)).map((connector) => (
              <div key={connector.source_type} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-foreground">{connector.display_name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{connector.description}</p>
                  </div>
                  {connector.source_type === 'meta_lead_ads' ? (
                    <a
                      href={`/api/oauth/meta/start?org_id=${orgId}`}
                      className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Connect
                    </a>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {connector.description.includes('V1') ? 'V1' : 'Coming Soon'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats summary */}
        {connectedSources && connectedSources.length > 0 && (
          <section className="mt-8 rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/dashboard?org_id=${orgId}`}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                View Dashboard →
              </a>
              <a
                href={`/leads?org_id=${orgId}`}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                View All Leads →
              </a>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
