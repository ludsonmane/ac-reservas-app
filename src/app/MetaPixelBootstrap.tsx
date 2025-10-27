// src/app/MetaPixelBootstrap.tsx
'use client';

import { useEffect } from 'react';
import Script from 'next/script';

export default function MetaPixelBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const W = window as any;

    // Estado global do pixel (único lugar que inicializa a estrutura)
    W.__manePixels = W.__manePixels || {
      loadedIds: new Set<string>(),
      activeId: undefined as string | undefined,
      scriptLoaded: false,
      debug: false,
    };

    // deixe true só enquanto estiver testando
    W.__manePixels.debug = true;

    const dlog = (...a: any[]) => W.__manePixels?.debug && console.log('[MetaPixelBootstrap]', ...a);

    if (!W.fbq) {
      // Snippet oficial do Meta (Facebook Pixel)
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(W, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      W.__manePixels.scriptLoaded = true;
      dlog('fbq stubbed & script tag injected');
    } else {
      dlog('fbq already present');
    }

    // PageView global
    try {
      W.fbq?.('track', 'PageView');
      dlog('Global PageView sent');
    } catch (e) {
      console.warn('fbq PageView error', e);
    }
  }, []);

  // Mantemos o Script vazio só para garantir "afterInteractive"
  return <Script id="meta-fbq-bootstrap" strategy="afterInteractive">{''}</Script>;
}
