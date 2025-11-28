// src/lib/utm.ts
'use client';

type UTM = Partial<{
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
}>;

const UTM_KEYS: (keyof UTM)[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];

const COOKIE_TTL_DAYS = 90;

// helpers
function setCookie(name: string, value: string, days = COOKIE_TTL_DAYS) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
  } catch {}
}
function getCookie(name: string): string | undefined {
  try {
    return document.cookie
      .split(';')
      .map(s => s.trim())
      .map(s => s.split('=').map(decodeURIComponent))
      .reduce<Record<string, string>>((acc, [k, v]) => { acc[k] = v; return acc; }, {})[name];
  } catch { return undefined; }
}

export function persistUtmFromUrlOnce() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let found = false;
  UTM_KEYS.forEach(k => {
    const v = url.searchParams.get(k);
    if (v && v.trim()) {
      found = true;
      setCookie(k, v.trim());
      try { localStorage.setItem(k, v.trim()); } catch {}
    }
  });
  // também guarda o referrer bruto (quem trouxe o usuário), se útil
  if (document.referrer) {
    try { localStorage.setItem('ref', document.referrer); } catch {}
    setCookie('ref', document.referrer);
  }
  return found;
}

export function getStoredUtm(): UTM {
  const out: UTM = {};
  UTM_KEYS.forEach(k => {
    const v = (typeof window !== 'undefined' && (localStorage.getItem(k) || getCookie(k))) || '';
    if (v) out[k] = v;
  });
  return out;
}

export function getAttributionForPayload() {
  if (typeof window === 'undefined') return {};
  const utm = getStoredUtm();
  const url = window.location.href;
  const ref = document.referrer || localStorage.getItem('ref') || undefined;
  return { ...utm, url, ref };
}

/**
 * Gera um href com as UTM persistidas (para navegação interna manter query).
 * Ex.: useUtmHref('/reservar') -> '/reservar?utm_source=...&utm_campaign=...'
 */
export function useUtmHref(baseHref: string): string {
  if (typeof window === 'undefined') return baseHref;
  try {
    const hasQuery = baseHref.includes('?');
    const url = new URL(baseHref, window.location.origin);
    const utm = getStoredUtm();
    for (const k of UTM_KEYS) {
      const v = utm[k];
      if (v && !url.searchParams.get(k)) {
        url.searchParams.set(k, v);
      }
    }
    return hasQuery ? `${url.pathname}?${url.searchParams.toString()}` : url.toString().replace(window.location.origin, '');
  } catch {
    return baseHref;
  }
}
