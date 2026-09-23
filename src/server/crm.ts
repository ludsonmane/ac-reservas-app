// Acesso a dados do cliente SÓ no servidor. Nunca importar em componentes cliente.
// Quem é esse telefone? UMA fonte: o CRM/engine (base da Zig sincronizada, ~490 mil leads).
// Pedido 23/09: NÃO consultar o histórico de reservas antes; só a Zig, e muito rápido.
//   - caminho rápido: GET /leads/by-phone?phone= (índice pelo sufixo do telefone, ~1-3 ms no banco);
//   - reserva: GET /leads?search= (varredura, ~0,8 s) só se o engine ainda não tiver a rota.
import crypto from 'crypto';

const ENGINE = (process.env.ENGINE_API_BASE || 'https://engine.mane.com.vc/api').replace(/\/+$/, '');
const TOKEN = process.env.ENGINE_API_TOKEN || '';
const SECRET = TOKEN || 'dev';

type Lead = {
  id: number | string; name?: string | null; first_name?: string | null; email?: string | null; phone?: string | null;
  cpf?: string | null; birthday?: string | null; ltv?: string | number | null; purchase_count?: number | null; unit?: string | null;
  source?: 'crm';
};

export const hasCrmToken = () => !!TOKEN;
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

const toList = (j: unknown) => (Array.isArray(j) ? j : (j as { items?: Lead[]; data?: Lead[] })?.items || (j as { data?: Lead[] })?.data || []) as Lead[];

// Enquanto o engine em prod não tiver /leads/by-phone (404), lembra por 10 min e vai direto no search=.
let byPhoneMissingUntil = 0;

/** CRM/engine (base da Zig). GOTCHA: `?phone=` no /leads NÃO filtra (devolve leads aleatórios em 3,4 s). */
async function findInCrm(last9: string): Promise<Lead | null> {
  if (!TOKEN) return null;
  const headers = { Authorization: `Bearer ${TOKEN}` };
  let list: Lead[] = [];

  if (Date.now() > byPhoneMissingUntil) {
    const res = await fetch(`${ENGINE}/leads/by-phone?phone=${encodeURIComponent(last9)}&limit=20`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(2500),
    });
    if (res.ok) list = toList(await res.json());
    else if (res.status === 404) byPhoneMissingUntil = Date.now() + 10 * 60 * 1000;
    else return null;
  }
  if (Date.now() <= byPhoneMissingUntil) {
    const res = await fetch(`${ENGINE}/leads?search=${encodeURIComponent(last9)}&limit=20`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    list = toList(await res.json());
  }

  const matches = list.filter((l) => digits(l.phone || '').endsWith(last9));
  if (matches.length === 0) return null;
  const score = (l: Lead) => (l.cpf ? 4 : 0) + (l.email ? 2 : 0) + (l.birthday ? 1 : 0) + Math.min(Number(l.ltv || 0) / 1000, 1);
  const best = matches.sort((a, b) => score(b) - score(a))[0];
  return { ...best, birthday: norm(best.birthday), source: 'crm' };
}

// Cache curto em memória: a tela consulta o número no lookup e de novo ao criar a reserva.
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; lead: Lead | null }>();
const inflight = new Map<string, Promise<Lead | null>>();

export async function findLeadByPhone(phoneDigits: string): Promise<Lead | null> {
  const last9 = phoneDigits.slice(-9);
  if (last9.length < 8) return null;
  const hit = cache.get(last9);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.lead;
  if (inflight.has(last9)) return inflight.get(last9)!;

  const run = findInCrm(last9).catch(() => null);
  inflight.set(last9, run);
  try {
    const lead = await run;
    cache.set(last9, { at: Date.now(), lead }); trim();
    return lead;
  } finally {
    inflight.delete(last9);
  }
}

function trim() {
  if (cache.size > 500) { const first = cache.keys().next().value; if (first) cache.delete(first); }
}

export type { Lead };
