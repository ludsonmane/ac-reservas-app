// src/lib/s3.ts (novo) — ou cole direto no componente
const S3_BASE = 'https://mane-reservations-prod.s3.amazonaws.com';

export function imgFromPhotoUrl(photoUrl?: string | null): string {
  if (!photoUrl) return '';
  const p = String(photoUrl).trim().replace(/\\/g, '/');
  if (!p) return '';
  // Se já for absoluto, usa como está
  if (/^https?:\/\//i.test(p) || p.startsWith('data:')) return p;
  // Garante uma única barra
  const path = p.startsWith('/') ? p : `/${p}`;
  return `${S3_BASE}${path}`;
}
