'use client';

import * as React from 'react';
import { apiGet } from '@/lib/api';

export type UnitOption = { id: string; name: string; slug?: string | null };

export function usePublicUnits(enabled = true) {
  const [data, setData] = React.useState<UnitOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!enabled) {
      setData([]);
      setError(null);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await apiGet<any[]>('/v1/units/public/options/list');
        const normalized: UnitOption[] = (list ?? []).map((u: any) => ({
          id: String(u.id ?? u._id ?? u.slug ?? u.name),
          name: String(u.name ?? u.title ?? u.slug ?? ''),
          slug: u.slug ?? null,
        }));
        if (!alive) return;
        setData(normalized);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Falha ao carregar unidades.');
        setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [enabled]);

  return { data, loading, error };
}
