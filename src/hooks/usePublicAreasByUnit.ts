// src/hooks/usePublicAreasByUnit.ts
'use client';

import * as React from 'react';
import { apiGet } from '@/lib/api';

export type AreaOption = { id: string; name: string; capacity?: number };

export function usePublicAreasByUnit(
  unitId?: string | null,
  enabled = true
) {
  const [data, setData] = React.useState<AreaOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    if (!enabled || !unitId) {
      setData([]);
      setError(null);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await apiGet<any[]>(
          `/v1/areas/public/by-unit/${encodeURIComponent(unitId)}`
        );
        const normalized: AreaOption[] = (list ?? []).map((a: any) => ({
          id: String(a.id ?? a._id),
          name: String(a.name ?? a.title ?? ''),
          capacity: typeof a.capacity === 'number' ? a.capacity : undefined,
        }));
        if (!alive) return;
        setData(normalized);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Falha ao carregar áreas.');
        setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [unitId, enabled]);

  return { data, loading, error };
}
