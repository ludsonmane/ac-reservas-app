// src/lib/api.ts

// NUNCA use localhost como default em produção
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE?.trim() || '') as string;

// Base sem barra final
export function getBaseUrl() {
  return (API_BASE || '').replace(/\/+$/, '');
}

type RequestOpts = RequestInit & {
  timeoutMs?: number;
  noCredentials?: boolean;
};

// Monta URL absoluta respeitando paths já absolutos
function toUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  // Se NÃO tiver API_BASE -> usa mesmo host (caminho relativo)
  const base = getBaseUrl();
  return base ? `${base}${p}` : p;
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
    if (!headers.has('Content-Type') && !isFormData(init.body)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(toUrl(path), {
      cache: 'no-store',
      credentials: init.noCredentials ? 'omit' : 'same-origin',
      ...init,
      headers,
      signal: controller.signal,
    });

    if (res.status === 204) return undefined as T;

    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const payload = isJson ? await res.json().catch(() => ({})) : await res.text();

    if (!res.ok) {
      const msg =
        (isJson
          ? payload?.error?.message || payload?.message || payload?.error || res.statusText
          : payload || res.statusText) || 'Erro na requisição';
      const err: any = new Error(String(msg));
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload as T;
  } catch (e: any) {
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

/* helpers */
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

/* endpoints convenientes (sem mudanças) */
export type UnitOption = { id: string; name: string; slug?: string };
export const fetchUnitsOptions = () => apiGet<UnitOption[]>('/v1/units/public/options/list');

export type AreaStatic = {
  id: string;
  name: string;
  photoUrl: string | null;
  photoUrlAbsolute?: string | null;
  capacityAfternoon: number | null;
  capacityNight: number | null;
  isActive: boolean;
};
export const fetchAreasStaticByUnit = (unitId: string) =>
  apiGet<AreaStatic[]>(`/v1/areas/public/by-unit/${encodeURIComponent(unitId)}`);

export type AreaAvailability = {
  id: string;
  name: string;
  photoUrl?: string | null;
  photoUrlAbsolute?: string | null;
  capacityAfternoon?: number | null;
  capacityNight?: number | null;
  isActive: boolean;
  remaining?: number;
  available?: number;
  isAvailable?: boolean;
};
export const fetchAreasAvailability = (params: { unitId: string; date: string; time?: string }) => {
  const q = new URLSearchParams({ unitId: params.unitId, date: params.date });
  if (params.time) q.set('time', params.time);
  return apiGet<AreaAvailability[]>(`/v1/reservations/public/availability?${q.toString()}`);
};

export const fetchAvailabilityByPeriod = (unitId: string, dateISO: string, timeHHmm: string) => {
  const q = new URLSearchParams({ unitId, date: dateISO, time: timeHHmm });
  return apiGet<AreaAvailability[]>(`/v1/reservations/public/availability?${q.toString()}`);
};

export type AreaOption = { id: string; name: string; isActive?: boolean; remaining?: number };
export const fetchAreasByUnit = (unitId: string) => fetchAreasStaticByUnit(unitId);
