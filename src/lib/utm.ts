// src/lib/utm.ts
'use client';

export type Utm = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  url?: string | null;
  ref?: string | null;
};

const UTM_KEYS: (keyof Utm)[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];

const LS_KEY = 'utm:attrib:v1';

/** Lê UTM da URL atual (client) */
export function readUtmFromUrl(): Utm {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const utm: Utm = {};
  for (const k of UTM_KEYS) {
    const v = p.get(k as string);
    if (v) utm[k] = v;
  }
  return utm;
}

/** Salva no localStorage */
export function saveUtmToStorage(data: Utm) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}

/** Lê do localStorage */
export function loadUtmFromStorage(): Utm {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Utm) : {};
  } catch {
    return {};
  }
}

/** Captura UTM da URL (uma vez) e persiste (com url/ref) */
export function persistUtmFromUrlOnce() {
  if (typeof window === 'undefined') return;
  const stored = loadUtmFromStorage();
  // se já temos utm_source guardado, mantemos
  if (stored?.utm_source) return;

  const fromUrl = readUtmFromUrl();
  const hasAny =
    UTM_KEYS.some((k) => !!fromUrl[k]) ||
    !!document?.referrer;

  if (!hasAny) return;

  const merged: Utm = {
    ...fromUrl,
    url: window.location.href,
    ref: document.referrer || null,
  };
  saveUtmToStorage(merged);
}

/** Hook simples para pegar as UTMs atuais (URL > storage) */
export function useUtm(): Utm {
  if (typeof window === 'undefined') return {};
  const urlUtm = readUtmFromUrl();
  // prioriza URL se tiver algo, senão storage
  const hasUrl = UTM_KEYS.some((k) => !!urlUtm[k]);
  return hasUrl ? urlUtm : loadUtmFromStorage();
}

/** Acrescenta UTM a uma URL (aceita 1 ou 2 argumentos p/ compat) */
export function appendUtmToUrl(
  url: string,
  utmOrOpts?: Utm | { force?: boolean; utm?: Utm }
): string {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

    let utm: Utm | undefined;
    if (utmOrOpts && ('force' in (utmOrOpts as any) || 'utm' in (utmOrOpts as any))) {
      utm = (utmOrOpts as any).utm || loadUtmFromStorage();
    } else {
      utm = (utmOrOpts as Utm) || loadUtmFromStorage();
    }

    if (utm) {
      for (const k of UTM_KEYS) {
        const v = utm[k];
        if (v && !u.searchParams.get(k as string)) {
          u.searchParams.set(k as string, String(v));
        }
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Merge das UTM no body do POST sem sobrescrever campos já presentes */
export function mergeUtmIntoBody<T extends Record<string, any>>(body: T): T & Utm {
  const stored = loadUtmFromStorage();
  const out: any = { ...body };
  for (const k of UTM_KEYS) {
    if (out[k] == null && stored[k] != null) out[k] = stored[k];
  }
  if (out.url == null && stored.url != null) out.url = stored.url;
  if (out.ref == null && stored.ref != null) out.ref = stored.ref;
  return out;
}

/** Gera o “pacote de atribuição” para o payload do POST */
export function getAttributionForPayload(): Utm {
  persistUtmFromUrlOnce();
  const url = typeof window !== 'undefined' ? window.location.href : null;
  const ref = typeof document !== 'undefined' ? document.referrer || null : null;
  const utm = loadUtmFromStorage();
  return {
    ...utm,
    url: utm.url ?? url,
    ref: utm.ref ?? ref,
  };
}

/** HOC helper (mantido p/ compat, só retorna a própria URL com UTM) */
export function withUtm(url: string): string {
  return appendUtmToUrl(url);
}
