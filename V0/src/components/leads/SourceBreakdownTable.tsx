import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeadStatsResponse } from '@/app/leads/page';

interface SourceBreakdownTableProps {
  sources: LeadStatsResponse['sources'];
}

function sourceTypeBadge(type: string) {
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const variantMap: Record<string, 'default' | 'info' | 'secondary'> = {
    'Meta Lead Ads': 'default',
    'Facebook': 'info',
    'Manual': 'secondary',
  };
  return (
    <Badge variant={variantMap[label] ?? 'secondary'} className="font-normal">
      {label}
    </Badge>
  );
}

export function SourceBreakdownTable({ sources }: SourceBreakdownTableProps) {
  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Source Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 py-4 text-center">No sources found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Source</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total Leads</TableHead>
              <TableHead className="text-right">Unique</TableHead>
              <TableHead className="text-right">Duplicates</TableHead>
              <TableHead className="text-right">Dedup %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <TableRow key={source.source_id}>
                <TableCell className="font-medium text-slate-900">
                  {source.source_name}
                </TableCell>
                <TableCell>{sourceTypeBadge(source.source_type)}</TableCell>
                <TableCell className="text-right text-slate-700">
                  {source.total_leads.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-emerald-700">
                    {source.unique_count.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-amber-700">
                    {source.duplicate_count.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {source.dedup_rate_pct != null ? (
                    <span className="text-slate-700">{source.dedup_rate_pct}%</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
