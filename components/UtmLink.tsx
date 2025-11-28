// components/UtmLink.tsx
'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import React, { useMemo } from 'react';
import { appendUtmToUrl, useUtm, type Utm } from '@/lib/utm';

type LinkBaseProps = ComponentProps<typeof Link>;

type Props = Omit<LinkBaseProps, 'href'> & {
  href: string;
  /** força anexar UTM mesmo p/ domínios externos */
  forceUtm?: boolean;
  /** opcional: UTMs custom (senão pega do hook/storage) */
  utmOverride?: Utm;
};

function isRelativeOrSameOrigin(href: string) {
  try {
    const u = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (typeof window === 'undefined') return true;
    return u.origin === window.location.origin;
  } catch {
    return true; // relativo
  }
}

export default function UtmLink({ href, forceUtm, utmOverride, ...rest }: Props) {
  const utm = useUtm();
  const finalHref = useMemo(() => {
    const base = href || '/';
    const shouldAttach = typeof forceUtm === 'boolean' ? forceUtm : isRelativeOrSameOrigin(base);
    if (!shouldAttach) return base;
    // nova assinatura aceita (url, utm) ou (url, { utm })
    return appendUtmToUrl(base, utmOverride ?? utm);
  }, [href, utm, utmOverride, forceUtm]);

  return <Link href={finalHref} {...rest} />;
}
