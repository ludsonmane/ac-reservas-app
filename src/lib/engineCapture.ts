// src/lib/engineCapture.ts
// Captura parcial do funil de reservas → EngineUp (recuperação de abandono).
//
// Quando o cliente preenche "Seus dados" (step 3) e tem pelo menos um
// identificador válido (telefone, email ou CPF), mandamos o lead pro engine
// ANTES do submit final. Se ele abandonar sem concluir, o worker de reservas
// detecta (tag reserva-dados-parciais sem reserva correspondente em ~40min)
// e dispara a cadência de recuperação. Quem conclui a reserva é suprimido.
//
// Fire-and-forget: falha aqui NUNCA afeta o funil. keepalive=true pra
// requisição sobreviver se o usuário fechar a aba logo depois de digitar.

const ENGINE_TRACK_URL =
  (process.env.NEXT_PUBLIC_ENGINE_TRACK_URL?.trim() || 'https://engine.mane.com.vc/api/track/lead');

// Token PÚBLICO de captura (id 3 no engine) — restrito por allowed_origins,
// então não é segredo. Rate-limit por IP e por token no servidor.
const CAPTURE_TOKEN =
  (process.env.NEXT_PUBLIC_ENGINE_CAPTURE_TOKEN?.trim() || 'eng_pub_0de61a943ab36e555cbdfd38f3738d6a');

// Tag que marca "preencheu dados mas ainda não concluiu". O worker do engine
// troca por reserva-abandonada (ou remove, se a reserva sair) depois da janela.
const PARTIAL_TAG = 'reserva-dados-parciais';

// unitId (mane-api) → slug canônico do engine
const UNIT_SLUGS: Record<string, string> = {
  '9c4cd726-1cd3-468d-908e-5a91f84a8e37': 'bsb',
  'ddb38605-2cdf-48da-83cc-74fcb3311761': 'ac',
  'cae76f94-8395-4398-848a-ec5b21d4f52f': 'sp',
};

export function engineUnitSlug(unitId?: string | null, unitName?: string | null): string | undefined {
  if (unitId && UNIT_SLUGS[unitId]) return UNIT_SLUGS[unitId];
  const n = (unitName || '').toLowerCase();
  if (/brasil/.test(n)) return 'bsb';
  if (/água|agua/.test(n)) return 'ac';
  if (/paulo|perdizes|west/.test(n)) return 'sp';
  return undefined;
}

export type PartialLead = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  birthday?: string | null; // YYYY-MM-DD
  unitId?: string | null;
  unitName?: string | null;
  utm?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  } | null;
};

// Evita reenviar payload idêntico (o engine também deduplica por janela,
// isso aqui só poupa requisição enquanto a pessoa digita).
let lastSentKey = '';

export function sendPartialLead(p: PartialLead): void {
  try {
    if (typeof window === 'undefined') return;

    const digits = (s?: string | null) => String(s || '').replace(/\D/g, '');
    const phone = digits(p.phone);
    const cpf = digits(p.cpf);
    const email = String(p.email || '').trim().toLowerCase();
    const validPhone = phone.length >= 10 && phone.length <= 13;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const validCpf = cpf.length === 11;

    // Precisa de pelo menos um identificador útil (regra do engine)
    if (!validPhone && !validEmail && !validCpf) return;

    const key = [p.name || '', validPhone ? phone : '', validEmail ? email : '', validCpf ? cpf : '', p.birthday || '', p.unitId || ''].join('|');
    if (key === lastSentKey) return;
    lastSentKey = key;

    const body: Record<string, unknown> = {
      token: CAPTURE_TOKEN,
      tag: PARTIAL_TAG,
      name: p.name || undefined,
      phone: validPhone ? phone : undefined,
      email: validEmail ? email : undefined,
      cpf: validCpf ? cpf : undefined,
      birthday: p.birthday || undefined,
      unit: engineUnitSlug(p.unitId, p.unitName),
      source_url: window.location.href,
      referrer: document.referrer || undefined,
      utm_source: p.utm?.utm_source || undefined,
      utm_medium: p.utm?.utm_medium || undefined,
      utm_campaign: p.utm?.utm_campaign || undefined,
      utm_content: p.utm?.utm_content || undefined,
      utm_term: p.utm?.utm_term || undefined,
    };

    fetch(ENGINE_TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => { /* nunca quebra o funil */ });
  } catch {
    /* nunca quebra o funil */
  }
}
