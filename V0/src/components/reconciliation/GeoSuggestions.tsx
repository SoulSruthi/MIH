'use client';

import { useEffect, useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

type GeoSuggestion = {
  source_id: string;
  project_id: string | null;
  source_name: string;
  taxonomy_path: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  is_active: boolean;
};

type Props = {
  itemId: string;
  orgId: string;
};

export default function GeoSuggestions({ itemId, orgId }: Props) {
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reconciliation/${itemId}/geo-suggestions`, {
      headers: { 'x-org-id': orgId },
    })
      .then((r) => r.json())
      .then((d) => { setSuggestions(d.suggestions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [itemId, orgId]);

  if (loading) return <p className="text-sm text-gray-400">Loading geo suggestions...</p>;
  if (suggestions.length === 0) return <p className="text-sm text-gray-400">No active sources found nearby for this project.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Possible Source Attribution</p>
      {suggestions.map((s) => (
        <div key={s.source_id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <MapPin className="text-blue-500 mt-0.5 shrink-0" size={16} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800">{s.source_name}</p>
            {s.taxonomy_path && (
              <p className="text-xs text-gray-500 mt-0.5">{s.taxonomy_path}</p>
            )}
            {s.geo_lat && s.geo_lng && (
              <a
                href={`https://maps.google.com/?q=${s.geo_lat},${s.geo_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
              >
                View on map <ExternalLink size={10} />
              </a>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {s.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      ))}
    </div>
  );
}
