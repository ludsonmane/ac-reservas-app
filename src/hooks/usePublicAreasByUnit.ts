// src/hooks/usePublicAreasByUnit.ts
'use client';

import * as React from 'react';
import { apiGet } from '@/lib/api';
import { resolvePhotoUrl } from '../lib/assets';

export type AreaOption = {
  id: string;
  name: string;

  /** compat antigo */
  capacity?: number;

  /** novos (para exibir imagem e info) */
  photoUrl?: string | null;
  photoUrlAbsolute?: string | null;
  capacityAfternoon?: number | null;
  capacityNight?: number | null;
  isActive?: boolean;
  iconEmoji?: string | null;
  description?: string | null;
};

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
          `/v1/areas/public/by-unit/${encodeURIComponent(unitId)}?__ts=${Date.now()}`
        );

        const normalized: AreaOption[] = (list ?? []).map((a: any) => {
          // normaliza URLs (preferir absoluta vinda da API)
          const abs = resolvePhotoUrl(a.photoUrlAbsolute) ?? null;
          const rel = resolvePhotoUrl(
            a.photoUrl ?? a.photo ?? a.imageUrl ?? a.image ?? a.coverUrl ?? a.photo_url
          ) ?? null;

          return {
            id: String(a.id ?? a._id),
            name: String(a.name ?? a.title ?? ''),

            // compat antigo
            capacity: typeof a.capacity === 'number' ? a.capacity : undefined,

            // novos campos
            photoUrlAbsolute: abs,
            photoUrl: rel,
            capacityAfternoon: a.capacityAfternoon ?? a.capacity_afternoon ?? null,
            capacityNight: a.capacityNight ?? a.capacity_night ?? null,
            isActive: a.isActive ?? true,
            iconEmoji: a.iconEmoji ?? a.icon_emoji ?? null,
            description: a.description ?? null,
          };
        });

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
