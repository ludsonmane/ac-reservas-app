// src/app/reservar/hooks/useAvailability.ts
'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type AreaAvailability = {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  remaining?: number; // calculado pela API por dia
};

export function useAvailability(unitId?: string | null, dateYMD?: string | null) {
  const [data, setData] = useState<AreaAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) { setData([]); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('unitId', unitId);
        if (dateYMD) qs.set('date', dateYMD);
        const list = await apiGet<AreaAvailability[]>(`/v1/reservations/availability?${qs.toString()}`);
        if (!alive) return;
        setData(list ?? []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Falha ao carregar disponibilidade');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [unitId, dateYMD]);

  return { data, loading, error };
}
