// Regras de negócio da jornada de reserva v2.
// Portadas de /reservar/page.tsx para um módulo puro (sem React) e testável.
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

export const MAX_PEOPLE_WITHOUT_CONCIERGE = 40;
export const DEFAULT_MIN_PEOPLE = 2;
export const EVENING_CUTOFF_MIN = 17 * 60 + 30; // 17:30 separa tarde e noite
export const MANECO_MIN_HOUR = 18;

export type DayWindow = { open: string; close: string } | null;

// BSB/AC: dom–sex 12:00–22:00 · sáb 12:00–22:30 (BSB: sáb abre 11:00, ver BSB_SAT_OPEN)
const HOURS_BY_DOW: DayWindow[] = [
  { open: '12:00', close: '22:00' },
  { open: '12:00', close: '22:00' },
  { open: '12:00', close: '22:00' },
  { open: '12:00', close: '22:00' },
  { open: '12:00', close: '22:00' },
  { open: '12:00', close: '22:00' },
  { open: '12:00', close: '22:30' },
];
// SP (Perdizes): ter–dom 12:00–20:00 · segunda fechado
const HOURS_BY_DOW_SP: DayWindow[] = [
  { open: '12:00', close: '20:00' },
  null,
  { open: '12:00', close: '20:00' },
  { open: '12:00', close: '20:00' },
  { open: '12:00', close: '20:00' },
  { open: '12:00', close: '20:00' },
  { open: '12:00', close: '20:00' },
];

// 11:00/11:30 só liberam no sábado da BSB (janela do dia filtra o resto).
export const ALLOWED_SLOTS: string[] = (() => {
  const s: string[] = [];
  for (let h = 11; h <= 22; h++) for (const m of [0, 30]) s.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  return s;
})();

export function isSpUnit(slug?: string | null, name?: string | null) {
  const hay = `${slug || ''} ${name || ''}`.toLowerCase();
  return /\bsp\b|paulo|perdizes|west[\s-]?plaza/.test(hay);
}

// Brasília abre reservas às 11:00 no sábado (pedido 22/09/2026: sáb 11h–13h e 17h–19h;
// o fechamento entre as janelas vem do bloqueio recorrente do admin). Mesma regra na API.
const BSB_SAT_OPEN = '11:00';

export function isBsbUnit(slug?: string | null, name?: string | null) {
  const hay = `${slug || ''} ${name || ''}`.toLowerCase();
  return /\bbsb\b|bras[ií]lia/.test(hay);
}

export function dayWindow(dateYMD: string | null, sp = false, bsb = false): DayWindow {
  if (!dateYMD) return sp ? { open: '12:00', close: '20:00' } : { open: '12:00', close: '22:00' };
  const dow = dayjs(dateYMD).day();
  if (sp) return HOURS_BY_DOW_SP[dow];
  const win = HOURS_BY_DOW[dow];
  if (bsb && dow === 6 && win) return { open: BSB_SAT_OPEN, close: win.close };
  return win;
}

export function isClosedDay(dateYMD: string | null, sp = false) {
  return !!dateYMD && dayWindow(dateYMD, sp) === null;
}

export function slotMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function periodOf(hhmm: string): 'AFTERNOON' | 'NIGHT' {
  return slotMinutes(hhmm) >= EVENING_CUTOFF_MIN ? 'NIGHT' : 'AFTERNOON';
}

/** Primeiro instante reservável agora (regra de antecedência por período). */
export function earliestBookable(now: Date = new Date()): { dateYMD: string; time: string; reason: string } {
  const n = dayjs(now);
  const mins = n.hour() * 60 + n.minute();
  if (mins < EVENING_CUTOFF_MIN) {
    return {
      dateYMD: n.format('YYYY-MM-DD'),
      time: '17:30',
      reason: 'Reservas para o almoço de hoje já encerraram. Hoje ainda dá a partir das 17h30.',
    };
  }
  return {
    dateYMD: n.add(1, 'day').format('YYYY-MM-DD'),
    time: '12:00',
    reason: 'Reservas para hoje já encerraram. A partir de amanhã, 12h.',
  };
}

/** Um horário está fora da janela de antecedência (mesmo período que o atual)? */
export function isBeforeEarliest(dateYMD: string, hhmm: string, now: Date = new Date()) {
  const e = earliestBookable(now);
  if (dateYMD < e.dateYMD) return true;
  if (dateYMD > e.dateYMD) return false;
  return slotMinutes(hhmm) < slotMinutes(e.time);
}

