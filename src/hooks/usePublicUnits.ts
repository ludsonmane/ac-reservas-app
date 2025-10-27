"use client";
import * as React from "react";
import { api } from "@/lib/api";

export type UnitOption = { id: string; name: string; slug: string };

export function usePublicUnits(enabled = true) {
  const [units, setUnits] = React.useState<UnitOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true); setError(null);

    api("/v1/units/public/options/list")
      .then((list: any[]) => {
        if (!alive) return;
        const mapped = (list ?? []).map((u) => ({
          id: String(u.id ?? u._id ?? u.slug ?? u.name),
          name: String(u.name ?? u.title ?? u.slug ?? ""),
          slug: String(u.slug ?? ""),
        }));
        setUnits(mapped);
      })
      .catch((e: any) => alive && setError(e?.error || e?.message || "Erro ao carregar unidades"))
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [enabled]);

  return { units, loading, error };
}
