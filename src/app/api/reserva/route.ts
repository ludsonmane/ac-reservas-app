// Cria a reserva no servidor: completa e-mail, CPF e nascimento a partir do CRM quando o cliente
// foi reconhecido (token da consulta), e repassa para a API de reservas.
import { NextResponse } from 'next/server';
import { BlockList, isIPv6 } from 'net';
import { findLeadByPhone, verifyLookup } from '@/server/crm';
import { ageFromISO, MAX_AGE, MIN_AGE } from '@/app/(reserva)/_lib/validators';

export const dynamic = 'force-dynamic';

const API = (process.env.RESERVAS_API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'https://api.mane.com.vc').replace(/\/+$/, '');
const digits = (v: string) => (v || '').replace(/\D+/g, '');

// Faixas oficiais da Cloudflare (https://www.cloudflare.com/ips, conferidas em 16/10/2026)
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];
const cloudflare = new BlockList();
for (const cidr of CLOUDFLARE_RANGES) {
  const [net, bits] = cidr.split('/');
  cloudflare.addSubnet(net, Number(bits), isIPv6(net) ? 'ipv6' : 'ipv4');
}

// IP do cliente como a borda da Railway entrega (X-Real-IP; fallback: 1º do X-Forwarded-For).
// Com o proxy da Cloudflare ligado, quem conecta é a Cloudflare e o cliente vem em
// CF-Connecting-IP, que só vale se a conexão veio MESMO de um IP da Cloudflare.
function clientIp(req: Request): string | null {
  const edge =
    req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (edge && cf) {
    try {
      if (cloudflare.check(edge, isIPv6(edge) ? 'ipv6' : 'ipv4')) return cf;
    } catch { /* IP malformado: segue com o da borda */ }
  }
  return edge;
}

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
      headers: {
        'Content-Type': 'application/json',
        // a API limita reservas por IP: sem isso todos os clientes do site dividem o IP deste servidor
        ...(clientIp(req) && process.env.SITE_PROXY_SECRET
          ? { 'x-client-ip': clientIp(req)!, 'x-proxy-secret': process.env.SITE_PROXY_SECRET }
          : {}),
      },
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
