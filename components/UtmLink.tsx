// components/UtmLink.tsx
'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import React, { useMemo, forwardRef } from 'react';

type LinkBaseProps = ComponentProps<typeof Link>;

export type Utm = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

type Props = Omit<LinkBaseProps, 'href'> & {
  href: string;
  /** força anexar UTM mesmo p/ domínios externos */
  forceUtm?: boolean;
  /** UTM explicitamente passada; se ausente, pega da URL atual */
  utmOverride?: Utm;
};

function getUtmFromLocation(): Utm {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  const get = (k: string) => sp.get(k) ?? undefined;
  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
  };
}

function isRelativeOrSameOrigin(href: string) {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(href, base);
    if (typeof window === 'undefined') return true;
    return u.origin === window.location.origin;
  } catch {
    return true; // trata como relativo
  }
}

function appendUtmToUrl(url: string, utm?: Utm) {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(url, base);
    const src: Utm = utm ?? getUtmFromLocation();
    ([
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ] as const).forEach((k) => {
      const v = src[k];
      if (v) u.searchParams.set(k, v);
    });
    // retorna relativo quando possível (pra não “quebrar” o Link)
    const origin = typeof window !== 'undefined' ? window.location.origin : base;
    return u.origin === origin ? `${u.pathname}${u.search}${u.hash}` : u.toString();
  } catch {
    return url;
  }
}

const UtmLink = forwardRef<HTMLAnchorElement, Props>(function UtmLink(
  { href, forceUtm, utmOverride, ...rest },
  ref
) {
  const finalHref = useMemo(() => {
    const base = href || '/';
    const shouldAttach =
      typeof forceUtm === 'boolean' ? forceUtm : isRelativeOrSameOrigin(base);
    return shouldAttach ? appendUtmToUrl(base, utmOverride ?? getUtmFromLocation()) : base;
  }, [href, forceUtm, utmOverride]);

  return <Link ref={ref} href={finalHref} {...rest} />;
});

export default UtmLink;
