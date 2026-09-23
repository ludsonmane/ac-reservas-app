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
