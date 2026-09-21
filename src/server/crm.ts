// Acesso ao CRM (engine) SÓ no servidor. Nunca importar em componentes cliente.
import crypto from 'crypto';

const ENGINE = (process.env.ENGINE_API_BASE || 'https://engine.mane.com.vc/api').replace(/\/+$/, '');
const TOKEN = process.env.ENGINE_API_TOKEN || '';

type Lead = {
  id: number; name?: string | null; first_name?: string | null; email?: string | null; phone?: string | null;
  cpf?: string | null; birthday?: string | null; ltv?: string | number | null; purchase_count?: number | null; unit?: string | null;
};

export const hasCrmToken = () => !!TOKEN;
export const digits = (v: string) => (v || '').replace(/\D+/g, '');

export function signLookup(leadId: number, last9: string) {
  const exp = Date.now() + 30 * 60 * 1000; // vale 30 minutos
  const payload = Buffer.from(JSON.stringify({ id: leadId, p: last9, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN || 'dev').update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export function verifyLookup(token: string): { id: number; p: string } | null {
  try {
    const [payload, sig] = token.split('.');
    const expect = crypto.createHmac('sha256', TOKEN || 'dev').update(payload).digest('base64url');
    if (sig !== expect) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.id || !data?.p || Date.now() > data.exp) return null;
    return { id: Number(data.id), p: String(data.p) };
  } catch {
    return null;
  }
}

/** Busca os leads cujo telefone termina com os 9 dígitos informados e escolhe o mais completo. */
export async function findLeadByPhone(phoneDigits: string): Promise<Lead | null> {
  if (!TOKEN) return null;
  const last9 = phoneDigits.slice(-9);
  if (last9.length < 8) return null;
  const res = await fetch(`${ENGINE}/leads?search=${encodeURIComponent(last9)}&limit=20`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const list = (await res.json()) as Lead[];
  const matches = (Array.isArray(list) ? list : []).filter((l) => digits(l.phone || '').endsWith(last9));
  if (matches.length === 0) return null;
  // prioridade: tem CPF, tem e-mail, maior consumo
  const score = (l: Lead) => (l.cpf ? 4 : 0) + (l.email ? 2 : 0) + (l.birthday ? 1 : 0) + Math.min(Number(l.ltv || 0) / 1000, 1);
  return matches.sort((a, b) => score(b) - score(a))[0];
}


export type { Lead };
