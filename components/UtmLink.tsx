'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import React from 'react';
import { withUtm, useUtm } from '../src/lib/utm';

// Pega as props reais do <Link> e substitui o href por um tipo explicitamente aceito
type LinkBaseProps = ComponentProps<typeof Link>;

type Props = Omit<LinkBaseProps, 'href'> & {
  href: string | URL | { pathname: string; query?: Record<string, any>; hash?: string };
  forceUtm?: boolean; // mantido caso queira sobrescrever no futuro
};

export default function UtmLink({ href, forceUtm = false, ...rest }: Props) {
  const utm = useUtm();

  const hrefStr = React.useMemo(() => {
    if (typeof href === 'string') return href;

    // URL nativa
    if (href instanceof URL) {
      const qs = href.search ?? '';
      const hash = href.hash ?? '';
      return `${href.pathname}${qs}${hash}`;
    }

    // UrlObject (pathname + query + hash)
    if (href && typeof href === 'object' && 'pathname' in href) {
      const qs = new URLSearchParams(href.query as Record<string, string> | undefined);
      const query = qs.toString();
      const hash = href.hash ? `#${href.hash}` : '';
      return `${href.pathname}${query ? `?${query}` : ''}${hash}`;
    }

    return '/';
  }, [href]);

  const computedHref = React.useMemo(() => {
    if (!utm || Object.keys(utm).length === 0) return hrefStr;
    return withUtm(hrefStr, utm); // adiciona UTMs só se faltarem
  }, [hrefStr, utm, forceUtm]);

  return <Link href={computedHref} {...rest} />;
}
