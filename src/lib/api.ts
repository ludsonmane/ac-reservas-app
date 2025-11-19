// src/lib/api.ts

// Base da API: configure via .env.local -> NEXT_PUBLIC_API_BASE=https://api.mane.com.vc
export const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE?.trim() || 'http://localhost:4000') as string;

/** Retorna a base sem barra final (p/ montar URLs de assets) */
export function getBaseUrl() {
  return (API_BASE || '').replace(/\/+$/, '');
}

type RequestOpts = RequestInit & {
  /** Tempo máximo da requisição (ms). Default: 20000 */
  timeoutMs?: number;
  /** Desabilita envio de credenciais. Default: false (sem cookies por padrão) */
  noCredentials?: boolean;
};

/** Monta URL absoluta respeitando paths absolutos (http/https) */
function toUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getBaseUrl()}${p}`;
}

function isFormData(body: any): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function request<T = any>(path: string, init: RequestOpts = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 20000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init.headers || {});
    // Só define JSON quando NÃO for FormData
    if (!headers.has('Content-Type') && !isFormData(init.body)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(toUrl(path), {
      cache: 'no-store',
      // Front público: por padrão não envia cookies entre domínios (same-origin).
      // Se quiser garantir que não vai nenhum cookie, use noCredentials: true
      credentials: init.noCredentials ? 'omit' : 'same-origin',
      ...init,
      headers,
      signal: controller.signal,
    });

    // 204 No Content
    if (res.status === 204) return undefined as T;

    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');

    let payload: any;
    if (isJson) {
      try {
        payload = await res.json();
      } catch {
        payload = {};
      }
    } else {
      // para casos raros em que a API retorne texto (ex.: health)
      payload = await res.text();
    }

    if (!res.ok) {
      // tenta extrair mensagens comuns
      const msg =
        (isJson
          ? payload?.error?.message ||
            payload?.message ||
            payload?.error ||
            res.statusText
          : payload || res.statusText) || 'Erro na requisição';

      const err: any = new Error(String(msg));
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload as T;
  } catch (e: any) {
    // normaliza abort/timeout
    if (e?.name === 'AbortError') {
      const err: any = new Error('Tempo de requisição excedido.');
      err.status = 0;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/* ------------ helpers REST genéricos ------------ */
export const apiGet = <T = any>(path: string, init?: RequestOpts) =>
  request<T>(path, { method: 'GET', ...(init || {}) });

export const apiPost = <T = any>(path: string, body?: any, init?: RequestOpts) =>
  request<T>(path, {
    method: 'POST',
    body: body === undefined || isFormData(body) ? body : JSON.stringify(body),
    ...(init || {}),
  });

export const apiPut = <T = any>(path: string, body?: any, init?: RequestOpts) =>
  request<T>(path, {
    method: 'PUT',
    body: body === undefined || isFormData(body) ? body : JSON.stringify(body),
    ...(init || {}),
  });

export const apiDelete = <T = any>(path: string, init?: RequestOpts) =>
  request<T>(path, { method: 'DELETE', ...(init || {}) });

/* ------------ endpoints convenientes ------------ */

// Unidades públicas para selects (mane-api: /v1/units/public/options/list)
export type UnitOption = { id: string; name: string; slug?: string };
export const fetchUnitsOptions = () =>
  apiGet<UnitOption[]>('/v1/units/public/options/list');

// --- Áreas (estático) ---
// Lista estática por unidade (NÃO calcula disponibilidade).
// GET /v1/areas/public/by-unit/:unitId
export type AreaStatic = {
  id: string;
  name: string;
  photoUrl: string | null;
  photoUrlAbsolute?: string | null; // <- preferencial (S3/CDN)
  capacityAfternoon: number | null;
  capacityNight: number | null;
  isActive: boolean;
};
export const fetchAreasStaticByUnit = (unitId: string) =>
  apiGet<AreaStatic[]>(`/v1/areas/public/by-unit/${encodeURIComponent(unitId)}`);

// --- Disponibilidade (quando precisar calcular vagas) ---
// GET /v1/reservations/public/availability?unitId=&date=YYYY-MM-DD&time=HH:mm
export type AreaAvailability = {
  id: string;
  name: string;
  photoUrl?: string | null;
  photoUrlAbsolute?: string | null; // <- preferencial
  capacityAfternoon?: number | null;
  capacityNight?: number | null;
  isActive: boolean;
  remaining?: number; // alias: available
  available?: number;
  isAvailable?: boolean;
};
export const fetchAreasAvailability = (params: {
  unitId: string;
  date: string;      // YYYY-MM-DD
  time?: string;     // HH:mm (opcional; sem time -> cálculo diário)
}) => {
  const q = new URLSearchParams({ unitId: params.unitId, date: params.date });
  if (params.time) q.set('time', params.time);
  return apiGet<AreaAvailability[]>(`/v1/reservations/public/availability?${q.toString()}`);
};

// Helper específico para **período** (recomendado para o passo 2 do fluxo)
// Sempre exige time (HH:mm) para garantir cálculo do turno correto.
export const fetchAvailabilityByPeriod = (
  unitId: string,
  dateISO: string,     // YYYY-MM-DD
  timeHHmm: string     // HH:mm (obrigatório)
) => {
  const q = new URLSearchParams({ unitId, date: dateISO, time: timeHHmm });
  return apiGet<AreaAvailability[]>(`/v1/reservations/public/availability?${q.toString()}`);
};

// --- Compat (se você já usava fetchAreasByUnit anteriormente) ---
// OBS: esta função agora chama a LISTA ESTÁTICA (sem disponibilidade).
// Prefira usar `fetchAreasStaticByUnit` ou `fetchAvailabilityByPeriod`.
export type AreaOption = {
  id: string;
  name: string;
  isActive?: boolean;
  remaining?: number; // não é retornado pela rota estática
};
export const fetchAreasByUnit = (unitId: string, _dateISO?: string) =>
  fetchAreasStaticByUnit(unitId);
