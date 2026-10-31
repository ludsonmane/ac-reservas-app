// Metadados de exibição das casas. A lista real vem da API; aqui só o que a API não sabe dizer.
export type UnitMeta = {
  slug: 'bsb' | 'ac' | 'sp' | 'partage';
  short: string;      // nome curto no cartão
  sub: string;        // linha de apoio
  concierge: string;  // WhatsApp do concierge (dígitos)
  opensOn?: string;   // YYYY-MM-DD quando ainda não abriu
};

export const UNIT_META: UnitMeta[] = [
  { slug: 'bsb', short: 'Brasília', sub: 'Arena Mané Garrincha', concierge: '61982850776' },
  { slug: 'ac', short: 'Águas Claras', sub: 'Águas Claras', concierge: '61999312284' },
  { slug: 'sp', short: 'São Paulo', sub: 'Perdizes', concierge: '61982850776' },
  { slug: 'partage', short: 'Partage', sub: 'Lago Sul', concierge: '61982850776' },
];

/**
 * Mínimo fixo de pessoas por casa (vale em qualquer horário) quando a API não manda `minPeople`.
 * O valor do admin (Unidades → "Mínimo de pessoas (sempre)"), quando existe, prevalece.
 */
export const UNIT_MIN_PEOPLE: Partial<Record<UnitMeta['slug'], number>> = { partage: 4 };

export function unitMinPeople(u: { slug?: string | null; name?: string | null; minPeople?: number | null }): number | null {
  if (typeof u.minPeople === 'number' && u.minPeople > 0) return u.minPeople;
  const slug = detectSlug(u.slug, u.name);
  return (slug && UNIT_MIN_PEOPLE[slug]) || null;
}

/** Casas fora da reserva online (somem do front; reservas antigas continuam na API). */
export const HIDDEN_SLUGS: UnitMeta['slug'][] = ['sp'];

/** Descobre o slug de exibição a partir do que a API devolve (slug ou nome). */
export function detectSlug(slug?: string | null, name?: string | null): UnitMeta['slug'] | null {
  const hay = `${slug || ''} ${name || ''}`.toLowerCase();
  if (/partage|lago sul/.test(hay)) return 'partage';
  if (/\bsp\b|paulo|perdizes|west[\s-]?plaza/.test(hay)) return 'sp';
  if (/aguas|águas|\bac\b/.test(hay)) return 'ac';
  if (/bras[ií]lia|\bbsb\b|arena/.test(hay)) return 'bsb';
  return null;
}

export function metaFor(slug: UnitMeta['slug'] | null) {
  return UNIT_META.find((m) => m.slug === slug) || null;
}

export function conciergeLink(phoneDigits: string, text: string) {
  return `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(text)}`;
}
