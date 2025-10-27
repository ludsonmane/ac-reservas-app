// src/app/MetaPixelBootstrap.tsx
'use client';

import { useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;   // ⬅️ era `any`, agora é função
    _fbq?: (...args: any[]) => void;  // idem, por consistência
    __manePixels?: {
      loadedIds: Set<string>;
      unitActivePixelId?: string | null;
    };
  }
}

export default function MetaPixelBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // habilite/desabilite logs (pode desligar depois)
    window.__manePixels = window.__manePixels || { loadedIds: new Set() };
    window.__manePixels.debug = true; // <-- coloque false quando terminar de testar

    const dlog = (...a: any[]) =>
      window.__manePixels?.debug && console.log('[MetaPixelBootstrap]', ...a);

    if (!window.fbq) {
      // stub oficial + injeção do script
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      window.__manePixels!.scriptLoaded = true;
      dlog('fbq stubbed & script tag injected');
    } else {
      dlog('fbq already present');
    }

    // Um PageView básico (pixel global / sem id específico)
    try {
      window.fbq?.('track', 'PageView');
      dlog('Global PageView sent');
    } catch (e) {
      console.warn('fbq PageView error', e);
    }
  }, []);

  // Mantemos o Script vazio só para garantir "afterInteractive"
  return <Script id="meta-fbq-bootstrap" strategy="afterInteractive">{''}</Script>;
}
