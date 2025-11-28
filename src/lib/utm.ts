// lib/utm.ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const;

type UtmKey = typeof UTM_KEYS[number];
export type UtmBag = Partial<Record<UtmKey, string>>;

const SS_KEY = 'utm_bag';

function readFromSession(): UtmBag {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? (JSON.parse(raw) as UtmBag) : {};
  } catch {
    return {};
  }
}

function writeToSession(bag: UtmBag) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(bag));
  } catch {}
}

function fromSearchParams(sp: URLSearchParams): UtmBag {
  const bag: UtmBag = {};
  UTM_KEYS.forEach((k) => {
    const v = sp.get(k);
    if (v) bag[k] = v;
  });
  return bag;
}

export function mergeUtm(current: UtmBag, incoming: UtmBag): UtmBag {
  // incoming tem prioridade; mantém o que já existe
  return { ...current, ...incoming };
}

export function withUtm(href: string, utm: UtmBag): string {
  if (!utm || Object.keys(utm).length === 0) return href;

  const url = new URL(href, 'http://dummy'); // base fake para manipular
  const params = new URLSearchParams(url.search);

  Object.entries(utm).forEach(([k, v]) => {
    if (v && !params.has(k)) params.set(k, v);
  });

  url.search = params.toString();
  // remove a base dummy
  return url.pathname + (url.search ? `?${url.searchParams.toString()}` : '') + (url.hash || '');
}

// Hook: lê UTMs da URL, persiste e retorna a "bag" atual
export function useUtm(): UtmBag {
  const sp = useSearchParams();
  const [bag, setBag] = useState<UtmBag>({});
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const fromUrl = sp ? fromSearchParams(sp as unknown as URLSearchParams) : {};
    const fromSS = readFromSession();
    const merged = mergeUtm(fromSS, fromUrl);

    if (Object.keys(merged).length > 0) {
      writeToSession(merged);
      // opcional: cookie simples por 90 dias
      const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
      Object.entries(merged).forEach(([k, v]) => {
        document.cookie = `${encodeURIComponent(k)}=${encodeURIComponent(v!)}; Path=/; Expires=${expires}; SameSite=Lax`;
      });
    }
    setBag(merged);
  }, [sp]);

  // memorizado para estabilidade
  return useMemo(() => bag, [bag]);
}
