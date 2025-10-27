// src/lib/analytics.ts
// Cliente puro — não usa process/import.meta

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
    __manePixels?: {
      loadedIds: Set<string>;
      activeId?: string;
      scriptLoaded?: boolean;
      debug?: boolean;
    };
  }
}

const dlog = (...a: any[]) =>
  typeof window !== 'undefined' &&
  window.__manePixels?.debug &&
  console.log('[analytics]', ...a);

// ======= MAPA unidade → Pixel ID (ajuste conforme vem do seu /units) =======
const UNIT_PIXEL_MAP: Record<string, string> = {
  // Slugs esperados
  'bsb': '328827303217903',
  'brasilia': '328827303217903',
  'brasília': '328827303217903',
  'arena brasilia': '328827303217903',
  'arena brasília': '328827303217903',

  'aguas-claras': '1160688802149033',
  'águas-claras': '1160688802149033',
  'aguas claras': '1160688802149033',
  'águas claras': '1160688802149033',
  'mane aguas claras': '1160688802149033',
  'mané aguas claras': '1160688802149033',
  'mané águas claras': '1160688802149033',
  'mane águas claras': '1160688802149033',
};

function normalizeKey(input?: string | null) {
  if (!input) return '';
  const key = input.toString().trim().toLowerCase();
  return key
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // tira acento
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '') // tira pontuação
    .trim();
}

function ensureMetaScript() {
  if (typeof window === 'undefined') return;
  window.__manePixels = window.__manePixels || { loadedIds: new Set() };
  if (window.__manePixels.scriptLoaded) return;

  if (!window.fbq) {
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    dlog('fbq stubbed by analytics.ts (fallback)');
  }

  window.__manePixels.scriptLoaded = true;
}

// Garante bootstrap mínimo (fbq stub + dataLayer) sem reinjetar nada duplicado
export function ensureAnalyticsReady() {
  try {
    ensureMetaScript(); // cria fbq stub e injeta fbevents.js se ainda não houver
    (window as any).dataLayer = (window as any).dataLayer || [];
    dlog('ensureAnalyticsReady: ok');
  } catch (e) {
    console.warn('ensureAnalyticsReady error', e);
  }
}


function ensurePixel(pixelId: string) {
  ensureMetaScript();
  if (!pixelId) return;
  window.__manePixels = window.__manePixels || { loadedIds: new Set() };

  if (!window.__manePixels.loadedIds.has(pixelId)) {
    dlog('fbq init', pixelId);
    window.fbq?.('init', pixelId);
    window.__manePixels.loadedIds.add(pixelId);

    // 🔵 importante para aparecer no Pixel Helper:
    // manda um PageView vinculado a ESSE pixel específico
    try {
      window.fbq?.('trackSingle', pixelId, 'PageView');
      dlog('trackSingle PageView sent for', pixelId);
    } catch (e) {
      console.warn('trackSingle PageView error', e);
    }
  } else {
    dlog('pixel already initialized', pixelId);
  }
}

function findPixelForUnit(input?: string | null): string | undefined {
  if (!input) return;
  const n = normalizeKey(input);

  // tenta direto
  if (UNIT_PIXEL_MAP[n]) return UNIT_PIXEL_MAP[n];

  // heurísticas simples (ajude se o nome vier "estranho")
  if (/brasili/.test(n) || /arena brasil/.test(n) || n === 'bsb') {
    return UNIT_PIXEL_MAP['brasilia'];
  }
  if (/agua/.test(n) && /clara/.test(n)) {
    return UNIT_PIXEL_MAP['aguas claras'];
  }
  return undefined;
}

export function setActiveUnitPixelByKey(unitKeyOrName?: string | null) {
  const id = findPixelForUnit(unitKeyOrName || '');
  if (!id) {
    dlog('no pixel found for', unitKeyOrName);
    return;
  }
  ensurePixel(id);
  window.__manePixels = window.__manePixels || { loadedIds: new Set() };
  window.__manePixels.activeId = id;
  dlog('active pixel set to', id, 'for', unitKeyOrName);
}

export function setActiveUnitPixelFromUnit(
  unit: { id?: string; name?: string | null; slug?: string | null } | string | null | undefined
) {
  if (!unit) return;
  const candidates: string[] = [];
  if (typeof unit === 'string') candidates.push(unit);
  else {
    if (unit.slug) candidates.push(unit.slug);
    if (unit.name) candidates.push(unit.name);
    if (unit.id) candidates.push(unit.id);
  }
  for (const k of candidates) {
    const id = findPixelForUnit(k);
    if (id) {
      ensurePixel(id);
      window.__manePixels = window.__manePixels || { loadedIds: new Set() };
      window.__manePixels.activeId = id;
      dlog('active pixel set (from object) →', id, 'via', k);
      return;
    }
  }
  dlog('no pixel match for unit object/str', unit);
}

// ===== Eventos =====
export type ReservationEvent = {
  reservationCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  unit?: string | null;
  area?: string | null;
  status?: string | null;
  source?: string | null;
};

function norm(v?: string | null) {
  return (v || '').trim();
}

function fbqTrackCustomActive(singleEventName: string, payload: any) {
  const active = window.__manePixels?.activeId;
  if (!window.fbq) { dlog('fbq missing on track', singleEventName, payload); return; }
  if (active) {
    dlog('trackSingle', singleEventName, '→', active, payload);
    window.fbq('trackSingle', active, singleEventName, payload);
  } else {
    dlog('trackCustom (no active pixel)', singleEventName, payload);
    window.fbq('trackCustom', singleEventName, payload);
  }
}

export async function trackReservationMade(ev: ReservationEvent) {
  const payload = {
    reservation_code: norm(ev.reservationCode),
    full_name: norm(ev.fullName),
    email: norm(ev.email),
    phone: norm(ev.phone),
    unit: norm(ev.unit),
    area: norm(ev.area),
    status: norm(ev.status),
    source: norm(ev.source),
  };
  fbqTrackCustomActive('Reservation Made', payload);
  (window as any).dataLayer?.push({ event: 'reservation_made', ...payload });
}

export async function trackReservationCheckin(ev: ReservationEvent) {
  const payload = {
    reservation_code: norm(ev.reservationCode),
    full_name: norm(ev.fullName),
    email: norm(ev.email),
    phone: norm(ev.phone),
    unit: norm(ev.unit),
    area: norm(ev.area),
    status: norm(ev.status),
    source: norm(ev.source),
  };
  fbqTrackCustomActive('Reservation Checkin', payload);
  (window as any).dataLayer?.push({ event: 'reservation_checkin', ...payload });
}
