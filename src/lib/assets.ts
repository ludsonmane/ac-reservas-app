// src/lib/assets.ts

// Base pública do backend (se você já tem API_BASE noutro lugar, não precisa reimportar aqui)
const ASSET_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE) ||
  (typeof process !== 'undefined' && process.env.API_BASE) ||
  '';

const S3_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_S3_BASE) ||
  'https://mane-reservations-prod.s3.amazonaws.com';

function toHttps(u: string) {
  try {
    const url = new URL(u);
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol === 'http:') {
      url.protocol = 'https:';
      return url.toString();
    }
  } catch {
    // url relativa
  }
  return u;
}

function sanitizePhoto(raw?: any): string | undefined {
  if (raw == null) return undefined;
  const value =
    typeof raw === 'object' && 'url' in (raw as any)
      ? String((raw as any).url ?? '')
      : String(raw);
  const r = value.trim();
  if (!r || r === 'null' || r === 'undefined' || r === '[object Object]') return undefined;
  return r;
}

/**
 * Resolve uma URL de imagem que pode vir absoluta, relativa ao backend, S3 ou data URI.
 * Mantém HTTPS quando o site está em HTTPS.
 */
export function resolvePhotoUrl(raw?: any): string | undefined {
  let s = sanitizePhoto(raw);
  if (!s) return undefined;
  s = s.replace(/\\/g, '/').trim();

  if (s.startsWith('//')) return `https:${s}`;
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return toHttps(s);

  // caminho relativo → prefixa com ASSET_BASE se houver
  s = s.replace(/^\/+/, '/');
  if (!ASSET_BASE) return s.startsWith('/') ? s : `/${s}`;
  const base = ASSET_BASE.replace(/\/+$/, '');
  const abs = `${base}${s.startsWith('/') ? s : `/${s}`}`;
  return toHttps(abs);
}

/** Variante que força prefixo S3 (quando você guarda só o path) */
export function toS3Url(raw?: any): string | undefined {
  let s = sanitizePhoto(raw);
  if (!s) return undefined;
  s = s.replace(/\\/g, '/').trim();

  if (s.startsWith('//')) return `https:${s}`;
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return toHttps(s);

  const path = s.startsWith('/') ? s : `/${s}`;
  return `${S3_BASE}${path}`;
}
