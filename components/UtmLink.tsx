'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import React, { useMemo } from 'react';
import { appendUtmToUrl, useUtm } from '@/lib/utm';

// Pega as props padrão do <Link> e substitui o href por string/URL
type LinkBaseProps = ComponentProps<typeof Link>;
type UtmLinkProps = Omit<LinkBaseProps, 'href'> & {
  href: string | URL;
  /** Força anexar UTM mesmo se o href for cross-origin (default: só relative/mesma origem) */
  forceUtm?: boolean;
};

function isRelativeOrSameOrigin(href: string | URL) {
  try {
    if (typeof href === 'string') {
      // relativo: começa com / ou ? ou #
      if (/^([/?#]|$)/.test(href)) return true;
      // absoluto -> comparar origem
      const u = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://dummy.local');
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dummy.local';
      return u.origin === origin;
    }
    // URL object
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dummy.local';
    return href.origin === origin || href.href.startsWith('/') || href.href.startsWith('?') || href.href.startsWith('#');
  } catch {
    return false;
  }
}

export default function UtmLink({ href, forceUtm, ...rest }: UtmLinkProps) {
  // manter hook caso queira decisões futuras baseadas nas UTMs
  useUtm(); // garante persistência e leitura (efeito colateral idempotente)

  const hrefWithUtm = useMemo(() => {
    const base = typeof href === 'string' ? href : href.toString();
    const shouldAttach = typeof forceUtm === 'boolean' ? forceUtm : isRelativeOrSameOrigin(base);
    if (!shouldAttach) return base;
    // <<< FIX: appendUtmToUrl aceita só 1 argumento
    return appendUtmToUrl(base);
  }, [href, forceUtm]);

  return <Link href={hrefWithUtm} {...rest} />;
}
