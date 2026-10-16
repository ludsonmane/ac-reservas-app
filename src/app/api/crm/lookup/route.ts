// Identifica o cliente pelo WhatsApp no CRM (engine), do lado do servidor.
// REGRA (16/10/2026): nada pessoal sai por telefone. O navegador recebe só "existe cadastro",
// quais dados já temos (sim/não) e um token assinado. Nome, e-mail, CPF e nascimento só entram
// no fluxo no servidor, na hora de criar a reserva (api/reserva).
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { digits, findLeadByPhone, signLookup, hasCrmToken } from '@/server/crm';

// Limite por IP (memória do processo): a rota consulta a base inteira do CRM por telefone.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function clientIp(req: Request) {
  // x-real-ip: a borda da Railway sobrescreve (e já resolve o cliente atrás da Cloudflare)
  return (
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 50_000) hits.clear();
  return arr.length > MAX_PER_WINDOW;
}

export async function GET(req: Request) {
  if (limited(clientIp(req))) {
    return NextResponse.json({ found: false, error: 'rate_limited' }, { status: 429 });
  }
  const url = new URL(req.url);
  const phone = digits(url.searchParams.get('phone') || '');
  if (phone.length < 10) return NextResponse.json({ found: false, reason: 'phone' }, { status: 400 });
  if (!hasCrmToken()) return NextResponse.json({ found: false, disabled: true });

  try {
    const lead = await findLeadByPhone(phone);
    if (!lead) return NextResponse.json({ found: false });
    return NextResponse.json({
      found: true,
      has: { email: !!lead.email, cpf: digits(lead.cpf || '').length === 11, birthday: !!lead.birthday },
      token: signLookup(lead.id, phone.slice(-9)),
    });
  } catch {
    return NextResponse.json({ found: false, error: true });
  }
}
