// web/src/lib/api.ts

// Em produção, deixe vazio quando API e Front estiverem na mesma origem.
// Em DEV/PROD separados, defina NEXT_PUBLIC_API_BASE_URL (ou BASE/URL legados) com a URL da API.
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  ''
).replace(/\/+$/, ''); // remove barra final

function trimSlash(s: string) { return s.replace(/\/+$/, ''); }

// Se base estiver vazio -> retorna path relativo ("/v1/...").
// Se base vier absoluto -> concatena corretamente.
function joinUrl(base: string, path: string) {
  return base ? `${trimSlash(base)}${path.startsWith('/') ? '' : '/'}${path}` : path;
}

// Evita quebrar quando path for relativo: cai num "dummy base".
function safeURL(u: string) {
  try { return new URL(u); } catch { return new URL(u, 'http://dummy.local'); }
}

function getUrl(path: string) { return safeURL(joinUrl(API_BASE, path)); }
function pathnameOf(path: string) { return getUrl(path).pathname; }
function qsOf(path: string) { return getUrl(path).searchParams; }

function idemKey() {
  return (globalThis.crypto?.randomUUID?.() as string) || Math.random().toString(36).slice(2);
}

async function jsonOrNull(res: Response) {
  try {
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  } catch { return null; }
}

// Erro rico (status + URL + corpo)
async function throwHttp(res: Response): Promise<never> {
  const url = res.url || '(no-url)';
  let text = '';
  try { text = await res.text(); } catch {}
  const msg = `[HTTP ${res.status}] ${url}${text ? ` – ${text}` : ''}`;
  throw new Error(msg);
}

/* ---------- Adapters ---------- */
function mapList(path: string) {
  const params = qsOf(path);
  const page = params.get('page') || '1';
  const limit = params.get('limit') || '20';
  const q = params.get('q') || '';
  const newQS = new URLSearchParams();
  newQS.set('page', page);
  newQS.set('pageSize', limit);
  if (q) newQS.set('search', q);
  const newPath = `/v1/reservations?${newQS.toString()}`;
  const adapter = (d: any) => {
    if (!d) return d;
    const total = Number(d.total ?? 0);
    const pageN = Number(d.page ?? page);
    const pageSize = Number(d.pageSize ?? limit);
    const totalPages = Number(d.totalPages ?? (pageSize ? Math.ceil(total / pageSize) : 1));
    return {
      items: Array.isArray(d.items) ? d.items : [],
      meta: {
        total, page: pageN, limit: pageSize, pages: totalPages,
        hasPrev: pageN > 1, hasNext: pageN < totalPages
      }
    };
  };
  return { path: newPath, adapter };
}

function mapCreate(body: any) {
  const mapped = {
    fullName: body?.fullName,
    cpf: body?.cpf,
    people: body?.people,
    kids: body?.kids,                 // ✅ mantém 0 quando vier 0
    area: body?.area ?? null,

    reservationDate: body?.reservationDate,
    birthdayDate: body?.birthdayDate,

    email: body?.contactEmail ?? body?.email,
    phone: body?.contactPhone ?? body?.phone,

    // Somente utm_* (sem s_utm*)
    utm_source: body?.utm_source ?? 'site',
    utm_campaign: body?.utm_campaign,
    utm_medium: body?.utm_medium,
    utm_content: body?.utm_content,
    utm_term: body?.utm_term,

    unit: body?.unit,
    source: body?.source ?? 'site',
    notes: body?.notes
  };
  const adapter = (d: any) => ({ ok: true, id: d?.id ?? d?._id ?? null });
  return { path: '/v1/reservations', body: mapped, adapter };
}

function mapUpdate(body: any) {
  const m: any = {};
  if ('fullName' in body) m.fullName = body.fullName;
  if ('cpf' in body) m.cpf = body.cpf;
  if ('people' in body) m.people = body.people;
  if ('kids' in body) m.kids = body.kids;                 // ✅ mantém 0 se vier 0
  if ('area' in body) m.area = body.area ?? null;

  if ('reservationDate' in body) m.reservationDate = body.reservationDate;
  if ('birthdayDate' in body) m.birthdayDate = body.birthdayDate;

  if ('email' in body || 'contactEmail' in body) m.email = body.contactEmail ?? body.email;
  if ('phone' in body || 'contactPhone' in body) m.phone = body.contactPhone ?? body.phone;
  if ('notes' in body) m.notes = body.notes;

  if ('utm_source' in body) m.utm_source = body.utm_source;
  if ('utm_campaign' in body) m.utm_campaign = body.utm_campaign;
  if ('utm_medium' in body) m.utm_medium = body.utm_medium;
  if ('utm_content' in body) m.utm_content = body.utm_content;
  if ('utm_term' in body) m.utm_term = body.utm_term;

  if ('unit' in body) m.unit = body.unit;
  if ('source' in body) m.source = body.source;
  return m;
}

/* ---------- Rewriter ---------- */
type RewriteResult =
  | { path: string; adapter: (d: any) => any }
  | { path: string; adapter: (d: any) => any; body: any };

function rewrite(method: string, path: string, body?: any): RewriteResult {
  const pn = pathnameOf(path);

  if (method === 'GET' && pn === '/reservas') return mapList(path);

  if (method === 'POST' && pn === '/reservas') return mapCreate(body);

  if (method === 'GET' && /^\/reservas\/[^/]+$/.test(pn)) {
    const id = pn.split('/').pop()!;
    return { path: `/v1/reservations/${id}`, adapter: (d: any) => d };
  }

  if (method === 'PUT' && /^\/reservas\/[^/]+$/.test(pn)) {
    const id = pn.split('/').pop()!;
    return { path: `/v1/reservations/${id}`, body: mapUpdate(body), adapter: (d: any) => d };
  }

  if (method === 'DELETE' && /^\/reservas\/[^/]+$/.test(pn)) {
    const id = pn.split('/').pop()!;
    return { path: `/v1/reservations/${id}`, adapter: (d: any) => d };
  }

  return { path, body, adapter: (d: any) => d };
}

/* ---------- HTTP helpers ---------- */
export async function apiGet<T>(path: string): Promise<T> {
  const mapped = rewrite('GET', path);
  const url = joinUrl(API_BASE, mapped.path);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) await throwHttp(res);
  const raw = await jsonOrNull(res);
  return mapped.adapter(raw);
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const mapped = rewrite('POST', path, body);
  const reqBody = ('body' in mapped) ? mapped.body : body;  // mantém 0/false/null
  const url = joinUrl(API_BASE, mapped.path);

  // opcional: log útil durante ajustes
  // console.log('[API] POST', url, reqBody);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey() },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) await throwHttp(res);
  const raw = await jsonOrNull(res);
  return mapped.adapter(raw);
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const mapped = rewrite('PUT', path, body);
  const reqBody = ('body' in mapped) ? mapped.body : body;
  const url = joinUrl(API_BASE, mapped.path);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) await throwHttp(res);
  const raw = await jsonOrNull(res);
  return mapped.adapter(raw);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const mapped = rewrite('DELETE', path);
  const url = joinUrl(API_BASE, mapped.path);
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) await throwHttp(res);
  const raw = await jsonOrNull(res);
  return mapped.adapter(raw);
}
