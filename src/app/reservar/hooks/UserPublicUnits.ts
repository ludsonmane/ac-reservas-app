// src/app/reservar/hooks/usePublicUnits.ts
'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type PublicUnit = { id: string; name: string; slug?: string };

export function usePublicUnits() {
  const [data, setData] = useState<PublicUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await apiGet<any[]>('/v1/units/public/options/list');
        if (!alive) return;
        const normalized = (list ?? []).map((u: any) => ({
          id: String(u.id ?? u._id ?? u.slug ?? u.name),
          name: String(u.name ?? u.title ?? u.slug ?? ''),
          slug: u.slug ?? undefined,
        }));
        setData(normalized);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Falha ao carregar unidades');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { data, loading, error };
}
