// Identifica o cliente pelo WhatsApp no CRM (engine), do lado do servidor.
// O navegador recebe só o primeiro nome, campos mascarados e um token assinado.
// Os valores reais só voltam a entrar no fluxo no servidor, na hora de criar a reserva (api/reserva).
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { digits, findLeadByPhone, signLookup, hasCrmToken, type Lead } from '@/server/crm';

const firstName = (l: Lead) => {
  const n = (l.first_name || l.name || '').trim().split(/\s+/)[0] || '';
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
};
const maskEmail = (e?: string | null) => {
  if (!e) return null;
  const [u, d] = e.split('@');
  return d ? `${u.slice(0, 2)}${'*'.repeat(Math.max(2, u.length - 2))}@${d}` : '***';
};
const maskCpf = (c?: string | null) => {
  const d = digits(c || '');
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : null;
};
const maskBirthday = (b?: string | null) => {
  const m = String(b || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `**/${m[2]}/${m[1]}` : null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = digits(url.searchParams.get('phone') || '');
  if (phone.length < 10) return NextResponse.json({ found: false, reason: 'phone' }, { status: 400 });
  if (!hasCrmToken()) return NextResponse.json({ found: false, disabled: true });

  try {
    const lead = await findLeadByPhone(phone);
    if (!lead) return NextResponse.json({ found: false });
    return NextResponse.json({
      found: true,
      firstName: firstName(lead),
      fullName: (lead.name || '').trim() || null,
      returning: Number(lead.purchase_count || 0) > 0 || Number(lead.ltv || 0) > 0,
      masked: { email: maskEmail(lead.email), cpf: maskCpf(lead.cpf), birthday: maskBirthday(lead.birthday) },
      has: { email: !!lead.email, cpf: digits(lead.cpf || '').length === 11, birthday: !!lead.birthday },
      token: signLookup(lead.id, phone.slice(-9)),
    });
  } catch {
    return NextResponse.json({ found: false, error: true });
  }
}
