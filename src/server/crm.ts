// Acesso a dados do cliente SÓ no servidor. Nunca importar em componentes cliente.
// Quem é esse telefone? Duas fontes, disparadas AO MESMO TEMPO:
//   1. histórico de reservas (API de reservas, base pequena, ~0,3 s): se achar, responde na hora;
//   2. CRM/engine (base da Zig sincronizada, ~330 mil leads, ~0,8 s): usado quando a reserva não achou,
//      e guardado em cache para completar a reserva depois (e-mail, CPF, nascimento).
import crypto from 'crypto';

const ENGINE = (process.env.ENGINE_API_BASE || 'https://engine.mane.com.vc/api').replace(/\/+$/, '');
const TOKEN = process.env.ENGINE_API_TOKEN || '';
const RESERVAS_API = (process.env.RESERVAS_API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'https://api.mane.com.vc').replace(/\/+$/, '');
const RESERVAS_KEY = process.env.RESERVAS_API_KEY || '';
const SECRET = TOKEN || RESERVAS_KEY || 'dev';

type Lead = {
  id: number | string; name?: string | null; first_name?: string | null; email?: string | null; phone?: string | null;
  cpf?: string | null; birthday?: string | null; ltv?: string | number | null; purchase_count?: number | null; unit?: string | null;
  source?: 'crm' | 'reservas';
};

export const hasCrmToken = () => !!TOKEN || !!RESERVAS_KEY;
export const digits = (v: string) => (v || '').replace(/\D+/g, '');

export function signLookup(leadId: number | string, last9: string) {
  const exp = Date.now() + 30 * 60 * 1000; // vale 30 minutos
  const payload = Buffer.from(JSON.stringify({ id: leadId, p: last9, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifyLookup(token: string): { id: number | string; p: string } | null {
  try {
    const [payload, sig] = token.split('.');
    const expect = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    if (sig !== expect) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.id || !data?.p || Date.now() > data.exp) return null;
    return { id: data.id, p: String(data.p) };
  } catch {
    return null;
  }
}

const norm = (b: string | null | undefined) => {
  const m = String(b || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** CRM/engine (base da Zig): busca livre pelos 9 dígitos (~0,8 s). GOTCHA: `?phone=` NÃO filtra no engine, devolve
 *  leads aleatórios em 3,4 s, por isso não é usado. */
async function findInCrm(last9: string): Promise<Lead | null> {
  if (!TOKEN) return null;
  const headers = { Authorization: `Bearer ${TOKEN}` };
  const fetchList = async (qs: string) => {
    const res = await fetch(`${ENGINE}/leads?${qs}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [] as Lead[];
    const j = await res.json();
    return (Array.isArray(j) ? j : j?.items || j?.data || []) as Lead[];
  };
  const list = await fetchList(`search=${encodeURIComponent(last9)}&limit=20`);
  const matches = list.filter((l) => digits(l.phone || '').endsWith(last9));
  if (matches.length === 0) return null;
  const score = (l: Lead) => (l.cpf ? 4 : 0) + (l.email ? 2 : 0) + (l.birthday ? 1 : 0) + Math.min(Number(l.ltv || 0) / 1000, 1);
  const best = matches.sort((a, b) => score(b) - score(a))[0];
  return { ...best, birthday: norm(best.birthday), source: 'crm' };
}

type Reservation = {
  id: string; fullName?: string | null; email?: string | null; cpf?: string | null; phone?: string | null;
  birthdayDate?: string | null; status?: string | null; createdAt?: string | null; reservationDate?: string | null;
};

/** Histórico de reservas: reservas anteriores desse telefone, a mais completa e recente primeiro. */
async function findInReservas(last9: string): Promise<Lead | null> {
  if (!RESERVAS_KEY) return null;
  const res = await fetch(`${RESERVAS_API}/v1/reservations?search=${encodeURIComponent(last9)}&limit=20&pageSize=20`, {
    headers: { 'x-api-key': RESERVAS_KEY }, cache: 'no-store', signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) return null;
  const j = await res.json();
  const items = (Array.isArray(j) ? j : j?.items || j?.data || []) as Reservation[];
  const matches = items.filter((r) => digits(r.phone || '').endsWith(last9) && !/CANCEL/i.test(String(r.status || '')));
  if (matches.length === 0) return null;
  const score = (r: Reservation) => (r.birthdayDate ? 10 : 0) + (r.cpf ? 5 : 0) + (r.fullName ? 1 : 0) + (Date.parse(r.createdAt || r.reservationDate || '') || 0) / 1e14;
  const best = matches.sort((a, b) => score(b) - score(a))[0];
  return {
    id: best.id, name: best.fullName || null, email: best.email || null, cpf: best.cpf || null, phone: best.phone || null,
    birthday: norm(best.birthdayDate), purchase_count: matches.length, source: 'reservas',
  };
}

// Cache curto em memória: a tela consulta o número no lookup e de novo ao criar a reserva.
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; lead: Lead | null }>();
const inflight = new Map<string, Promise<Lead | null>>();

/** Junta o melhor das duas fontes: a reserva dá nome/telefone recentes; o CRM completa o que faltar. */
function merge(res: Lead | null, crm: Lead | null): Lead | null {
  if (!res && !crm) return null;
  if (!res) return crm;
  if (!crm) return res;
  return {
    ...res,
    email: res.email || crm.email || null,
    cpf: res.cpf || crm.cpf || null,
    birthday: res.birthday || crm.birthday || null,
    ltv: crm.ltv ?? null,
    purchase_count: Math.max(Number(res.purchase_count || 0), Number(crm.purchase_count || 0)) || res.purchase_count,
  };
}

export async function findLeadByPhone(phoneDigits: string): Promise<Lead | null> {
  const last9 = phoneDigits.slice(-9);
  if (last9.length < 8) return null;
  const hit = cache.get(last9);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.lead;
  if (inflight.has(last9)) return inflight.get(last9)!;

  const run = (async () => {
    const pRes = findInReservas(last9).catch(() => null);
    const pCrm = findInCrm(last9).catch(() => null);
    // quando as duas terminam, o cache guarda a versão completa (usada ao criar a reserva)
    Promise.all([pRes, pCrm]).then(([r, c]) => { cache.set(last9, { at: Date.now(), lead: merge(r, c) }); trim(); }).catch(() => {});
    const res = await pRes;
    if (res) return res; // achou no histórico de reservas: responde na hora, sem esperar a base da Zig
    return await pCrm;
  })();
  inflight.set(last9, run);
  try {
    const lead = await run;
    if (!cache.has(last9)) { cache.set(last9, { at: Date.now(), lead }); trim(); }
    return lead;
  } finally {
    inflight.delete(last9);
  }
}

function trim() {
  if (cache.size > 500) { const first = cache.keys().next().value; if (first) cache.delete(first); }
}

export type { Lead };
