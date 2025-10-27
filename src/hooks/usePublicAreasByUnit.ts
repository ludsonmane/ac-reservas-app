"use client";
import * as React from "react";
import { api } from "@/lib/api";

export type AreaOption = { id: string; name: string; capacity?: number };

export function usePublicAreasByUnit(unitId?: string) {
  const [areas, setAreas] = React.useState<AreaOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!unitId) { setAreas([]); return; }
    let alive = true;
    setLoading(true); setError(null);

    api(`/v1/areas/public/by-unit/${unitId}`)
      .then((list: any[]) => {
        if (!alive) return;
        const mapped = (list ?? []).map((a) => ({
          id: String(a.id ?? a._id),
          name: String(a.name ?? a.title ?? ""),
          capacity: a.capacity ?? undefined,
        }));
        setAreas(mapped);
      })
      .catch((e: any) => alive && setError(e?.error || e?.message || "Erro ao carregar áreas"))
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [unitId]);

  return { areas, loading, error };
}
