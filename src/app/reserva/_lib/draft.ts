// Rascunho da reserva v2: vive em sessionStorage (só neste navegador, só nesta aba).
export type Occasion = 'ANIVERSARIO' | 'CONFRATERNIZACAO' | 'EMPRESA' | null;

export type Draft = {
  unitId: string | null;
  unitName: string | null;
  unitSlug: string | null;
  minPeople: number | null;
  adults: number;
  kids: number;
  dateYMD: string | null;
  time: string | null;
  occasion: Occasion;
  areaId: string | null;
  areaName: string | null;
  // tela 2
  fullName?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  birthday?: string;
  notes?: string;
  updatedAt?: number;
};

export const EMPTY_DRAFT: Draft = {
  unitId: null, unitName: null, unitSlug: null, minPeople: null,
  adults: 0, kids: 0, dateYMD: null, time: null, occasion: null, areaId: null, areaName: null,
};

const KEY = 'mane:reserva:v2';

export function loadDraft(): Draft {
  if (typeof window === 'undefined') return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    const d = JSON.parse(raw);
    // rascunho velho (mais de 6 horas) não vale mais
    if (d?.updatedAt && Date.now() - d.updatedAt > 6 * 3600e3) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...d };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(d: Draft) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...d, updatedAt: Date.now() }));
  } catch {
    /* sem storage, segue sem rascunho */
  }
}

export function clearDraft() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
