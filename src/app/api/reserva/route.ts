// Cria a reserva no servidor: completa e-mail, CPF e nascimento a partir do CRM quando o cliente
// foi reconhecido (token da consulta), e repassa para a API de reservas.
import { NextResponse } from 'next/server';
import { findLeadByPhone, verifyLookup } from '@/server/crm';
import { ageFromISO, MAX_AGE, MIN_AGE } from '@/app/(reserva)/_lib/validators';

export const dynamic = 'force-dynamic';

const API = (process.env.RESERVAS_API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'https://api.mane.com.vc').replace(/\/+$/, '');
const digits = (v: string) => (v || '').replace(/\D+/g, '');

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: { message: 'Pedido inválido.' } }, { status: 400 }); }

  const phone = digits(body.phone || '');
  let email: string | null = (body.email || '').trim().toLowerCase() || null;
  let cpf: string | null = digits(body.cpf || '') || null;
  let birthdayDate: string | null = body.birthdayDate || null;

  // cliente reconhecido: completa e-mail sempre; CPF e nascimento só quando a pessoa pediu para usar o que já temos
  // (useKnownCpf / useKnownBirthday), e o nascimento passa pela mesma regra de idade da tela
  if (body.crmToken) {
    const t = verifyLookup(String(body.crmToken));
    if (t && phone.endsWith(t.p)) {
      try {
        const lead = await findLeadByPhone(phone);
        if (lead && String(lead.id) === String(t.id)) {
          if (!email && lead.email) email = String(lead.email).trim().toLowerCase();
          if (!cpf && body.useKnownCpf && digits(lead.cpf || '').length === 11) cpf = digits(lead.cpf || '');
          if (!birthdayDate && body.useKnownBirthday && lead.birthday) {
            const m = String(lead.birthday).match(/^(\d{4}-\d{2}-\d{2})/);
            const age = m ? ageFromISO(m[1]) : null;
            if (m && age !== null && age >= MIN_AGE && age <= MAX_AGE) birthdayDate = `${m[1]}T12:00:00.000Z`;
          }
        }
      } catch { /* sem CRM, segue com o que veio */ }
    }
  }

  const payload = {
    fullName: String(body.fullName || '').trim(),
    phone,
    email,
    cpf,
    birthdayDate,
    people: Number(body.people || 0),
    kids: Number(body.kids || 0),
    reservationDate: body.reservationDate,
    unitId: body.unitId,
    areaId: body.areaId,
    notes: (body.notes || '').trim() || null,
    reservationType: body.reservationType || 'PARTICULAR',
    source: 'site',
    utm_source: body.utm_source || 'site',
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    utm_content: body.utm_content || 'jornada-v2',
    utm_term: body.utm_term || null,
    url: body.url || null,
    ref: body.ref || null,
  };

  try {
    const res = await fetch(`${API}/v1/reservations/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    const timeout = e?.name === 'TimeoutError';
    return NextResponse.json({ error: { message: timeout ? 'A API demorou demais para responder.' : 'Não conseguimos falar com a API de reservas.' } }, { status: 502 });
  }
}