export function isPastSelection(dateYMD: string, hhmm: string, now: Date = new Date()) {
  const [h, m] = hhmm.split(':').map(Number);
  const dt = dayjs(dateYMD).hour(h || 0).minute(m || 0).second(0);
  return dt.isBefore(dayjs(now));
}

export function isManecoArea(name?: string | null) {
  return String(name || '').trim().toLowerCase() === 'maneco';
}
export function isBeforeManecoMin(hhmm: string) {
  const [h] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && h < MANECO_MIN_HOUR;
}

export type RecurringRule = { dow: number; fromTime: string; toTime: string; areaId?: string | null; reason?: string | null };

/** Bloqueio recorrente cobre esse horário? (areaId null = unidade inteira) */
export function ruleCovers(rule: RecurringRule, dateYMD: string, hhmm: string) {
  if (rule.dow !== dayjs(dateYMD).day()) return false;
  return hhmm >= rule.fromTime && hhmm < rule.toTime;
}

/** Motivo pelo qual um slot não pode ser escolhido, ou null se pode. */
export function slotBlockReason(opts: {
  dateYMD: string; hhmm: string; sp: boolean; bsb?: boolean; rules: RecurringRule[]; now?: Date;
}): null | 'fechado' | 'passou' | 'antecedencia' | 'bloqueado' {
  const { dateYMD, hhmm, sp, bsb = false, rules, now } = opts;
  const win = dayWindow(dateYMD, sp, bsb);
  if (!win) return 'fechado';
  if (hhmm < win.open || hhmm > win.close) return 'fechado';
  if (isPastSelection(dateYMD, hhmm, now)) return 'passou';
  if (isBeforeEarliest(dateYMD, hhmm, now)) return 'antecedencia';
  if (rules.some((r) => !r.areaId && ruleCovers(r, dateYMD, hhmm))) return 'bloqueado';
  return null;
}

export function joinDateTimeISO(dateYMD: string, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return dayjs(dateYMD).hour(h || 0).minute(m || 0).second(0).millisecond(0).toDate().toISOString();
}

export function fmtDayLabel(dateYMD: string, todayYMD = dayjs().format('YYYY-MM-DD')) {
  const d = dayjs(dateYMD);
  if (dateYMD === todayYMD) return 'Hoje';
  if (dateYMD === dayjs(todayYMD).add(1, 'day').format('YYYY-MM-DD')) return 'Amanhã';
  const wd = d.format('ddd').replace('.', '');
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

export function fmtLongDate(dateYMD: string) {
  const d = dayjs(dateYMD);
  const wd = d.format('dddd');
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${d.format('D [de] MMMM')}`;
}

/** Mínimo de pessoas em horário de pico, espelho do servidor (min-party-rule.ts): sex ≥18h, sáb <18h, dom 11h–16h.
 *  O servidor é a fonte da verdade (o admin pode mudar); aqui é só para avisar antes do erro. */
export function peakMinPeople(dateYMD: string, hhmm: string, unitSlug: string | null): number {
  const dow = dayjs(dateYMD).day();
  const mins = slotMinutes(hhmm);
  const peak = (dow === 5 && mins >= 18 * 60) || (dow === 6 && mins < 18 * 60) || (dow === 0 && mins >= 11 * 60 && mins <= 16 * 60);
  if (!peak) return 1;
  if (unitSlug === 'ac') return 4;
  if (unitSlug === 'bsb') return 5;
  return 1;
}

/** Regras recorrentes da unidade inteira que valem no dia escolhido, para explicar horários fechados. */
export function unitRulesForDay(rules: RecurringRule[], dateYMD: string) {
  const dow = dayjs(dateYMD).day();
  return rules.filter((r) => !r.areaId && r.dow === dow).sort((a, b) => a.fromTime.localeCompare(b.fromTime));
}

/** Último horário reservável do dia, considerando janela da casa e bloqueios da unidade. */
export function lastBookableSlot(dateYMD: string, sp: boolean, rules: RecurringRule[], bsb = false): string | null {
  const win = dayWindow(dateYMD, sp, bsb);
  if (!win) return null;
  const slots = ALLOWED_SLOTS.filter((t) => t >= win.open && t <= win.close);
  const ok = slots.filter((t) => !rules.some((r) => !r.areaId && ruleCovers(r, dateYMD, t)));
  return ok.length ? ok[ok.length - 1] : null;
}
