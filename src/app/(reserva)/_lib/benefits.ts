// Ofertas do Mané por tamanho do grupo (espelho do /reservar atual e da página /convidados).
// Aniversário: bônus em R$ por faixa de convidados, creditado no dia da reserva, mais mimos da Brinquedoteca.
// Qualquer ocasião: a partir de 8 pessoas o grupo ganha a lista de convidados.

export const GUEST_LIST_MIN = 8;

export type BirthdayTier = { level: 1 | 2 | 3; min: number; max: number | null; range: string; bonus: number; headline: string; perks: string[] };

export const BIRTHDAY_TIERS: BirthdayTier[] = [
  { level: 1, min: 8, max: 15, range: '8 a 15', bonus: 100, headline: 'Comemore com quem importa', perks: ['Brinquedoteca day use para 1 criança'] },
  { level: 2, min: 16, max: 30, range: '16 a 30', bonus: 150, headline: 'Reúna a turma toda', perks: ['Brinquedoteca day use para 2 crianças'] },
  { level: 3, min: 31, max: null, range: 'Mais de 30', bonus: 200, headline: 'A celebração completa', perks: ['Brinquedoteca day use para 2 crianças', 'Cardápio personalizado'] },
];

/** Faixa de aniversário conquistada pelo total de pessoas (null abaixo de 8). */
export function birthdayTier(people: number): BirthdayTier | null {
  return [...BIRTHDAY_TIERS].reverse().find((t) => people >= t.min) || null;
}

/** Próxima faixa acima do total (null se já está na última). */
export function nextBirthdayTier(people: number): BirthdayTier | null {
  return BIRTHDAY_TIERS.find((t) => people < t.min) || null;
}

export const fmtBRL = (v: number) => `R$ ${v}`;
