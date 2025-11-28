'use client';

import { useEffect, useMemo, useState } from 'react';

export type UTM = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  url?: string | null;
  ref?: string | null;
};

const STORAGE_KEY = '__mane_utm_v1';

function safeWindow() {
  return typeof window !== 'undefined' ? window : undefined;
}
function safeDocument() {
  return typeof document !== 'undefined' ? document : undefined;
}

function parseSearchParams(search: string): Partial<UTM> {
  const out: Partial<UTM> = {};
  const sp = new URLSearchParams(search || '');
  ([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ] as const).forEach((k) => {
    const v = sp.get(k);
    if (v) out[k] = v;
  });
  return out;
}

export function readUtmFromStorage(): UTM | null {
  try {
    const w = safeWindow();
    if (!w) return null;
    const raw = w.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as UTM;
    return obj || null;
  } catch {
    return null;
  }
}

/** Grava UTMs da URL uma única vez (idempotente) */
export function persistUtmFromUrlOnce(): void {
  const w = safeWindow();
  const d = safeDocument();
  if (!w) return;

  const current = readUtmFromStorage() || {};
  const incoming = parseSearchParams(w.location.search);

  // se já temos source/campaign salvos, não sobrescreve (idempotente)
  const already = !!(current.utm_source || current.utm_campaign);

  const urlNow = w.location.href || null;
  const refNow = d?.referrer || null;

  const merged: UTM = {
    ...(already ? current : { ...incoming }),
    url: current.url ?? urlNow,
    ref: current.ref ?? refNow,
  };

  try {
    w.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
}

/** Hook para ler UTMs (client) */
export function useUtm(): UTM | null {
  const [state, setState] = useState<UTM | null>(null);

  useEffect(() => {
    // garante persistência (caso layout não tenha chamado)
    try {
      persistUtmFromUrlOnce();
    } catch {}
    setState(readUtmFromStorage());
  }, []);

  return state;
}

/** Adiciona UTMs salvas ao URL fornecido */
export function appendUtmToUrl(rawUrl: string): string {
  try {
    const w = safeWindow();
    const base = new URL(rawUrl, w?.location?.origin ?? 'https://dummy.local');
    const utm = readUtmFromStorage();
    if (utm) {
      ([
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
      ] as (keyof UTM)[]).forEach((k) => {
        const v = utm[k];
        if (v && !base.searchParams.get(k)) {
          base.searchParams.set(k, String(v));
        }
      });
    }
    return base.toString();
  } catch {
    return rawUrl;
  }
}

/** Retrocompat: alias de appendUtmToUrl (para imports antigos) */
export const withUtm = appendUtmToUrl;

/** Mescla UTMs no body (não sobrescreve campos já presentes) */
export function mergeUtmIntoBody<T extends Record<string, any>>(body: T): T & UTM {
  const utm = readUtmFromStorage();
  if (!utm) return body as T & UTM;

  const outAny: Record<string, any> = { ...body };

  ([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'url',
    'ref',
  ] as (keyof UTM)[]).forEach((k) => {
    if (outAny[k] == null && utm[k] != null) {
      outAny[k] = utm[k];
    }
  });

  return outAny as T & UTM;
}

/** Retorno pronto para payload (prioriza UTMs salvas; preenche url/ref atuais) */
export function getAttributionForPayload(): UTM {
  const w = safeWindow();
  const d = safeDocument();
  const saved = readUtmFromStorage() || {};

  const urlNow = w?.location?.href ?? null;
  const refNow = d?.referrer ?? null;

  return {
    utm_source: saved.utm_source ?? null,
    utm_medium: saved.utm_medium ?? null,
    utm_campaign: saved.utm_campaign ?? null,
    utm_content: saved.utm_content ?? null,
    utm_term: saved.utm_term ?? null,
    url: saved.url ?? urlNow,
    ref: saved.ref ?? refNow,
  };
}

/** Versão memoizada opcional */
export function useAttribution(): UTM {
  const utm = useUtm();
  return useMemo<UTM>(() => {
    const w = safeWindow();
    const d = safeDocument();
    return {
      utm_source: utm?.utm_source ?? null,
      utm_medium: utm?.utm_medium ?? null,
      utm_campaign: utm?.utm_campaign ?? null,
      utm_content: utm?.utm_content ?? null,
      utm_term: utm?.utm_term ?? null,
      url: utm?.url ?? (w?.location?.href ?? null),
      ref: utm?.ref ?? (d?.referrer ?? null),
    };
  }, [utm]);
}
