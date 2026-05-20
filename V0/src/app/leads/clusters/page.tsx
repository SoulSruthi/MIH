'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ORG_ID = 'demo-org-id';

type GoldenRecord = {
  id: string;
  primary_phone: string;
  primary_name: string | null;
  primary_email: string | null;
  first_touch_at: string | null;
  last_touch_at: string | null;
  first_touch_source_id: string | null;
};

type Cluster = {
  id: string;
  cluster_type: string;
  state: string;
  raw_lead_count: number;
  source_count: number;
  first_seen_at: string;
  last_activity_at: string;
  golden_records: GoldenRecord[] | GoldenRecord | null;
};

type ClusterDetail = Cluster & {
  identity_edges: Array<{
    id: string;
    edge_type: string;
    confidence: number;
    identity_nodes: { attribute_type: string; attribute_value: string } | null;
  }>;
};

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClusterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/clusters', { headers: { 'x-org-id': ORG_ID } });
    if (res.ok) {
      const d = await res.json() as { clusters: Cluster[] };
      setClusters(d.clusters);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchClusters(); }, [fetchClusters]);

  const handleRowClick = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    const res = await fetch(`/api/clusters/${id}`, { headers: { 'x-org-id': ORG_ID } });
    if (res.ok) {
      const d = await res.json() as { cluster: ClusterDetail };
      setDetail(d.cluster);
    }
    setDetailLoading(false);
  };

  const getGolden = (c: Cluster): GoldenRecord | null => {
    if (!c.golden_records) return null;
    if (Array.isArray(c.golden_records)) return c.golden_records[0] ?? null;
    return c.golden_records;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Identity Clusters</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Each cluster represents a unique person. Click a row to see the golden record and all raw leads.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cluster list */}
        <Card>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">
              {clusters.length} active clusters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading...</div>
            ) : clusters.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No clusters yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Sources</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>First Touch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusters.map((c) => {
                    const g = getGolden(c);
                    return (
                      <TableRow
                        key={c.id}
                        className={`cursor-pointer ${selectedId === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        onClick={() => void handleRowClick(c.id)}
                      >
                        <TableCell className="font-mono text-sm">{g?.primary_phone ?? '—'}</TableCell>
                        <TableCell className="text-sm">{g?.primary_name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{c.source_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.raw_lead_count > 1 ? 'default' : 'outline'}>
                            {c.raw_lead_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(g?.first_touch_at ?? null)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">
              {selectedId ? 'Golden Record' : 'Select a cluster to view details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {!selectedId && (
              <p className="text-sm text-slate-400">Click a row in the list to see the golden record.</p>
            )}
            {detailLoading && (
              <p className="text-sm text-slate-400">Loading...</p>
            )}
            {detail && !detailLoading && (() => {
              const g = Array.isArray(detail.golden_records) ? detail.golden_records[0] : detail.golden_records;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Primary Phone</p>
                      <p className="text-sm font-mono mt-0.5">{g?.primary_phone ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Name</p>
                      <p className="text-sm mt-0.5">{g?.primary_name ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Email</p>
                      <p className="text-sm mt-0.5">{g?.primary_email ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Cluster Type</p>
                      <Badge variant="outline" className="mt-0.5">{detail.cluster_type}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">First Touch</p>
                      <p className="text-sm mt-0.5">{formatDate(g?.first_touch_at ?? null)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Last Touch</p>
                      <p className="text-sm mt-0.5">{formatDate(g?.last_touch_at ?? null)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-2">Identity Signals</p>
                    <div className="space-y-1">
                      {(detail.identity_edges ?? []).map((edge) => (
                        <div key={edge.id} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">{edge.edge_type}</Badge>
                          <span className="text-slate-600">
                            {edge.identity_nodes?.attribute_type}: {edge.identity_nodes?.attribute_value}
                          </span>
                          <span className="text-slate-400">conf: {edge.confidence}</span>
                        </div>
                      ))}
                      {(detail.identity_edges ?? []).length === 0 && (
                        <p className="text-xs text-slate-400">No edges yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 pt-2 border-t">
                    <p>Raw leads: {detail.raw_lead_count} • Sources: {detail.source_count}</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
